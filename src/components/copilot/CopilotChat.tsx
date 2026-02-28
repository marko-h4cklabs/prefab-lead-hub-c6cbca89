import { useEffect, useState, useRef, useCallback } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, Loader2, Mic, Image, RefreshCw, Send } from "lucide-react";
import CopilotSuggestionCard from "./CopilotSuggestionCard";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: string;
  content: string;
  timestamp?: string;
  type?: "text" | "voice" | "image";
}

interface Suggestion {
  id: string;
  message: string;
  text?: string;
  label?: string;
  index: number;
}

interface Props {
  leadId: string;
  conversationId: string;
  leadName: string;
  onBack?: () => void;
}

const POLL_INTERVAL = 5_000;

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

const CopilotChat = ({ leadId, conversationId, leadName, onBack }: Props) => {
  const companyId = requireCompanyId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCountRef = useRef(0);
  const customInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // --- Fetch conversation messages ---
  const fetchMessages = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const convo = await api.getConversation(companyId, leadId);
        const msgs = Array.isArray(convo?.messages) ? convo.messages : [];
        setMessages(msgs);
        // If new messages arrived, auto-fetch suggestions
        if (msgs.length > prevCountRef.current && msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last.role === "user") {
            fetchSuggestions();
          }
        }
        prevCountRef.current = msgs.length;
      } catch {
        if (!silent)
          toast({ title: "Failed to load conversation", variant: "destructive" });
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [companyId, leadId],
  );

  // --- Fetch suggestions ---
  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      // Try existing suggestions first
      const latest = await api.getLatestSuggestions(leadId);
      const items = Array.isArray(latest?.suggestions) ? latest.suggestions : [];
      if (items.length > 0) {
        setSuggestions(
          items.slice(0, 3).map((s: any, i: number) => ({ ...s, index: s.index ?? i })),
        );
        setLoadingSuggestions(false);
        return;
      }
    } catch {
      /* no existing suggestions */
    }

    // Generate new ones
    try {
      const res = await api.generateSuggestions(conversationId);
      const items = Array.isArray(res?.suggestions) ? res.suggestions : [];
      setSuggestions(
        items.slice(0, 3).map((s: any, i: number) => ({ ...s, index: s.index ?? i })),
      );
    } catch {
      // silent fail
    } finally {
      setLoadingSuggestions(false);
    }
  }, [leadId, conversationId]);

  // --- Initial load ---
  useEffect(() => {
    prevCountRef.current = 0;
    fetchMessages();
    fetchSuggestions();
  }, [leadId, conversationId]);

  // --- Poll for new messages ---
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(true), POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

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

      // r -> regenerate
      if (e.key === "r" || e.key === "R") {
        if (!loadingSuggestions) {
          e.preventDefault();
          setSuggestions([]);
          fetchSuggestions();
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
    try {
      if (isEditedMsg) {
        await api.sendEditedSuggestion(conversationId, s.id, text);
      } else {
        await api.sendSuggestion(conversationId, s.id, s.index);
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
      // Use the first suggestion's ID if available, or generate+send
      if (suggestions.length > 0) {
        await api.sendEditedSuggestion(conversationId, suggestions[0].id, text);
      } else {
        // Generate then send edited
        const res = await api.generateSuggestions(conversationId);
        const items = Array.isArray(res?.suggestions) ? res.suggestions : [];
        if (items.length > 0) {
          await api.sendEditedSuggestion(conversationId, items[0].id, text);
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
    if (type === "voice") return <Mic size={10} className="shrink-0 opacity-60" />;
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
                  {msg.type && msg.type !== "text" && (
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
              setSuggestions([]);
              fetchSuggestions();
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
