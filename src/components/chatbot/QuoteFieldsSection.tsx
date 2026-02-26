import { useEffect, useState, useRef, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Save, X, ChevronUp, ChevronDown, Trash2, Plus, Loader2 } from "lucide-react";

// --- Preset definitions ---

interface PresetConfig {
  id: string;
  label: string;
  description: string;
  configType?: "currency" | "options" | "dimensions" | "completion";
}

const PRESETS: PresetConfig[] = [
  { id: "budget", label: "Budget", description: "Requested budget or price range", configType: "currency" },
  { id: "location", label: "Location", description: "Project or delivery location", configType: "options" },
  { id: "time_window", label: "Time Window", description: "Desired timeline or delivery window", configType: "options" },
  { id: "email_address", label: "Email Address", description: "Contact email" },
  { id: "phone_number", label: "Phone Number", description: "Contact phone number" },
  { id: "full_name", label: "Full Name", description: "Contact full name" },
  { id: "additional_notes", label: "Additional Notes", description: "Any extra information from the lead" },
  { id: "pictures", label: "Pictures", description: "Photo uploads from the lead" },
];

const TagInput = ({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-sm text-xs font-mono">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive"><X size={10} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} placeholder="Add option…" className="dark-input py-0.5 px-2 text-xs w-28" />
    </div>
  );
};

interface PresetState {
  enabled: boolean;
  priority: number;
  currency?: string;
  allowed_options?: string[];
  dimension_axes?: string[];
  dimension_unit?: string;
  completion_options?: string[];
}

type AllPresetsState = Record<string, PresetState>;

interface CustomField {
  id: string;
  label: string;
  field_type: string;
  is_custom: boolean;
}

function buildDefault(): AllPresetsState {
  const state: AllPresetsState = {};
  PRESETS.forEach((p, i) => {
    const s: PresetState = { enabled: false, priority: (i + 1) * 10 };
    if (p.configType === "currency") s.currency = "EUR";
    if (p.configType === "options") s.allowed_options = [];
    if (p.configType === "dimensions") { s.dimension_axes = ["length", "width"]; s.dimension_unit = "m"; }
    if (p.configType === "completion") s.completion_options = [];
    state[p.id] = s;
  });
  return state;
}

function getEnabledOrder(presets: AllPresetsState): string[] {
  return PRESETS
    .filter((p) => presets[p.id]?.enabled)
    .sort((a, b) => (presets[a.id].priority ?? 999) - (presets[b.id].priority ?? 999))
    .map((p) => p.id);
}

function reassignPriorities(presets: AllPresetsState, orderedIds: string[]): AllPresetsState {
  const next = { ...presets };
  orderedIds.forEach((id, i) => { next[id] = { ...next[id], priority: i + 1 }; });
  return next;
}

