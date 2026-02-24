import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, CalendarCheck, Settings, ExternalLink, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

import AgentIdentitySection from "@/components/chatbot/AgentIdentitySection";
import CommunicationStyleSection from "@/components/chatbot/CommunicationStyleSection";
import ConversationStrategySection from "@/components/chatbot/ConversationStrategySection";
import GuardrailsSection from "@/components/chatbot/GuardrailsSection";
import SocialProofSection from "@/components/chatbot/SocialProofSection";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";
import PersonasSection from "@/components/chatbot/PersonasSection";
import TemplatesSection from "@/components/chatbot/TemplatesSection";
import AutoresponderSection from "@/components/chatbot/AutoresponderSection";
import VoiceSettingsSection from "@/components/voice/VoiceSettingsSection";
import PreviewPanel from "@/components/chatbot/PreviewPanel";

const Fields = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [bookingStatus, setBookingStatus] = useState<{ loaded: boolean; enabled: boolean; mode: string }>({ loaded: false, enabled: false, mode: "off" });
  const [previewKey, setPreviewKey] = useState(0);
  const [savingAll, setSavingAll] = useState(false);

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
    // Trigger a global refresh — individual sections handle their own saves
    toast({ title: "Refreshing preview...", description: "Save each section individually for best results." });
    refreshPreview();
    setTimeout(() => setSavingAll(false), 1000);
  };

  const leftColumn = (
    <div className="space-y-4">
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
        <AgentIdentitySection onSaved={refreshPreview} />
      </div>

      {/* Section 2 — Communication Style */}
      <div className="dark-card border-l-4 border-l-primary">
        <CommunicationStyleSection onSaved={refreshPreview} />
      </div>

      {/* Section 3 — Conversation Strategy */}
      <div className="dark-card border-l-4 border-l-primary">
        <ConversationStrategySection onSaved={refreshPreview} />
      </div>

      {/* Section 4 — Guardrails */}
      <div className="dark-card border-l-4 border-l-primary">
        <GuardrailsSection onSaved={refreshPreview} />
      </div>

      {/* Section 5 — Social Proof */}
      <div className="dark-card border-l-4 border-l-primary">
        <SocialProofSection onSaved={refreshPreview} />
      </div>

      {/* Section 6 — Data Collection */}
      <div className="dark-card border-l-4 border-l-primary">
        <QuoteFieldsSection />
      </div>

      {/* Section 7 — Personas */}
      <div className="dark-card border-l-4 border-l-primary">
        <PersonasSection />
      </div>

      {/* Section 8 — Message Templates */}
      <div className="dark-card border-l-4 border-l-primary">
        <TemplatesSection />
      </div>

      {/* Section 9 — Autoresponder Rules */}
      <div className="dark-card border-l-4 border-l-primary">
        <AutoresponderSection />
      </div>

      {/* Section 10 — Voice Settings */}
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
      {/* Left Column — 60% */}
      <div className="w-[60%] overflow-auto pr-2 pb-6">
        {leftColumn}
      </div>

      {/* Right Column — 40% sticky preview */}
      <div className="w-[40%] sticky top-0 h-[calc(100vh-4rem)]">
        <PreviewPanel refreshKey={previewKey} />
      </div>
    </div>
  );
};

export default Fields;
