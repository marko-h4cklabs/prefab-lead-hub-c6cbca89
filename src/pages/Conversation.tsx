import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { toDisplayText, safeArray, getErrorMessage } from "@/lib/errorUtils";
import { ArrowLeft, Send, Loader2, Bot, Timer, ImagePlus, CalendarDays, Bug, ChevronDown, ChevronRight } from "lucide-react";
import AudioPlayer from "@/components/conversation/AudioPlayer";
import VoiceRecorder from "@/components/conversation/VoiceRecorder";
import { toast } from "@/hooks/use-toast";
import PicturesThumbnails from "@/components/PicturesThumbnails";
import BookingPanel, { BookingPayload, getBookingFlowLabel } from "@/components/conversation/BookingPanel";
import { processAiReply, detectBookingIntent, getFlow, dismissBookingFlow, resetBookingFlow, type BookingFlowState } from "@/lib/bookingOrchestrator";

interface QuickReply {
  label: string;
  value: string;
}

interface Message {
  role: string;
  content: string;
  timestamp?: string;
  quick_replies?: QuickReply[];
  booking?: BookingPayload;
  type?: string;
  audio_url?: string;
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Booking flow state (conversation-level, not per-message)
  const [bookingFlowState, setBookingFlowState] = useState<{
    offered: boolean;
    awaitingSlotSelection: boolean;
    dismissed: boolean;
    bookedAppointmentId: string | null;
    lastOfferReason: string | null;
    slotsError: string | null;
    lastEndpoint: string | null;
    lastError: string | null;
    lastPayloadKeys: string | null;
  }>({
    offered: false,
    awaitingSlotSelection: false,
    dismissed: false,
    bookedAppointmentId: null,
    lastOfferReason: null,
    slotsError: null,
    lastEndpoint: null,
    lastError: null,
    lastPayloadKeys: null,
  });

  // Debug panel visibility (simulation only)
  const [debugOpen, setDebugOpen] = useState(false);

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

  /** Extract booking payload from multiple possible response locations */
  const extractBooking = (res: any): BookingPayload | undefined => {
    const candidates = [
      res?.booking,
      res?.meta?.booking,
      res?.ui_action?.booking,
    ];
    for (const b of candidates) {
      if (b && typeof b === "object" && b.mode) return b as BookingPayload;
    }
    return undefined;
  };

  const syncBookingFlowState = useCallback(() => {
    const convKey = conversationId || leadId || "";
    const flow = getFlow(convKey);
    setBookingFlowState((prev) => ({
      ...prev,
      offered: flow.offerShown,
      awaitingSlotSelection: flow.stage === "awaiting_slot_choice",
      dismissed: flow.stage === "declined",
      bookedAppointmentId: flow.completed ? "completed" : null,
      lastOfferReason: flow.stage,
    }));
  }, [conversationId, leadId]);

  const applyBackendResponse = async (res: any, lastUserMsg?: string) => {
    applyResponseFields(res);

    // If dismissed or already booked, don't run orchestrator
    const convKey = conversationId || leadId || "";
    const flow = getFlow(convKey);

    let finalRes = res;

    // Only run orchestrator if NOT dismissed and NOT already completed
    if (flow.stage !== "declined" && !flow.completed) {
      try {
        const augmented = await processAiReply(res, convKey, lastUserMsg);
        if (augmented) finalRes = augmented;
      } catch { /* orchestrator failed, use original response */ }
    }

    if (finalRes?.assistant_message !== undefined) {
      if (finalRes.conversation_id) setConversationId(finalRes.conversation_id);
      const quickReplies: QuickReply[] | undefined = Array.isArray(finalRes.quick_replies)
        ? finalRes.quick_replies
        : undefined;
      const booking = extractBooking(finalRes);
      setData((prev) => {
        const msgs = prev?.messages || [];
        return {
          ...prev,
          lead_id: prev?.lead_id || leadId || "",
          messages: [...msgs, { role: "assistant", content: finalRes.assistant_message, quick_replies: quickReplies, booking }],
          parsed_fields: prev?.parsed_fields || {},
          current_step: prev?.current_step ?? 0,
        };
      });
    } else {
      setData(finalRes);
    }

    // Sync flow state after processing
    syncBookingFlowState();
  };

