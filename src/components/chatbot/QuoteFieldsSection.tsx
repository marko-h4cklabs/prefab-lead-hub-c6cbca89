import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Save, X } from "lucide-react";

// --- Preset definitions ---

interface PresetConfig {
  id: string;
  label: string;
  description: string;
  configType?: "currency" | "options" | "dimensions" | "completion";
  group: "basic" | "detailed";
}

const PRESETS: PresetConfig[] = [
  // Basic
  { id: "budget", label: "Budget", description: "Requested budget or price range", configType: "currency", group: "basic" },
  { id: "location", label: "Location", description: "Project or delivery location", configType: "options", group: "basic" },
  { id: "time_window", label: "Time Window", description: "Desired timeline or delivery window", configType: "options", group: "basic" },
  { id: "email_address", label: "Email Address", description: "Contact email", group: "basic" },
  { id: "phone_number", label: "Phone Number", description: "Contact phone number", group: "basic" },
  { id: "full_name", label: "Full Name", description: "Contact full name", group: "basic" },
  { id: "additional_notes", label: "Additional Notes", description: "Any extra information from the lead", group: "basic" },
  { id: "pictures", label: "Pictures", description: "Photo uploads from the lead", group: "basic" },
  { id: "object_type", label: "Object Type", description: "Type of object or project", configType: "options", group: "basic" },
  // Detailed
  { id: "doors", label: "Doors", description: "Door specifications", configType: "options", group: "detailed" },
  { id: "windows", label: "Windows", description: "Window specifications", configType: "options", group: "detailed" },
  { id: "colors", label: "Colors", description: "Color preferences", configType: "options", group: "detailed" },
  { id: "dimensions", label: "Dimensions", description: "Size measurements", configType: "dimensions", group: "detailed" },
  { id: "roof", label: "Roof", description: "Roof type or specifications", configType: "options", group: "detailed" },
  { id: "ground_condition", label: "Ground Condition", description: "Soil or terrain conditions", configType: "options", group: "detailed" },
  { id: "utility_connections", label: "Utility Connections", description: "Water, electricity, gas availability", configType: "options", group: "detailed" },
  { id: "completion_level", label: "Completion Level", description: "Level of finish required", configType: "completion", group: "detailed" },
];

const COMPLETION_OPTIONS = ["Structural phase", "Fully finished turnkey"];

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

function buildDefault(): AllPresetsState {
  const state: AllPresetsState = {};
  PRESETS.forEach((p, i) => {
    const s: PresetState = { enabled: false, priority: (i + 1) * 10 };
    if (p.configType === "currency") s.currency = "EUR";
    if (p.configType === "options") s.allowed_options = [];
    if (p.configType === "dimensions") {
      s.dimension_axes = ["length", "width"];
      s.dimension_unit = "m";
    }
    if (p.configType === "completion") s.completion_options = [];
    state[p.id] = s;
  });
  return state;
}

// --- Tag input ---

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
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="Add option…"
        className="industrial-input py-0.5 px-2 text-xs w-28"
      />
    </div>
  );
};

// --- Main component ---

