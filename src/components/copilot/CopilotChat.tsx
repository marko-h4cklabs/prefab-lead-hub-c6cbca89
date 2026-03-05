import { useEffect, useState, useRef, useCallback } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, Loader2, Mic, Image, RefreshCw, Send, FileText, X, Volume2 } from "lucide-react";
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
  /** Queue of SSE messages — processed in order so rapid events are never lost */
  sseMessageQueue?: SSEMessage[];
  /** Callback to clear the queue after processing */
  onSSEMessagesProcessed?: () => void;
  /** Increment to trigger an immediate suggestion refresh (e.g. from SSE suggestion_ready event) */
  suggestionTrigger?: number;
  /** When SSE is connected, use longer polling interval */
  sseConnected?: boolean;
}

const POLL_INTERVAL = 5_000;
const POLL_INTERVAL_SSE = 2_000; // Fast polling even when SSE is active

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

const CopilotChat = ({ leadId, conversationId, leadName, onBack, sseMessageQueue, onSSEMessagesProcessed, suggestionTrigger, sseConnected }: Props) => {
  const companyId = requireCompanyId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [regeneratingRef] = useState(() => ({ current: false })); // tracks active regenerate
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const sendingRef = useRef(false); // ref-based guard — updates instantly unlike state
  const [customDraft, setCustomDraft] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Template panel state
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [tplList, setTplList] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [loadingTpls, setLoadingTpls] = useState(false);
  const [tplEditId, setTplEditId] = useState<string | null>(null);
  const [tplEditText, setTplEditText] = useState("");
  const [sendingTpl, setSendingTpl] = useState(false);
  // Voice note panel state
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceAudioBase64, setVoiceAudioBase64] = useState<string | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceAmbientNoise, setVoiceAmbientNoise] = useState<string | null | undefined>(undefined); // undefined = company default, null = none, string = specific
  const [voiceHumanize, setVoiceHumanize] = useState(true);
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
  // Fallback timer: if backend's suggestion_ready SSE doesn't arrive within 12s, generate locally
  const suggestionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reconciliation timer: after SSE messages, refetch full conversation from DB to catch any gaps
  const reconcileRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const mapSuggestions = useCallback((items: any[], rowId: string) =>
    items.slice(0, 3).map((s: any, i: number) => ({ ...s, id: `${rowId}-${s.index ?? i}`, suggestionRowId: rowId, index: s.index ?? i })), []);

  // --- Load existing suggestions only (no generation) ---
  const loadExistingSuggestions = useCallback(async () => {
    const gen = suggestionGenRef.current;
    try {
      const latest = await api.getLatestSuggestions(leadId);
      const items = Array.isArray(latest?.suggestions) ? latest.suggestions : [];
      const rowId = latest?.suggestion_id || latest?.id;
      if (items.length > 0 && rowId && gen === suggestionGenRef.current) {
        setSuggestions(mapSuggestions(items, rowId));
        setLoadingSuggestions(false);
      }
    } catch { /* silent */ }
  }, [leadId, mapSuggestions]);

  // --- Load copilot template messages ---
  const loadTemplates = useCallback(async () => {
    setLoadingTpls(true);
    try {
      const res = await api.getCopilotTemplates();
      setTplList(res.templates ?? []);
    } catch { /* silent */ }
    finally { setLoadingTpls(false); }
  }, []);

  // --- Fetch suggestions (may generate if none exist) ---
  const fetchSuggestions = useCallback(async (forceRegenerate = false) => {
    // If a regeneration is already in-flight, skip non-force calls
    if (!forceRegenerate && regeneratingRef.current) return;

    setLoadingSuggestions(true);
    if (forceRegenerate) regeneratingRef.current = true;

    const gen = suggestionGenRef.current;

    // Try existing suggestions first (skip when force-regenerating)
    if (!forceRegenerate) {
      try {
        const latest = await api.getLatestSuggestions(leadId);
        const items = Array.isArray(latest?.suggestions) ? latest.suggestions : [];
        const rowId = latest?.suggestion_id || latest?.id;
        if (items.length > 0 && rowId) {
          if (gen === suggestionGenRef.current) {
            setSuggestions(mapSuggestions(items, rowId));
          }
          setLoadingSuggestions(false);
          regeneratingRef.current = false;
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
  }, [leadId, conversationId, mapSuggestions]);

  // --- Initial load ---
  useEffect(() => {
    fetchMessages();
    // Load existing suggestions only — don't auto-generate (saves Claude API credits).
    // Setter clicks "Generate" button to get suggestions on demand.
    loadExistingSuggestions();
  }, [leadId, conversationId]);

  // --- Poll for new messages (safety net) ---
  useEffect(() => {
    const interval = sseConnected ? POLL_INTERVAL_SSE : POLL_INTERVAL;
    pollRef.current = setInterval(() => fetchMessages(true), interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, sseConnected]);

  // --- SSE-pushed messages: process entire queue so rapid events are never lost ---
  useEffect(() => {
    if (!sseMessageQueue || sseMessageQueue.length === 0) return;

    let hasNewUserMessage = false;

    for (const msg of sseMessageQueue) {
      if (msg.leadId !== leadId) continue;

      // Deduplicate: don't process the same SSE message twice
      const msgKey = `${msg.role}:${msg.content}:${msg.timestamp}`;
      if (lastProcessedSSERef.current === msgKey) continue;
      lastProcessedSSERef.current = msgKey;

      const newMsg: Message = {
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      };

      setMessages((prev) => {
        const tail = prev.slice(-10);
        if (tail.some((m) => m.role === newMsg.role && m.content === newMsg.content)) {
          return prev;
        }
        return [...prev, newMsg];
      });

      if (msg.role === "user") hasNewUserMessage = true;
    }

    // Clear the queue after processing all messages
    onSSEMessagesProcessed?.();

    // Quick reconciliation: refetch full conversation from DB 1s after the last SSE batch.
    // Catches any messages that were stored in DB but whose SSE event was lost.
    if (reconcileRef.current) clearTimeout(reconcileRef.current);
    reconcileRef.current = setTimeout(() => fetchMessages(true), 1000);

    // When any new user (lead) message arrived, invalidate old suggestions.
    // Don't auto-generate — wait for manual "Generate" click.
    if (hasNewUserMessage) {
      suggestionGenRef.current += 1;
      setSuggestions([]);
      setLoadingSuggestions(false);
    }
  }, [sseMessageQueue, leadId]);

  // SSE suggestion_ready trigger — cancel fallback timer and load pre-generated suggestions
  useEffect(() => {
    if (suggestionTrigger && suggestionTrigger > 0) {
      if (suggestionFallbackRef.current) {
        clearTimeout(suggestionFallbackRef.current);
        suggestionFallbackRef.current = null;
      }
      loadExistingSuggestions();
    }
  }, [suggestionTrigger, loadExistingSuggestions]);

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
    if (!s || sendingRef.current) return;
    sendingRef.current = true;
    setSendingIndex(index);
    const rowId = s.suggestionRowId || s.id;
    try {
      if (isEditedMsg) {
        await api.sendEditedSuggestion(conversationId, rowId, text);
      } else {
        await api.sendSuggestion(conversationId, rowId, s.index);
      }
      // Optimistically add to messages (skip if SSE already pushed it)
      setMessages((prev) => {
        const tail = prev.slice(-5);
        if (tail.some((m) => m.role === "assistant" && m.content === text)) return prev;
        return [...prev, { role: "assistant", content: text, timestamp: new Date().toISOString() }];
      });
      setSuggestions([]);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingIndex(null);
      sendingRef.current = false;
    }
  };

  // --- Send custom message ---
  const handleCustomSend = async () => {
    const text = customDraft.trim();
    if (!text) return;
    setSendingCustom(true);
    try {
      // Get a suggestion row ID to send through (endpoint handles stale/used IDs gracefully)
      let rowId: string | null = null;
      if (suggestions.length > 0) {
        rowId = suggestions[0].suggestionRowId || suggestions[0].id;
      }
      if (!rowId) {
        // Generate a suggestion row first (needed as a vehicle for custom send)
        const res = await api.generateSuggestions(conversationId);
        rowId = res?.suggestion_id || res?.id;
      }
      if (!rowId) throw new Error("Could not get suggestion context");
      await api.sendEditedSuggestion(conversationId, rowId, text);
      setMessages((prev) => {
        const tail = prev.slice(-5);
        if (tail.some((m) => m.role === "assistant" && m.content === text)) return prev;
        return [...prev, { role: "assistant", content: text, timestamp: new Date().toISOString() }];
      });
      setCustomDraft("");
      setSuggestions([]);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingCustom(false);
    }
  };

  // --- Send a template message directly ---
  const handleTemplateSend = async (text: string) => {
    if (!text.trim()) return;
    setSendingTpl(true);
    try {
      await api.sendDirectMessage(conversationId, text.trim());
      setMessages((prev) => {
        const tail = prev.slice(-5);
        if (tail.some((m) => m.role === "assistant" && m.content === text.trim())) return prev;
        return [...prev, { role: "assistant", content: text.trim(), timestamp: new Date().toISOString() }];
      });
      setShowTemplatePanel(false);
      setTplEditId(null);
      setTplEditText("");
      setSuggestions([]);
    } catch {
      toast({ title: "Failed to send template message", variant: "destructive" });
    } finally {
      setSendingTpl(false);
    }
  };

  // --- Generate voice preview ---
  const handleGenerateVoice = async () => {
    if (!voiceText.trim()) return;
    setGeneratingVoice(true);
    setVoiceAudioBase64(null);
    setVoiceAudioUrl(null);
    try {
      const result = await api.generateVoiceNote(voiceText.trim(), {
        ...(voiceAmbientNoise !== undefined && { ambient_noise: voiceAmbientNoise }),
        humanize: voiceHumanize,
      });
      setVoiceAudioBase64(result.audio_base64);
      setVoiceAudioUrl(`data:${result.content_type || "audio/wav"};base64,${result.audio_base64}`);
    } catch (err: any) {
      const msg = err?.message || "Failed to generate voice note";
      toast({
        title: "Voice generation failed",
        description: msg.includes("No voice selected")
          ? "Configure a voice in Settings > Voice Messages first."
          : msg,
        variant: "destructive",
      });
    } finally {
      setGeneratingVoice(false);
    }
  };

  // --- Send voice note ---
  const handleSendVoice = async () => {
    if (!voiceAudioBase64 || !voiceText.trim()) return;
    setSendingVoice(true);
    try {
      await api.sendVoiceNote(conversationId, voiceAudioBase64, voiceText.trim());
      setMessages((prev) => {
        const content = voiceText.trim();
        const tail = prev.slice(-5);
        if (tail.some((m) => m.role === "assistant" && m.content === content)) return prev;
        return [...prev, { role: "assistant", content, timestamp: new Date().toISOString(), type: "voice" as const, is_voice: true }];
      });
      setShowVoicePanel(false);
      setVoiceText("");
      setVoiceAudioBase64(null);
      setVoiceAudioUrl(null);
      setSuggestions([]);
    } catch {
      toast({ title: "Failed to send voice note", variant: "destructive" });
    } finally {
      setSendingVoice(false);
    }
  };

  // --- Cancel voice panel ---
  const handleCancelVoice = () => {
    setShowVoicePanel(false);
    setVoiceText("");
    setVoiceAudioBase64(null);
    setVoiceAudioUrl(null);
    setGeneratingVoice(false);
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
          {suggestions.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!showTemplatePanel) loadTemplates();
                  setShowTemplatePanel(!showTemplatePanel);
                  setShowVoicePanel(false);
                }}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  showTemplatePanel ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText size={12} />
                Templates
              </button>
              <button
                onClick={() => {
                  setShowVoicePanel(!showVoicePanel);
                  setShowTemplatePanel(false);
                }}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  showVoicePanel ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Volume2 size={12} />
                Voice Note
              </button>
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
          )}
        </div>

        {/* Skeleton loading */}
        {loadingSuggestions && (
          <div className="space-y-2">
            {[0, 1].map((i) => (
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

        {/* Generate + Template buttons — shown when no suggestions and not loading */}
        {!loadingSuggestions && suggestions.length === 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                suggestionGenRef.current += 1;
                fetchSuggestions(true);
              }}
              className="flex-1 py-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              Generate Suggestions
            </button>
            <button
              onClick={() => {
                if (!showTemplatePanel) loadTemplates();
                setShowTemplatePanel(!showTemplatePanel);
                setShowVoicePanel(false);
              }}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                showTemplatePanel
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-dashed border-muted-foreground/40 bg-muted/5 hover:bg-muted/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText size={14} />
              Templates
            </button>
            <button
              onClick={() => {
                setShowVoicePanel(!showVoicePanel);
                setShowTemplatePanel(false);
              }}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                showVoicePanel
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-dashed border-muted-foreground/40 bg-muted/5 hover:bg-muted/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Volume2 size={14} />
              Voice Note
            </button>
          </div>
        )}

        {/* Template panel */}
        {showTemplatePanel && (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
              <span className="text-xs font-semibold text-foreground">Template Messages</span>
              <button
                onClick={() => { setShowTemplatePanel(false); setTplEditId(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[240px] overflow-y-auto divide-y divide-border">
              {loadingTpls && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingTpls && tplList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No templates yet. Create them in Settings &gt; Templates.
                </p>
              )}
              {!loadingTpls && tplList.map((tpl) => (
                <div key={tpl.id} className="px-3 py-2.5 hover:bg-secondary/20 transition-colors">
                  {tplEditId === tpl.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={tplEditText}
                        onChange={(e) => setTplEditText(e.target.value)}
                        className="dark-input w-full text-sm min-h-[60px] resize-y"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => { setTplEditId(null); setTplEditText(""); }}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleTemplateSend(tplEditText)}
                          disabled={!tplEditText.trim() || sendingTpl}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                        >
                          {sendingTpl ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setTplEditId(tpl.id); setTplEditText(tpl.content); }}
                      className="w-full text-left"
                    >
                      <p className="text-xs font-semibold text-foreground">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.content}</p>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice note panel */}
        {showVoicePanel && (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Volume2 size={12} />
                Voice Note
              </span>
              <button
                onClick={handleCancelVoice}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-3 space-y-3">
              <textarea
                value={voiceText}
                onChange={(e) => {
                  setVoiceText(e.target.value);
                  if (voiceAudioBase64) {
                    setVoiceAudioBase64(null);
                    setVoiceAudioUrl(null);
                  }
                }}
                placeholder="Type the message to convert to voice..."
                className="dark-input w-full text-sm min-h-[60px] resize-y"
                disabled={generatingVoice || sendingVoice}
              />

              {/* Voice options row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Noise:</label>
                  <select
                    value={voiceAmbientNoise === undefined ? "default" : voiceAmbientNoise === null ? "none" : voiceAmbientNoise}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVoiceAmbientNoise(v === "default" ? undefined : v === "none" ? null : v);
                    }}
                    className="dark-input text-xs py-1 px-2 rounded"
                    disabled={generatingVoice || sendingVoice}
                  >
                    <option value="default">Default</option>
                    <option value="none">None</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="street">Street</option>
                    <option value="white_noise">White Noise</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceHumanize}
                    onChange={(e) => setVoiceHumanize(e.target.checked)}
                    disabled={generatingVoice || sendingVoice}
                    className="rounded border-border"
                  />
                  Humanize
                </label>
              </div>

              {/* Generate button */}
              {!voiceAudioUrl && (
                <button
                  onClick={handleGenerateVoice}
                  disabled={!voiceText.trim() || generatingVoice}
                  className="w-full py-2 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generatingVoice ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating voice...
                    </>
                  ) : (
                    <>
                      <Mic size={14} />
                      Generate Voice Preview
                    </>
                  )}
                </button>
              )}

              {/* Audio preview + send/re-generate */}
              {voiceAudioUrl && (
                <div className="space-y-2">
                  <audio
                    controls
                    src={voiceAudioUrl}
                    className="w-full h-10"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateVoice}
                      disabled={generatingVoice}
                      className="flex-1 py-2 rounded-md border border-border bg-card hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generatingVoice ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <><RefreshCw size={12} /> Re-generate</>
                      )}
                    </button>
                    <button
                      onClick={handleSendVoice}
                      disabled={sendingVoice}
                      className="flex-1 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {sendingVoice ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          Send Voice Note
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">2</kbd> to quick-send,{" "}
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