const QuoteFieldsSection = ({ onFieldsChanged }: { onFieldsChanged?: () => void }) => {
  const [presets, setPresets] = useState<AllPresetsState>(buildDefault);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef<string>("");

  // Custom field creator state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [addingCustom, setAddingCustom] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const enabledOrder = useMemo(() => getEnabledOrder(presets), [presets]);

  const applyFetched = (data: unknown) => {
    const raw = data as Record<string, unknown> | unknown[];
    const list: unknown[] = Array.isArray(raw) ? raw : (raw as any)?.presets || (raw as any)?.fields || [];
    const merged = buildDefault();
    const customs: CustomField[] = [];
    if (!Array.isArray(list)) return { merged, customs };
    list.forEach((item: any) => {
      if (!item?.name && !item?.label) return;
      if (item.is_custom) {
        customs.push({ id: item.id || item.name, label: item.label || item.name, field_type: item.field_type || "text", is_custom: true });
        return;
      }
      const name = item.name;
      if (!merged[name]) return;
      merged[name].enabled = !!item.is_enabled;
      if (typeof item.priority === "number") merged[name].priority = item.priority;
      const c = item.config || {};
      if (c.defaultUnit) merged[name].currency = c.defaultUnit;
      if (c.allowed_options) merged[name].allowed_options = c.allowed_options;
      if (c.enabledParts) merged[name].dimension_axes = c.enabledParts;
      if (c.unit) merged[name].dimension_unit = c.unit;
      if (c.completion_options) merged[name].completion_options = c.completion_options;
    });
    return { merged, customs };
  };

  useEffect(() => {
    api.getQuoteFields()
      .then((res) => {
        const { merged, customs } = applyFetched(res);
        setPresets(merged);
        setCustomFields(customs);
        initialRef.current = JSON.stringify(merged);
      })
      .catch(() => {
        const def = buildDefault();
        setPresets(def);
        initialRef.current = JSON.stringify(def);
      })
      .finally(() => setLoading(false));
  }, []);

  const markDirty = (next: AllPresetsState) => { setIsDirty(JSON.stringify(next) !== initialRef.current); };

  const update = (id: string, patch: Partial<PresetState>) => {
    setPresets((prev) => {
      let next = { ...prev, [id]: { ...prev[id], ...patch } };
      if (patch.enabled === true && !prev[id].enabled) {
        const currentEnabled = getEnabledOrder(prev);
        next[id] = { ...next[id], priority: currentEnabled.length + 1 };
      }
      if (patch.enabled === false && prev[id].enabled) {
        const remaining = getEnabledOrder(prev).filter((x) => x !== id);
        next = reassignPriorities(next, remaining);
      }
      markDirty(next);
      return next;
    });
  };

  const moveOrder = (id: string, direction: "up" | "down") => {
    setPresets((prev) => {
      const order = getEnabledOrder(prev);
      const idx = order.indexOf(id);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= order.length) return prev;
      const newOrder = [...order];
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      const next = reassignPriorities({ ...prev }, newOrder);
      markDirty(next);
      return next;
    });
  };

  const toPayload = (state: AllPresetsState) =>
    PRESETS.map((p) => {
      const s = state[p.id];
      const config: Record<string, unknown> = {};
      if (p.configType === "currency") config.defaultUnit = s.currency || "EUR";
      if (p.configType === "options") config.allowed_options = s.allowed_options || [];
      if (p.configType === "dimensions") { config.enabledParts = s.dimension_axes || []; config.unit = s.dimension_unit || "m"; }
      if (p.configType === "completion") config.completion_options = s.completion_options || [];
      return { name: p.id, is_enabled: s.enabled, priority: s.priority, config };
    });

  const handleSave = () => {
    setSaving(true);
    api.putQuoteFields({ presets: toPayload(presets) })
      .then(() => {
        toast({ title: "Saved", description: "Quote fields updated." });
        return api.getQuoteFields();
      })
      .then((res) => {
        const { merged, customs } = applyFetched(res);
        setPresets(merged);
        setCustomFields(customs);
        initialRef.current = JSON.stringify(merged);
        setIsDirty(false);
      })
      .catch((err) => { toast({ title: "Save failed", description: getErrorMessage(err), variant: "destructive" }); })
      .finally(() => setSaving(false));
  };

  const refetchFields = async () => {
    try {
      const res = await api.getQuoteFields();
      const { merged, customs } = applyFetched(res);
      setPresets(merged);
      setCustomFields(customs);
      initialRef.current = JSON.stringify(merged);
      setIsDirty(false);
    } catch { /* best effort */ }
  };

  const handleAddCustom = async () => {
    if (!newLabel.trim()) return;
    setAddingCustom(true);
    try {
      await api.createCustomQuoteField({ label: newLabel.trim(), field_type: newType });
      setNewLabel("");
      setNewType("text");
      toast({ title: "Custom field added" });
      await refetchFields();
      onFieldsChanged?.();
    } catch (err) {
      toast({ title: "Failed to add field", description: getErrorMessage(err), variant: "destructive" });
    } finally { setAddingCustom(false); }
  };

  const handleDeleteCustom = async (id: string) => {
    if (!confirm("Remove this field?")) return;
    setDeletingId(id);
    try {
      await api.deleteQuoteField(id);
      toast({ title: "Field removed" });
      await refetchFields();
      onFieldsChanged?.();
    } catch (err) {
      toast({ title: "Failed to remove", description: getErrorMessage(err), variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  const renderPreset = (preset: PresetConfig) => {
    const state = presets[preset.id];
    const enabled = state?.enabled ?? false;
    const globalIdx = enabledOrder.indexOf(preset.id);
    const orderNum = globalIdx >= 0 ? globalIdx + 1 : -1;
    const isFirst = orderNum === 1;
    const isLast = orderNum === enabledOrder.length;

    return (
      <div key={preset.id} className="rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => update(preset.id, { enabled: !enabled })}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
          </button>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground">{preset.label}</span>
            <p className="text-[11px] text-muted-foreground">{preset.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {enabled ? (
              <>
                <span className="text-xs font-mono text-muted-foreground w-6 text-center">{orderNum}</span>
                <button type="button" disabled={isFirst} onClick={() => moveOrder(preset.id, "up")} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground hover:text-foreground"><ChevronUp size={14} /></button>
                <button type="button" disabled={isLast} onClick={() => moveOrder(preset.id, "down")} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground hover:text-foreground"><ChevronDown size={14} /></button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground w-6 text-center">—</span>
            )}
          </div>
        </div>

        {enabled && preset.configType && (
          <div className="mt-2 pt-2 border-t border-border">
            {preset.configType === "currency" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">Unit:</span>
                <select value={state.currency || "EUR"} onChange={(e) => update(preset.id, { currency: e.target.value })} className="dark-input py-0.5 px-2 text-xs w-24">
                  <option value="EUR">EUR</option><option value="USD">USD</option>
                </select>
              </div>
            )}
            {preset.configType === "options" && (
              <div className="space-y-1">
                <span className="text-xs font-mono text-muted-foreground">Allowed options:</span>
                <TagInput tags={state.allowed_options || []} onChange={(t) => update(preset.id, { allowed_options: t })} />
              </div>
            )}
            {preset.configType === "dimensions" && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">Axes:</span>
                  {(["length", "width", "height"] as const).map((axis) => {
                    const axes = state.dimension_axes || [];
                    const checked = axes.includes(axis);
                    return (
                      <label key={axis} className="flex items-center gap-1 text-xs font-mono">
                        <input type="checkbox" checked={checked} onChange={() => { const next = checked ? axes.filter((a) => a !== axis) : [...axes, axis]; update(preset.id, { dimension_axes: next }); }} className="accent-primary" />
                        {axis}
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">Unit:</span>
                  <select value={state.dimension_unit || "m"} onChange={(e) => update(preset.id, { dimension_unit: e.target.value })} className="dark-input py-0.5 px-2 text-xs w-20">
                    <option value="m">m</option><option value="cm">cm</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground">📋 Data Collection</h2>
      <p className="text-xs text-muted-foreground">Select what information your AI collects from leads. Start with the presets below, then add any custom fields your business needs.</p>

      {/* Preset fields — enabled first sorted by priority, then disabled */}
      <div className="space-y-2">
        {[...PRESETS]
          .sort((a, b) => {
            const aEnabled = presets[a.id]?.enabled ?? false;
            const bEnabled = presets[b.id]?.enabled ?? false;
            if (aEnabled && !bEnabled) return -1;
            if (!aEnabled && bEnabled) return 1;
            if (aEnabled && bEnabled) return (presets[a.id]?.priority ?? 999) - (presets[b.id]?.priority ?? 999);
            return 0;
          })
          .map(renderPreset)}
      </div>

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Custom Fields</h3>
          {customFields.map((field) => (
            <div key={field.id} className="rounded-lg border border-border bg-secondary/30 p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground">{field.label}</span>
                <p className="text-[11px] text-muted-foreground capitalize">{field.field_type === "boolean" ? "Yes / No" : field.field_type} answer</p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Custom</span>
              <button
                onClick={() => handleDeleteCustom(field.id)}
                disabled={deletingId === field.id}
                className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
              >
                {deletingId === field.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Custom Field */}
      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Plus size={14} /> Add Custom Field</h3>
        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Project deadline, Budget range, Location..."
            className="dark-input flex-1 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="dark-input text-sm w-32">
            <option value="text">Text answer</option>
            <option value="number">Number</option>
            <option value="boolean">Yes / No</option>
          </select>
          <button
            onClick={handleAddCustom}
            disabled={addingCustom || !newLabel.trim()}
            className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 text-sm px-4"
          >
            {addingCustom ? <Loader2 size={14} className="animate-spin" /> : "Add"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">💡 Variable names are assigned automatically so they work correctly in your AI conversations</p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={`dark-btn ${isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"}`}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
};

export default QuoteFieldsSection;
