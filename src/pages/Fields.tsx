import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import {
  Loader2, Save, AlertTriangle, ChevronDown,
  User, MessageSquare, Settings2, Mic, RotateCcw, Database,
} from "lucide-react";
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
import AdvancedFollowUpSection from "@/components/followups/AdvancedFollowUpSection";
import PreviewPanel from "@/components/chatbot/PreviewPanel";

const SECTION_LABELS: Record<string, string> = {
  identity: "Agent Identity",
  style: "Communication Style",
  strategy: "Conversation Strategy",
  guardrails: "Guardrails",
  booking: "Booking Trigger",
  social_proof: "Social Proof",
};

/* ── Collapsible Section ── */
const Section = ({
  id,
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="dark-card border-l-4 border-l-primary overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <ChevronDown
        size={16}
        className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
    {open && <div className="border-t border-border">{children}</div>}
  </div>
);

/* ── Main Page ── */
const Fields = () => {
  const isMobile = useIsMobile();
  const [previewKey, setPreviewKey] = useState(0);
  const [savingAll, setSavingAll] = useState(false);
  const [unsavedSections, setUnsavedSections] = useState<Set<string>>(new Set());
  const [quoteFieldsVersion, setQuoteFieldsVersion] = useState(0);

  // Track which accordion sections are open (allow multiple)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["identity"]));

  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    <div className="space-y-3">
      {/* Unsaved changes warning */}
      {unsavedSections.size > 0 && (
        <div className="sticky top-0 z-10 rounded-lg bg-warning/15 border border-warning/30 px-4 py-2.5 flex items-center gap-2 text-sm">
          <AlertTriangle size={14} className="text-warning shrink-0" />
          <span className="text-warning font-medium text-xs">
            Unsaved: {unsavedNames.join(", ")}
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

      {/* ── Section 1: Agent Identity ── */}
      <Section id="identity" icon={<User size={16} />} title="Agent Identity" open={openSections.has("identity")} onToggle={() => toggleSection("identity")}>
        <AgentIdentitySection onDirty={() => markDirty('identity')} onSaved={() => { markClean('identity'); refreshPreview(); }} />
      </Section>

      {/* ── Section 2: Communication Style ── */}
      <Section id="style" icon={<MessageSquare size={16} />} title="Communication Style" open={openSections.has("style")} onToggle={() => toggleSection("style")}>
        <CommunicationStyleSection onDirty={() => markDirty('style')} onSaved={() => { markClean('style'); refreshPreview(); }} />
      </Section>

      {/* ── Section 3: Behavior & Strategy ── */}
      <Section id="behavior" icon={<Settings2 size={16} />} title="Behavior & Strategy" open={openSections.has("behavior")} onToggle={() => toggleSection("behavior")}>
        <div className="divide-y divide-border">
          <ConversationStrategySection onDirty={() => markDirty('strategy')} onSaved={() => { markClean('strategy'); refreshPreview(); }} />
          <GuardrailsSection onDirty={() => markDirty('guardrails')} onSaved={() => { markClean('guardrails'); refreshPreview(); }} />
          <BookingTriggerSection onDirty={() => markDirty('booking')} onSaved={() => { markClean('booking'); refreshPreview(); }} quoteFieldsVersion={quoteFieldsVersion} />
          <SocialProofSection onDirty={() => markDirty('social_proof')} onSaved={() => { markClean('social_proof'); refreshPreview(); }} />
        </div>
      </Section>

      {/* ── Section 4: Content & Automation ── */}
      <Section id="content" icon={<Database size={16} />} title="Content & Automation" open={openSections.has("content")} onToggle={() => toggleSection("content")}>
        <div className="divide-y divide-border">
          <QuoteFieldsSection onFieldsChanged={refreshQuoteFields} />
          <PersonasSection />
          <TemplatesSection />
          <AutoresponderSection />
        </div>
      </Section>

      {/* ── Section 5: Voice Control ── */}
      <Section id="voice" icon={<Mic size={16} />} title="Voice Control" open={openSections.has("voice")} onToggle={() => toggleSection("voice")}>
        <VoiceSettingsSection />
      </Section>

      {/* ── Section 6: Advanced Follow-up ── */}
      <Section id="followup" icon={<RotateCcw size={16} />} title="Advanced Follow-up" open={openSections.has("followup")} onToggle={() => toggleSection("followup")}>
        <AdvancedFollowUpSection />
      </Section>
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
