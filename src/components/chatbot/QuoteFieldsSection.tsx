import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";

// --- Preset definitions ---

interface PresetConfig {
  id: string;
  label: string;
  description: string;
  configType?: "currency" | "options" | "dimensions";
}

const PRESETS: PresetConfig[] = [
  { id: "budget", label: "Budget", description: "Requested budget or price range", configType: "currency" },
  { id: "location", label: "Location", description: "Project or delivery location", configType: "options" },
  { id: "email_address", label: "Email Address", description: "Contact email" },
  { id: "phone_number", label: "Phone Number", description: "Contact phone number" },
  { id: "full_name", label: "Full Name", description: "Contact full name" },
  { id: "additional_notes", label: "Additional Notes", description: "Any extra information from the lead" },
  { id: "doors", label: "Doors", description: "Door specifications", configType: "options" },
  { id: "windows", label: "Windows", description: "Window specifications", configType: "options" },
  { id: "colors", label: "Colors", description: "Color preferences", configType: "options" },
  { id: "dimensions", label: "Dimensions", description: "Size measurements", configType: "dimensions" },
  { id: "roof", label: "Roof", description: "Roof type or specifications", configType: "options" },
];

interface PresetState {
  enabled: boolean;
  currency?: string;
  allowed_options?: string[];
  dimension_axes?: string[];
  dimension_unit?: string;
}

type AllPresetsState = Record<string, PresetState>;

function buildDefault(): AllPresetsState {
  const state: AllPresetsState = {};
  PRESETS.forEach((p) => {
    const s: PresetState = { enabled: false };
    if (p.configType === "currency") s.currency = "EUR";
    if (p.configType === "options") s.allowed_options = [];
    if (p.configType === "dimensions") {
      s.dimension_axes = ["length", "width"];
      s.dimension_unit = "m";
    }
    state[p.id] = s;
  });
  return state;
}

// --- Tag input component ---

const TagInput = ({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) {
      onChange([...tags, v]);
    }
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
        const data = res?.presets || res?.fields || res;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const merged = { ...buildDefault() };
          for (const key of Object.keys(merged)) {
            if (data[key]) merged[key] = { ...merged[key], ...data[key] };
          }
          setPresets(merged);
          initialRef.current = JSON.stringify(merged);
        } else {
          const def = buildDefault();
          setPresets(def);
          initialRef.current = JSON.stringify(def);
        }
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

  const handleSave = () => {
    setSaving(true);
    api.putQuoteFields({ fields: presets as any })
      .then(() => {
        toast({ title: "Saved", description: "Quote fields updated." });
        initialRef.current = JSON.stringify(presets);
        setIsDirty(false);
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="industrial-card p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider">Quote Requirements</h2>

      <div className="space-y-1">
        {PRESETS.map((preset) => {
          const state = presets[preset.id];
          const enabled = state?.enabled ?? false;

          return (
            <div key={preset.id} className="border border-border rounded-sm">
              {/* Row header */}
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
                <div className="min-w-0">
                  <span className="text-sm font-semibold">{preset.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{preset.description}</span>
                </div>
              </div>

              {/* Config panel */}
              {enabled && preset.configType && (
                <div className="px-4 pb-3 pt-0 border-t border-border">
                  <div className="pt-3">
                    {preset.configType === "currency" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">Units:</span>
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
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
