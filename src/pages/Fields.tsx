import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, CalendarCheck, Settings, ExternalLink, Save, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

import AgentIdentitySection from "@/components/chatbot/AgentIdentitySection";
import CommunicationStyleSection from "@/components/chatbot/CommunicationStyleSection";
import ConversationStrategySection from "@/components/chatbot/ConversationStrategySection";
import GuardrailsSection from "@/components/chatbot/GuardrailsSection";
import BookingTriggerSection from "@/components/chatbot/BookingTriggerSection";
import SocialProofSection from "@/components/chatbot/SocialProofSection";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";
import PersonasSection from "@/components/chatbot/PersonasSection";
import TemplatesSection from "@/components/chatbot/TemplatesSection";
import AutoresponderSection from "@/components/chatbot/AutoresponderSection";
import VoiceSettingsSection from "@/components/voice/VoiceSettingsSection";
import PreviewPanel from "@/components/chatbot/PreviewPanel";

const SECTION_LABELS: Record<string, string> = {
  identity: "Agent Identity",
  style: "Communication Style",
  strategy: "Conversation Strategy",
  guardrails: "Guardrails",
  booking: "Booking Trigger",
  social_proof: "Social Proof",
};

const Fields = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [bookingStatus, setBookingStatus] = useState<{ loaded: boolean; enabled: boolean; mode: string }>({ loaded: false, enabled: false, mode: "off" });
  const [previewKey, setPreviewKey] = useState(0);
  const [savingAll, setSavingAll] = useState(false);
  const [unsavedSections, setUnsavedSections] = useState<Set<string>>(new Set());
  const [quoteFieldsVersion, setQuoteFieldsVersion] = useState(0);

  const markDirty = useCallback((section: string) => {
    setUnsavedSections(prev => new Set([...prev, section]));
  }, []);

  const markClean = useCallback((section: string) => {
    setUnsavedSections(prev => { const n = new Set(prev); n.delete(section); return n; });
  }, []);

  const refreshQuoteFields = useCallback(() => {
    setQuoteFieldsVersion(v => v + 1);
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (unsavedSections.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [unsavedSections]);

  useEffect(() => {
    api.getSchedulingSettings()
      .then((res) => {
        const cb = res?.chatbot_booking && typeof res.chatbot_booking === "object" ? res.chatbot_booking : res;
        setBookingStatus({ loaded: true, enabled: Boolean(cb?.chatbot_booking_enabled), mode: cb?.booking_mode || "off" });
      })
      .catch(() => setBookingStatus({ loaded: true, enabled: false, mode: "off" }));
  }, []);

  const refreshPreview = useCallback(() => {
    setPreviewKey((k) => k + 1);
  }, []);

  const handleSaveAll = () => {
    setSavingAll(true);
    toast({ title: "Refreshing preview...", description: "Save each section individually for best results." });
    refreshPreview();
    setTimeout(() => setSavingAll(false), 1000);
  };

  const unsavedNames = Array.from(unsavedSections).map(s => SECTION_LABELS[s] || s);

  const leftColumn = (
    <div className="space-y-4">
      {/* Unsaved changes warning */}
      {unsavedSections.size > 0 && (
        <div className="sticky top-0 z-10 rounded-lg bg-warning/15 border border-warning/30 px-4 py-2.5 flex items-center gap-2 text-sm">
          <AlertTriangle size={14} className="text-warning shrink-0" />
          <span className="text-warning font-medium text-xs">
            Unsaved changes in: {unsavedNames.join(", ")}. Click "Save" in each section to keep your changes.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">AI Agent</h1>
        <button
          onClick={handleSaveAll}
          disabled={savingAll}
          className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs"
        >
          {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save All
        </button>
      </div>

      {/* Booking Status */}
      <div className="dark-card px-5 py-3 flex items-center justify-between border-l-4 border-l-primary">
        <div className="flex items-center gap-2.5">
          <CalendarCheck size={14} className="text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Booking offers</span>
          {!bookingStatus.loaded ? (
            <Loader2 size={12} className="animate-spin text-muted-foreground" />
          ) : bookingStatus.enabled ? (
            <span className="status-badge bg-primary/15 text-primary text-[10px]">
              Enabled · {bookingStatus.mode === "direct_booking" ? "Direct" : "Manual request"}
            </span>
          ) : (
            <span className="status-badge bg-secondary text-muted-foreground text-[10px]">Disabled</span>
          )}
        </div>
        <button onClick={() => navigate("/settings")} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors">
          <Settings size={10} /> Scheduling settings <ExternalLink size={8} />
        </button>
      </div>

      {/* Section 1 — Agent Identity */}
      <div className="dark-card border-l-4 border-l-primary">
        <AgentIdentitySection onDirty={() => markDirty('identity')} onSaved={() => { markClean('identity'); refreshPreview(); }} />
      </div>

      {/* Section 2 — Communication Style */}
      <div className="dark-card border-l-4 border-l-primary">
        <CommunicationStyleSection onDirty={() => markDirty('style')} onSaved={() => { markClean('style'); refreshPreview(); }} />
      </div>

      {/* Section 3 — Conversation Strategy */}
      <div className="dark-card border-l-4 border-l-primary">
        <ConversationStrategySection onDirty={() => markDirty('strategy')} onSaved={() => { markClean('strategy'); refreshPreview(); }} />
      </div>

      {/* Section 4 — Guardrails */}
      <div className="dark-card border-l-4 border-l-primary">
        <GuardrailsSection onDirty={() => markDirty('guardrails')} onSaved={() => { markClean('guardrails'); refreshPreview(); }} />
      </div>

      {/* Section 5 — Smart Booking Trigger */}
      <div className="dark-card border-l-4 border-l-primary">
        <BookingTriggerSection onDirty={() => markDirty('booking')} onSaved={() => { markClean('booking'); refreshPreview(); }} quoteFieldsVersion={quoteFieldsVersion} />
      </div>

      {/* Section 6 — Social Proof */}
      <div className="dark-card border-l-4 border-l-primary">
        <SocialProofSection onDirty={() => markDirty('social_proof')} onSaved={() => { markClean('social_proof'); refreshPreview(); }} />
      </div>

      {/* Section 7 — Data Collection */}
      <div className="dark-card border-l-4 border-l-primary">
        <QuoteFieldsSection onFieldsChanged={refreshQuoteFields} />
      </div>

      {/* Section 8 — Personas */}
      <div className="dark-card border-l-4 border-l-primary">
        <PersonasSection />
      </div>

      {/* Section 9 — Message Templates */}
      <div className="dark-card border-l-4 border-l-primary">
        <TemplatesSection />
      </div>

      {/* Section 10 — Autoresponder Rules */}
      <div className="dark-card border-l-4 border-l-primary">
        <AutoresponderSection />
      </div>

      {/* Section 11 — Voice Settings */}
      <div className="border-t border-border pt-6">
        <VoiceSettingsSection />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="max-w-3xl space-y-6 pb-6">
        {leftColumn}
        <div className="h-[500px]">
          <PreviewPanel refreshKey={previewKey} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full min-h-0">
      <div className="w-[60%] overflow-auto pr-2 pb-6">
        {leftColumn}
      </div>
      <div className="w-[40%] sticky top-0 h-[calc(100vh-4rem)]">
        <PreviewPanel refreshKey={previewKey} />
      </div>
    </div>
  );
};

export default Fields;
