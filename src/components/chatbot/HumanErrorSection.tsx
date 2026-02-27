import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Save, Loader2, Check, X, Shuffle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ERROR_TYPES = [
  { key: "typos", label: "Typos", desc: "Occasional letter swaps or missing letters" },
  { key: "no_periods", label: "No Periods", desc: "Skip ending sentences with periods" },
  { key: "lowercase_starts", label: "Lowercase Starts", desc: "Sometimes start sentences lowercase" },
  { key: "short_forms", label: "Short Forms", desc: 'Use "ur", "u", "rn", "gonna", "wanna"' },
  { key: "double_messages", label: "Split Messages", desc: "Split thoughts into 2 short messages" },
];

interface HumanErrorState {
  human_error_enabled: boolean;
  human_error_types: string[];
  human_error_random: boolean;
}

const DEFAULTS: HumanErrorState = {
  human_error_enabled: false,
  human_error_types: [],
  human_error_random: false,
};

const STORAGE_KEY = "chatbot_human_error_draft";

const HumanErrorSection = ({ onSaved, onDirty }: { onSaved?: () => void; onDirty?: () => void }) => {
  const [data, setData] = useState<HumanErrorState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(DEFAULTS));

  useEffect(() => {
    api.getChatbotBehavior()
      .then((res: any) => {
        const merged: HumanErrorState = {
          human_error_enabled: res.human_error_enabled ?? false,
          human_error_types: Array.isArray(res.human_error_types) ? res.human_error_types : [],
          human_error_random: res.human_error_random ?? false,
        };
        setData(merged);
        initialRef.current = JSON.stringify(merged);
        sessionStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {
        const draft = sessionStorage.getItem(STORAGE_KEY);
        if (draft) {
          try { setData(JSON.parse(draft)); } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, loading]);

  const update = (patch: Partial<HumanErrorState>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      const dirty = JSON.stringify(next) !== initialRef.current;
      setIsDirty(dirty);
      if (dirty) onDirty?.();
      return next;
    });
  };

  const toggleType = (key: string) => {
    const types = data.human_error_types.includes(key)
      ? data.human_error_types.filter((t) => t !== key)
      : [...data.human_error_types, key];
    update({ human_error_types: types });
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setSaveError("");
    try {
      await api.putChatbotBehavior({
        human_error_enabled: data.human_error_enabled,
        human_error_types: data.human_error_types,
        human_error_random: data.human_error_random,
      } as any);
      initialRef.current = JSON.stringify(data);
      setIsDirty(false);
      setSaveStatus("saved");
      sessionStorage.removeItem(STORAGE_KEY);
      onSaved?.();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err: any) {
      setSaveStatus("error");
      setSaveError(err?.message || "Failed to save.");
    }
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-base font-bold text-foreground">Human Error Style</h2>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Make your chatbot write with small imperfections — typos, missing punctuation, casual language. Makes it feel more like a real person texting.
      </p>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-foreground">Enable Human Errors</label>
          <p className="text-[10px] text-muted-foreground">Bot will intentionally make small mistakes</p>
        </div>
        <Switch checked={data.human_error_enabled} onCheckedChange={(v) => update({ human_error_enabled: v })} />
      </div>

      {data.human_error_enabled && (
        <>
          {/* Error type checkboxes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground block">Error Types</label>
            {ERROR_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => toggleType(t.key)}
                className={`w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-all ${
                  data.human_error_types.includes(t.key)
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  data.human_error_types.includes(t.key)
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}>
                  {data.human_error_types.includes(t.key) && <Check size={10} className="text-primary-foreground" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground">{t.label}</span>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Random toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center gap-2">
              <Shuffle size={14} className="text-primary" />
              <div>
                <label className="text-xs font-medium text-foreground">Random Mode</label>
                <p className="text-[10px] text-muted-foreground">Randomly pick 1-2 errors per message instead of all</p>
              </div>
            </div>
            <Switch checked={data.human_error_random} onCheckedChange={(v) => update({ human_error_random: v })} />
          </div>
        </>
      )}

      <div>
        <button
          onClick={handleSave}
          disabled={saveStatus === "saving" || saveStatus === "saved" || !isDirty}
          className={`dark-btn ${
            saveStatus === "saved" ? "bg-success/15 text-success" :
            saveStatus === "error" ? "bg-destructive/15 text-destructive" :
            isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
          }`}
        >
          {saveStatus === "saving" ? <Loader2 size={16} className="animate-spin" /> :
           saveStatus === "saved" ? <Check size={16} /> :
           saveStatus === "error" ? <X size={16} /> : <Save size={16} />}
          {saveStatus === "saving" ? "Saving..." :
           saveStatus === "saved" ? "Saved" :
           saveStatus === "error" ? "Save failed" : "Save"}
        </button>
        {saveStatus === "error" && <p className="text-xs text-destructive mt-2">{saveError}</p>}
      </div>
    </div>
  );
};

export default HumanErrorSection;