  const handleBookingUpdate = (msgIndex: number, updated: BookingPayload) => {
    setData((prev) => {
      if (!prev) return prev;
      const msgs = [...prev.messages];
      if (msgs[msgIndex]) {
        msgs[msgIndex] = { ...msgs[msgIndex], booking: updated, quick_replies: undefined };
      }
      return { ...prev, messages: msgs };
    });
    // If confirmed, update flow state
    const normalizedMode = updated.mode;
    if (normalizedMode === "confirmed" || normalizedMode === "booking_success") {
      setBookingFlowState((prev) => ({
        ...prev,
        bookedAppointmentId: updated.appointment_id || updated.appointment?.id || "confirmed",
        awaitingSlotSelection: false,
        lastEndpoint: "book-slot",
        lastPayloadKeys: updated.confirmed_slot ? Object.keys(updated.confirmed_slot).join(",") : null,
      }));
    }
  };

  const handleBookingDismiss = () => {
    const convKey = conversationId || leadId || "";
    dismissBookingFlow(convKey);
    setBookingFlowState((prev) => ({
      ...prev,
      dismissed: true,
      offered: false,
      awaitingSlotSelection: false,
    }));
  };

  const triggerAiReply = useCallback(async () => {
    if (!leadId || aiReplying) return;
    setAiReplying(true);
    try {
      const res = await api.aiReply(companyId, leadId);
      await applyBackendResponse(res);
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
      await applyBackendResponse(res, content);

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

  const handleQuickReply = (reply: QuickReply) => {
    setDraft(reply.value);
    // Clear quick replies from the message that triggered them
    setData((prev) => {
      if (!prev) return prev;
      const msgs = [...prev.messages];
      // Remove quick_replies from all messages to avoid re-rendering old chips
      const cleaned = msgs.map((m) => ({ ...m, quick_replies: undefined }));
      return { ...prev, messages: cleaned };
    });
    // Auto-send
    setTimeout(() => {
      const syntheticDraft = reply.value;
      if (syntheticDraft && leadId && !sending) {
        setDraft("");
        setSending(true);
        clearTimers();
        setData((prev) => ({
          ...prev,
          lead_id: prev?.lead_id || leadId || "",
          messages: [...(prev?.messages || []), { role: "user", content: syntheticDraft }],
          parsed_fields: prev?.parsed_fields || {},
          current_step: prev?.current_step ?? 0,
        }));
        const body: any = { role: "user", content: syntheticDraft };
        if (conversationId) body.conversation_id = conversationId;
        api.sendMessage(companyId, leadId, body)
          .then(async (res) => {
            await applyBackendResponse(res, syntheticDraft);
            if (testingMode === "automated") startAutoCountdown();
          })
          .catch(() => {
            toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
          })
          .finally(() => setSending(false));
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const picturesRequired = requiredInfos.some(
    (r) => r.name?.toLowerCase() === "pictures"
  );

  const picturesCollected: string[] = (() => {
    const entry = collectedInfos.find(
      (c) => (c.field_name || c.name || "").toLowerCase() === "pictures"
    );
    if (!entry) return [];
    if (Array.isArray(entry.value)) return entry.value.filter((v: any) => typeof v === "string");
    return [];
  })();

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !leadId) return;
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        await api.uploadAttachment(leadId, file);
        successCount++;
      } catch (err: unknown) {
        toast({
          title: "Upload failed",
          description: getErrorMessage(err),
          variant: "destructive",
        });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (successCount > 0) {
      // Send an informational message and refresh state
      try {
        const body: any = { role: "user", content: `Uploaded ${successCount} picture${successCount > 1 ? "s" : ""}.` };
        if (conversationId) body.conversation_id = conversationId;
        const res = await api.sendMessage(companyId, leadId, body);
        await applyBackendResponse(res);
      } catch { /* best-effort */ }
      // Refresh conversation to get updated collected_infos
      try {
        const convo = await api.getConversation(companyId, leadId);
        setData(convo);
        applyResponseFields(convo);
      } catch { /* ignore */ }
    }
    setUploading(false);
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

  // Derive latest booking flow status from the last message with booking data
  const latestBookingLabel = (() => {
    const msgs = data?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const label = getBookingFlowLabel(msgs[i]?.booking);
      if (label) return label;
    }
    return null;
  })();

  const HighlightsPanel = () => (
    <div className="space-y-4">
      {/* Booking flow status hint */}
      {latestBookingLabel && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Booking flow
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent/10 border border-accent/20 px-2 py-1 text-xs font-mono text-accent">
            <CalendarDays size={11} />
            {latestBookingLabel}
          </span>
        </div>
      )}
      {/* Looking for (required_infos) */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Looking for
        </h3>
        {requiredInfos.length === 0 ? (
          <p className="text-xs text-muted-foreground">All required fields collected.</p>
        ) : (
          <ul className="space-y-1">
            {safeArray<RequiredInfo>(requiredInfos, "requiredInfos").map((item, i) => (
              <li key={i} className="text-xs font-mono">
                <span className="text-foreground">{toDisplayText(item.name)}</span>
                {(item.type || item.units) && (
                  <span className="text-muted-foreground ml-1">
                    ({[item.type, item.units].filter(Boolean).map(toDisplayText).join(", ")})
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
            {safeArray<CollectedInfo>(collectedInfos, "collectedInfos").map((item, i) => {
              const fieldName = (item.field_name || item.name || "").toLowerCase();
              if (fieldName === "pictures") {
                const rawValue = item.value;
                const picUrls: string[] = Array.isArray(rawValue) ? rawValue.filter((v: any) => typeof v === "string") : [];
                const picLinks: { label: string; url: string }[] =
                  Array.isArray((item as any).links)
                    ? (item as any).links
                    : picUrls.map((url, j) => ({ label: `Picture ${j + 1}`, url }));
                return (
                  <div key={i} className="text-xs font-mono">
                    <dt className="text-muted-foreground">Pictures received:</dt>
                    {picLinks.length > 0 && (
                      <dd className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        {picLinks.map((link, j) => (
                          <a key={j} href={link.url} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent/80">
                            {link.label}
                          </a>
                        ))}
                      </dd>
                    )}
                    <PicturesThumbnails urls={picUrls} />
                  </div>
                );
              }
              return (
                <div key={i} className="text-xs font-mono">
                  <dt className="text-muted-foreground inline">{toDisplayText(item.field_name || item.name)}: </dt>
                  <dd className="inline text-foreground font-medium">{toDisplayText(item.value)}</dd>
                  {item.units && <span className="text-muted-foreground ml-1">({toDisplayText(item.units)})</span>}
                </div>
              );
            })}
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
              (() => {
                // Find the LAST message index with active booking data
                let lastBookingMsgIdx = -1;
                for (let j = messages.length - 1; j >= 0; j--) {
                  if (messages[j]?.booking?.mode) { lastBookingMsgIdx = j; break; }
                }
                // Only show booking panel on that last message, and only if not dismissed/booked
                const shouldShowBooking = !bookingFlowState.dismissed && !bookingFlowState.bookedAppointmentId;
                // For confirmed state, show on last booking message regardless
                const lastBookingMode = lastBookingMsgIdx >= 0 ? messages[lastBookingMsgIdx]?.booking?.mode : null;
                const isConfirmedMode = lastBookingMode === "confirmed" || lastBookingMode === "booking_success";

                return messages.map((msg, i) => {
                  const isUser = msg.role === "user";
                  const isSystem = msg.role === "system";
                  const isSchedulingChip = isSystem && (msg.content || "").toLowerCase().includes("scheduling request");

                  if (isSchedulingChip) {
                    return (
                      <div key={i} className="flex justify-center">
                        <div className="inline-flex items-center gap-1.5 rounded-sm bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-mono text-accent">
                          <CalendarDays size={12} />
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  if (isSystem) {
                    return (
                      <div key={i} className="flex justify-center">
                        <div className="inline-flex items-center gap-1.5 rounded-sm bg-muted px-3 py-1.5 text-xs font-mono text-muted-foreground">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  // Only render BookingPanel on the LAST message with booking, and only if state allows
                  const showBookingHere = i === lastBookingMsgIdx && msg.booking?.mode && (shouldShowBooking || isConfirmedMode);

                  return (
                    <div key={i}>
                      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
                          {/* Audio message */}
                          {(msg.type === "audio" || msg.audio_url) && msg.audio_url ? (
                            <div className="space-y-2">
                              <AudioPlayer src={msg.audio_url} />
                              {msg.content && (
                                <div>
                                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-50">Transcription</span>
                                  <p className="whitespace-pre-wrap italic opacity-80">{msg.content}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                          {/* Inline booking panel — only on last active booking message */}
                          {showBookingHere && (
                            <BookingPanel
                              booking={msg.booking!}
                              leadId={leadId || ""}
                              conversationId={conversationId}
                              onBookingUpdate={(updated) => handleBookingUpdate(i, updated)}
                              onSendMessage={(content) => {
                                setDraft(content);
                                setTimeout(() => handleSend(), 0);
                              }}
                              onDismiss={handleBookingDismiss}
                            />
                          )}
                        </div>
                      </div>
                      {/* Quick reply chips */}
                      {!isUser && Array.isArray(msg.quick_replies) && msg.quick_replies.length > 0 && (
                        <div className="flex justify-start mt-2 ml-1 gap-2 flex-wrap">
                          {msg.quick_replies.map((qr, qi) => (
                            <button
                              key={qi}
                              onClick={() => handleQuickReply(qr)}
                              disabled={sending || aiReplying}
                              className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-xs font-mono text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                            >
                              {qr.label === "Schedule now" && <CalendarDays size={12} />}
                              {qr.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
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
                <VoiceRecorder
                  onSend={async (blob) => {
                    const convId = conversationId || leadId || "";
                    const res = await api.sendVoiceMessage(convId, blob);
                    if (res?.message || res?.assistant_message) {
                      await applyBackendResponse(res);
                    } else {
                      // Refresh conversation
                      const convo = await api.getConversation(companyId, leadId!);
                      setData(convo);
                      applyResponseFields(convo);
                    }
                  }}
                />
                <button
                  onClick={() => { clearTimers(); triggerAiReply(); }}
                  disabled={aiReplying}
                  className="industrial-btn-accent h-[25px] px-4"
                >
                  {aiReplying ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  <span className="text-xs ml-1">AI Reply</span>
                </button>
                {picturesRequired && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="industrial-btn-ghost h-[25px] px-4 border border-border"
                    >
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                      <span className="text-xs ml-1">{uploading ? "Uploading…" : "Pictures"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Highlights */}
        <aside className="hidden md:block w-64 shrink-0 overflow-y-auto space-y-3">
          <div className="industrial-card p-4">
            <HighlightsPanel />
          </div>
          {/* Debug panel (simulation only) */}
          <div className="industrial-card p-3">
            <button
              onClick={() => setDebugOpen(!debugOpen)}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground w-full"
            >
              {debugOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Bug size={10} />
              Booking Debug
            </button>
            {debugOpen && (
              <div className="mt-2 space-y-1 text-[10px] font-mono text-muted-foreground">
                <div>offered: {String(bookingFlowState.offered)}</div>
                <div>awaitingSlots: {String(bookingFlowState.awaitingSlotSelection)}</div>
                <div>dismissed: {String(bookingFlowState.dismissed)}</div>
                <div>booked: {bookingFlowState.bookedAppointmentId || "—"}</div>
                <div>reason: {bookingFlowState.lastOfferReason || "—"}</div>
                <div>endpoint: {bookingFlowState.lastEndpoint || "—"}</div>
                <div>error: {bookingFlowState.lastError || "—"}</div>
                <div>lastPayloadKeys: {bookingFlowState.lastPayloadKeys || "—"}</div>
                <button
                  onClick={() => {
                    const convKey = conversationId || leadId || "";
                    resetBookingFlow(convKey);
                    setBookingFlowState({
                      offered: false, awaitingSlotSelection: false, dismissed: false,
                      bookedAppointmentId: null, lastOfferReason: null, slotsError: null,
                      lastEndpoint: null, lastError: null, lastPayloadKeys: null,
                    });
                  }}
                  className="mt-1 text-accent hover:underline"
                >
                  Reset flow
                </button>
              </div>
            )}
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