const QuoteFieldsSection = () => {
  const [presets, setPresets] = useState<AllPresetsState>(buildDefault);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef<string>("");

  useEffect(() => {
    api.getQuoteFields()
      .then((res) => {
        const next = applyFetched(res);
        setPresets(next);
        initialRef.current = JSON.stringify(next);
      })
      .catch(() => {
        const def = buildDefault();
        setPresets(def);
        initialRef.current = JSON.stringify(def);
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<PresetState>) => {
    setPresets((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      setIsDirty(JSON.stringify(next) !== initialRef.current);
      return next;
    });
  };

  const toPayload = (state: AllPresetsState) =>
    PRESETS.map((p) => {
      const s = state[p.id];
      const config: Record<string, unknown> = {};
      if (p.configType === "currency") config.defaultUnit = s.currency || "EUR";
      if (p.configType === "options") config.allowed_options = s.allowed_options || [];
      if (p.configType === "dimensions") {
        config.enabledParts = s.dimension_axes || [];
        config.unit = s.dimension_unit || "m";
      }
      if (p.configType === "completion") config.completion_options = s.completion_options || [];
      return { name: p.id, is_enabled: s.enabled, priority: s.priority, config };
    });

  const applyFetched = (data: unknown) => {
    const raw = data as Record<string, unknown> | unknown[];
    const list: unknown[] = Array.isArray(raw) ? raw : (raw as any)?.presets || (raw as any)?.fields || [];
    const merged = buildDefault();
    if (!Array.isArray(list)) return merged;
    list.forEach((item: any) => {
      if (!item?.name || !merged[item.name]) return;
      merged[item.name].enabled = !!item.is_enabled;
      if (typeof item.priority === "number") merged[item.name].priority = item.priority;
      const c = item.config || {};
      if (c.defaultUnit) merged[item.name].currency = c.defaultUnit;
      if (c.allowed_options) merged[item.name].allowed_options = c.allowed_options;
      if (c.enabledParts) merged[item.name].dimension_axes = c.enabledParts;
      if (c.unit) merged[item.name].dimension_unit = c.unit;
      if (c.completion_options) merged[item.name].completion_options = c.completion_options;
    });
    return merged;
  };

  const handleSave = () => {
    setSaving(true);
    api.putQuoteFields({ presets: toPayload(presets) })
      .then(() => {
        toast({ title: "Saved", description: "Quote fields updated." });
        return api.getQuoteFields();
      })
      .then((res) => {
        const next = applyFetched(res);
        setPresets(next);
        initialRef.current = JSON.stringify(next);
        setIsDirty(false);
      })
      .catch((err) => {
        toast({ title: "Save failed", description: getErrorMessage(err), variant: "destructive" });
      })
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  const basicPresets = PRESETS.filter((p) => p.group === "basic");
  const detailedPresets = PRESETS.filter((p) => p.group === "detailed");

  const renderPreset = (preset: PresetConfig) => {
    const state = presets[preset.id];
    const enabled = state?.enabled ?? false;

    return (
      <div key={preset.id} className="border border-border rounded-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => update(preset.id, { enabled: !enabled })}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              enabled ? "bg-accent" : "bg-muted"
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-card transition-transform ${
              enabled ? "translate-x-[18px]" : "translate-x-[3px]"
            }`} />
          </button>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold">{preset.label}</span>
            <span className="text-xs text-muted-foreground ml-2">{preset.description}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Order</span>
            <input
              type="number"
              min={1}
              step={1}
              value={state.priority}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) update(preset.id, { priority: v });
              }}
              className="industrial-input w-14 py-0.5 px-2 text-xs text-center"
            />
          </div>
        </div>

        {enabled && preset.configType && (
          <div className="px-4 pb-3 pt-0 border-t border-border">
            <div className="pt-3">
              {preset.configType === "currency" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">Unit:</span>
                  <select
                    value={state.currency || "EUR"}
                    onChange={(e) => update(preset.id, { currency: e.target.value })}
                    className="industrial-input py-0.5 px-2 text-xs w-24"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}

              {preset.configType === "options" && (
                <div className="space-y-1">
                  <span className="text-xs font-mono text-muted-foreground">Allowed options:</span>
                  <TagInput
                    tags={state.allowed_options || []}
                    onChange={(t) => update(preset.id, { allowed_options: t })}
                  />
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
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked ? axes.filter((a) => a !== axis) : [...axes, axis];
                              update(preset.id, { dimension_axes: next });
                            }}
                            className="accent-accent"
                          />
                          {axis}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">Unit:</span>
                    <select
                      value={state.dimension_unit || "m"}
                      onChange={(e) => update(preset.id, { dimension_unit: e.target.value })}
                      className="industrial-input py-0.5 px-2 text-xs w-20"
                    >
                      <option value="m">m</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>
                </div>
              )}

              {preset.configType === "completion" && (
                <div className="space-y-1">
                  <span className="text-xs font-mono text-muted-foreground">Options:</span>
                  <div className="flex flex-wrap gap-3">
                    {COMPLETION_OPTIONS.map((opt) => {
                      const selected = (state.completion_options || []).includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-1.5 text-xs font-mono">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const cur = state.completion_options || [];
                              const next = selected ? cur.filter((o) => o !== opt) : [...cur, opt];
                              update(preset.id, { completion_options: next });
                            }}
                            className="accent-accent"
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="industrial-card p-6 space-y-6">
      <h2 className="text-sm font-bold uppercase tracking-wider">Quote Requirements</h2>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Basic Options</h3>
          <div className="space-y-1">
            {basicPresets.map(renderPreset)}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detailed Options</h3>
          <div className="space-y-1">
            {detailedPresets.map(renderPreset)}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={isDirty ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
      >
        <Save size={16} /> {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
};

export default QuoteFieldsSection;
