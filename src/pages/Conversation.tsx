import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, Send, Loader2, Bot, Timer } from "lucide-react";
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

interface RequiredInfo {
  name: string;
  type?: string;
  units?: string;
}

interface CollectedInfo {
  name: string;
  value?: any;
  units?: string;
  field_name?: string;
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
  const [requiredInfos, setRequiredInfos] = useState<RequiredInfo[]>([]);
  const [collectedInfos, setCollectedInfos] = useState<CollectedInfo[]>([]);

  // Testing mode state
  const [testingMode, setTestingMode] = useState<"manual" | "automated">("manual");
  const [smartDelay, setSmartDelay] = useState(8);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearTimers = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (delayTimerRef.current) { clearTimeout(delayTimerRef.current); delayTimerRef.current = null; }
    setCountdown(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const applyResponseFields = (res: any) => {
    if (Array.isArray(res?.required_infos)) setRequiredInfos(res.required_infos);
    else if (Array.isArray(res?.looking_for)) setRequiredInfos(res.looking_for);
    if (Array.isArray(res?.collected_infos)) setCollectedInfos(res.collected_infos);
    else if (Array.isArray(res?.collected)) setCollectedInfos(res.collected);
  };

  useEffect(() => {
    if (!leadId) return;
    api.getConversation(companyId, leadId)
      .then((convo) => {
        setData(convo);
        applyResponseFields(convo);
      })
      .catch(() => {
        toast({ title: "Error", description: "Failed to load conversation", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { scrollToBottom(); }, [data?.messages]);

  const applyBackendResponse = (res: any) => {
    applyResponseFields(res);
    if (res?.assistant_message !== undefined) {
      if (res.conversation_id) setConversationId(res.conversation_id);
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

  const triggerAiReply = useCallback(async () => {
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
  }, [leadId, companyId, aiReplying]);

  const startAutoCountdown = useCallback(() => {
    clearTimers();
    setCountdown(smartDelay);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    delayTimerRef.current = setTimeout(() => {
      clearTimers();
      triggerAiReply();
    }, smartDelay * 1000);
  }, [smartDelay, clearTimers, triggerAiReply]);

  const handleSend = async () => {
    if (!draft.trim() || !leadId || sending) return;
    const content = draft.trim();
    setSending(true);
    setDraft("");

    // Reset countdown on each new message
    clearTimers();

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

      // If automated, start countdown for AI reply
      if (testingMode === "automated") {
        startAutoCountdown();
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
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

  const HighlightsPanel = () => (
    <div className="space-y-4">
      {/* Looking for (required_infos) */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Looking for
        </h3>
        {requiredInfos.length === 0 ? (
          <p className="text-xs text-muted-foreground">All required fields collected.</p>
        ) : (
          <ul className="space-y-1">
            {requiredInfos.map((item, i) => (
              <li key={i} className="text-xs font-mono">
                <span className="text-foreground">{item.name}</span>
                {(item.type || item.units) && (
                  <span className="text-muted-foreground ml-1">
                    ({[item.type, item.units].filter(Boolean).join(", ")})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Collected (collected_infos) */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Collected
        </h3>
        {collectedInfos.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet</p>
        ) : (
          <dl className="space-y-1">
            {collectedInfos.map((item, i) => (
              <div key={i} className="text-xs font-mono">
                <dt className="text-muted-foreground inline">{item.field_name || item.name}: </dt>
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
        <div className="flex items-center gap-3">
          {/* Testing mode toggle */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => { setTestingMode("manual"); clearTimers(); }}
              className={`px-2 py-1 rounded-sm border ${testingMode === "manual" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              Manual
            </button>
            <button
              onClick={() => setTestingMode("automated")}
              className={`px-2 py-1 rounded-sm border ${testingMode === "automated" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              Automated
            </button>
          </div>
          {testingMode === "automated" && (
            <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
              <Timer size={12} />
              <input
                type="number"
                min={1}
                max={120}
                value={smartDelay}
                onChange={(e) => setSmartDelay(Math.max(1, Math.min(120, Number(e.target.value) || 8)))}
                className="industrial-input w-14 py-0.5 px-1 text-xs text-center"
              />
              <span>s</span>
            </div>
          )}
          {countdown !== null && (
            <span className="text-xs font-mono text-accent animate-pulse">AI in {countdown}s</span>
          )}
          <span className="text-xs font-mono text-muted-foreground">Step {currentStep}</span>
        </div>
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
                  onClick={() => { clearTimers(); triggerAiReply(); }}
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
            {requiredInfos.length > 0 && ` · ${requiredInfos.length} looking for`}
            {collectedInfos.length > 0 && ` · ${collectedInfos.length} collected`}
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
