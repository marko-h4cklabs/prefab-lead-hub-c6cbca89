import { useEffect, useState, useRef, useCallback } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, Loader2, Mic, Image, RefreshCw, Send } from "lucide-react";
import CopilotSuggestionCard from "./CopilotSuggestionCard";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: string;
  content: string;
  timestamp?: string;
  type?: "text" | "voice" | "image" | "audio";
  is_voice?: boolean;
  audio_url?: string;
}

interface Suggestion {
  id: string;
  suggestionRowId?: string; // the actual DB row id for API calls
  message: string;
  text?: string;
  label?: string;
  index: number;
}

interface SSEMessage {
  leadId: string;
  role: string;
  content: string;
  timestamp: string;
}

interface Props {
  leadId: string;
  conversationId: string;
  leadName: string;
  onBack?: () => void;
  /** Direct SSE message push — append immediately without refetch */
  sseMessage?: SSEMessage | null;
  /** Increment to trigger an immediate suggestion refresh (e.g. from SSE suggestion_ready event) */
  suggestionTrigger?: number;
  /** When SSE is connected, use longer polling interval */
  sseConnected?: boolean;
}

const POLL_INTERVAL = 5_000;
const POLL_INTERVAL_SSE = 60_000; // Much slower polling when SSE is active — just a safety net

/** Remove consecutive duplicate messages (same role + content) */
const dedup = (msgs: Message[]): Message[] => {
  if (msgs.length <= 1) return msgs;
  const out: Message[] = [msgs[0]];
  for (let i = 1; i < msgs.length; i++) {
    const prev = out[out.length - 1];
    if (prev.role === msgs[i].role && prev.content === msgs[i].content) continue;
    out.push(msgs[i]);
  }
  return out;
};

