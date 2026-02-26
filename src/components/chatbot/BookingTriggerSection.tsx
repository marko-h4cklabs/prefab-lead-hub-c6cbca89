import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, Check, Save, ExternalLink, Calendar, Link2, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Props {
  onSaved?: () => void;
  onDirty?: () => void;
  quoteFieldsVersion?: number;
}

interface BookingConfig {
  enabled: boolean;
  platform: "calendly";
  calendly_url: string;
  required_fields: string[];
  custom_offer_message: string;
  intent_threshold: number;
}

interface AvailableField {
  name: string;
  label: string;
  is_custom?: boolean;
}

const DEFAULT: BookingConfig = {
  enabled: false,
  platform: "calendly",
  calendly_url: "",
  required_fields: ["full_name"],
  custom_offer_message: "",
  intent_threshold: 60,
};

const STORAGE_KEY = "chatbot_booking_draft";

export default function BookingTriggerSection({ onSaved, onDirty, quoteFieldsVersion }: Props) {
  const [config, setConfig] = useState<BookingConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const initialRef = useRef(JSON.stringify(DEFAULT));
  const loadedOnce = useRef(false);

  // Load booking settings + GC status
  useEffect(() => {
    api.getBookingSettings().catch(() => null).then((bs) => {
      if (bs) {
        const loaded: BookingConfig = {
          enabled: Boolean(bs.enabled ?? bs.booking_trigger_enabled),
          platform: "calendly",
          calendly_url: bs.calendly_url || "",
          required_fields: bs.required_fields || bs.booking_required_fields || ["full_name"],
          custom_offer_message: bs.custom_offer_message || bs.booking_offer_message || "",
          intent_threshold: bs.intent_threshold ?? bs.booking_trigger_score ?? 60,
        };
        setConfig(loaded);
        initialRef.current = JSON.stringify(loaded);
        sessionStorage.removeItem(STORAGE_KEY);
        const fields = bs.available_fields || [];
        if (fields.length > 0) setAvailableFields(fields);
      } else {
        const draft = sessionStorage.getItem(STORAGE_KEY);
        if (draft) {
          try { setConfig(JSON.parse(draft)); } catch {}
        }
      }
      loadedOnce.current = true;
    }).finally(() => setLoading(false));
  }, []);

  // Re-fetch available fields when quote fields change
  useEffect(() => {
    if (!loadedOnce.current) return;
    if (quoteFieldsVersion === undefined) return;
    api.getBookingSettings().then(res => {
      if (res?.available_fields) {
        setAvailableFields(res.available_fields);
      }
      // Don't overwrite current config selection
    }).catch(() => {});
  }, [quoteFieldsVersion]);

  // SessionStorage backup
  useEffect(() => {
    if (!loading) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config, loading]);

  const set = <K extends keyof BookingConfig>(key: K, val: BookingConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: val };
      if (JSON.stringify(next) !== initialRef.current) onDirty?.();
      return next;
    });
  };

  const toggleRequired = (key: string) => {
    if (key === "full_name") return;
    setConfig((prev) => {
      const next = {
        ...prev,
        required_fields: prev.required_fields.includes(key)
          ? prev.required_fields.filter((k) => k !== key)
          : [...prev.required_fields, key],
      };
      if (JSON.stringify(next) !== initialRef.current) onDirty?.();
      return next;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      await api.putBookingSettings({
        booking_trigger_enabled: config.enabled,
        enabled: config.enabled,
        platform: config.platform,
        booking_platform: config.platform,
        calendly_url: config.calendly_url,
        custom_offer_message: config.custom_offer_message,
        booking_offer_message: config.custom_offer_message,
        intent_threshold: config.intent_threshold,
        booking_trigger_score: config.intent_threshold,
        required_fields: config.required_fields,
        booking_required_fields: config.required_fields,
      });
      initialRef.current = JSON.stringify(config);
      setSaveStatus('saved');
      sessionStorage.removeItem(STORAGE_KEY);
      onSaved?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Failed to save. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading booking settings…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <span>📅</span> Smart Booking Trigger
        </h2>
      </div>

      {/* Enable toggle */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Automatically offer to book an appointment when a lead is ready</span>
        <button type="button" role="switch" aria-checked={config.enabled} onClick={() => set("enabled", !config.enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${config.enabled ? "bg-primary" : "bg-muted"}`}>
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow-sm transition-transform ${config.enabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </label>

      {config.enabled && (
        <div className="space-y-5">
          {/* Calendly URL */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Calendly URL</label>
            <input type="url" value={config.calendly_url} onChange={(e) => set("calendly_url", e.target.value)} placeholder="https://calendly.com/yourname/30min" className="dark-input w-full" />
            <p className="text-[10px] text-muted-foreground mt-1">Your Calendly booking link. Lead picks their own time from your Calendly page.</p>
          </div>

          {/* Required fields — from available_fields API */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required info before offering booking</label>
            <div className="space-y-2">
              {availableFields.length > 0 ? (
                availableFields.map((field) => (
                  <label key={field.name} className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.required_fields.includes(field.name) || field.name === 'full_name'}
                      disabled={field.name === 'full_name'}
                      onChange={() => toggleRequired(field.name)}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    <span className="text-sm">{field.label}</span>
                    {field.is_custom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">Custom</span>
                    )}
                    {field.name === 'full_name' && (
                      <span className="text-[10px] text-muted-foreground">(always required)</span>
                    )}
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No fields available. Add fields in Data Collection first.</p>
              )}
            </div>
          </div>

          {/* Custom offer message */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">What should the AI say when offering to book?</label>
            <textarea value={config.custom_offer_message} onChange={(e) => set("custom_offer_message", e.target.value)} placeholder="Great, let me set up a quick call! What days work best for you this week?" className="dark-input w-full min-h-[70px] resize-y" />
            <p className="text-[10px] text-muted-foreground mt-1">Leave blank to use the default message for your selected platform</p>
          </div>

          {/* Intent score threshold */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Minimum lead score before offering booking</label>
            <div className="flex items-center gap-4">
              <Slider value={[config.intent_threshold]} onValueChange={([v]) => set("intent_threshold", v)} min={0} max={100} step={5} className="flex-1" />
              <span className="text-sm font-bold text-primary w-12 text-right">{config.intent_threshold}/100</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Higher = only offer to highly engaged leads. Lower = offer to everyone.</p>
          </div>

          {/* Save */}
          <div>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              className={`dark-btn ${
                saveStatus === 'saved' ? "bg-success/15 text-success" :
                saveStatus === 'error' ? "bg-destructive/15 text-destructive" :
                "bg-primary text-primary-foreground hover:bg-primary/90"
              } text-sm`}
            >
              {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> :
               saveStatus === 'saved' ? <Check size={14} /> :
               saveStatus === 'error' ? <X size={14} /> : <Save size={14} />}
              {saveStatus === 'saving' ? "Saving…" :
               saveStatus === 'saved' ? "Saved ✓" :
               saveStatus === 'error' ? "Save failed" : "Save Booking Trigger"}
            </button>
            {saveStatus === 'error' && <p className="text-xs text-destructive mt-2">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
