import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, Send, Loader2, Bot } from "lucide-react";
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

interface FieldDef {
  id: string;
  name: string;
  required?: boolean;
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
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiReplying, setAiReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!leadId) return;
    Promise.all([
      api.getConversation(companyId, leadId),
      api.getFields(companyId),
    ])
      .then(([convo, fieldsRes]) => {
        setData(convo);
        setFields(Array.isArray(fieldsRes) ? fieldsRes : fieldsRes?.data || fieldsRes?.fields || []);
      })
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
      const updated = await api.sendMessage(companyId, leadId, { role: "user", content });
      setData(updated);
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const handleAiReply = async () => {
    if (!leadId || aiReplying) return;
    setAiReplying(true);
    try {
      const updated = await api.aiReply(companyId, leadId);
      setData(updated);
    } catch {
      toast({ title: "Error", description: "Failed to get AI reply", variant: "destructive" });
    } finally {
      setAiReplying(false);
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

  const requiredFields = fields.filter((f) => f.required);
  const missingFields = requiredFields.filter((f) => {
    const val = parsedFields[f.name];
    return val === undefined || val === null || val === "";
  });

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
        <span className="text-xs font-mono text-muted-foreground">Step {currentStep}</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-4 pt-4 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <div className="industrial-card p-8 text-center text-muted-foreground">
                No messages yet. Send the first message below.
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
                placeholder="Type a message… (Enter to send)"
                rows={2}
                className="industrial-input flex-1 resize-none font-sans"
                disabled={sending}
              />
              <div className="flex flex-col gap-1 self-end">
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="industrial-btn-primary h-[25px] px-4"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
                <button
                  onClick={handleAiReply}
                  disabled={aiReplying}
                  className="industrial-btn-accent h-[25px] px-4"
                >
                  {aiReplying ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  <span className="text-xs ml-1">AI Reply</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Captured Fields */}
        <aside className="hidden md:block w-64 shrink-0 overflow-y-auto">
          <div className="industrial-card p-4 space-y-4">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Captured Fields
              </h3>
              {Object.keys(parsedFields).length === 0 ? (
                <p className="text-xs text-muted-foreground">No fields captured yet</p>
              ) : (
                <dl className="space-y-2">
                  {Object.entries(parsedFields).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k}</dt>
                      <dd className="text-sm font-medium">{String(v ?? "—")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {missingFields.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-destructive mb-2">
                  Missing Required Fields
                </h3>
                <ul className="space-y-1">
                  {missingFields.map((f) => (
                    <li key={f.id} className="text-xs font-mono text-destructive/80">• {f.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile fields */}
      <div className="md:hidden mt-3 shrink-0">
        {(Object.keys(parsedFields).length > 0 || missingFields.length > 0) && (
          <details className="industrial-card p-3">
            <summary className="text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer">
              Captured Fields ({Object.keys(parsedFields).length})
              {missingFields.length > 0 && ` · ${missingFields.length} missing`}
            </summary>
            <dl className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(parsedFields).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-mono uppercase text-muted-foreground">{k}</dt>
                  <dd className="text-sm font-medium">{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
            {missingFields.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-[10px] font-mono uppercase text-destructive mb-1">Missing required</p>
                {missingFields.map((f) => (
                  <span key={f.id} className="text-xs font-mono text-destructive/80 mr-2">• {f.name}</span>
                ))}
              </div>
            )}
          </details>
        )}
      </div>
    </div>
  );
};

export default Conversation;
