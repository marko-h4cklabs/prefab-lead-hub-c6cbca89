import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Save, Loader2, Check, X } from "lucide-react";

const FOLLOW_UP = [
  { value: "gentle", label: "Gentle", desc: "Soft nudges, no pressure" },
  { value: "persistent", label: "Persistent", desc: "Clear CTAs, creates mild urgency" },
  { value: "value_first", label: "Value-First", desc: "Lead with insight before asking" },
];

const CLOSING = [
  { value: "soft", label: "Soft" },
  { value: "direct", label: "Direct" },
  { value: "assumptive", label: "Assumptive" },
];

const COMPETITOR = [
  { value: "deflect", label: "Deflect" },
  { value: "acknowledge", label: "Acknowledge" },
  { value: "ignore", label: "Ignore" },
];

const PRICE_OPTIONS = [
  { value: "share", label: "Share pricing when asked", desc: "Transparent and direct" },
  { value: "qualify", label: "Qualify budget first", desc: "Ask about needs before revealing pricing", recommended: true },
  { value: "never", label: "Never share pricing", desc: "Always direct to a call for custom quote" },
];

interface StrategyState {
  primary_goal: string;
  follow_up_style: string;
  closing_style: string;
  competitor_mentions: string;
  price_reveal: string;
}

const DEFAULTS: StrategyState = {
  primary_goal: "",
  follow_up_style: "gentle",
  closing_style: "soft",
  competitor_mentions: "deflect",
  price_reveal: "qualify",
};

const STORAGE_KEY = "chatbot_strategy_draft";

const ConversationStrategySection = ({ onSaved, onDirty }: { onSaved?: () => void; onDirty?: () => void }) => {
  const [data, setData] = useState<StrategyState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(DEFAULTS));

  useEffect(() => {
    api.getConversationStrategy()
      .then((res) => {
        const hasRealData = res.primary_goal || res.conversation_goal || res.follow_up_style;
        if (hasRealData) {
          const merged: StrategyState = {
            primary_goal: res.primary_goal || res.conversation_goal || "",
            follow_up_style: res.follow_up_style || "gentle",
            closing_style: res.closing_style || "soft",
            competitor_mentions: res.competitor_mentions || "deflect",
            price_reveal: res.price_reveal || "qualify",
          };
          setData(merged);
          initialRef.current = JSON.stringify(merged);
          sessionStorage.removeItem(STORAGE_KEY);
        } else {
          const draft = sessionStorage.getItem(STORAGE_KEY);
          if (draft) {
            try { setData(JSON.parse(draft)); } catch {}
          }
        }
      })
      .catch(() => {
        const draft = sessionStorage.getItem(STORAGE_KEY);
        if (draft) {
          try { setData(JSON.parse(draft)); } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // SessionStorage backup
  useEffect(() => {
    if (!loading) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, loading]);

  const update = (patch: Partial<StrategyState>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      const dirty = JSON.stringify(next) !== initialRef.current;
      setIsDirty(dirty);
      if (dirty) onDirty?.();
      return next;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      await api.putConversationStrategy(data);
      initialRef.current = JSON.stringify(data);
      setIsDirty(false);
      setSaveStatus('saved');
      sessionStorage.removeItem(STORAGE_KEY);
      onSaved?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Failed to save. Please try again.');
    }
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  const ToggleGroup = ({ options, value, onChange }: { options: { value: string; label: string; desc?: string }[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`flex-1 py-2.5 text-center transition-colors ${value === o.value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
          <div className="text-sm font-semibold">{o.label}</div>
          {o.desc && <div className="text-[10px] opacity-70 hidden sm:block">{o.desc}</div>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground">🎯 Conversation Strategy</h2>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Primary Goal</label>
        <input value={data.primary_goal} onChange={(e) => update({ primary_goal: e.target.value })} className="dark-input w-full" placeholder="e.g. Book a 30-minute discovery call, Get them to fill out our form..." />
        <p className="text-[11px] text-muted-foreground mt-1">What should every conversation ultimately lead to?</p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Follow-up Style</label>
        <ToggleGroup options={FOLLOW_UP} value={data.follow_up_style} onChange={(v) => update({ follow_up_style: v })} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Closing Style</label>
        <ToggleGroup options={CLOSING} value={data.closing_style} onChange={(v) => update({ closing_style: v })} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Competitor Mentions</label>
        <ToggleGroup options={COMPETITOR} value={data.competitor_mentions} onChange={(v) => update({ competitor_mentions: v })} />
      </div>

      {/* Price Reveal */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Price Reveal</label>
        <div className="space-y-2">
          {PRICE_OPTIONS.map((p) => (
            <button key={p.value} onClick={() => update({ price_reveal: p.value })}
              className={`w-full text-left rounded-lg p-3 border transition-all ${data.price_reveal === p.value ? "border-primary bg-primary/5 shadow-[0_0_8px_hsl(48_92%_53%/0.1)]" : "border-border bg-card hover:border-muted-foreground/30"}`}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${data.price_reveal === p.value ? "border-primary" : "border-muted-foreground"}`}>
                  {data.price_reveal === p.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                {p.recommended && <span className="text-[10px] px-2 py-0.5 rounded-md bg-success/15 text-success font-medium">Recommended</span>}
              </div>
              <p className="text-[11px] text-muted-foreground ml-5 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || saveStatus === 'saved' || !isDirty}
          className={`dark-btn ${
            saveStatus === 'saved' ? "bg-success/15 text-success" :
            saveStatus === 'error' ? "bg-destructive/15 text-destructive" :
            isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
          }`}
        >
          {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> :
           saveStatus === 'saved' ? <Check size={16} /> :
           saveStatus === 'error' ? <X size={16} /> : <Save size={16} />}
          {saveStatus === 'saving' ? "Saving…" :
           saveStatus === 'saved' ? "Saved ✓" :
           saveStatus === 'error' ? "Save failed" : "Save"}
        </button>
        {saveStatus === 'error' && <p className="text-xs text-destructive mt-2">{saveError}</p>}
      </div>
    </div>
  );
};

export default ConversationStrategySection;