const formatTime = (ts?: string) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date}, ${time}`;
};

const CopilotChat = ({ leadId, conversationId, leadName, onBack, sseMessage, suggestionTrigger, sseConnected }: Props) => {
  const companyId = requireCompanyId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [regeneratingRef] = useState(() => ({ current: false })); // tracks active regenerate
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Fetch deduplication: prevent concurrent fetches for the same data
  const fetchInFlightRef = useRef(false);
  const fetchQueuedRef = useRef(false);

  // Track the last processed SSE message to avoid re-processing on re-render
  const lastProcessedSSERef = useRef<string | null>(null);

  // Generation counter: incremented on every user message so stale suggestion results are discarded
  const suggestionGenRef = useRef(0);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // --- Fetch conversation messages (with deduplication + smart merge) ---
  const fetchMessages = useCallback(
    async (silent = false) => {
      // If a fetch is already in flight, queue one more (coalesce rapid triggers)
      if (fetchInFlightRef.current) {
        fetchQueuedRef.current = true;
        return;
      }
      fetchInFlightRef.current = true;
      if (!silent) setLoadingMessages(true);
      try {
        const convo = await api.getConversation(companyId, leadId);
        const serverMsgs: Message[] = dedup(Array.isArray(convo?.messages) ? convo.messages : []);
        // Smart merge: only accept server data if it has at least as many messages
        // as current state. This prevents wiping optimistic/SSE-pushed messages
        // when the server is slightly behind.
        setMessages((prev) => {
          if (!silent || serverMsgs.length >= prev.length) {
            return serverMsgs;
          }
          // Server is behind — keep current state
          return prev;
        });
      } catch {
        if (!silent)
          toast({ title: "Failed to load conversation", variant: "destructive" });
      } finally {
        if (!silent) setLoadingMessages(false);
        fetchInFlightRef.current = false;
        // If another fetch was requested while we were in flight, do one more
        if (fetchQueuedRef.current) {
          fetchQueuedRef.current = false;
          fetchMessages(true);
        }
      }
    },
    [companyId, leadId],
  );

  // --- Fetch suggestions ---
  const fetchSuggestions = useCallback(async (forceRegenerate = false) => {
    // If a regeneration is in-flight and this is an SSE-triggered fetch, skip to avoid duplicates
    if (!forceRegenerate && regeneratingRef.current) return;

    setLoadingSuggestions(true);
    if (forceRegenerate) regeneratingRef.current = true;

    // Capture generation at call time — if a newer generation starts before
    // we finish, discard these results so we don't show stale suggestions.
    const gen = suggestionGenRef.current;

    const mapSuggestions = (items: any[], rowId: string) =>
      items.slice(0, 3).map((s: any, i: number) => ({ ...s, id: `${rowId}-${s.index ?? i}`, suggestionRowId: rowId, index: s.index ?? i }));

    if (!forceRegenerate) {
      try {
        // Try existing suggestions first
        const latest = await api.getLatestSuggestions(leadId);
        const items = Array.isArray(latest?.suggestions) ? latest.suggestions : [];
        const rowId = latest?.suggestion_id || latest?.id;
        if (items.length > 0 && rowId) {
          if (gen === suggestionGenRef.current) {
            setSuggestions(mapSuggestions(items, rowId));
          }
          setLoadingSuggestions(false);
          return;
        }
      } catch {
        /* no existing suggestions */
      }
    }

    // Generate new ones
    try {
      const res = await api.generateSuggestions(conversationId);
      if (gen !== suggestionGenRef.current) return; // stale — discard
      const items = Array.isArray(res?.suggestions) ? res.suggestions : [];
      let rowId = res?.suggestion_id || res?.id;
      if (!rowId) {
        try {
          const latest = await api.getLatestSuggestions(leadId);
          rowId = latest?.suggestion_id || latest?.id;
        } catch { /* ok */ }
      }
      if (gen === suggestionGenRef.current) {
        setSuggestions(mapSuggestions(items, rowId || "gen"));
      }
    } catch {
      // silent fail
    } finally {
      if (gen === suggestionGenRef.current) {
        setLoadingSuggestions(false);
      }
      regeneratingRef.current = false;
    }
  }, [leadId, conversationId]);

  // --- Initial load ---
  useEffect(() => {
    fetchMessages();
    fetchSuggestions();
  }, [leadId, conversationId]);

  // --- Poll for new messages (safety net) ---
  useEffect(() => {
    const interval = sseConnected ? POLL_INTERVAL_SSE : POLL_INTERVAL;
    pollRef.current = setInterval(() => fetchMessages(true), interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, sseConnected]);

  // --- SSE-pushed message: append instantly without refetch ---
  useEffect(() => {
    if (!sseMessage || sseMessage.leadId !== leadId) return;

    // Deduplicate: don't process the same SSE message twice
    const msgKey = `${sseMessage.role}:${sseMessage.content}:${sseMessage.timestamp}`;
    if (lastProcessedSSERef.current === msgKey) return;
    lastProcessedSSERef.current = msgKey;

    const newMsg: Message = {
      role: sseMessage.role,
      content: sseMessage.content,
      timestamp: sseMessage.timestamp,
    };

    setMessages((prev) => {
      // Dedup: skip if any of the last 3 messages has same content + role
      // (prevents double from optimistic + SSE + polling overlap)
      const tail = prev.slice(-3);
      if (tail.some((m) => m.role === newMsg.role && m.content === newMsg.content)) {
        return prev;
      }
      return [...prev, newMsg];
    });

    // When a new user (lead) message arrives, invalidate old suggestions and regenerate
    if (sseMessage.role === "user") {
      suggestionGenRef.current += 1;
      setSuggestions([]);
      fetchSuggestions(true);
    }
    // No reconciliation fetch — the 60s polling safety net handles canonical sync.
  }, [sseMessage, leadId]);

  // SSE suggestion trigger
  useEffect(() => {
    if (suggestionTrigger && suggestionTrigger > 0) {
      fetchSuggestions();
    }
  }, [suggestionTrigger]);

  // --- Auto-scroll on new messages ---
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is in an input / textarea / contentEditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Skip when a suggestion card is being edited
      if (isEditing) return;

      // 1, 2, 3 -> quick-send suggestion
      if (["1", "2", "3"].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (suggestions[idx] && sendingIndex === null) {
          e.preventDefault();
          const text = suggestions[idx].text || suggestions[idx].message || "";
          handleSendSuggestion(idx, text, false);
        }
        return;
      }

      // r -> regenerate (force new suggestions)
      if (e.key === "r" || e.key === "R") {
        if (!loadingSuggestions) {
          e.preventDefault();
          suggestionGenRef.current += 1;
          setSuggestions([]);
          fetchSuggestions(true);
        }
        return;
      }

      // Escape -> back
      if (e.key === "Escape") {
        e.preventDefault();
        onBack?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [suggestions, sendingIndex, loadingSuggestions, isEditing, onBack]);

  // --- Send a suggestion (original or edited) ---
  const handleSendSuggestion = async (
    index: number,
    text: string,
    isEditedMsg: boolean,
  ) => {
    const s = suggestions[index];
    if (!s) return;
    setSendingIndex(index);
    const rowId = s.suggestionRowId || s.id;
    try {
      if (isEditedMsg) {
        await api.sendEditedSuggestion(conversationId, rowId, text);
      } else {
        await api.sendSuggestion(conversationId, rowId, s.index);
      }
      // Optimistically add to messages
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text, timestamp: new Date().toISOString() },
      ]);
      setSuggestions([]);
      // Auto-regenerate after a short delay
      setTimeout(() => fetchSuggestions(), 500);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingIndex(null);
    }
  };

  // --- Send custom message ---
  const handleCustomSend = async () => {
    const text = customDraft.trim();
    if (!text) return;
    setSendingCustom(true);
    try {
      // Use the first suggestion's row ID if available, or generate+send
      if (suggestions.length > 0) {
        const rowId = suggestions[0].suggestionRowId || suggestions[0].id;
        await api.sendEditedSuggestion(conversationId, rowId, text);
      } else {
        // Generate then send edited
        const res = await api.generateSuggestions(conversationId);
        const rowId = res?.suggestion_id || res?.id;
        if (rowId) {
          await api.sendEditedSuggestion(conversationId, rowId, text);
        }
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text, timestamp: new Date().toISOString() },
      ]);
      setCustomDraft("");
      setSuggestions([]);
      setTimeout(() => fetchSuggestions(), 500);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingCustom(false);
    }
  };

  // Track editing state from child suggestion cards
  const handleEditingChange = (editing: boolean) => {
    setIsEditing(editing);
  };

  // --- Message type icon ---
  const MessageTypeIcon = ({ type }: { type?: string }) => {
    if (type === "voice" || type === "audio") return <Mic size={10} className="shrink-0 opacity-60" />;
    if (type === "image") return <Image size={10} className="shrink-0 opacity-60" />;
    return null;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* ---- Header ---- */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-[hsl(0_0%_4%)] flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{leadName}</h3>
          <span className="text-[10px] text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
        </div>
        {!loadingSuggestions && suggestions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-success/20 text-success border border-success/30">
            AI Ready
          </span>
        )}
      </div>

      {/* ---- Messages ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {loadingMessages && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!loadingMessages &&
          messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={i}
                className={`flex ${isUser ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${
                    isUser
                      ? "bg-secondary text-foreground rounded-tl-sm"
                      : "bg-primary/15 text-foreground rounded-tr-sm"
                  }`}
                >
                  {(msg.type === "voice" || msg.type === "audio" || msg.is_voice) && (
                    <div className="flex items-center gap-1 mb-1">
                      <MessageTypeIcon type="voice" />
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        voice message
                      </span>
                    </div>
                  )}
                  {(msg.type === "voice" || msg.type === "audio" || msg.is_voice) && msg.audio_url ? (
                    <div className="space-y-1.5">
                      <audio
                        controls
                        preload="metadata"
                        className="w-full max-w-[280px] h-8 [&::-webkit-media-controls-panel]:bg-secondary"
                      >
                        <source src={msg.audio_url} />
                      </audio>
                      {msg.content && (
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                          {msg.content}
                        </p>
                      )}
                    </div>
                  ) : msg.type === "image" ? (
                    <>
                      {msg.type && (
                        <div className="flex items-center gap-1 mb-1">
                          <MessageTypeIcon type={msg.type} />
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            {msg.type}
                          </span>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  )}
                  {msg.timestamp && (
                    <p
                      className={`text-[10px] mt-1 ${
                        isUser ? "text-muted-foreground" : "text-primary/60"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        <div ref={messagesEndRef} />
      </div>

      {/* ---- Suggestions panel ---- */}
      <div className="shrink-0 border-t border-border bg-[hsl(0_0%_6%)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">AI Suggestions</span>
          <button
            onClick={() => {
              suggestionGenRef.current += 1;
              setSuggestions([]);
              fetchSuggestions(true);
            }}
            disabled={loadingSuggestions}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} className={loadingSuggestions ? "animate-spin" : ""} />
            Regenerate
          </button>
        </div>

        {/* Skeleton loading */}
        {loadingSuggestions && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-3 animate-pulse"
              >
                <div className="h-4 bg-secondary rounded w-16 mb-2" />
                <div className="h-3 bg-secondary rounded w-full" />
                <div className="h-3 bg-secondary rounded w-3/4 mt-1" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center">
              AI is generating suggestions...
            </p>
          </div>
        )}

        {/* Suggestion cards */}
        {!loadingSuggestions &&
          suggestions.map((s, i) => (
            <CopilotSuggestionCard
              key={s.id || i}
              suggestion={s}
              labelIndex={i}
              sending={sendingIndex === i}
              onSend={(text, isEditedMsg) => handleSendSuggestion(i, text, isEditedMsg)}
              shortcutKey={i + 1}
            />
          ))}

        {/* Keyboard shortcut hint */}
        {!loadingSuggestions && suggestions.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">1</kbd>-
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">3</kbd> to quick-send,{" "}
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">R</kbd> to regenerate
          </p>
        )}

        {/* Custom message input */}
        {!loadingSuggestions && (
          <>
            <div className="border-t border-border" />
            <div className="flex gap-2">
              <input
                ref={customInputRef}
                type="text"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSend();
                }}
                placeholder="Or type a custom message..."
                className="dark-input flex-1 text-sm"
                disabled={sendingCustom}
              />
              <button
                onClick={handleCustomSend}
                disabled={!customDraft.trim() || sendingCustom}
                className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
              >
                {sendingCustom ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CopilotChat;
