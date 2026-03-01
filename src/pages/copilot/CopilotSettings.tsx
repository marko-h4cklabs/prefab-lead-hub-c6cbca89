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
  Pencil,
  Check,
  X,
  Loader2,
  Save,
  Zap,
  UserCircle,
  CheckCircle2,
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IdentityData {
  business_description: string;
  additional_notes: string;
}

interface BehaviorData {
  conversation_goal: string;
  response_length: string;
  emojis_enabled: boolean;
  tone: string;
}

interface QuoteField {
  id?: string;
  name: string;
  type: string;
  is_enabled: boolean;
  qualification_prompt: string;
}

interface Persona {
  id: string;
  name: string;
  agent_name: string;
  tone: string;
  system_prompt: string;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { key: "identity", label: "Identity", icon: Bot },
  { key: "behavior", label: "Behavior", icon: MessageSquare },
  { key: "fields", label: "Fields", icon: Settings },
  { key: "personas", label: "Personas", icon: Users },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "integrations", label: "Integrations", icon: Link2 },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TONES = [
  { value: "professional", label: "Professional", desc: "Polished and business-like" },
  { value: "friendly", label: "Friendly", desc: "Warm and conversational" },
  { value: "confident", label: "Confident", desc: "Bold and persuasive" },
  { value: "relatable", label: "Relatable", desc: "Casual and authentic" },
];

const RESPONSE_LENGTHS = [
  { value: "short", label: "Short", sub: "1-2 sentences" },
  { value: "medium", label: "Medium", sub: "2-4 sentences" },
  { value: "long", label: "Long", sub: "Up to 8 sentences" },
];

const FIELD_TYPES = [
  "text",
  "number",
  "email",
  "phone",
  "url",
  "date",
  "select",
  "boolean",
];

const FIELD_PRIORITIES = [
  { value: "required", label: "Required" },
  { value: "recommended", label: "Recommended" },
  { value: "optional", label: "Optional" },
];

const IDENTITY_DEFAULTS: IdentityData = {
  business_description: "",
  additional_notes: "",
};

const BEHAVIOR_DEFAULTS: BehaviorData = {
  conversation_goal: "",
  response_length: "medium",
  emojis_enabled: false,
  tone: "professional",
};

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

