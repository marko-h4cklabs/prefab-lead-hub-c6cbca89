import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SocialProofState {
  enabled: boolean;
  examples: string;
}

const DEFAULTS: SocialProofState = { enabled: false, examples: "" };

const PLACEHOLDER = `• "We helped a coaching business go from 3 to 12 clients in 60 days"
• "Our average client sees ROI within the first 30 days"
• "Over 500 businesses have used our system"`;

const SocialProofSection = ({ onSaved }: { onSaved?: () => void }) => {
  const [data, setData] = useState<SocialProofState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(DEFAULTS));

  useEffect(() => {
    api.getSocialProof()
      .then((res) => {
        const merged = { ...DEFAULTS, ...res };
        setData(merged);
        initialRef.current = JSON.stringify(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<SocialProofState>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      setIsDirty(JSON.stringify(next) !== initialRef.current);
      return next;
    });
  };

  const handleSave = () => {
    setSaving(true);
    api.putSocialProof(data)
      .then(() => {
        toast({ title: "Saved ✓", description: "Social proof updated." });
        initialRef.current = JSON.stringify(data);
        setIsDirty(false);
        onSaved?.();
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">⭐ Social Proof</h2>
        <Switch checked={data.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>

      <p className="text-xs text-muted-foreground">Enable social proof in conversations — the AI will weave these in naturally when relevant</p>

      {data.enabled && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Social Proof Examples</label>
          <textarea
            value={data.examples}
            onChange={(e) => update({ examples: e.target.value })}
            className="dark-input w-full h-32 resize-y"
            placeholder={PLACEHOLDER}
          />
          <p className="text-[11px] text-muted-foreground mt-1">The AI will weave these in naturally when relevant — never robotically</p>
        </div>
      )}

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

export default SocialProofSection;
