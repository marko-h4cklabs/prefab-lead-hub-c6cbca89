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
  priority: string;
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
          name: f.name || f.label || "",
          type: f.type || "text",
          priority: f.priority || "optional",
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
      const next = [...prev, { id: crypto.randomUUID(), name: "", type: "text", priority: "optional" }];
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
      await api.putCopilotFields(fields);
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
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="pt-2 text-muted-foreground/50">
                  <GripVertical size={14} />
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Field Name</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(idx, { name: e.target.value })}
                      placeholder="e.g. Budget"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Type</label>
                    <div className="relative">
                      <select
                        value={field.type}
                        onChange={(e) => updateField(idx, { type: e.target.value })}
                        className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-8"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Priority</label>
                    <div className="relative">
                      <select
                        value={field.priority}
                        onChange={(e) => updateField(idx, { priority: e.target.value })}
                        className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors pr-8"
                      >
                        {FIELD_PRIORITIES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeField(idx)}
                  className="mt-6 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
  hint?: string;
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
