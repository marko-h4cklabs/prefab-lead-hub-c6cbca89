import { useEffect, useState, useRef, useCallback } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Loader2, RefreshCw, Send } from "lucide-react";
import CopilotSuggestionCard from "./CopilotSuggestionCard";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: string;
  content: string;
  timestamp?: string;
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
}

const POLL_INTERVAL = 5_000;

const formatTime = (ts?: string) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const CopilotChat = ({ leadId, conversationId, leadName }: Props) => {
  const companyId = requireCompanyId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCountRef = useRef(0);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // Fetch conversation messages
  const fetchMessages = useCallback(async (silent = false) => {
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
      if (!silent) toast({ title: "Failed to load conversation", variant: "destructive" });
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [companyId, leadId]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      // Try existing suggestions first
      const latest = await api.getLatestSuggestions(leadId);
      const items = Array.isArray(latest?.suggestions) ? latest.suggestions : [];
      if (items.length > 0) {
        setSuggestions(items.slice(0, 3).map((s: any, i: number) => ({ ...s, index: s.index ?? i })));
        setLoadingSuggestions(false);
        return;
      }
    } catch { /* no existing suggestions */ }

    // Generate new ones
    try {
      const res = await api.generateSuggestions(conversationId);
      const items = Array.isArray(res?.suggestions) ? res.suggestions : [];
      setSuggestions(items.slice(0, 3).map((s: any, i: number) => ({ ...s, index: s.index ?? i })));
    } catch {
      // silent fail
    } finally {
      setLoadingSuggestions(false);
    }
  }, [leadId, conversationId]);

  // Initial load
  useEffect(() => {
    prevCountRef.current = 0;
    fetchMessages();
    fetchSuggestions();
  }, [leadId, conversationId]);

  // Poll for new messages
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Send a suggestion (original or edited)
  const handleSendSuggestion = async (index: number, text: string, isEdited: boolean) => {
    const s = suggestions[index];
    if (!s) return;
    setSendingIndex(index);
    try {
      if (isEdited) {
        await api.sendEditedSuggestion(conversationId, s.id, text);
      } else {
        await api.sendSuggestion(conversationId, s.id, s.index);
      }
      // Optimistically add to messages
      setMessages((prev) => [...prev, { role: "assistant", content: text, timestamp: new Date().toISOString() }]);
      setSuggestions([]);
      // Auto-regenerate after a short delay
      setTimeout(() => fetchSuggestions(), 500);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingIndex(null);
    }
  };

  // Send custom message
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
      setMessages((prev) => [...prev, { role: "assistant", content: text, timestamp: new Date().toISOString() }]);
      setCustomDraft("");
      setSuggestions([]);
      setTimeout(() => fetchSuggestions(), 500);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingCustom(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-[hsl(0_0%_4%)] flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{leadName}</h3>
        <span className="text-[10px] text-muted-foreground">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {loadingMessages && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!loadingMessages && messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${
                isUser
                  ? "bg-secondary text-foreground rounded-tl-sm"
                  : "bg-primary/15 text-foreground rounded-tr-sm"
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.timestamp && (
                  <p className={`text-[10px] mt-1 ${isUser ? "text-muted-foreground" : "text-primary/60"}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div className="shrink-0 border-t border-border bg-[hsl(0_0%_6%)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">AI Suggestions</span>
          <button
            onClick={() => { setSuggestions([]); fetchSuggestions(); }}
            disabled={loadingSuggestions}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
        </div>

        {loadingSuggestions && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 animate-pulse">
                <div className="h-4 bg-secondary rounded w-16 mb-2" />
                <div className="h-3 bg-secondary rounded w-full" />
                <div className="h-3 bg-secondary rounded w-3/4 mt-1" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center">AI is generating suggestions...</p>
          </div>
        )}

        {!loadingSuggestions && suggestions.map((s, i) => (
          <CopilotSuggestionCard
            key={s.id || i}
            suggestion={s}
            labelIndex={i}
            sending={sendingIndex === i}
            onSend={(text, isEdited) => handleSendSuggestion(i, text, isEdited)}
          />
        ))}

        {/* Custom message input */}
        {!loadingSuggestions && (
          <>
            <div className="border-t border-border" />
            <div className="flex gap-2">
              <input
                type="text"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCustomSend(); }}
                placeholder="Or type a custom message..."
                className="dark-input flex-1 text-sm"
                disabled={sendingCustom}
              />
              <button
                onClick={handleCustomSend}
                disabled={!customDraft.trim() || sendingCustom}
                className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
              >
                {sendingCustom ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CopilotChat;
