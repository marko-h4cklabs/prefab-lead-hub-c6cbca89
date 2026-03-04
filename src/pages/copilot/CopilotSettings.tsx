import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Switch } from "@/components/ui/switch";
import {
  Bot,
  MessageSquare,
  Settings,
  Users,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Save,
  GripVertical,
  ChevronDown,
  CalendarClock,
  Link2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Play,
  Pause,
  SkipForward,
  Bell,
  Send,
  Volume2,
  VolumeX,
  Star,
  Sparkles,
  ChevronUp,
  FileText,
  Sliders,
  Pencil,
} from "lucide-react";
import AgentIdentitySection from "@/components/chatbot/AgentIdentitySection";
import AILearningGround from "@/components/chatbot/AILearningGround";
import PersonasSection from "@/components/chatbot/PersonasSection";
import CommunicationStyleSection from "@/components/chatbot/CommunicationStyleSection";
import ConversationStrategySection from "@/components/chatbot/ConversationStrategySection";
import GuardrailsSection from "@/components/chatbot/GuardrailsSection";
import HumanErrorSection from "@/components/chatbot/HumanErrorSection";
import SocialProofSection from "@/components/chatbot/SocialProofSection";
import PersonaGeneratorPanel from "@/components/copilot/PersonaGeneratorPanel";
import VoiceSettingsSection from "@/components/voice/VoiceSettingsSection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteField {
  id?: string;
  name: string;
  type: string;
  is_enabled: boolean;
  qualification_prompt: string;
  qualification_requirement: string;
}


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Manual-only tabs (Integrations and Notifications are global, at top-level)
const TABS = [
  { key: "identity", label: "Identity", icon: Bot },
  { key: "personas", label: "Personas", icon: Users },
  { key: "behavior", label: "Behavior", icon: MessageSquare },
  { key: "social-proof", label: "Social Proof", icon: Star },
  { key: "fields", label: "Fields", icon: Settings },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// Top-level view switcher (Integrations + Notifications are always accessible)
const VIEW_TABS = [
  { key: "ai", label: "AI-Generated", icon: Sparkles },
  { key: "manual", label: "Manual", icon: Settings },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "voice", label: "Voice Messages", icon: Volume2 },
  { key: "integrations", label: "Integrations", icon: Link2 },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

type ViewMode = (typeof VIEW_TABS)[number]["key"];


// ---------------------------------------------------------------------------
// Helper: normalize API list responses
// ---------------------------------------------------------------------------

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types for AI personas
// ---------------------------------------------------------------------------

interface AiPersona {
  id: string;
  name: string;
  style_summary: string | null;
  knowledge_base: string | null;
  snapshot: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// AI Page — persona list + generator
// ---------------------------------------------------------------------------

function AiPage({
  conversationSource,
  onSourceChange,
}: {
  conversationSource: "manual" | "ai_generated";
  onSourceChange: (src: "manual" | "ai_generated", personas: AiPersona[], activeId: string | null) => void;
}) {
  const [personas, setPersonas] = useState<AiPersona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);

  const loadPersonas = useCallback(async () => {
    try {
      const res = await api.getCopilotPersonaConfig();
      const ps = res.personas ?? [];
      setPersonas(ps);
      const activeId = res.active_ai_persona_id ?? null;
      setActivePersonaId(activeId);
      onSourceChange(res.copilot_persona_source ?? "manual", ps, activeId);
      // Auto-open config tabs for the active persona (or first persona) on load
      if (ps.length > 0) {
        setEditingPersonaId(activeId ?? ps[0].id);
      }
    } catch {
      // silently skip
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPersonas(); }, [loadPersonas]);

  const activatePersona = async (id: string) => {
    setActivating(id);
    try {
      await api.activateCopilotAiPersona(id);
      setActivePersonaId(id);
      const persona = personas.find((p) => p.id === id);
      toast({ title: `"${persona?.name}" is now active`, description: "AI-Generated mode activated for all conversations." });
      onSourceChange("ai_generated", personas, id);
    } catch (err: any) {
      toast({ title: "Failed to activate", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setActivating(null);
    }
  };

  const deactivate = async () => {
    try {
      await api.putCopilotPersonaSource("manual");
      onSourceChange("manual", personas, activePersonaId);
      toast({ title: "Switched to Manual configuration" });
    } catch (err: any) {
      toast({ title: "Failed to switch", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const deletePersona = async (id: string) => {
    setDeleting(id);
    try {
      await api.deleteCopilotAiPersona(id);
      const removed = personas.find((p) => p.id === id);
      const updated = personas.filter((p) => p.id !== id);
      setPersonas(updated);
      if (activePersonaId === id) {
        setActivePersonaId(null);
        onSourceChange("manual", updated, null);
      } else {
        onSourceChange(conversationSource, updated, activePersonaId);
      }
      toast({ title: `"${removed?.name}" deleted` });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const onPersonaApplied = () => {
    setGeneratorOpen(false);
    loadPersonas(); // will auto-open the new persona's config tabs
  };

  const onPersonaUpdated = (updated: AiPersona) => {
    setPersonas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAiActive = conversationSource === "ai_generated";

  return (
    <div className="max-w-2xl space-y-4 py-6">
      {/* Status row */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isAiActive ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
        <Sparkles size={16} className={isAiActive ? "text-primary shrink-0" : "text-muted-foreground shrink-0"} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {isAiActive
              ? `Active: ${personas.find((p) => p.id === activePersonaId)?.name ?? "AI-Generated"}`
              : "Not active — using Manual configuration"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isAiActive ? "All copilot suggestions use this AI persona" : "Activate a persona below to use it in conversations"}
          </p>
        </div>
        {isAiActive && (
          <button
            type="button"
            onClick={deactivate}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            Deactivate
          </button>
        )}
      </div>

      {/* Saved personas */}
      {personas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <Sparkles size={24} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No AI personas yet</p>
          <p className="text-[12px] text-muted-foreground">Upload DM exports or screenshots below to generate your first persona.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {personas.map((persona) => {
            const isActive = persona.id === activePersonaId && conversationSource === "ai_generated";
            const createdDate = new Date(persona.created_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            });
            const kbExpanded = expandedKbId === persona.id;
            return (
              <div
                key={persona.id}
                className={`rounded-xl border transition-colors ${isActive ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <Sparkles size={15} className={`mt-0.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{persona.name}</span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Check size={9} /> Active
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{createdDate}</span>
                    </div>
                    {persona.style_summary && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{persona.style_summary}</p>
                    )}
                    {persona.knowledge_base && (
                      <button
                        type="button"
                        onClick={() => setExpandedKbId(kbExpanded ? null : persona.id)}
                        className="text-[10px] text-primary/70 hover:text-primary mt-1 flex items-center gap-1 transition-colors"
                      >
                        {kbExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        Knowledge base
                      </button>
                    )}
                    {kbExpanded && persona.knowledge_base && (
                      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed rounded-lg bg-muted/50 px-3 py-2">
                        {persona.knowledge_base}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingPersonaId(editingPersonaId === persona.id ? null : persona.id)}
                      className={`flex items-center gap-1 text-[11px] font-medium transition-colors px-2 py-1 rounded-md ${
                        editingPersonaId === persona.id
                          ? "text-foreground bg-secondary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {editingPersonaId === persona.id ? (
                        <><ChevronUp size={11} /> Hide settings</>
                      ) : (
                        <><ChevronDown size={11} /> Edit settings</>
                      )}
                    </button>
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => activatePersona(persona.id)}
                        disabled={activating === persona.id}
                        className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/10 disabled:opacity-50"
                      >
                        {activating === persona.id ? <Loader2 size={12} className="animate-spin" /> : "Activate"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePersona(persona.id)}
                      disabled={deleting === persona.id}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {deleting === persona.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              {/* Inline config panel — inside the card, expands below the header row */}
              {editingPersonaId === persona.id && (
                <div className="px-2 pb-3">
                  <AiPersonaConfigTabs
                    persona={persona}
                    onUpdated={onPersonaUpdated}
                    onClose={() => setEditingPersonaId(null)}
                  />
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* Generator */}
      <div className={`rounded-xl border transition-colors ${generatorOpen ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
        <button
          type="button"
          onClick={() => setGeneratorOpen((v) => !v)}
          className="w-full text-left px-4 py-3.5"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles size={15} className="text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground flex-1">Generate from DMs / Screenshots</span>
            {generatorOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 ml-6">
            Upload IG DM exports, transcripts, or conversation screenshots
          </p>
        </button>
        {generatorOpen && (
          <div className="px-4 pb-4">
            <PersonaGeneratorPanel onApplied={onPersonaApplied} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToggleGroup — reusable pill selector
// ---------------------------------------------------------------------------

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AiPersonaConfigTabs — editable configuration panel for a single AI persona
// ---------------------------------------------------------------------------

const AI_CONFIG_TABS = [
  { key: "identity", label: "Identity", icon: Bot },
  { key: "behavior", label: "Behavior", icon: Sliders },
  { key: "strategy", label: "Strategy", icon: Settings },
  { key: "additional", label: "Additional Info", icon: FileText },
  { key: "fields", label: "Fields", icon: GripVertical },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
] as const;

type AiConfigTabKey = (typeof AI_CONFIG_TABS)[number]["key"];

const HUMAN_ERROR_OPTIONS = [
  { value: "typos", label: "Typos" },
  { value: "no_periods", label: "No periods" },
  { value: "lowercase_starts", label: "Lowercase starts" },
  { value: "short_forms", label: "Short forms" },
];

function AiPersonaConfigTabs({
  persona,
  onUpdated,
  onClose,
}: {
  persona: AiPersona;
  onUpdated: (updated: AiPersona) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AiConfigTabKey>("identity");
  const snap = persona.snapshot || {};

  // Identity
  const [agentName, setAgentName] = useState<string>(String(snap.agent_name || ""));
  const [agentBackstory, setAgentBackstory] = useState<string>(String(snap.agent_backstory || ""));

  // Behavior
  const [tone, setTone] = useState<string>(snap.tone || "friendly");
  const [responseLength, setResponseLength] = useState<string>(snap.response_length || "medium");
  const [emojisEnabled, setEmojisEnabled] = useState<boolean>(Boolean(snap.emojis_enabled));
  const [openerStyle, setOpenerStyle] = useState<string>(snap.opener_style || "casual");
  const [noTrailingPeriod, setNoTrailingPeriod] = useState<boolean>(Boolean(snap.no_trailing_period));
  const [humanErrorEnabled, setHumanErrorEnabled] = useState<boolean>(Boolean(snap.human_error_enabled));
  const [humanErrorTypes, setHumanErrorTypes] = useState<string[]>(
    Array.isArray(snap.human_error_types) ? snap.human_error_types : []
  );
  const [humanErrorRandom, setHumanErrorRandom] = useState<boolean>(Boolean(snap.human_error_random));

  // Strategy
  const [conversationApproach, setConversationApproach] = useState<string>(
    snap.conversation_approach || "rapport_building"
  );
  const [followUpStyle, setFollowUpStyle] = useState<string>(snap.follow_up_style || "gentle");
  const [closingStyle, setClosingStyle] = useState<string>(snap.closing_style || "soft");
  const [botDenyResponse, setBotDenyResponse] = useState<string>(
    String(snap.bot_deny_response || "I'm a real person, just quick at responding!")
  );

  // Additional Info
  const [additionalInstructions, setAdditionalInstructions] = useState<string>(
    String(snap.additional_instructions || "")
  );

  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const buildSnapshot = () => ({
    ...snap,
    agent_name: agentName,
    agent_backstory: agentBackstory,
    tone,
    response_length: responseLength,
    emojis_enabled: emojisEnabled,
    opener_style: openerStyle,
    no_trailing_period: noTrailingPeriod,
    human_error_enabled: humanErrorEnabled,
    human_error_types: humanErrorTypes,
    human_error_random: humanErrorRandom,
    conversation_approach: conversationApproach,
    follow_up_style: followUpStyle,
    closing_style: closingStyle,
    bot_deny_response: botDenyResponse,
    additional_instructions: additionalInstructions,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedSnapshot = buildSnapshot();
      await api.updateCopilotAiPersona(persona.id, { snapshot: updatedSnapshot });
      onUpdated({ ...persona, snapshot: updatedSnapshot });
      setSavedOk(true);
      toast({ title: "Persona configuration saved" });
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err: any) {
      toast({ title: "Failed to save", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isPersonaTab = (tab: AiConfigTabKey) =>
    tab === "identity" || tab === "behavior" || tab === "strategy" || tab === "additional";

  const toggleErrorType = (type: string) => {
    setHumanErrorTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card mt-2">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Sparkles size={14} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Configuring: {persona.name}</p>
          <p className="text-[11px] text-muted-foreground">Changes saved to this persona's snapshot and applied when AI-Generated is active</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-4 pt-2 overflow-x-auto">
        {AI_CONFIG_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="border-b border-border" />

      {/* Tab content */}
      <div className="px-4 py-4">
        {/* IDENTITY TAB */}
        {activeTab === "identity" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Agent Name</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Agent Backstory</label>
              <p className="text-[11px] text-muted-foreground mb-2">Describes this persona's personality, background, and approach — the AI uses this to adopt the exact style.</p>
              <textarea
                value={agentBackstory}
                onChange={(e) => setAgentBackstory(e.target.value)}
                rows={8}
                placeholder="Describe the persona's communication style, sales approach, personality..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* BEHAVIOR TAB */}
        {activeTab === "behavior" && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Tone</label>
              <ToggleGroup
                options={[
                  { value: "professional", label: "Professional" },
                  { value: "friendly", label: "Friendly" },
                  { value: "confident", label: "Confident" },
                  { value: "relatable", label: "Relatable" },
                ]}
                value={tone}
                onChange={setTone}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Response Length</label>
              <ToggleGroup
                options={[
                  { value: "short", label: "Short" },
                  { value: "medium", label: "Medium" },
                  { value: "long", label: "Long" },
                ]}
                value={responseLength}
                onChange={setResponseLength}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Opener Style</label>
              <ToggleGroup
                options={[
                  { value: "casual", label: "Casual" },
                  { value: "formal", label: "Formal" },
                  { value: "question", label: "Question" },
                  { value: "direct", label: "Direct" },
                ]}
                value={openerStyle}
                onChange={setOpenerStyle}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Use Emojis</p>
                <p className="text-[11px] text-muted-foreground">Include emojis in AI replies</p>
              </div>
              <Switch checked={emojisEnabled} onCheckedChange={setEmojisEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">No Trailing Period</p>
                <p className="text-[11px] text-muted-foreground">Skip end punctuation — more natural texting style</p>
              </div>
              <Switch checked={noTrailingPeriod} onCheckedChange={setNoTrailingPeriod} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Human Writing Style</p>
                  <p className="text-[11px] text-muted-foreground">Add intentional imperfections to feel more human</p>
                </div>
                <Switch checked={humanErrorEnabled} onCheckedChange={setHumanErrorEnabled} />
              </div>
              {humanErrorEnabled && (
                <div className="space-y-2 pl-2">
                  <p className="text-[11px] text-muted-foreground">Active imperfections:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {HUMAN_ERROR_OPTIONS.map((opt) => {
                      const active = humanErrorTypes.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleErrorType(opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[11px] text-foreground">Randomize imperfections</p>
                      <p className="text-[10px] text-muted-foreground">Apply inconsistently for more realism</p>
                    </div>
                    <Switch checked={humanErrorRandom} onCheckedChange={setHumanErrorRandom} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STRATEGY TAB */}
        {activeTab === "strategy" && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Conversation Approach</label>
              <ToggleGroup
                options={[
                  { value: "rapport_building", label: "Rapport Building" },
                  { value: "field_focused", label: "Field Focused" },
                ]}
                value={conversationApproach}
                onChange={setConversationApproach}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {conversationApproach === "rapport_building"
                  ? "Warm up the conversation before asking qualifying questions"
                  : "Get to qualifying questions quickly and efficiently"}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Follow-up Style</label>
              <ToggleGroup
                options={[
                  { value: "gentle", label: "Gentle" },
                  { value: "persistent", label: "Persistent" },
                  { value: "value_first", label: "Value First" },
                ]}
                value={followUpStyle}
                onChange={setFollowUpStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Closing Style</label>
              <ToggleGroup
                options={[
                  { value: "soft", label: "Soft" },
                  { value: "direct", label: "Direct" },
                  { value: "assumptive", label: "Assumptive" },
                ]}
                value={closingStyle}
                onChange={setClosingStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Response When Asked "Are You a Bot?"</label>
              <textarea
                value={botDenyResponse}
                onChange={(e) => setBotDenyResponse(e.target.value)}
                rows={3}
                placeholder="e.g. I'm a real person, just quick at responding!"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* ADDITIONAL INFO TAB */}
        {activeTab === "additional" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
              <p className="text-xs text-primary font-semibold mb-1">Custom Rules for This Persona</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Add any specific instructions, quirks, or rules you noticed while reviewing the conversations. These will be injected directly into the AI prompt and must be respected in every conversation.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Additional Instructions</label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={10}
                placeholder={`Examples:\n- Always ask about their timeline before discussing price\n- Never mention competitor X by name\n- When they ask about results, always mention the 3-month transformation story\n- Keep energy high even when leads are slow to respond\n- Always end by leaving the ball in their court`}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {additionalInstructions.length > 0 ? `${additionalInstructions.length} characters` : "No custom instructions yet"}
              </p>
            </div>
          </div>
        )}

        {/* FIELDS TAB — global, reuse existing component */}
        {activeTab === "fields" && <FieldsTab />}

        {/* FOLLOW-UPS TAB — global, reuse existing component */}
        {activeTab === "followups" && <FollowUpsTab />}

        {/* Save button for persona-specific tabs */}
        {isPersonaTab(activeTab) && (
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || savedOk}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : savedOk ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Saving..." : savedOk ? "Saved" : "Save Changes"}
            </button>
            {savedOk && (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <Check size={12} /> Changes saved
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Page — standard tabs, always reads raw chatbot_behavior (no AI merge)
// ---------------------------------------------------------------------------

function ManualPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("identity");
  const [mountedTabs, setMountedTabs] = useState<Set<TabKey>>(new Set(["identity" as TabKey]));

  const handleTabChange = (tab: TabKey) => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border sticky top-0 bg-[hsl(0_0%_4%)] z-10 -mx-6 px-6">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                active ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="py-6">
        <div className="max-w-2xl">
          {mountedTabs.has("identity") && <div className={activeTab !== "identity" ? "hidden" : ""}><IdentityTab /></div>}
          {mountedTabs.has("personas") && <div className={activeTab !== "personas" ? "hidden" : ""}><PersonasTab /></div>}
          {mountedTabs.has("behavior") && <div className={activeTab !== "behavior" ? "hidden" : ""}><BehaviorTab /></div>}
          {mountedTabs.has("social-proof") && <div className={activeTab !== "social-proof" ? "hidden" : ""}><SocialProofTab /></div>}
          {mountedTabs.has("fields") && <div className={activeTab !== "fields" ? "hidden" : ""}><FieldsTab /></div>}
          {mountedTabs.has("followups") && <div className={activeTab !== "followups" ? "hidden" : ""}><FollowUpsTab /></div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const CopilotSettings = () => {
  // Which section the user is VIEWING
  const [viewMode, setViewMode] = useState<ViewMode>("manual");
  // Which mode is currently ACTIVE for conversations (fetched from backend on mount)
  const [conversationSource, setConversationSource] = useState<"manual" | "ai_generated">("manual");
  const [activePersonaName, setActivePersonaName] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Fetch current persona source on mount so the status badge is always correct
  // regardless of which view the user is on — fixes the "auto-switches to Manual" bug
  useEffect(() => {
    api.getCopilotPersonaConfig()
      .then((res: any) => {
        const src = res.copilot_persona_source ?? "manual";
        const activeId = res.active_ai_persona_id ?? null;
        const ps: AiPersona[] = res.personas ?? [];
        setConversationSource(src);
        if (src === "ai_generated" && activeId) {
          setActivePersonaName(ps.find((p) => p.id === activeId)?.name ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const handleSourceChange = (src: "manual" | "ai_generated", personas: AiPersona[], activeId: string | null) => {
    setConversationSource(src);
    if (src === "ai_generated" && activeId) {
      setActivePersonaName(personas.find((p) => p.id === activeId)?.name ?? null);
    } else {
      setActivePersonaName(null);
    }
  };

  const isAiActive = conversationSource === "ai_generated";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[hsl(0_0%_4%)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Copilot Settings</h1>
            {/* Conversation mode status badge */}
            {!statusLoading && (
              <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isAiActive
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}>
                {isAiActive ? <Sparkles size={10} /> : <Settings size={10} />}
                {isAiActive
                  ? `AI-Generated${activePersonaName ? `: ${activePersonaName}` : ""}`
                  : "Manual configuration"}
              </div>
            )}
          </div>
        </div>

        {/* Page switcher — Integrations and Notifications are always accessible */}
        <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
          {VIEW_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto px-6">
        {viewMode === "ai" && (
          <AiPage conversationSource={conversationSource} onSourceChange={handleSourceChange} />
        )}
        {viewMode === "manual" && <ManualPage />}
        {viewMode === "templates" && (
          <div className="py-6 max-w-2xl"><TemplatesTab /></div>
        )}
        {viewMode === "voice" && (
          <div className="py-6 max-w-2xl"><VoiceSettingsSection /></div>
        )}
        {viewMode === "integrations" && (
          <div className="py-6 max-w-2xl"><IntegrationsTab /></div>
        )}
        {viewMode === "notifications" && (
          <div className="py-6 max-w-2xl"><NotificationsTab /></div>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// IDENTITY TAB
// ===========================================================================

function IdentityTab() {
  return (
    <div className="space-y-0">
      <AgentIdentitySection mode="copilot" />
      <AILearningGround />
    </div>
  );
}

// ===========================================================================
// BEHAVIOR TAB
// ===========================================================================

function BehaviorTab() {
  return (
    <div className="space-y-0">
      <CommunicationStyleSection mode="copilot" />
      <ConversationStrategySection mode="copilot" />
      <GuardrailsSection mode="copilot" />
      <HumanErrorSection mode="copilot" />
    </div>
  );
}

// ===========================================================================
// FIELDS TAB
// ===========================================================================

function FieldsTab() {
  const [fields, setFields] = useState<QuoteField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef("[]");

  useEffect(() => {
    api
      .getCopilotFields()
      .then((res: any) => {
        const list = normalizeList(res, ["fields", "presets", "data", "items"]);
        const mapped: QuoteField[] = list.map((f: any) => ({
          id: f.id || f._id || crypto.randomUUID(),
          name: f.label || f.name || "",
          type: f.type || "text",
          is_enabled: f.is_enabled !== false,
          qualification_prompt: f.qualification_prompt || "",
          qualification_requirement: f.qualification_requirement || "",
        }));
        setFields(mapped);
        initialRef.current = JSON.stringify(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markDirty = (next: QuoteField[]) => {
    setIsDirty(JSON.stringify(next) !== initialRef.current);
  };

  const updateField = (index: number, patch: Partial<QuoteField>) => {
    setFields((prev) => {
      const next = prev.map((f, i) => (i === index ? { ...f, ...patch } : f));
      markDirty(next);
      return next;
    });
  };

  const addField = () => {
    setFields((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), name: "", type: "text", is_enabled: true, qualification_prompt: "", qualification_requirement: "" }];
      markDirty(next);
      return next;
    });
  };

  const removeField = (index: number) => {
    setFields((prev) => {
      const next = prev.filter((_, i) => i !== index);
      markDirty(next);
      return next;
    });
  };

  const handleSave = async () => {
    // Validate: all fields must have a name
    const invalid = fields.some((f) => !f.name.trim());
    if (invalid) {
      setSaveError("All fields must have a name.");
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saving");
    setSaveError("");
    try {
      await api.putCopilotFields({ presets: fields });
      initialRef.current = JSON.stringify(fields);
      setIsDirty(false);
      setSaveStatus("saved");
      toast({ title: "Quote fields saved" });
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err));
      setSaveStatus("error");
    }
  };

  if (loading) return <LoadingSkeleton lines={5} />;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Quote Fields"
        description="Configure what information the copilot should help you collect from leads. These fields appear in the lead summary."
      >
        <div className="space-y-3">
          {fields.length === 0 ? (
            <div className="text-center py-8">
              <Settings size={28} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No fields configured yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Add fields to define what data the AI should help collect.</p>
            </div>
          ) : (
            fields.map((field, idx) => (
              <div
                key={field.id || idx}
                className={`flex items-start gap-3 p-3 rounded-lg border border-border transition-colors ${field.is_enabled ? "bg-secondary/50" : "bg-secondary/20 opacity-60"}`}
              >
                <div className="pt-2 text-muted-foreground/50">
                  <GripVertical size={14} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-[1fr_2fr] gap-3">
                    {/* Field Name */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Field Name</label>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(idx, { name: e.target.value })}
                        placeholder="e.g. Person Age"
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      />
                    </div>

                    {/* What to search for */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">What to search for</label>
                      <input
                        type="text"
                        value={field.qualification_prompt}
                        onChange={(e) => updateField(idx, { qualification_prompt: e.target.value })}
                        placeholder="e.g. I want to know how old the client is"
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  {/* Qualification Requirement */}
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Qualification Requirement</label>
                    <input
                      type="text"
                      value={field.qualification_requirement}
                      onChange={(e) => updateField(idx, { qualification_requirement: e.target.value })}
                      placeholder="e.g. must be above 35"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Toggle ON/OFF */}
                <div className="pt-5 shrink-0">
                  <Switch
                    checked={field.is_enabled}
                    onCheckedChange={(checked: boolean) => updateField(idx, { is_enabled: checked })}
                  />
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeField(idx)}
                  className="mt-5 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove field"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}

          {/* Add field button */}
          <button
            onClick={addField}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Plus size={14} /> Add Field
          </button>
        </div>
      </SectionCard>

      {/* Save */}
      <SaveBar
        status={saveStatus}
        error={saveError}
        dirty={isDirty}
        onSave={handleSave}
        label="Save Fields"
      />
    </div>
  );
}

// ===========================================================================
// PERSONAS TAB
// ===========================================================================

function PersonasTab() {
  return <PersonasSection mode="copilot" />;
}

// ===========================================================================
// SOCIAL PROOF TAB
// ===========================================================================

function SocialProofTab() {
  return <SocialProofSection mode="copilot" />;
}

// ===========================================================================
// FOLLOW-UPS TAB
// ===========================================================================

interface SequenceStep {
  type: "template" | "ai_generated";
  delay_minutes: number;
  message_template?: string;
  ai_context_prompt?: string;
}

interface Sequence {
  id: string;
  name: string;
  trigger_event: string;
  max_follow_ups: number;
  escalation_action: string;
  is_active: boolean;
  steps: SequenceStep[];
}

interface Enrollment {
  id: string;
  lead_id: string;
  lead_name?: string;
  sequence_name?: string;
  current_step: number;
  follow_ups_sent: number;
  next_send_at: string | null;
  status: string;
}

const TRIGGER_EVENTS = [
  { value: "no_reply_72h", label: "No reply (72h)" },
  { value: "post_quote", label: "After quote sent" },
  { value: "call_booked", label: "Call booked" },
  { value: "no_show_detected", label: "No-show detected" },
  { value: "re_engagement", label: "Re-engagement" },
  { value: "custom", label: "Custom" },
];

const ESCALATION_ACTIONS = [
  { value: "none", label: "None" },
  { value: "tag_cold", label: "Tag as Cold" },
  { value: "notify_owner", label: "Notify Owner" },
  { value: "move_pipeline", label: "Move Pipeline Stage" },
  { value: "pause", label: "Pause" },
];

function FollowUpsTab() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"overview" | "sequences" | "active">("overview");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSeq, setNewSeq] = useState({
    name: "",
    trigger_event: "no_reply_72h",
    max_follow_ups: 5,
    escalation_action: "none",
    steps: [{ type: "ai_generated" as SequenceStep["type"], delay_minutes: 1440, message_template: "", ai_context_prompt: "" }],
  });
  const [creating, setCreating] = useState(false);
  const [followUpsEnabled, setFollowUpsEnabled] = useState(true);
  const [togglingFollowUps, setTogglingFollowUps] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [seqRes, enrollRes, statsRes, behaviorRes] = await Promise.allSettled([
        api.getWarmingSequences(),
        api.getWarmingEnrollments("active"),
        api.getFollowUpDashboard(),
        api.getCopilotBehavior(),
      ]);
      if (seqRes.status === "fulfilled") {
        setSequences(normalizeList(seqRes.value, ["sequences", "data", "items"]));
      }
      if (enrollRes.status === "fulfilled") {
        setEnrollments(normalizeList(enrollRes.value, ["enrollments", "data", "items"]));
      }
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      }
      if (behaviorRes.status === "fulfilled") {
        const b = behaviorRes.value;
        setFollowUpsEnabled(b?.follow_ups_enabled !== false);
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleToggleFollowUps = async (enabled: boolean) => {
    setTogglingFollowUps(true);
    try {
      await api.putCopilotBehavior({ follow_ups_enabled: enabled });
      setFollowUpsEnabled(enabled);
      toast({ title: enabled ? "Follow-ups enabled" : "Follow-ups disabled" });
    } catch (err) {
      toast({ title: "Failed to update", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setTogglingFollowUps(false);
    }
  };

  const handleCreateSequence = async () => {
    if (!newSeq.name.trim()) {
      toast({ title: "Sequence name is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.createWarmingSequence(newSeq);
      toast({ title: "Sequence created" });
      setShowCreateForm(false);
      setNewSeq({
        name: "",
        trigger_event: "no_reply_72h",
        max_follow_ups: 5,
        escalation_action: "none",
        steps: [{ type: "ai_generated", delay_minutes: 1440, message_template: "", ai_context_prompt: "" }],
      });
      fetchAll();
    } catch (err) {
      toast({ title: "Failed to create sequence", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggleSequence = async (seq: Sequence) => {
    try {
      await api.updateWarmingSequence(seq.id, { is_active: !seq.is_active });
      toast({ title: seq.is_active ? "Sequence paused" : "Sequence activated" });
      fetchAll();
    } catch (err) {
      toast({ title: "Failed to update sequence", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleEnrollmentAction = async (id: string, action: "pause" | "resume" | "skip" | "cancel") => {
    try {
      if (action === "pause") await api.pauseEnrollment(id);
      else if (action === "resume") await api.resumeEnrollment(id);
      else if (action === "skip") await api.skipEnrollmentStep(id);
      else if (action === "cancel") await api.cancelEnrollment(id);
      toast({ title: `Enrollment ${action}d` });
      fetchAll();
    } catch (err) {
      toast({ title: `Failed to ${action} enrollment`, description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (loading) return <LoadingSkeleton lines={5} />;

  const subTabs = [
    { key: "overview", label: "Overview" },
    { key: "sequences", label: `Sequences (${sequences.length})` },
    { key: "active", label: `Active (${enrollments.length})` },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Follow-ups</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {followUpsEnabled ? "Follow-up sequences are active and processing." : "All follow-up processing is paused."}
          </p>
        </div>
        <Switch
          checked={followUpsEnabled}
          onCheckedChange={handleToggleFollowUps}
          disabled={togglingFollowUps}
        />
      </div>

      {/* Sub-tab nav */}
      <div className={`space-y-6 transition-opacity ${followUpsEnabled ? "" : "opacity-50 pointer-events-none"}`}>
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 text-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              subTab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === "overview" && (
        <SectionCard
          title="Follow-up Overview"
          description="Automated follow-up sequences for the copilot workflow. In copilot mode, follow-ups generate suggestions for setter review instead of auto-sending."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Active Sequences</p>
              <p className="text-2xl font-bold text-foreground mt-1">{sequences.filter(s => s.is_active).length}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Active Enrollments</p>
              <p className="text-2xl font-bold text-foreground mt-1">{enrollments.length}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Messages Sent</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats?.messages_sent ?? 0}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Reply Rate</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats?.reply_rate ?? 0}%</p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-primary font-medium">Copilot Mode Behavior</p>
            <p className="text-xs text-muted-foreground mt-1">
              In copilot mode, follow-up messages appear as suggestions for setters to review and send manually.
              This ensures human oversight over all automated follow-ups.
            </p>
          </div>
        </SectionCard>
      )}

      {/* Sequences */}
      {subTab === "sequences" && (
        <SectionCard
          title="Follow-up Sequences"
          description="Create and manage automated follow-up sequences."
          headerAction={
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={12} /> New Sequence
            </button>
          }
        >
          {/* Create form */}
          {showCreateForm && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">New Sequence</h3>
                <button onClick={() => setShowCreateForm(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Name" required>
                  <input
                    type="text"
                    value={newSeq.name}
                    onChange={(e) => setNewSeq(s => ({ ...s, name: e.target.value }))}
                    placeholder="e.g. No-reply follow-up"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                </FieldGroup>
                <FieldGroup label="Trigger Event">
                  <div className="relative">
                    <select
                      value={newSeq.trigger_event}
                      onChange={(e) => setNewSeq(s => ({ ...s, trigger_event: e.target.value }))}
                      className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-8"
                    >
                      {TRIGGER_EVENTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </FieldGroup>
                <FieldGroup label="Max Follow-ups">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newSeq.max_follow_ups}
                    onChange={(e) => setNewSeq(s => ({ ...s, max_follow_ups: Number(e.target.value) || 5 }))}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                </FieldGroup>
                <FieldGroup label="Escalation Action">
                  <div className="relative">
                    <select
                      value={newSeq.escalation_action}
                      onChange={(e) => setNewSeq(s => ({ ...s, escalation_action: e.target.value }))}
                      className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-8"
                    >
                      {ESCALATION_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </FieldGroup>
              </div>

              {/* Steps */}
              <FieldGroup label="Steps" hint="Each step fires after a delay. AI-generated steps create reply suggestions.">
                <div className="space-y-2">
                  {newSeq.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-secondary/80 border border-border">
                      <span className="text-[10px] font-bold text-muted-foreground mt-2 w-6 shrink-0 text-center">#{idx + 1}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="relative">
                          <select
                            value={step.type}
                            onChange={(e) => {
                              const s = [...newSeq.steps];
                              s[idx] = { ...s[idx], type: e.target.value as "template" | "ai_generated" };
                              setNewSeq(prev => ({ ...prev, steps: s }));
                            }}
                            className="w-full appearance-none bg-secondary border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none pr-6"
                          >
                            <option value="ai_generated">AI Generated</option>
                            <option value="template">Template</option>
                          </select>
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={step.delay_minutes}
                          onChange={(e) => {
                            const s = [...newSeq.steps];
                            s[idx] = { ...s[idx], delay_minutes: Number(e.target.value) || 60 };
                            setNewSeq(prev => ({ ...prev, steps: s }));
                          }}
                          placeholder="Delay (min)"
                          className="w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const s = newSeq.steps.filter((_, i) => i !== idx);
                          setNewSeq(prev => ({ ...prev, steps: s.length ? s : [{ type: "ai_generated", delay_minutes: 1440, message_template: "", ai_context_prompt: "" }] }));
                        }}
                        className="mt-1 p-1 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setNewSeq(prev => ({ ...prev, steps: [...prev.steps, { type: "ai_generated", delay_minutes: 1440, message_template: "", ai_context_prompt: "" }] }))}
                    className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  >
                    <Plus size={12} /> Add Step
                  </button>
                </div>
              </FieldGroup>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleCreateSequence}
                  disabled={creating || !newSeq.name.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {creating ? "Creating..." : "Create Sequence"}
                </button>
                <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Sequence list */}
          {sequences.length === 0 && !showCreateForm ? (
            <div className="text-center py-10">
              <CalendarClock size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No follow-up sequences yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Create a sequence to automate follow-ups with AI-generated suggestions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sequences.map((seq) => (
                <div key={seq.id} className={`rounded-lg p-4 transition-all ${seq.is_active ? "bg-primary/5 ring-1 ring-primary/40" : "bg-secondary/50 border border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-foreground">{seq.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${seq.is_active ? "bg-green-500/15 text-green-500" : "bg-secondary text-muted-foreground"}`}>
                        {seq.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <Switch checked={seq.is_active} onCheckedChange={() => toggleSequence(seq)} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Trigger: {TRIGGER_EVENTS.find(t => t.value === seq.trigger_event)?.label || seq.trigger_event}</span>
                    <span>Steps: {seq.steps?.length || 0}</span>
                    <span>Max: {seq.max_follow_ups}</span>
                    <span>Escalation: {ESCALATION_ACTIONS.find(a => a.value === seq.escalation_action)?.label || seq.escalation_action}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Active Enrollments */}
      {subTab === "active" && (
        <SectionCard
          title="Active Enrollments"
          description="Leads currently enrolled in follow-up sequences."
        >
          {enrollments.length === 0 ? (
            <div className="text-center py-10">
              <Users size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No active enrollments.</p>
              <p className="text-xs text-muted-foreground mt-1">Leads will be enrolled automatically when they match a sequence trigger.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.lead_name || `Lead ${e.lead_id?.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.sequence_name || "Sequence"} &middot; Step {e.current_step} &middot; {e.follow_ups_sent} sent
                      {e.next_send_at && ` &middot; Next: ${new Date(e.next_send_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {e.status === "paused" ? (
                      <button onClick={() => handleEnrollmentAction(e.id, "resume")} className="p-1.5 rounded-md text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors" title="Resume">
                        <Play size={13} />
                      </button>
                    ) : (
                      <button onClick={() => handleEnrollmentAction(e.id, "pause")} className="p-1.5 rounded-md text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors" title="Pause">
                        <Pause size={13} />
                      </button>
                    )}
                    <button onClick={() => handleEnrollmentAction(e.id, "skip")} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Skip step">
                      <SkipForward size={13} />
                    </button>
                    <button onClick={() => handleEnrollmentAction(e.id, "cancel")} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Cancel">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
      </div>
    </div>
  );
}

// ===========================================================================
// TEMPLATES TAB
// ===========================================================================

interface CopilotTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
  use_count: number;
  created_at: string;
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<CopilotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.getCopilotTemplates();
      setTemplates(res.templates ?? []);
    } catch {
      toast({ title: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await api.createCopilotTemplate({ name: newName.trim(), content: newContent.trim() });
      setNewName("");
      setNewContent("");
      setAdding(false);
      toast({ title: "Template created" });
      loadTemplates();
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      await api.updateCopilotTemplate(id, { name: editName.trim(), content: editContent.trim() });
      setEditingId(null);
      toast({ title: "Template updated" });
      loadTemplates();
    } catch {
      toast({ title: "Failed to update template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCopilotTemplate(id);
      toast({ title: "Template deleted" });
      loadTemplates();
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Template Messages</h3>
          <p className="text-sm text-muted-foreground">Pre-written messages you can quickly send from the chat view.</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            Add Template
          </button>
        )}
      </div>

      {/* Add new template form */}
      {adding && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name (e.g., Greeting, Follow-up)"
            className="dark-input w-full text-sm"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Template message content..."
            className="dark-input w-full text-sm min-h-[80px] resize-y"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setNewName(""); setNewContent(""); }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newContent.trim() || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && !adding && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No templates yet. Click "Add Template" to create your first one.</p>
        </div>
      )}

      {/* Template list */}
      {!loading && templates.map((tpl) => (
        <div key={tpl.id} className="border border-border rounded-lg p-4 bg-card hover:border-primary/20 transition-colors">
          {editingId === tpl.id ? (
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name"
                className="dark-input w-full text-sm"
                autoFocus
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Template message content..."
                className="dark-input w-full text-sm min-h-[80px] resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdate(tpl.id)}
                  disabled={!editName.trim() || !editContent.trim() || saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{tpl.content}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingId(tpl.id); setEditName(tpl.name); setEditContent(tpl.content); }}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// INTEGRATIONS TAB
// ===========================================================================

function IntegrationsTab() {
  const [mcApiKey, setMcApiKey] = useState("");
  const [mcPageId, setMcPageId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mcSaving, setMcSaving] = useState(false);
  const [mcStatus, setMcStatus] = useState<"idle" | "saved" | "error">("idle");

  const [urlSaving, setUrlSaving] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [mcRes, whRes, bookRes] = await Promise.allSettled([
          api.getManychatSettings(),
          api.getWebhookUrl(),
          api.getCalendlyBookingUrl(),
        ]);
        if (mcRes.status === "fulfilled") {
          const mc = mcRes.value as any;
          setMcApiKey(mc?.api_key || mc?.manychat_api_key || "");
          setMcPageId(mc?.page_id || mc?.manychat_page_id || "");
        }
        if (whRes.status === "fulfilled") {
          const wh = whRes.value as any;
          setWebhookUrl(wh?.url || wh?.webhook_url || "");
        }
        if (bookRes.status === "fulfilled") {
          const b = bookRes.value as any;
          setCalendlyUrl(b?.calendly_url || "");
        }
      } catch (_) {}
      setLoading(false);
    };
    loadAll();
  }, []);

  const handleSaveManychat = async () => {
    setMcSaving(true);
    setMcStatus("idle");
    try {
      await api.saveManychatSettings({ manychat_api_key: mcApiKey, manychat_page_id: mcPageId });
      setMcStatus("saved");
      toast({ title: "ManyChat settings saved" });
      setTimeout(() => setMcStatus("idle"), 2000);
    } catch (err) {
      setMcStatus("error");
      toast({ title: "Failed to save ManyChat settings", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setMcSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard" });
    }).catch(() => {});
  };

  if (loading) return <LoadingSkeleton lines={4} />;

  const mcConnected = !!(mcApiKey && mcPageId);
  const whConnected = mcConnected && !!webhookUrl;
  const calConnected = !!calendlyUrl;

  return (
    <div className="space-y-6">
      {/* Status overview */}
      <SectionCard title="Connection Status" description="Overview of your active integrations.">
        <div className="space-y-3">
          {[
            { name: "ManyChat", desc: "Instagram DM automation", connected: mcConnected },
            { name: "Webhook", desc: "Receive DMs via webhook", connected: whConnected },
            { name: "Calendly", desc: "Booking link integration", connected: calConnected },
          ].map((int) => (
            <div key={int.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${int.connected ? "bg-green-500" : "bg-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{int.name}</p>
                  <p className="text-xs text-muted-foreground">{int.desc}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${int.connected ? "text-green-500" : "text-muted-foreground"}`}>
                {int.connected ? "Connected" : "Not connected"}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ManyChat Connection */}
      <SectionCard
        title="ManyChat Connection"
        description="Connect your ManyChat account to receive and respond to Instagram DMs through the copilot."
      >
        <div className="space-y-4">
          <FieldGroup label="ManyChat API Key" required hint="Found in ManyChat > Settings > API.">
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={mcApiKey}
                onChange={(e) => setMcApiKey(e.target.value)}
                placeholder="Enter your ManyChat API key"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={showApiKey ? "Hide" : "Show"}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </FieldGroup>

          <FieldGroup label="Page ID" required hint="Your ManyChat Page ID (found in ManyChat settings).">
            <input
              type="text"
              value={mcPageId}
              onChange={(e) => setMcPageId(e.target.value)}
              placeholder="Enter your ManyChat Page ID"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </FieldGroup>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveManychat}
              disabled={mcSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mcSaving ? <Loader2 size={14} className="animate-spin" /> : mcStatus === "saved" ? <Check size={14} /> : <Save size={14} />}
              {mcSaving ? "Saving..." : mcStatus === "saved" ? "Saved" : "Save ManyChat Settings"}
            </button>
            {mcConnected && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <Check size={12} /> Connected
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Webhook URL */}
      <SectionCard
        title="Webhook URL"
        description="Your unique webhook URL for receiving DMs. Share this with ManyChat or other automation tools."
      >
        {webhookUrl ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono truncate">
              {webhookUrl}
            </div>
            <button
              onClick={() => copyToClipboard(webhookUrl)}
              className="shrink-0 p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Copy URL"
            >
              <Copy size={14} />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Webhook URL will be generated when you connect ManyChat.</p>
        )}
      </SectionCard>

      {/* Booking URL */}
      <SectionCard
        title="Calendly Booking URL"
        description="Paste your Calendly link here. The AI will share this link when a lead is qualified and ready to book."
      >
        <FieldGroup label="Booking URL" hint="The AI will include this exact link in its suggestions when it's time to book a call.">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={calendlyUrl}
              onChange={(e) => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/yourname/30min"
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
            {calendlyUrl && (
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                title="Open booking link"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </FieldGroup>
        <button
          onClick={async () => {
            setUrlSaving(true);
            try {
              await api.saveCalendlyBookingUrl(calendlyUrl.trim());
              toast({ title: "Booking URL saved" });
            } catch (err) {
              toast({ title: "Failed to save booking URL", description: getErrorMessage(err), variant: "destructive" });
            } finally {
              setUrlSaving(false);
            }
          }}
          disabled={urlSaving}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {urlSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {urlSaving ? "Saving..." : "Save Booking URL"}
        </button>
      </SectionCard>
    </div>
  );
}

// ===========================================================================
// NOTIFICATIONS TAB
// ===========================================================================

interface ChannelState {
  slack: { enabled: boolean; webhook_url: string };
  telegram: { enabled: boolean; bot_token: string; chat_id: string };
  browser: { enabled: boolean; sound: boolean };
}

const CHANNEL_DEFAULTS: ChannelState = {
  slack: { enabled: false, webhook_url: "" },
  telegram: { enabled: false, bot_token: "", chat_id: "" },
  browser: { enabled: false, sound: true },
};

function NotificationsTab() {
  const [channels, setChannels] = useState<ChannelState>(CHANNEL_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSlackUrl, setShowSlackUrl] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);

  useEffect(() => {
    api.getNotificationChannels()
      .then((res: any) => {
        const list = Array.isArray(res?.channels) ? res.channels : [];
        const state = { ...CHANNEL_DEFAULTS };
        for (const ch of list) {
          const config = typeof ch.channel_config === "string"
            ? JSON.parse(ch.channel_config)
            : (ch.channel_config || {});
          if (ch.channel_type === "slack") {
            state.slack = { enabled: ch.enabled, webhook_url: config.webhook_url || "" };
          } else if (ch.channel_type === "telegram") {
            state.telegram = { enabled: ch.enabled, bot_token: config.bot_token || "", chat_id: config.chat_id || "" };
          } else if (ch.channel_type === "browser") {
            state.browser = { enabled: ch.enabled, sound: config.sound !== false };
          }
        }
        setChannels(state);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (channelType: "slack" | "telegram" | "browser") => {
    setSaving(channelType);
    try {
      const ch = channels[channelType];
      let channelConfig: any = {};
      if (channelType === "slack") channelConfig = { webhook_url: (ch as any).webhook_url };
      else if (channelType === "telegram") channelConfig = { bot_token: (ch as any).bot_token, chat_id: (ch as any).chat_id };
      else if (channelType === "browser") channelConfig = { sound: (ch as any).sound };

      await api.upsertNotificationChannel(channelType, { enabled: ch.enabled, channel_config: channelConfig });
      // Also save browser sound preference to localStorage for client-side access
      if (channelType === "browser") {
        localStorage.setItem("notif_browser_enabled", String(ch.enabled));
        localStorage.setItem("notif_sound_enabled", String((ch as any).sound));
      }
      toast({ title: `${channelType.charAt(0).toUpperCase() + channelType.slice(1)} settings saved` });
    } catch (err) {
      toast({ title: `Failed to save ${channelType}`, description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (channelType: "slack" | "telegram") => {
    setTesting(channelType);
    try {
      const ch = channels[channelType];
      let channelConfig: any = {};
      if (channelType === "slack") channelConfig = { webhook_url: (ch as any).webhook_url };
      else if (channelType === "telegram") channelConfig = { bot_token: (ch as any).bot_token, chat_id: (ch as any).chat_id };

      await api.testNotificationChannel(channelType, channelConfig);
      toast({ title: "Test notification sent" });
    } catch (err) {
      toast({ title: "Test failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <LoadingSkeleton lines={4} />;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Notification Channels"
        description="Configure how you receive notifications when new DMs arrive or you get assigned leads."
      >
        <div className="space-y-3">
          {[
            { name: "Browser", key: "browser" as const, desc: "In-app + desktop notifications", enabled: channels.browser.enabled },
            { name: "Slack", key: "slack" as const, desc: "Receive alerts via Slack webhook", enabled: channels.slack.enabled },
            { name: "Telegram", key: "telegram" as const, desc: "Receive alerts via Telegram bot", enabled: channels.telegram.enabled },
          ].map((ch) => (
            <div key={ch.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${ch.enabled ? "bg-green-500" : "bg-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${ch.enabled ? "text-green-500" : "text-muted-foreground"}`}>
                {ch.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Browser Notifications */}
      <SectionCard
        title="Browser Notifications"
        description="Receive desktop notifications when new DMs arrive. Sound alerts play when you get assigned a new lead."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Desktop Notifications</p>
              <p className="text-xs text-muted-foreground">Show browser push notifications for new DMs and assignments.</p>
            </div>
            <Switch
              checked={channels.browser.enabled}
              onCheckedChange={(checked) => {
                setChannels((prev) => ({ ...prev, browser: { ...prev.browser, enabled: checked } }));
                // Request browser permission if enabling
                if (checked && "Notification" in window && Notification.permission === "default") {
                  Notification.requestPermission();
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {channels.browser.sound ? <Volume2 size={16} className="text-foreground" /> : <VolumeX size={16} className="text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">Sound Alerts</p>
                <p className="text-xs text-muted-foreground">Play a notification sound when a new DM arrives.</p>
              </div>
            </div>
            <Switch
              checked={channels.browser.sound}
              onCheckedChange={(checked) =>
                setChannels((prev) => ({ ...prev, browser: { ...prev.browser, sound: checked } }))
              }
            />
          </div>

          <button
            onClick={() => handleSave("browser")}
            disabled={saving === "browser"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving === "browser" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving === "browser" ? "Saving..." : "Save Browser Settings"}
          </button>
        </div>
      </SectionCard>

      {/* Slack */}
      <SectionCard
        title="Slack Notifications"
        description="Send notifications to a Slack channel via incoming webhook. Create a webhook in your Slack workspace settings."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Slack</p>
              <p className="text-xs text-muted-foreground">Forward notifications to your Slack channel.</p>
            </div>
            <Switch
              checked={channels.slack.enabled}
              onCheckedChange={(checked) =>
                setChannels((prev) => ({ ...prev, slack: { ...prev.slack, enabled: checked } }))
              }
            />
          </div>

          {channels.slack.enabled && (
            <FieldGroup label="Webhook URL" required hint="Paste your Slack Incoming Webhook URL.">
              <div className="relative">
                <input
                  type={showSlackUrl ? "text" : "password"}
                  value={channels.slack.webhook_url}
                  onChange={(e) =>
                    setChannels((prev) => ({ ...prev, slack: { ...prev.slack, webhook_url: e.target.value } }))
                  }
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-10"
                />
                <button
                  onClick={() => setShowSlackUrl(!showSlackUrl)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSlackUrl ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FieldGroup>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave("slack")}
              disabled={saving === "slack"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving === "slack" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving === "slack" ? "Saving..." : "Save Slack Settings"}
            </button>

            {channels.slack.enabled && channels.slack.webhook_url && (
              <button
                onClick={() => handleTest("slack")}
                disabled={testing === "slack"}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {testing === "slack" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {testing === "slack" ? "Sending..." : "Send Test"}
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Telegram */}
      <SectionCard
        title="Telegram Notifications"
        description="Send notifications to a Telegram chat via a bot. Create a bot with @BotFather and get your chat ID."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Telegram</p>
              <p className="text-xs text-muted-foreground">Forward notifications to your Telegram chat.</p>
            </div>
            <Switch
              checked={channels.telegram.enabled}
              onCheckedChange={(checked) =>
                setChannels((prev) => ({ ...prev, telegram: { ...prev.telegram, enabled: checked } }))
              }
            />
          </div>

          {channels.telegram.enabled && (
            <>
              <FieldGroup label="Bot Token" required hint="Token from @BotFather (e.g. 123456:ABC-DEF...).">
                <div className="relative">
                  <input
                    type={showBotToken ? "text" : "password"}
                    value={channels.telegram.bot_token}
                    onChange={(e) =>
                      setChannels((prev) => ({ ...prev, telegram: { ...prev.telegram, bot_token: e.target.value } }))
                    }
                    placeholder="123456789:ABCdefGHIjklMNO..."
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-10"
                  />
                  <button
                    onClick={() => setShowBotToken(!showBotToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showBotToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </FieldGroup>

              <FieldGroup label="Chat ID" required hint="Your personal or group chat ID. Use @userinfobot or @RawDataBot to find it.">
                <input
                  type="text"
                  value={channels.telegram.chat_id}
                  onChange={(e) =>
                    setChannels((prev) => ({ ...prev, telegram: { ...prev.telegram, chat_id: e.target.value } }))
                  }
                  placeholder="e.g. 123456789"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </FieldGroup>
            </>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave("telegram")}
              disabled={saving === "telegram"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving === "telegram" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving === "telegram" ? "Saving..." : "Save Telegram Settings"}
            </button>

            {channels.telegram.enabled && channels.telegram.bot_token && channels.telegram.chat_id && (
              <button
                onClick={() => handleTest("telegram")}
                disabled={testing === "telegram"}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {testing === "telegram" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {testing === "telegram" ? "Sending..." : "Send Test"}
              </button>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ===========================================================================
// SHARED UI COMPONENTS
// ===========================================================================

function SectionCard({
  title,
  description,
  children,
  headerAction,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {headerAction}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}

function SaveBar({
  status,
  error,
  dirty,
  onSave,
  label,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string;
  dirty: boolean;
  onSave: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={onSave}
        disabled={status === "saving" || status === "saved" || !dirty}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "saving" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : status === "saved" ? (
          <Check size={14} />
        ) : (
          <Save size={14} />
        )}
        {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : label}
      </button>

      {status === "error" && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {status === "saved" && (
        <p className="text-xs text-green-500 flex items-center gap-1">
          <Check size={12} /> Changes saved successfully
        </p>
      )}
    </div>
  );
}

function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="h-4 w-40 bg-secondary rounded animate-pulse" />
        <div className="h-3 w-64 bg-secondary/70 rounded animate-pulse" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 bg-secondary/50 rounded animate-pulse" />
              <div className="h-10 bg-secondary rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CopilotSettings;
