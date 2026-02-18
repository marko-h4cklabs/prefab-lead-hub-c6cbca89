import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: string;
  content: string;
  timestamp?: string;
}

interface ConversationData {
  lead_id: string;
  messages: Message[];
  parsed_fields: Record<string, any>;
  current_step: number;
}

const Conversation = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();

  let companyId: string;
  try {
    companyId = requireCompanyId();
  } catch {
    return null;
  }

  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!leadId) return;
    api.getConversation(companyId, leadId)
      .then((res) => setData(res))
      .catch(() => {
        toast({ title: "Error", description: "Failed to load conversation", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [data?.messages]);

  const handleSend = async () => {
    if (!draft.trim() || !leadId || sending) return;
    const content = draft.trim();
    setSending(true);
    setDraft("");

    try {
      const updated = await api.sendMessage(companyId, leadId, {
        role: "user",
        content,
      });
      setData(updated);
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      setDraft(content); // restore draft on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 size={16} className="animate-spin" /> Loading conversation…
      </div>
    );
  }

  const messages = data?.messages || [];
  const parsedFields = data?.parsed_fields || {};
  const currentStep = data?.current_step ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/leads/${leadId}`)} className="industrial-btn-ghost">
            <ArrowLeft size={16} /> Back to Lead
          </button>
          <h1 className="text-lg font-bold">Conversation</h1>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          Step {currentStep}
        </span>
      </div>

      {/* Body: messages + sidebar */}
      <div className="flex flex-1 gap-4 pt-4 overflow-hidden">
        {/* Messages column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Scrollable message list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <div className="industrial-card p-8 text-center text-muted-foreground">
                No messages yet. Send the first message below.
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-sm px-4 py-3 text-sm ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "industrial-card border-l-2 border-l-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                          {msg.role}
                        </span>
                        {msg.timestamp && (
                          <span className="text-[10px] font-mono opacity-50">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="shrink-0 pt-3 border-t border-border mt-3">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={2}
                className="industrial-input flex-1 resize-none font-sans"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="industrial-btn-primary self-end h-[52px] px-5"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Parsed Fields sidebar */}
        <aside className="hidden md:block w-64 shrink-0 overflow-y-auto">
          <div className="industrial-card p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
              Parsed Fields
            </h3>
            {Object.keys(parsedFields).length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields parsed yet</p>
            ) : (
              <dl className="space-y-2">
                {Object.entries(parsedFields).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="text-sm font-medium">{String(v ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile parsed fields */}
      <div className="md:hidden mt-3 shrink-0">
        {Object.keys(parsedFields).length > 0 && (
          <details className="industrial-card p-3">
            <summary className="text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer">
              Parsed Fields ({Object.keys(parsedFields).length})
            </summary>
            <dl className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(parsedFields).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-mono uppercase text-muted-foreground">{k}</dt>
                  <dd className="text-sm font-medium">{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </div>
  );
};

export default Conversation;
