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
  { id: "location", label: "Location", description: "Project or delivery location" },
  { id: "time_window", label: "Time Window", description: "Desired timeline or delivery window" },
  { id: "email_address", label: "Email Address", description: "Contact email" },
  { id: "phone_number", label: "Phone Number", description: "Contact phone number" },
  { id: "full_name", label: "Full Name", description: "Contact full name" },
  { id: "additional_notes", label: "Additional Notes", description: "Any extra information from the lead" },
  { id: "pictures", label: "Pictures", description: "Photo uploads from the lead" },
];

interface PresetState {
  enabled: boolean;
  priority: number;
  currency?: string;
  allowed_options?: string[];
  dimension_axes?: string[];
  dimension_unit?: string;
  completion_options?: string[];
  qualification_prompt?: string;
}

type AllPresetsState = Record<string, PresetState>;

interface CustomField {
  id: string;
  label: string;
  field_type: string;
  is_custom: boolean;
  priority: number;
  qualification_prompt?: string;
}

// Unified item for the combined list
interface UnifiedField {
  key: string; // preset id or custom field id
  label: string;
  description: string;
  enabled: boolean;
  priority: number;
  isCustom: boolean;
  customId?: string;
  fieldType?: string;
  configType?: "currency";
  currency?: string;
  qualification_prompt?: string;
}

function buildDefault(): AllPresetsState {
  const state: AllPresetsState = {};
  PRESETS.forEach((p, i) => {
    const s: PresetState = { enabled: false, priority: (i + 1) * 10 };
    if (p.configType === "currency") s.currency = "EUR";
    state[p.id] = s;
  });
  return state;
}

function getEnabledOrder(presets: AllPresetsState, customs: CustomField[]): string[] {
  const presetItems = PRESETS
    .filter((p) => presets[p.id]?.enabled)
    .map((p) => ({ key: p.id, priority: presets[p.id].priority ?? 999 }));
  const customItems = customs
    .map((c) => ({ key: `custom_${c.id}`, priority: c.priority ?? 999 }));
  return [...presetItems, ...customItems]
    .sort((a, b) => a.priority - b.priority)
    .map((x) => x.key);
}