const CopilotSettings = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[hsl(0_0%_4%)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-0">
        <h1 className="text-xl font-bold text-foreground mb-4">Copilot Settings</h1>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                  active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl">
          {activeTab === "identity" && <IdentityTab />}
          {activeTab === "behavior" && <BehaviorTab />}
          {activeTab === "fields" && <FieldsTab />}
          {activeTab === "personas" && <PersonasTab />}
          {activeTab === "followups" && <FollowUpsTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// IDENTITY TAB
// ===========================================================================

function IdentityTab() {
  const [data, setData] = useState<IdentityData>(IDENTITY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(IDENTITY_DEFAULTS));

  useEffect(() => {
    api
      .getCopilotIdentity()
      .then((res: any) => {
        const merged: IdentityData = {
          business_description: res?.business_description || "",
          additional_notes: res?.additional_notes || "",
        };
        setData(merged);
        initialRef.current = JSON.stringify(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<IdentityData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      setIsDirty(JSON.stringify(next) !== initialRef.current);
      return next;
    });
  };

  const handleSave = async () => {
    if (!data.business_description.trim()) {
      setSaveError("Business description is required.");
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saving");
    setSaveError("");
    try {
      await api.putCopilotIdentity(data);
      initialRef.current = JSON.stringify(data);
      setIsDirty(false);
      setSaveStatus("saved");
      toast({ title: "Identity settings saved" });
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err));
      setSaveStatus("error");
    }
  };

  if (loading) return <LoadingSkeleton lines={4} />;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Business Identity"
        description="Define your business so the copilot AI understands your context and can generate relevant suggestions."
      >
        <div className="space-y-5">
          {/* Business Description */}
          <FieldGroup label="Business Description" required hint="What does your business do? Who are your customers?">
            <textarea
              value={data.business_description}
              onChange={(e) => update({ business_description: e.target.value })}
              rows={4}
              placeholder="e.g. We are a digital marketing agency specializing in social media management for e-commerce brands..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </FieldGroup>

          {/* Additional Notes */}
          <FieldGroup label="Additional Notes" hint="Any extra context, instructions, or guidelines for the AI.">
            <textarea
              value={data.additional_notes}
              onChange={(e) => update({ additional_notes: e.target.value })}
              rows={3}
              placeholder="e.g. Always mention our free consultation offer. Never discuss competitor pricing..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </FieldGroup>
        </div>
      </SectionCard>

      {/* Save */}
      <SaveBar
        status={saveStatus}
        error={saveError}
        dirty={isDirty}
        onSave={handleSave}
        label="Save Identity"
      />
    </div>
  );
}

// ===========================================================================
// BEHAVIOR TAB
// ===========================================================================

function BehaviorTab() {
  const [data, setData] = useState<BehaviorData>(BEHAVIOR_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(BEHAVIOR_DEFAULTS));

  useEffect(() => {
    api
      .getCopilotBehavior()
      .then((res: any) => {
        const merged: BehaviorData = {
          conversation_goal: res?.conversation_goal || "",
          response_length: res?.response_length || "medium",
          emojis_enabled: res?.emojis_enabled ?? false,
          tone: res?.tone || "professional",
        };
        setData(merged);
        initialRef.current = JSON.stringify(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<BehaviorData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      setIsDirty(JSON.stringify(next) !== initialRef.current);
      return next;
    });
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setSaveError("");
    try {
      await api.putCopilotBehavior(data);
      initialRef.current = JSON.stringify(data);
      setIsDirty(false);
      setSaveStatus("saved");
      toast({ title: "Behavior settings saved" });
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err));
      setSaveStatus("error");
    }
  };

  if (loading) return <LoadingSkeleton lines={5} />;

  return (
    <div className="space-y-6">
      {/* Conversation Goal */}
      <SectionCard
        title="Conversation Goal"
        description="What should the copilot help you achieve in each conversation?"
      >
        <FieldGroup label="Goal" hint="Describe the primary objective when the AI drafts messages for you.">
          <textarea
            value={data.conversation_goal}
            onChange={(e) => update({ conversation_goal: e.target.value })}
            rows={3}
            placeholder="e.g. Qualify leads by understanding their budget, timeline, and specific needs before suggesting a call..."
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </FieldGroup>
      </SectionCard>

      {/* Tone */}
      <SectionCard title="Tone" description="Choose the tone for AI-generated message drafts.">
        <div className="grid grid-cols-2 gap-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => update({ tone: t.value })}
              className={`text-left rounded-lg p-3 border-2 transition-all ${
                data.tone === t.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-secondary/30 hover:border-muted-foreground"
              }`}
            >
              <span className="text-sm font-semibold text-foreground">{t.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Response Length */}
      <SectionCard
        title="Response Length"
        description="How long should drafted messages be?"
      >
        <div className="grid grid-cols-3 gap-3">
          {RESPONSE_LENGTHS.map((l) => (
            <button
              key={l.value}
              onClick={() => update({ response_length: l.value })}
              className={`rounded-lg p-3 border-2 text-center transition-all ${
                data.response_length === l.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-secondary/30 hover:border-muted-foreground"
              }`}
            >
              <span className="text-sm font-semibold text-foreground block">{l.label}</span>
              <span className="text-xs text-muted-foreground">{l.sub}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Emojis Toggle */}
      <SectionCard title="Emojis" description="Allow the AI to include emojis in drafted messages.">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Enable Emojis</p>
            <p className="text-xs text-muted-foreground">When enabled, the AI may add emojis to make messages feel more casual.</p>
          </div>
          <Switch
            checked={data.emojis_enabled}
            onCheckedChange={(checked) => update({ emojis_enabled: checked })}
          />
        </div>
      </SectionCard>

      {/* Save */}
      <SaveBar
        status={saveStatus}
        error={saveError}
        dirty={isDirty}
        onSave={handleSave}
        label="Save Behavior"
      />
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
      const next = [...prev, { id: crypto.randomUUID(), name: "", type: "text", is_enabled: true, qualification_prompt: "" }];
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
                <div className="flex-1 grid grid-cols-[1fr_2fr] gap-3">
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

interface PersonaForm {
  name: string;
  agent_name: string;
  tone: string;
  system_prompt: string;
}

const PERSONA_DEFAULTS: PersonaForm = {
  name: "",
  agent_name: "",
  tone: "professional",
  system_prompt: "",
};

function PersonasTab() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Persona | null>(null);
  const [form, setForm] = useState<PersonaForm>(PERSONA_DEFAULTS);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPersonas = useCallback(() => {
    api
      .getCopilotPersonas()
      .then((res: any) => {
        setPersonas(normalizeList(res, ["items", "personas", "data"]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const openAdd = () => {
    setEditing(null);
    setForm(PERSONA_DEFAULTS);
    setShowForm(true);
  };

  const openEdit = (p: Persona) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      agent_name: p.agent_name || "",
      tone: p.tone || "professional",
      system_prompt: p.system_prompt || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(PERSONA_DEFAULTS);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Persona name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.updateCopilotPersona(editing.id, form);
        toast({ title: "Persona updated" });
      } else {
        await api.createCopilotPersona(form);
        toast({ title: "Persona created" });
      }
      closeForm();
      fetchPersonas();
    } catch (err) {
      toast({ title: "Failed to save persona", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this persona? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteCopilotPersona(id);
      toast({ title: "Persona deleted" });
      fetchPersonas();
    } catch (err) {
      toast({ title: "Failed to delete persona", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      await api.activateCopilotPersona(id);
      toast({ title: "Persona activated" });
      fetchPersonas();
    } catch (err) {
      toast({ title: "Failed to activate persona", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setActivatingId(null);
    }
  };

  if (loading) return <LoadingSkeleton lines={4} />;

  return (
    <div className="space-y-6">
      <SectionCard
        title="AI Personas"
        description="Create different personas to switch the copilot's personality and behavior. Only one persona can be active at a time."
        headerAction={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={12} /> Add Persona
          </button>
        }
      >
        {/* Persona form (inline) */}
        {showForm && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {editing ? "Edit Persona" : "New Persona"}
              </h3>
              <button onClick={closeForm} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Persona Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales Closer"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </FieldGroup>

              <FieldGroup label="Agent Name">
                <input
                  type="text"
                  value={form.agent_name}
                  onChange={(e) => setForm((f) => ({ ...f, agent_name: e.target.value }))}
                  placeholder="e.g. Alex"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Tone">
              <div className="grid grid-cols-4 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setForm((f) => ({ ...f, tone: t.value }))}
                    className={`rounded-lg p-2 border-2 text-center transition-all text-xs ${
                      form.tone === t.value
                        ? "border-primary bg-primary/5 text-foreground font-semibold"
                        : "border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="System Prompt" hint="Custom instructions for this persona's behavior.">
              <textarea
                value={form.system_prompt}
                onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                rows={3}
                placeholder="e.g. You are a high-energy sales closer who focuses on urgency and value..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </FieldGroup>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : editing ? "Update Persona" : "Create Persona"}
              </button>
              <button
                onClick={closeForm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Persona list */}
        {personas.length === 0 && !showForm ? (
          <div className="text-center py-10">
            <UserCircle size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No personas yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a persona to customize how the copilot drafts messages.
            </p>
            <button
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={12} /> Create First Persona
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {personas.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg p-4 transition-all ${
                  p.active
                    ? "bg-primary/5 ring-1 ring-primary/40"
                    : "bg-secondary/50 border border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.active ? (
                      <CheckCircle2 size={18} className="text-primary shrink-0" />
                    ) : (
                      <UserCircle size={18} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-bold text-foreground truncate">{p.name}</span>
                    {p.active && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                        <Zap size={8} /> ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!p.active && (
                      <button
                        onClick={() => handleActivate(p.id)}
                        disabled={activatingId === p.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {activatingId === p.id ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Edit persona"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={!!p.active || deletingId === p.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={p.active ? "Cannot delete active persona" : "Delete persona"}
                    >
                      {deletingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                  {p.agent_name && (
                    <span className="text-xs text-muted-foreground">
                      Agent: <span className="text-foreground font-medium">{p.agent_name}</span>
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground capitalize">
                    {p.tone || "professional"}
                  </span>
                </div>

                {/* System prompt preview */}
                {p.system_prompt && (
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 italic leading-relaxed">
                    {p.system_prompt.slice(0, 150)}
                    {p.system_prompt.length > 150 ? "..." : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
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
    steps: [{ type: "ai_generated" as const, delay_minutes: 1440, message_template: "", ai_context_prompt: "" }],
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

  // Calendly API integration
  const [calStatus, setCalStatus] = useState<any>(null);
  const [calToken, setCalToken] = useState("");
  const [calSaving, setCalSaving] = useState(false);
  const [showCalToken, setShowCalToken] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [mcRes, whRes, bookRes, calRes] = await Promise.allSettled([
          api.getManychatSettings(),
          api.getWebhookUrl(),
          api.getBookingSettings(),
          api.getCalendlyStatus(),
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
          setCalendlyUrl(b?.calendly_url || b?.booking_url || "");
        }
        if (calRes.status === "fulfilled") {
          setCalStatus(calRes.value);
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
  const calConnected = calStatus?.connected || !!calendlyUrl;

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

      {/* Calendly API Integration */}
      <SectionCard
        title="Calendly Integration"
        description="Connect your Calendly account to display booked calls in the Calendar tab."
      >
        {calStatus?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {calStatus.calendly_name || "Calendly Connected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {calStatus.calendly_email || calStatus.scheduling_url || ""}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.disconnectCalendly();
                    setCalStatus({ connected: false });
                    toast({ title: "Calendly disconnected" });
                  } catch {
                    toast({ title: "Failed to disconnect", variant: "destructive" });
                  }
                }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Disconnect
              </button>
            </div>
            {calStatus.scheduling_url && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ExternalLink size={10} />
                <a href={calStatus.scheduling_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {calStatus.scheduling_url}
                </a>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <FieldGroup
              label="Calendly API Token"
              hint={
                <>
                  Go to{" "}
                  <a href="https://calendly.com/integrations/api_webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Calendly &rarr; API & Webhooks
                  </a>{" "}
                  and generate a Personal Access Token.
                </>
              }
            >
              <div className="relative">
                <input
                  type={showCalToken ? "text" : "password"}
                  value={calToken}
                  onChange={(e) => setCalToken(e.target.value)}
                  placeholder="eyJraWQiOi..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-16"
                />
                <button
                  onClick={() => setShowCalToken(!showCalToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={showCalToken ? "Hide" : "Show"}
                >
                  {showCalToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FieldGroup>

            <button
              onClick={async () => {
                if (!calToken.trim()) return;
                setCalSaving(true);
                try {
                  const res = await api.saveCalendlyToken(calToken.trim());
                  setCalStatus({
                    connected: true,
                    calendly_name: res?.calendly_name,
                    calendly_email: res?.calendly_email,
                    scheduling_url: res?.scheduling_url,
                  });
                  setCalToken("");
                  toast({ title: "Calendly connected successfully" });
                } catch (err) {
                  toast({ title: "Failed to connect Calendly", description: getErrorMessage(err), variant: "destructive" });
                } finally {
                  setCalSaving(false);
                }
              }}
              disabled={!calToken.trim() || calSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calSaving ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {calSaving ? "Connecting..." : "Connect Calendly"}
            </button>
          </div>
        )}

        {/* Booking URL (from behavior settings) */}
        {calendlyUrl && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Booking URL (for AI to share)</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground truncate">
                {calendlyUrl}
              </div>
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                title="Open booking link"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}
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
