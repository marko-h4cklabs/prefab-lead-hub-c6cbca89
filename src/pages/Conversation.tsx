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



interface HighlightField {
  name: string;
  type?: string;
  units?: string;
  value?: any;
}

interface HighlightSettings {
  tone?: string;
  persona?: string;
  response_length?: string;
  emojis_enabled?: boolean;
  forbidden_topics?: string[];
}

interface Highlights {
  settings?: HighlightSettings;
  fields?: {
    configured?: HighlightField[];
    missing_required?: HighlightField[];
    collected?: HighlightField[];
  };
  state?: any;
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
  const [aiReplying, setAiReplying] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlights>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!leadId) return;
    api.getConversation(companyId, leadId)
      .then((convo) => setData(convo))
      .catch(() => {
        toast({ title: "Error", description: "Failed to load conversation", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [data?.messages]);

  const applyBackendResponse = (res: any) => {
    if (res?.assistant_message !== undefined) {
      if (res.conversation_id) setConversationId(res.conversation_id);

      // Support multiple response shapes for highlights
      const h: Highlights = res.highlights || {};
      const activeSettings = res.active_settings || h.settings;
      const missingReq = res.missing_required_infos || res.required_infos || res.required || h.fields?.missing_required || [];
      const coll = res.collected_infos || res.collected || h.fields?.collected || [];

      setHighlights({
        settings: activeSettings ? {
          tone: activeSettings.tone,
          persona: activeSettings.persona_style || activeSettings.persona,
          response_length: activeSettings.response_length,
          emojis_enabled: activeSettings.emojis_enabled,
          forbidden_topics: activeSettings.forbidden_topics,
        } : h.settings,
        fields: {
          configured: h.fields?.configured,
          missing_required: missingReq,
          collected: coll,
        },
      });

      setData((prev) => {
        const msgs = prev?.messages || [];
        return {
          ...prev,
          lead_id: prev?.lead_id || leadId || "",
          messages: [...msgs, { role: "assistant", content: res.assistant_message }],
          parsed_fields: prev?.parsed_fields || {},
          current_step: prev?.current_step ?? 0,
        };
      });
    } else {
      setData(res);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || !leadId || sending) return;
    const content = draft.trim();
    setSending(true);
    setDraft("");

    // Optimistically add user message
    setData((prev) => ({
      ...prev,
      lead_id: prev?.lead_id || leadId || "",
      messages: [...(prev?.messages || []), { role: "user", content }],
      parsed_fields: prev?.parsed_fields || {},
      current_step: prev?.current_step ?? 0,
    }));

    try {
      const body: any = { role: "user", content };
      if (conversationId) body.conversation_id = conversationId;
      const res = await api.sendMessage(companyId, leadId, body);
      applyBackendResponse(res);
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      // Remove optimistic user message and restore draft
      setData((prev) => ({
        ...prev,
        lead_id: prev?.lead_id || leadId || "",
        messages: (prev?.messages || []).slice(0, -1),
        parsed_fields: prev?.parsed_fields || {},
        current_step: prev?.current_step ?? 0,
      }));
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const handleAiReply = async () => {
    if (!leadId || aiReplying) return;
    setAiReplying(true);
    try {
      const res = await api.aiReply(companyId, leadId);
      applyBackendResponse(res);
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
  const currentStep = data?.current_step ?? 0;

  const settings = highlights.settings;
  const missingRequired = highlights.fields?.missing_required || [];
  const collected = highlights.fields?.collected || [];

  const HighlightsPanel = () => (
    <div className="space-y-4">
      {/* Active Settings */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Active Settings
        </h3>
        {settings ? (
          <dl className="space-y-1">
            <div className="text-xs font-mono">
              <dt className="text-muted-foreground inline">Tone: </dt>
              <dd className="inline text-foreground font-medium">{settings.tone || "—"}</dd>
            </div>
            <div className="text-xs font-mono">
              <dt className="text-muted-foreground inline">Persona: </dt>
              <dd className="inline text-foreground font-medium">{settings.persona || "—"}</dd>
            </div>
            <div className="text-xs font-mono">
              <dt className="text-muted-foreground inline">Response length: </dt>
              <dd className="inline text-foreground font-medium">{settings.response_length || "—"}</dd>
            </div>
            <div className="text-xs font-mono">
              <dt className="text-muted-foreground inline">Emojis: </dt>
              <dd className="inline text-foreground font-medium">{settings.emojis_enabled ? "Yes" : "No"}</dd>
            </div>
            <div className="text-xs font-mono">
              <dt className="text-muted-foreground inline">Forbidden topics: </dt>
              <dd className="inline text-foreground font-medium">
                {settings.forbidden_topics?.length ? settings.forbidden_topics.join(", ") : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">No settings received yet.</p>
        )}
      </div>

      {/* Missing Required */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Missing Required
        </h3>
        {missingRequired.length === 0 ? (
          <p className="text-xs text-muted-foreground">All required fields collected.</p>
        ) : (
          <ul className="space-y-1">
            {missingRequired.map((item, i) => (
              <li key={i} className="text-xs font-mono">
                <span className="text-foreground">{item.name}</span>
                <span className="text-muted-foreground ml-1">({item.type || "text"}{item.units ? `, ${item.units}` : ""})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Collected */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Collected
        </h3>
        {collected.length === 0 ? (
          <p className="text-xs text-muted-foreground">No fields collected yet.</p>
        ) : (
          <dl className="space-y-1">
            {collected.map((item, i) => (
              <div key={i} className="text-xs font-mono">
                <dt className="text-muted-foreground inline">{item.name}: </dt>
                <dd className="inline text-foreground font-medium">{String(item.value ?? "—")}</dd>
                {item.units && <span className="text-muted-foreground ml-1">({item.units})</span>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );

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

        {/* Sidebar: Highlights */}
        <aside className="hidden md:block w-64 shrink-0 overflow-y-auto">
          <div className="industrial-card p-4">
            <HighlightsPanel />
          </div>
        </aside>
      </div>

      {/* Mobile highlights panel */}
      <div className="md:hidden mt-3 shrink-0">
        <details className="industrial-card p-3">
          <summary className="text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer">
            Highlights
            {missingRequired.length > 0 && ` · ${missingRequired.length} missing`}
            {collected.length > 0 && ` · ${collected.length} collected`}
          </summary>
          <div className="mt-2">
            <HighlightsPanel />
          </div>
        </details>
      </div>
    </div>
  );
};

export default Conversation;
