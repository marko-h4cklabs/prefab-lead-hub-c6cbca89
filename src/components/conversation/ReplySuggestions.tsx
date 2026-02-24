import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, RefreshCw, Send } from "lucide-react";

interface Suggestion {
  id: string;
  message: string;
  label?: string;
}

const LABELS = [
  { name: "Direct", bg: "bg-info", text: "text-info-foreground" },
  { name: "Empathetic", bg: "bg-success", text: "text-success-foreground" },
  { name: "Strategic", bg: "bg-primary", text: "text-primary-foreground" },
];

interface Props {
  leadId: string;
  conversationId: string | null;
  onMessageSent: (content: string) => void;
  lastMessageCount: number;
}

const ReplySuggestions = ({ leadId, conversationId, onMessageSent, lastMessageCount }: Props) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);

  const fetchOrGenerate = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError("");
    try {
      const latest = await api.getLatestSuggestions(leadId);
      const items = Array.isArray(latest?.suggestions) ? latest.suggestions : [];
      if (items.length > 0) {
        setSuggestions(items.slice(0, 3));
        setLoading(false);
        return;
      }
    } catch { /* no existing suggestions */ }

    try {
      const res = await api.generateSuggestions(conversationId);
      const items = Array.isArray(res?.suggestions) ? res.suggestions : [];
      setSuggestions(items.slice(0, 3));
    } catch {
      setError("Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }, [leadId, conversationId]);

  useEffect(() => {
    fetchOrGenerate();
  }, [fetchOrGenerate, lastMessageCount]);

  const handleSend = async (index: number) => {
    const s = suggestions[index];
    if (!s || !conversationId) return;
    setSendingIndex(index);
    setError("");
    try {
      await api.sendSuggestion(conversationId, s.id, index);
      onMessageSent(s.message);
      setSuggestions([]);
      // Auto-regenerate
      setTimeout(() => fetchOrGenerate(), 500);
    } catch {
      setError("Failed to send suggestion");
    } finally {
      setSendingIndex(null);
    }
  };

  const handleRegenerate = () => {
    setSuggestions([]);
    fetchOrGenerate();
  };

  const handleCustomSend = async () => {
    const text = customDraft.trim();
    if (!text) return;
    setSendingCustom(true);
    try {
      onMessageSent(text);
      setCustomDraft("");
    } finally {
      setSendingCustom(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-[hsl(0_0%_6%)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">AI Suggestions</span>
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={12} /> Regenerate
        </button>
      </div>

      {/* Loading state */}
      {loading && (
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

      {/* Suggestion cards */}
      {!loading && suggestions.map((s, i) => {
        const label = LABELS[i] || LABELS[0];
        return (
          <div key={s.id || i} className="bg-card border border-border rounded-lg px-4 py-3 transition-opacity">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${label.bg} ${label.text}`}>
                {label.name}
              </span>
              <button
                onClick={() => handleSend(i)}
                disabled={sendingIndex !== null}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sendingIndex === i ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Send
              </button>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{s.message}</p>
          </div>
        );
      })}

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      {/* Custom message fallback */}
      {!loading && (
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
              className="dark-btn-primary h-9 px-3"
            >
              {sendingCustom ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ReplySuggestions;
