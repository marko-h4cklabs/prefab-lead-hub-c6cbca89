import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Save, Loader2, Check, X, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TONES = [
  { value: "professional", icon: "🎯", label: "Professional", desc: "Polished and credible" },
  { value: "friendly", icon: "😊", label: "Friendly", desc: "Warm and approachable" },
  { value: "casual", icon: "😎", label: "Casual", desc: "Relaxed and natural" },
  { value: "direct", icon: "⚡", label: "Direct", desc: "Concise and no-fluff" },
  { value: "empathetic", icon: "💙", label: "Empathetic", desc: "Understanding first" },
  { value: "humorous", icon: "😄", label: "Humorous", desc: "Light-hearted and fun" },
];

const LENGTHS = [
  { value: "short", label: "Short", sub: "1-2 sentences" },
  { value: "medium", label: "Medium", sub: "2-4 sentences" },
  { value: "long", label: "Long", sub: "Up to 8 sentences" },
];

const OPENER_STYLES = [
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "question", label: "Question" },
  { value: "statement", label: "Statement" },
];

const LANGUAGES = [
  { value: "en", flag: "🇺🇸", name: "English" },
  { value: "es", flag: "🇪🇸", name: "Spanish" },
  { value: "fr", flag: "🇫🇷", name: "French" },
  { value: "de", flag: "🇩🇪", name: "German" },
  { value: "it", flag: "🇮🇹", name: "Italian" },
  { value: "pt", flag: "🇵🇹", name: "Portuguese" },
  { value: "nl", flag: "🇳🇱", name: "Dutch" },
  { value: "hr", flag: "🇭🇷", name: "Croatian" },
  { value: "sr", flag: "🇷🇸", name: "Serbian" },
  { value: "ro", flag: "🇷🇴", name: "Romanian" },
  { value: "tr", flag: "🇹🇷", name: "Turkish" },
];

interface StyleState {
  tone: string;
  response_length: string;
  opener_style: string;
  emojis_enabled: boolean;
  language: string;
  response_delay_seconds: number;
}

const DEFAULTS: StyleState = {
  tone: "professional",
  response_length: "medium",
  opener_style: "casual",
  emojis_enabled: false,
  language: "en",
  response_delay_seconds: 0,
};

const STORAGE_KEY = "chatbot_style_draft";

const CommunicationStyleSection = ({ onSaved, onDirty }: { onSaved?: () => void; onDirty?: () => void }) => {
  const [data, setData] = useState<StyleState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(DEFAULTS));

  useEffect(() => {
    api.getChatbotBehavior()
      .then((res) => {
        const hasRealData = res.tone || res.response_length;
        if (hasRealData) {
        const merged: StyleState = {
            tone: res.tone || "professional",
            response_length: res.response_length || "medium",
            opener_style: res.opener_style || "casual",
            emojis_enabled: res.emojis_enabled ?? false,
            language: res.language_code || res.language || "en",
            response_delay_seconds: res.response_delay_seconds ?? 0,
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

  const update = (patch: Partial<StyleState>) => {
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
      await api.putChatbotBehavior({
        tone: data.tone,
        response_length: data.response_length,
        opener_style: data.opener_style,
        emojis_enabled: data.emojis_enabled,
        language_code: data.language,
        response_delay_seconds: data.response_delay_seconds,
      } as any);
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

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground">💬 Communication Style</h2>

      {/* Tone Cards */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Tone</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => update({ tone: t.value })}
              className={`rounded-lg p-3 text-left border transition-all ${
                data.tone === t.value
                  ? "border-primary shadow-[0_0_12px_hsl(48_92%_53%/0.15)] bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              <div className="text-sm font-semibold text-foreground mt-1">{t.label}</div>
              <p className="text-[11px] text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Response Length */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Response Length</label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {LENGTHS.map((l) => (
            <button key={l.value} onClick={() => update({ response_length: l.value })}
              className={`flex-1 py-2.5 text-center transition-colors ${data.response_length === l.value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              <div className="text-sm font-semibold">{l.label}</div>
              <div className="text-[10px] opacity-70">{l.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Opener Style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Opener Style</label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {OPENER_STYLES.map((o) => (
            <button key={o.value} onClick={() => update({ opener_style: o.value })}
              className={`flex-1 py-2.5 text-sm font-semibold text-center transition-colors ${data.opener_style === o.value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emojis */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-foreground">Allow Emojis</label>
          <p className="text-[11px] text-muted-foreground">Use 1-2 emojis per message when natural</p>
        </div>
        <Switch checked={data.emojis_enabled} onCheckedChange={(v) => update({ emojis_enabled: v })} />
      </div>

      {/* Smart Reply Delay */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="text-xs font-medium text-muted-foreground">Smart Reply Delay</label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                How long the bot waits before replying. If the user sends another message during this time, the timer resets. Set to 0 for instant replies.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={30}
            value={data.response_delay_seconds}
            onChange={(e) => update({ response_delay_seconds: Math.max(0, Math.min(30, parseInt(e.target.value) || 0)) })}
            className="dark-input w-20 text-center"
          />
          <span className="text-xs text-muted-foreground">seconds {data.response_delay_seconds === 0 && "(instant)"}</span>
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Language</label>
        <select value={data.language} onChange={(e) => update({ language: e.target.value })} className="dark-input w-full max-w-xs">
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.flag} {l.name}</option>
          ))}
        </select>
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

export default CommunicationStyleSection;
