import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, Check, Save, ExternalLink, Calendar, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Slider } from "@/components/ui/slider";

interface Props {
  onSaved?: () => void;
}

interface BookingConfig {
  enabled: boolean;
  platform: "google_calendar" | "calendly";
  calendly_url: string;
  required_fields: string[];
  custom_offer_message: string;
  intent_threshold: number;
}

const DEFAULT: BookingConfig = {
  enabled: false,
  platform: "google_calendar",
  calendly_url: "",
  required_fields: ["name"],
  custom_offer_message: "",
  intent_threshold: 60,
};

export default function BookingTriggerSection({ onSaved }: Props) {
  const [config, setConfig] = useState<BookingConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gcConnected, setGcConnected] = useState<boolean | null>(null);
  const [quoteFields, setQuoteFields] = useState<{ key: string; label: string; enabled: boolean }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    Promise.all([
      api.getBookingSettings().catch(() => null),
      api.getGoogleCalendarStatus().catch(() => null),
      api.getQuoteFields().catch(() => null),
    ]).then(([bs, gc, qf]) => {
      if (bs) {
        setConfig({
          enabled: Boolean(bs.enabled ?? bs.booking_trigger_enabled),
          platform: bs.platform || "google_calendar",
          calendly_url: bs.calendly_url || "",
          required_fields: bs.required_fields || ["name"],
          custom_offer_message: bs.custom_offer_message || "",
          intent_threshold: bs.intent_threshold ?? 60,
        });
      }
      setGcConnected(Boolean(gc?.connected || gc?.is_connected));
      // Parse quote fields
      const fields = Array.isArray(qf) ? qf : qf?.fields || qf?.presets || [];
      setQuoteFields(
        fields
          .filter((f: any) => f.enabled !== false)
          .map((f: any) => ({ key: f.key || f.id || f.label, label: f.label || f.name || f.key, enabled: true }))
      );
    }).finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof BookingConfig>(key: K, val: BookingConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: val }));

  const toggleRequired = (key: string) => {
    if (key === "name") return; // always required
    setConfig((prev) => ({
      ...prev,
      required_fields: prev.required_fields.includes(key)
        ? prev.required_fields.filter((k) => k !== key)
        : [...prev.required_fields, key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.putBookingSettings(config);
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      toast({ title: "Failed to save", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
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
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => set("enabled", !config.enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            config.enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow-sm transition-transform ${config.enabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </label>

      {config.enabled && (
        <div className="space-y-5">
          {/* Platform cards */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Booking Platform
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Google Calendar */}
              <button
                type="button"
                onClick={() => set("platform", "google_calendar")}
                className={`text-left rounded-lg p-4 border-2 transition-all ${
                  config.platform === "google_calendar"
                    ? "border-primary bg-primary/5 shadow-[0_0_12px_hsl(48_92%_53%/0.15)]"
                    : "border-border bg-secondary/30 hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Calendar size={16} className="text-primary" />
                  <span className="text-sm font-bold text-foreground">Google Calendar 📅</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Use your connected Google Calendar. AI checks your availability and offers real time slots.
                </p>
                {gcConnected === null ? (
                  <Loader2 size={12} className="animate-spin text-muted-foreground" />
                ) : gcConnected ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">Connected</span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Not connected</span>
                    <a href="/settings" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      Connect in Settings <ExternalLink size={8} />
                    </a>
                  </span>
                )}
              </button>

              {/* Calendly */}
              <button
                type="button"
                onClick={() => set("platform", "calendly")}
                className={`text-left rounded-lg p-4 border-2 transition-all ${
                  config.platform === "calendly"
                    ? "border-primary bg-primary/5 shadow-[0_0_12px_hsl(48_92%_53%/0.15)]"
                    : "border-border bg-secondary/30 hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Link2 size={16} className="text-primary" />
                  <span className="text-sm font-bold text-foreground">Calendly 🔗</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Use your Calendly booking link. Lead picks their own time from your Calendly page.
                </p>
              </button>
            </div>

            {config.platform === "calendly" && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Calendly URL</label>
                <input
                  type="url"
                  value={config.calendly_url}
                  onChange={(e) => set("calendly_url", e.target.value)}
                  placeholder="https://calendly.com/yourname/30min"
                  className="dark-input w-full"
                />
              </div>
            )}
          </div>

          {/* Required fields before offering booking */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Required info before offering booking
            </label>
            <div className="space-y-2">
              {/* Name is always required */}
              <label className="flex items-center gap-2.5 opacity-60 cursor-not-allowed">
                <input type="checkbox" checked disabled className="rounded border-border accent-primary" />
                <span className="text-sm">Name</span>
                <span className="text-[10px] text-muted-foreground">(always required)</span>
              </label>
              {quoteFields
                .filter((f) => f.key !== "name" && f.key !== "full_name")
                .map((f) => (
                  <label key={f.key} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.required_fields.includes(f.key)}
                      onChange={() => toggleRequired(f.key)}
                      className="rounded border-border accent-primary"
                    />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Custom offer message */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              What should the AI say when offering to book?
            </label>
            <textarea
              value={config.custom_offer_message}
              onChange={(e) => set("custom_offer_message", e.target.value)}
              placeholder="Great, let me set up a quick call! What days work best for you this week?"
              className="dark-input w-full min-h-[70px] resize-y"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Leave blank to use the default message for your selected platform</p>
          </div>

          {/* Intent score threshold */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Minimum lead score before offering booking
            </label>
            <div className="flex items-center gap-4">
              <Slider
                value={[config.intent_threshold]}
                onValueChange={([v]) => set("intent_threshold", v)}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-sm font-bold text-primary w-12 text-right">{config.intent_threshold}/100</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Higher = only offer to highly engaged leads. Lower = offer to everyone.
            </p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Booking Trigger"}
          </button>
        </div>
      )}
    </div>
  );
}
