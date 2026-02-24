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
import LeadIntelligence from "@/components/LeadIntelligence";
import ReplySuggestions from "@/components/conversation/ReplySuggestions";

interface QuickReply { label: string; value: string; }
interface Message { role: string; content: string; timestamp?: string; quick_replies?: QuickReply[]; booking?: BookingPayload; type?: string; audio_url?: string; }
interface ConversationData { lead_id: string; messages: Message[]; parsed_fields: Record<string, any>; current_step: number; }
interface RequiredInfo { name: string; type?: string; units?: string; }
interface CollectedInfo { field_name?: string; name?: string; value: any; units?: string; }
interface BookingState { offered: boolean; awaitingSlotSelection: boolean; dismissed: boolean; bookedAppointmentId: string | null; lastOfferReason: string | null; slotsError: string | null; lastEndpoint: string | null; lastError: string | null; }

const Conversation = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();

  let companyId: string;
  try { companyId = requireCompanyId(); } catch { return null; }

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
  const [bookingFlowState, setBookingFlowState] = useState<{ offered: boolean; awaitingSlotSelection: boolean; dismissed: boolean; bookedAppointmentId: string | null; lastOfferReason: string | null; slotsError: string | null; lastEndpoint: string | null; lastError: string | null; }>({ offered: false, awaitingSlotSelection: false, dismissed: false, bookedAppointmentId: null, lastOfferReason: null, slotsError: null, lastEndpoint: null, lastError: null });
  const [debugOpen, setDebugOpen] = useState(false);
  const [testingMode, setTestingMode] = useState<"manual" | "automated">("manual");
  const [smartDelay, setSmartDelay] = useState(8);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [operatingMode, setOperatingMode] = useState<string | null>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  const clearTimers = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (delayTimerRef.current) { clearTimeout(delayTimerRef.current); delayTimerRef.current = null; }
    setCountdown(null);
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const applyResponseFields = (res: any) => {
    if (Array.isArray(res?.required_infos)) setRequiredInfos(res.required_infos);
    else if (Array.isArray(res?.looking_for)) setRequiredInfos(res.looking_for);
    if (Array.isArray(res?.collected_infos)) setCollectedInfos(res.collected_infos);
    else if (Array.isArray(res?.collected)) setCollectedInfos(res.collected);
  };

  useEffect(() => {
    if (!leadId) return;
    api.getConversation(companyId, leadId).then((convo) => { setData(convo); applyResponseFields(convo); }).catch(() => { toast({ title: "Error", description: "Failed to load conversation", variant: "destructive" }); }).finally(() => setLoading(false));
  }, [leadId]);
  useEffect(() => { scrollToBottom(); }, [data?.messages]);

  // Fetch operating mode
  useEffect(() => {
    api.me().then((res) => {
      const mode = (res as any).operating_mode ?? (res.user as any)?.operating_mode ?? null;
      setOperatingMode(mode);
    }).catch(() => {});
  }, []);

  const extractBooking = (res: any): BookingPayload | undefined => {
    const candidates = [res?.booking, res?.meta?.booking, res?.ui_action?.booking];
    for (const b of candidates) { if (b && typeof b === "object" && b.mode) return b as BookingPayload; }
    return undefined;
  };

  const syncBookingFlowState = useCallback(() => {
    const convKey = conversationId || leadId || "";
    const flow = getFlow(convKey);
    setBookingFlowState((prev) => ({ ...prev, offered: flow.offerShown, awaitingSlotSelection: flow.stage === "awaiting_slot_choice", dismissed: flow.stage === "declined", bookedAppointmentId: flow.completed ? "completed" : null, lastOfferReason: flow.stage }));
  }, [conversationId, leadId]);

  const applyBackendResponse = async (res: any, lastUserMsg?: string) => {
    applyResponseFields(res);
    const convKey = conversationId || leadId || "";
    const flow = getFlow(convKey);
    let finalRes = res;
    if (flow.stage !== "declined" && !flow.completed) {
      try { const augmented = await processAiReply(res, convKey, lastUserMsg); if (augmented) finalRes = augmented; } catch { }
    }
    if (finalRes?.assistant_message !== undefined) {
      if (finalRes.conversation_id) setConversationId(finalRes.conversation_id);
      const quickReplies: QuickReply[] | undefined = Array.isArray(finalRes.quick_replies) ? finalRes.quick_replies : undefined;
      const booking = extractBooking(finalRes);
      setData((prev) => { const msgs = prev?.messages || []; return { ...prev, lead_id: prev?.lead_id || leadId || "", messages: [...msgs, { role: "assistant", content: finalRes.assistant_message, quick_replies: quickReplies, booking }], parsed_fields: prev?.parsed_fields || {}, current_step: prev?.current_step ?? 0 }; });
    } else { setData(finalRes); }
    syncBookingFlowState();
  };

  const handleBookingUpdate = (msgIndex: number, updated: BookingPayload) => {
    setData((prev) => { if (!prev) return prev; const msgs = [...prev.messages]; if (msgs[msgIndex]) { msgs[msgIndex] = { ...msgs[msgIndex], booking: updated, quick_replies: undefined }; } return { ...prev, messages: msgs }; });
    const normalizedMode = updated.mode;
    if (normalizedMode === "confirmed" || normalizedMode === "booking_success") {
      setBookingFlowState((prev) => ({ ...prev, bookedAppointmentId: updated.appointment_id || updated.appointment?.id || "confirmed", awaitingSlotSelection: false, lastEndpoint: "book-slot", lastPayloadKeys: updated.confirmed_slot ? Object.keys(updated.confirmed_slot).join(",") : null }));
    }
  };

  const handleBookingDismiss = () => {
    const convKey = conversationId || leadId || "";
    dismissBookingFlow(convKey);
    setBookingFlowState((prev) => ({ ...prev, dismissed: true, offered: false, awaitingSlotSelection: false }));
  };

  const triggerAiReply = useCallback(async () => {
    if (!leadId || aiReplying) return;
    setAiReplying(true);
    try { const res = await api.aiReply(companyId, leadId); await applyBackendResponse(res); } catch { toast({ title: "Error", description: "Failed to get AI reply", variant: "destructive" }); } finally { setAiReplying(false); }
  }, [leadId, companyId, aiReplying]);

  const startAutoCountdown = useCallback(() => {
    clearTimers(); setCountdown(smartDelay);
    countdownRef.current = setInterval(() => { setCountdown((prev) => { if (prev === null || prev <= 1) return null; return prev - 1; }); }, 1000);
    delayTimerRef.current = setTimeout(() => { clearTimers(); triggerAiReply(); }, smartDelay * 1000);
  }, [smartDelay, clearTimers, triggerAiReply]);

  const handleSend = async () => {
    if (!draft.trim() || !leadId || sending) return;
    const content = draft.trim(); setSending(true); setDraft(""); clearTimers();
    setData((prev) => ({ ...prev, lead_id: prev?.lead_id || leadId || "", messages: [...(prev?.messages || []), { role: "user", content }], parsed_fields: prev?.parsed_fields || {}, current_step: prev?.current_step ?? 0 }));
    try {
      const body: any = { role: "user", content }; if (conversationId) body.conversation_id = conversationId;
      const res = await api.sendMessage(companyId, leadId, body); await applyBackendResponse(res, content);
      if (testingMode === "automated") startAutoCountdown();
    } catch { toast({ title: "Error", description: "Failed to send message", variant: "destructive" }); setData((prev) => ({ ...prev, lead_id: prev?.lead_id || leadId || "", messages: (prev?.messages || []).slice(0, -1), parsed_fields: prev?.parsed_fields || {}, current_step: prev?.current_step ?? 0 })); setDraft(content); } finally { setSending(false); }
  };

  const handleQuickReply = (reply: QuickReply) => {
    setDraft(reply.value);
    setData((prev) => { if (!prev) return prev; const cleaned = prev.messages.map((m) => ({ ...m, quick_replies: undefined })); return { ...prev, messages: cleaned }; });
    setTimeout(() => {
      const syntheticDraft = reply.value;
      if (syntheticDraft && leadId && !sending) {
        setDraft(""); setSending(true); clearTimers();
        setData((prev) => ({ ...prev, lead_id: prev?.lead_id || leadId || "", messages: [...(prev?.messages || []), { role: "user", content: syntheticDraft }], parsed_fields: prev?.parsed_fields || {}, current_step: prev?.current_step ?? 0 }));
        const body: any = { role: "user", content: syntheticDraft }; if (conversationId) body.conversation_id = conversationId;
        api.sendMessage(companyId, leadId, body).then(async (res) => { await applyBackendResponse(res, syntheticDraft); if (testingMode === "automated") startAutoCountdown(); }).catch(() => { toast({ title: "Error", description: "Failed to send message", variant: "destructive" }); }).finally(() => setSending(false));
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const picturesRequired = requiredInfos.some((r) => r.name?.toLowerCase() === "pictures");
  const picturesCollected: string[] = (() => { const entry = collectedInfos.find((c) => (c.field_name || c.name || "").toLowerCase() === "pictures"); if (!entry) return []; if (Array.isArray(entry.value)) return entry.value.filter((v: any) => typeof v === "string"); return []; })();

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !leadId) return;
    setUploading(true); let successCount = 0;
    for (const file of Array.from(files)) { try { await api.uploadAttachment(leadId, file); successCount++; } catch (err: unknown) { toast({ title: "Upload failed", description: getErrorMessage(err), variant: "destructive" }); } }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (successCount > 0) {
      try { const body: any = { role: "user", content: `Uploaded ${successCount} picture${successCount > 1 ? "s" : ""}.` }; if (conversationId) body.conversation_id = conversationId; const res = await api.sendMessage(companyId, leadId, body); await applyBackendResponse(res); } catch { }
      try { const convo = await api.getConversation(companyId, leadId); setData(convo); applyResponseFields(convo); } catch { }
    }
    setUploading(false);
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 size={16} className="animate-spin" /> Loading conversation…</div>;

  const messages = data?.messages || [];
  const currentStep = data?.current_step ?? 0;
  const latestBookingLabel = (() => { const msgs = data?.messages || []; for (let i = msgs.length - 1; i >= 0; i--) { const label = getBookingFlowLabel(msgs[i]?.booking); if (label) return label; } return null; })();

  const HighlightsPanel = () => (
    <div className="space-y-4">
      {latestBookingLabel && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1">Booking flow</h3>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs text-primary">
            <CalendarDays size={11} />{latestBookingLabel}
          </span>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Looking for</h3>
        {requiredInfos.length === 0 ? <p className="text-xs text-muted-foreground">All collected.</p> : (
          <ul className="space-y-1">{safeArray<RequiredInfo>(requiredInfos, "requiredInfos").map((item, i) => (
            <li key={i} className="text-xs"><span className="text-foreground">{toDisplayText(item.name)}</span>{(item.type || item.units) && <span className="text-muted-foreground ml-1">({[item.type, item.units].filter(Boolean).map(toDisplayText).join(", ")})</span>}</li>
          ))}</ul>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Collected</h3>
        {collectedInfos.length === 0 ? <p className="text-xs text-muted-foreground">None yet</p> : (
          <dl className="space-y-1">{safeArray<CollectedInfo>(collectedInfos, "collectedInfos").map((item, i) => {
            const fieldName = (item.field_name || item.name || "").toLowerCase();
            if (fieldName === "pictures") {
              const picUrls: string[] = Array.isArray(item.value) ? item.value.filter((v: any) => typeof v === "string") : [];
              return <div key={i} className="text-xs"><dt className="text-muted-foreground">Pictures:</dt><PicturesThumbnails urls={picUrls} /></div>;
            }
            return <div key={i} className="text-xs"><dt className="text-muted-foreground inline">{toDisplayText(item.field_name || item.name)}: </dt><dd className="inline text-foreground font-medium">{toDisplayText(item.value)}</dd></div>;
          })}</dl>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/leads/${leadId}`)} className="dark-btn-ghost p-1.5"><ArrowLeft size={16} /></button>
          <h1 className="text-sm font-semibold">Conversation</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => { setTestingMode("manual"); clearTimers(); }} className={`px-2 py-1 rounded-md border text-xs ${testingMode === "manual" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>Manual</button>
            <button onClick={() => setTestingMode("automated")} className={`px-2 py-1 rounded-md border text-xs ${testingMode === "automated" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>Auto</button>
          </div>
          {testingMode === "automated" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer size={12} />
              <input type="number" min={1} max={120} value={smartDelay} onChange={(e) => setSmartDelay(Math.max(1, Math.min(120, Number(e.target.value) || 8)))} className="dark-input w-12 py-0.5 px-1 text-xs text-center" />
              <span>s</span>
            </div>
          )}
          {countdown !== null && <span className="text-xs text-primary animate-pulse">AI in {countdown}s</span>}
          <span className="text-xs text-muted-foreground">Step {currentStep}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto space-y-3 p-4">
            {messages.length === 0 ? (
              <div className="dark-card p-8 text-center text-muted-foreground">No messages yet. Send the first message below.</div>
            ) : (() => {
              let lastBookingMsgIdx = -1;
              for (let j = messages.length - 1; j >= 0; j--) { if (messages[j]?.booking?.mode) { lastBookingMsgIdx = j; break; } }
              const shouldShowBooking = !bookingFlowState.dismissed && !bookingFlowState.bookedAppointmentId;
              const lastBookingMode = lastBookingMsgIdx >= 0 ? messages[lastBookingMsgIdx]?.booking?.mode : null;
              const isConfirmedMode = lastBookingMode === "confirmed" || lastBookingMode === "booking_success";

              return messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isSystem = msg.role === "system";
                const isSchedulingChip = isSystem && (msg.content || "").toLowerCase().includes("scheduling request");

                if (isSchedulingChip) return <div key={i} className="flex justify-center"><div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs text-primary"><CalendarDays size={12} />{msg.content}</div></div>;
                if (isSystem) return <div key={i} className="flex justify-center"><div className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs text-muted-foreground">{msg.content}</div></div>;

                const showBookingHere = i === lastBookingMsgIdx && msg.booking?.mode && (shouldShowBooking || isConfirmedMode);

                return (
                  <div key={i}>
                    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-wider opacity-60">{msg.role}</span>
                          {msg.timestamp && <span className="text-[10px] opacity-40">{new Date(msg.timestamp).toLocaleString()}</span>}
                        </div>
                        {(msg.type === "audio" || msg.audio_url) && msg.audio_url ? (
                          <div className="space-y-2">
                            <AudioPlayer src={msg.audio_url} />
                            {msg.content && <div><span className="text-[10px] uppercase tracking-wider opacity-50">Transcription</span><p className="whitespace-pre-wrap italic opacity-80">{msg.content}</p></div>}
                          </div>
                        ) : <p className="whitespace-pre-wrap">{msg.content}</p>}
                        {showBookingHere && <BookingPanel booking={msg.booking!} leadId={leadId || ""} conversationId={conversationId} onBookingUpdate={(updated) => handleBookingUpdate(i, updated)} onSendMessage={(content) => { setDraft(content); setTimeout(() => handleSend(), 0); }} onDismiss={handleBookingDismiss} />}
                      </div>
                    </div>
                    {!isUser && Array.isArray(msg.quick_replies) && msg.quick_replies.length > 0 && (
                      <div className="flex justify-start mt-2 ml-1 gap-2 flex-wrap">
                        {msg.quick_replies.map((qr, qi) => (
                          <button key={qi} onClick={() => handleQuickReply(qr)} disabled={sending || aiReplying} className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                            {qr.label === "Schedule now" && <CalendarDays size={12} />}{qr.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer / Suggestions */}
          {operatingMode === "copilot" ? (
            <ReplySuggestions
              leadId={leadId || ""}
              conversationId={conversationId}
              onMessageSent={(content) => {
                setData((prev) => ({ ...prev, lead_id: prev?.lead_id || leadId || "", messages: [...(prev?.messages || []), { role: "user", content }], parsed_fields: prev?.parsed_fields || {}, current_step: prev?.current_step ?? 0 }));
                // Re-fetch conversation to get backend state
                if (leadId) api.getConversation(companyId, leadId).then((convo) => { setData(convo); applyResponseFields(convo); }).catch(() => {});
              }}
              lastMessageCount={messages.length}
            />
          ) : (
            <div className="shrink-0 p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a message… (Enter to send)" rows={2} className="dark-input flex-1 resize-none" disabled={sending} />
                <div className="flex flex-col gap-1 self-end">
                  <button onClick={handleSend} disabled={!draft.trim() || sending} className="dark-btn-primary h-[28px] px-4">
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                  <VoiceRecorder onSend={async (blob) => {
                    const convId = conversationId || leadId || "";
                    const res = await api.sendVoiceMessage(convId, blob);
                    if (res?.message || res?.assistant_message) { await applyBackendResponse(res); } else { const convo = await api.getConversation(companyId, leadId!); setData(convo); applyResponseFields(convo); }
                  }} />
                  <button onClick={() => { clearTimers(); triggerAiReply(); }} disabled={aiReplying} className="dark-btn bg-secondary text-secondary-foreground hover:bg-secondary/80 h-[28px] px-3">
                    {aiReplying ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                    <span className="text-xs ml-1">AI</span>
                  </button>
                  {picturesRequired && (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="dark-btn-ghost h-[28px] px-3 border border-border">
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 overflow-y-auto border-l border-border bg-card p-4 space-y-3">
          {leadId && <LeadIntelligence leadId={leadId} />}
          <HighlightsPanel />
          <div className="dark-panel p-3">
            <button onClick={() => setDebugOpen(!debugOpen)} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground w-full">
              {debugOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}<Bug size={10} />Booking Debug
            </button>
            {debugOpen && (
              <div className="mt-2 space-y-1 text-[10px] font-mono text-muted-foreground">
                <div>offered: {String(bookingFlowState.offered)}</div>
                <div>awaitingSlots: {String(bookingFlowState.awaitingSlotSelection)}</div>
                <div>dismissed: {String(bookingFlowState.dismissed)}</div>
                <div>booked: {bookingFlowState.bookedAppointmentId || "—"}</div>
                <button onClick={() => { const convKey = conversationId || leadId || ""; resetBookingFlow(convKey); setBookingFlowState({ offered: false, awaitingSlotSelection: false, dismissed: false, bookedAppointmentId: null, lastOfferReason: null, slotsError: null, lastEndpoint: null, lastError: null }); }} className="mt-1 text-primary hover:underline">Reset flow</button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Conversation;