const QuoteFieldsSection = ({ onFieldsChanged }: { onFieldsChanged?: () => void }) => {
  const [presets, setPresets] = useState<AllPresetsState>(buildDefault);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef<string>("");
  const initialCustomRef = useRef<string>("");

  // Custom field creator state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [addingCustom, setAddingCustom] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const enabledOrder = useMemo(() => getEnabledOrder(presets, customFields), [presets, customFields]);

  const applyFetched = (data: unknown) => {
    const raw = data as Record<string, unknown> | unknown[];
    const list: unknown[] = Array.isArray(raw) ? raw : (raw as any)?.presets || (raw as any)?.fields || [];
    const merged = buildDefault();
    const customs: CustomField[] = [];
    if (!Array.isArray(list)) return { merged, customs };
    list.forEach((item: any) => {
      if (!item?.name && !item?.label) return;
      if (item.is_custom) {
        customs.push({
          id: item.id || item.name,
          label: item.label || item.name,
          field_type: item.field_type || "text",
          is_custom: true,
          priority: item.priority ?? 500,
          qualification_prompt: item.qualification_prompt ?? "",
        });
        return;
      }
      const name = item.name;
      if (!merged[name]) return;
      merged[name].enabled = !!item.is_enabled;
      if (typeof item.priority === "number") merged[name].priority = item.priority;
      merged[name].qualification_prompt = item.qualification_prompt ?? "";
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
        initialCustomRef.current = JSON.stringify(customs);
      })
      .catch(() => {
        const def = buildDefault();
        setPresets(def);
        initialRef.current = JSON.stringify(def);
        initialCustomRef.current = JSON.stringify([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const markDirty = (nextPresets: AllPresetsState, nextCustoms?: CustomField[]) => {
    const presetsDirty = JSON.stringify(nextPresets) !== initialRef.current;
    const customsDirty = nextCustoms ? JSON.stringify(nextCustoms) !== initialCustomRef.current : JSON.stringify(customFields) !== initialCustomRef.current;
    setIsDirty(presetsDirty || customsDirty);
  };

  const update = (id: string, patch: Partial<PresetState>) => {
    setPresets((prev) => {
      let next = { ...prev, [id]: { ...prev[id], ...patch } };
      if (patch.enabled === true && !prev[id].enabled) {
        const currentEnabled = getEnabledOrder(prev, customFields);
        next[id] = { ...next[id], priority: currentEnabled.length + 1 };
      }
      if (patch.enabled === false && prev[id].enabled) {
        // Reassign priorities for remaining enabled items
        const remaining = getEnabledOrder(prev, customFields).filter((x) => x !== id);
        remaining.forEach((key, i) => {
          if (!key.startsWith("custom_") && next[key]) {
            next[key] = { ...next[key], priority: i + 1 };
          }
        });
        // Also update custom field priorities
        let ci = remaining.filter((k) => !k.startsWith("custom_")).length;
        setCustomFields((prevC) => {
          const updated = prevC.map((c) => {
            const idx = remaining.indexOf(`custom_${c.id}`);
            if (idx >= 0) return { ...c, priority: idx + 1 };
            return c;
          });
          return updated;
        });
      }
      markDirty(next);
      return next;
    });
  };

  const updateCustom = (id: string, patch: Partial<CustomField>) => {
    setCustomFields((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      markDirty(presets, next);
      return next;
    });
  };

  const moveOrder = (key: string, direction: "up" | "down") => {
    const order = [...enabledOrder];
    const idx = order.indexOf(key);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= order.length) return;
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];

    // Reassign priorities based on new order
    setPresets((prev) => {
      const next = { ...prev };
      order.forEach((k, i) => {
        if (!k.startsWith("custom_") && next[k]) {
          next[k] = { ...next[k], priority: i + 1 };
        }
      });
      markDirty(next);
      return next;
    });
    setCustomFields((prev) => {
      const next = prev.map((c) => {
        const orderIdx = order.indexOf(`custom_${c.id}`);
        if (orderIdx >= 0) return { ...c, priority: orderIdx + 1 };
        return c;
      });
      return next;
    });
  };

  const toPayload = (state: AllPresetsState) =>
    PRESETS.map((p) => {
      const s = state[p.id];
      const config: Record<string, unknown> = {};
      if (p.configType === "currency") config.defaultUnit = s.currency || "EUR";
      return {
        name: p.id,
        is_enabled: s.enabled,
        priority: s.priority,
        config,
        qualification_prompt: s.qualification_prompt || null,
      };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save presets
      await api.putQuoteFields({ presets: toPayload(presets) });

      // Save custom field qualification prompts
      for (const cf of customFields) {
        const initial = JSON.parse(initialCustomRef.current || "[]") as CustomField[];
        const orig = initial.find((c) => c.id === cf.id);
        if (orig && orig.qualification_prompt !== cf.qualification_prompt) {
          await api.updateCustomQuoteField(cf.id, { qualification_prompt: cf.qualification_prompt || null });
        }
      }

      toast({ title: "Saved", description: "Qualification fields updated." });

      // Refetch
      const res = await api.getQuoteFields();
      const { merged, customs } = applyFetched(res);
      setPresets(merged);
      setCustomFields(customs);
      initialRef.current = JSON.stringify(merged);
      initialCustomRef.current = JSON.stringify(customs);
      setIsDirty(false);
      onFieldsChanged?.();
    } catch (err) {
      toast({ title: "Save failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const refetchFields = async () => {
    try {
      const res = await api.getQuoteFields();
      const { merged, customs } = applyFetched(res);
      setPresets(merged);
      setCustomFields(customs);
      initialRef.current = JSON.stringify(merged);
      initialCustomRef.current = JSON.stringify(customs);
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

  // Build unified list: enabled presets + custom fields sorted by priority, then disabled presets
  const unifiedEnabled: UnifiedField[] = [];
  const unifiedDisabled: UnifiedField[] = [];

  PRESETS.forEach((p) => {
    const s = presets[p.id];
    const item: UnifiedField = {
      key: p.id,
      label: p.label,
      description: p.description,
      enabled: s?.enabled ?? false,
      priority: s?.priority ?? 999,
      isCustom: false,
      configType: p.configType === "currency" ? "currency" : undefined,
      currency: s?.currency,
      qualification_prompt: s?.qualification_prompt ?? "",
    };
    if (item.enabled) unifiedEnabled.push(item);
    else unifiedDisabled.push(item);
  });

  customFields.forEach((cf) => {
    unifiedEnabled.push({
      key: `custom_${cf.id}`,
      label: cf.label,
      description: `${cf.field_type === "boolean" ? "Yes / No" : cf.field_type} answer`,
      enabled: true,
      priority: cf.priority ?? 999,
      isCustom: true,
      customId: cf.id,
      fieldType: cf.field_type,
      qualification_prompt: cf.qualification_prompt ?? "",
    });
  });

  unifiedEnabled.sort((a, b) => a.priority - b.priority);
  const allFields = [...unifiedEnabled, ...unifiedDisabled];

  const renderField = (field: UnifiedField, idx: number) => {
    const globalIdx = unifiedEnabled.findIndex((f) => f.key === field.key);
    const orderNum = field.enabled ? globalIdx + 1 : -1;
    const isFirst = orderNum === 1;
    const isLast = orderNum === unifiedEnabled.length;

    return (
      <div key={field.key} className="rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          {!field.isCustom ? (
            <button
              type="button"
              onClick={() => update(field.key, { enabled: !field.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${field.enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${field.enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
            </button>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">Custom</span>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground">{field.label}</span>
            <p className="text-[11px] text-muted-foreground">{field.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {field.enabled ? (
              <>
                <span className="text-xs font-mono text-muted-foreground w-6 text-center">{orderNum}</span>
                <button type="button" disabled={isFirst} onClick={() => moveOrder(field.key, "up")} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground hover:text-foreground"><ChevronUp size={14} /></button>
                <button type="button" disabled={isLast} onClick={() => moveOrder(field.key, "down")} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground hover:text-foreground"><ChevronDown size={14} /></button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground w-6 text-center">—</span>
            )}
            {field.isCustom && (
              <button
                onClick={() => handleDeleteCustom(field.customId!)}
                disabled={deletingId === field.customId}
                className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors ml-1"
              >
                {deletingId === field.customId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </div>
        </div>

        {/* Config section when enabled */}
        {field.enabled && (
          <div className="mt-2 pt-2 border-t border-border space-y-2">
            {/* Currency selector for budget */}
            {field.configType === "currency" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">Currency:</span>
                <select value={field.currency || "EUR"} onChange={(e) => update(field.key, { currency: e.target.value })} className="dark-input py-0.5 px-2 text-xs w-24">
                  <option value="EUR">EUR</option><option value="USD">USD</option>
                </select>
              </div>
            )}

            {/* Qualification prompt */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Qualification criteria
              </label>
              <textarea
                value={field.qualification_prompt || ""}
                onChange={(e) => {
                  if (field.isCustom) {
                    updateCustom(field.customId!, { qualification_prompt: e.target.value });
                  } else {
                    update(field.key, { qualification_prompt: e.target.value });
                  }
                }}
                placeholder={getQualificationPlaceholder(field.key, field.label)}
                className="dark-input w-full h-16 resize-y text-xs"
              />
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Tell your AI how to evaluate this field for qualification. Be natural — the AI will use this intelligently.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground">Lead Qualification</h2>
      <p className="text-xs text-muted-foreground">
        Select what information your AI collects from leads and describe how each field qualifies or disqualifies someone for a booking. The AI uses your instructions intelligently — no hard-coded values.
      </p>

      {/* Unified field list */}
      <div className="space-y-2">
        {allFields.map((field, idx) => renderField(field, idx))}
      </div>

      {/* Add Custom Field */}
      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Plus size={14} /> Add Custom Field</h3>
        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Industry, Company size, Decision timeline..."
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
        <p className="text-[11px] text-muted-foreground">Custom fields appear in the list above — set their priority and qualification criteria just like preset fields.</p>
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

function getQualificationPlaceholder(key: string, label: string): string {
  const placeholders: Record<string, string> = {
    budget: "e.g. Minimum budget should be at least €5,000 to qualify for a call. Under €2,000 is disqualified.",
    location: "e.g. Anywhere in the UK or Europe is fine. We don't serve clients in Asia or Africa currently.",
    time_window: "e.g. If they need it within the next 3 months, they're a hot lead. Over 6 months is lower priority.",
    email_address: "e.g. Must be a real business email, not a throwaway. Gmail/personal is fine for smaller clients.",
    phone_number: "e.g. Any valid phone number works. International numbers are fine.",
    full_name: "e.g. Just need their real name. No qualification criteria needed here.",
    additional_notes: "e.g. Look for mentions of urgency, specific requirements, or decision-maker status.",
    pictures: "e.g. Photos help us give accurate quotes. Encourage them but don't require it.",
  };
  return placeholders[key] || `e.g. Describe what makes a lead qualified or disqualified based on their ${label.toLowerCase()}...`;
}

export default QuoteFieldsSection;
