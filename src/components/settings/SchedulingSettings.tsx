import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import ChatbotBookingSettings, { defaultChatbotBookingConfig } from "./ChatbotBookingSettings";

const APPOINTMENT_TYPES = [
  { value: "call", label: "Call" },
  { value: "site_visit", label: "Site Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow-up" },
];

const SLOT_DURATIONS = [15, 30, 45, 60, 90];
const REMINDER_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "24 hours" },
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

interface TimeRange {
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  ranges: TimeRange[];
}

interface SchedulingConfig {
  scheduling_enabled: boolean;
  chatbot_offers_booking: boolean;
  allow_manual_booking: boolean;
  timezone: string;
  default_appointment_types: string[];
  slot_duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  minimum_notice_hours: number;
  max_days_ahead: number;
  working_hours: Record<string, DaySchedule>;
  in_app_reminders: boolean;
  email_reminders: boolean;
  reminder_lead_time_minutes: number;
  // Chatbot booking fields
  chatbot_booking_enabled: boolean;
  booking_mode: string;
  ask_after_quote: boolean;
  default_booking_type: string;
  allow_custom_time: boolean;
  show_available_slots: boolean;
  booking_prompt_style: string;
  require_name: boolean;
  require_phone: boolean;
}

const defaultWorkingHours = (): Record<string, DaySchedule> => {
  const hours: Record<string, DaySchedule> = {};
  DAYS.forEach((d) => {
    hours[d] = {
      enabled: ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(d),
      ranges: [{ start: "09:00", end: "17:00" }],
    };
  });
  return hours;
};

/**
 * Normalize working_hours from backend (may be array or object) into the
 * Record<string, DaySchedule> shape used by the UI.
 */
function normalizeWorkingHoursFromApi(raw: unknown): Record<string, DaySchedule> {
  const fallback = defaultWorkingHours();
  if (!raw) return fallback;

  // Backend canonical: array of { day, enabled, ranges }
  if (Array.isArray(raw)) {
    const result = { ...fallback };
    raw.forEach((item: any) => {
      const day = String(item?.day || "").toLowerCase();
      if (DAYS.includes(day)) {
        result[day] = {
          enabled: Boolean(item.enabled),
          ranges: Array.isArray(item.ranges) && item.ranges.length
            ? item.ranges.map((r: any) => ({ start: r.start || "09:00", end: r.end || "17:00" }))
            : [{ start: "09:00", end: "17:00" }],
        };
      }
    });
    return result;
  }

  // Legacy: object keyed by day name
  if (typeof raw === "object") {
    const result = { ...fallback };
    for (const [key, val] of Object.entries(raw as Record<string, any>)) {
      const day = key.toLowerCase();
      if (DAYS.includes(day) && val && typeof val === "object") {
        result[day] = {
          enabled: Boolean(val.enabled),
          ranges: Array.isArray(val.ranges) && val.ranges.length
            ? val.ranges.map((r: any) => ({ start: r.start || "09:00", end: r.end || "17:00" }))
            : [{ start: "09:00", end: "17:00" }],
        };
      }
    }
    return result;
  }

  return fallback;
}

/**
 * Convert UI working_hours object back to backend canonical ARRAY shape.
 */
function workingHoursToArray(obj: Record<string, DaySchedule>): Array<{ day: string; enabled: boolean; ranges: TimeRange[] }> {
  return DAYS.map((day) => {
    const d = obj[day] || { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] };
    return { day, enabled: d.enabled, ranges: Array.isArray(d.ranges) ? d.ranges : [{ start: "09:00", end: "17:00" }] };
  });
}

const defaultConfig = (): SchedulingConfig => ({
  scheduling_enabled: true,
  chatbot_offers_booking: false,
  allow_manual_booking: true,
  timezone: "Europe/Zagreb",
  default_appointment_types: ["call", "site_visit", "meeting", "follow_up"],
  slot_duration_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  minimum_notice_hours: 1,
  max_days_ahead: 30,
  working_hours: defaultWorkingHours(),
  in_app_reminders: true,
  email_reminders: false,
  reminder_lead_time_minutes: 60,
  ...defaultChatbotBookingConfig(),
});

export default function SchedulingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SchedulingConfig>(defaultConfig());
  const [original, setOriginal] = useState<string>("");
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    api.getSchedulingSettings()
      .then((res) => {
        console.log("[SchedulingSettings] Loaded payload shape:", res);
        const defaults = defaultConfig();

        // Flatten chatbot_booking sub-object if backend nests it
        const chatbotBooking = res?.chatbot_booking && typeof res.chatbot_booking === "object"
          ? res.chatbot_booking as Record<string, unknown>
          : {};

        // Merge: defaults ← top-level response ← nested chatbot_booking (higher priority)
        const merged: SchedulingConfig = {
          ...defaults,
          ...res,
          ...chatbotBooking,
        };

        // Normalize working_hours from any shape
        merged.working_hours = normalizeWorkingHoursFromApi(res?.working_hours);
        // Ensure array fields are safe
        merged.default_appointment_types = Array.isArray(merged.default_appointment_types)
          ? merged.default_appointment_types : defaults.default_appointment_types;
        // Ensure booleans are actual booleans (not undefined)
        merged.chatbot_booking_enabled = Boolean(merged.chatbot_booking_enabled);
        merged.ask_after_quote = Boolean(merged.ask_after_quote);
        merged.allow_custom_time = Boolean(merged.allow_custom_time);
        merged.show_available_slots = Boolean(merged.show_available_slots);
        merged.require_name = Boolean(merged.require_name);
        merged.require_phone = Boolean(merged.require_phone);

        console.log("[SchedulingSettings] Resolved chatbot_booking_enabled:", merged.chatbot_booking_enabled);
        setConfig(merged);
        setOriginal(JSON.stringify(merged));
      })
      .catch((err) => {
        setFetchError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(() => JSON.stringify(config) !== original, [config, original]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build payload with working_hours as array (backend canonical shape)
      const { chatbot_booking_enabled, booking_mode, ask_after_quote, default_booking_type,
        allow_custom_time, show_available_slots, booking_prompt_style, require_name, require_phone,
        ...rest } = config;
      const payload = {
        ...rest,
        working_hours: workingHoursToArray(config.working_hours),
        // Send chatbot booking fields both flat AND nested for backend compatibility
        chatbot_booking_enabled,
        booking_mode,
        ask_after_quote,
        default_booking_type,
        allow_custom_time,
        show_available_slots,
        booking_prompt_style,
        require_name,
        require_phone,
        chatbot_booking: {
          chatbot_booking_enabled,
          booking_mode,
          ask_after_quote,
          default_booking_type,
          allow_custom_time,
          show_available_slots,
          booking_prompt_style,
          require_name,
          require_phone,
        },
      };
      console.log("[SchedulingSettings] Saving payload:", payload);
      await api.updateSchedulingSettings(payload);
      setOriginal(JSON.stringify(config));
      toast({ title: "Scheduling settings saved" });
    } catch (err) {
      toast({ title: "Failed to save", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof SchedulingConfig>(key: K, val: SchedulingConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: val }));

  const toggleType = (type: string) => {
    setConfig((c) => ({
      ...c,
      default_appointment_types: c.default_appointment_types.includes(type)
        ? c.default_appointment_types.filter((t) => t !== type)
        : [...c.default_appointment_types, type],
    }));
  };

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    setConfig((c) => ({
      ...c,
      working_hours: {
        ...c.working_hours,
        [day]: { ...c.working_hours[day], ...patch },
      },
    }));
  };

  const updateRange = (day: string, idx: number, field: "start" | "end", value: string) => {
    setConfig((c) => {
      const ranges = [...(c.working_hours[day]?.ranges || [])];
      ranges[idx] = { ...ranges[idx], [field]: value };
      return {
        ...c,
        working_hours: { ...c.working_hours, [day]: { ...c.working_hours[day], ranges } },
      };
    });
  };

  const addRange = (day: string) => {
    setConfig((c) => {
      const ranges = [...(c.working_hours[day]?.ranges || []), { start: "09:00", end: "17:00" }];
      return {
        ...c,
        working_hours: { ...c.working_hours, [day]: { ...c.working_hours[day], ranges } },
      };
    });
  };

  const removeRange = (day: string, idx: number) => {
    setConfig((c) => {
      const ranges = (c.working_hours[day]?.ranges || []).filter((_, i) => i !== idx);
      return {
        ...c,
        working_hours: { ...c.working_hours, [day]: { ...c.working_hours[day], ranges: ranges.length ? ranges : [{ start: "09:00", end: "17:00" }] } },
      };
    });
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading scheduling settings…</div>;

  if (fetchError) {
    return (
      <div className="space-y-4">
        <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </div>
        <p className="text-xs text-muted-foreground">Scheduling settings endpoint may not be available yet. Configuration will load once the backend supports it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* A) Booking Controls */}
      <div className="industrial-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Booking Controls</h2>

        <ToggleRow label="Enable scheduling" checked={config.scheduling_enabled} onChange={(v) => set("scheduling_enabled", v)} />
        <ToggleRow label="Chatbot offers booking" checked={config.chatbot_offers_booking} onChange={(v) => set("chatbot_offers_booking", v)} />
        <ToggleRow label="Allow manual booking from lead detail" checked={config.allow_manual_booking} onChange={(v) => set("allow_manual_booking", v)} />

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Timezone</label>
          <input
            type="text"
            value={config.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="industrial-input w-full max-w-xs"
            placeholder="Europe/Zagreb"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Default Appointment Types</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {APPOINTMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleType(t.value)}
                className={`status-badge transition-colors cursor-pointer ${
                  config.default_appointment_types.includes(t.value)
                    ? "bg-accent/15 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* B) Slot Rules */}
      <div className="industrial-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Slot Rules</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Slot Duration</label>
            <select className="industrial-input w-full" value={config.slot_duration_minutes} onChange={(e) => set("slot_duration_minutes", Number(e.target.value))}>
              {SLOT_DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Buffer Before</label>
            <input type="number" min={0} className="industrial-input w-full" value={config.buffer_before_minutes} onChange={(e) => set("buffer_before_minutes", Number(e.target.value))} />
            <span className="text-[10px] text-muted-foreground">minutes</span>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Buffer After</label>
            <input type="number" min={0} className="industrial-input w-full" value={config.buffer_after_minutes} onChange={(e) => set("buffer_after_minutes", Number(e.target.value))} />
            <span className="text-[10px] text-muted-foreground">minutes</span>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Min Notice</label>
            <input type="number" min={0} className="industrial-input w-full" value={config.minimum_notice_hours} onChange={(e) => set("minimum_notice_hours", Number(e.target.value))} />
            <span className="text-[10px] text-muted-foreground">hours</span>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Max Days Ahead</label>
            <input type="number" min={1} className="industrial-input w-full" value={config.max_days_ahead} onChange={(e) => set("max_days_ahead", Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* C) Working Hours */}
      <div className="industrial-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Working Hours</h2>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const dayConf = config.working_hours[day] || { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] };
            return (
              <div key={day} className="flex items-start gap-3 py-2 border-b border-border last:border-b-0">
                <div className="w-24 shrink-0 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dayConf.enabled}
                      onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                      className="rounded-sm accent-accent"
                    />
                    <span className="text-xs font-mono uppercase tracking-wider">{DAY_LABELS[day]?.slice(0, 3)}</span>
                  </label>
                </div>
                {dayConf.enabled && (
                  <div className="flex-1 space-y-1.5">
                    {dayConf.ranges.map((range, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={range.start}
                          onChange={(e) => updateRange(day, idx, "start", e.target.value)}
                          className="industrial-input py-1 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <input
                          type="time"
                          value={range.end}
                          onChange={(e) => updateRange(day, idx, "end", e.target.value)}
                          className="industrial-input py-1 text-xs"
                        />
                        {dayConf.ranges.length > 1 && (
                          <button type="button" onClick={() => removeRange(day, idx)} className="text-destructive hover:text-destructive/80 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addRange(day)} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                      <Plus size={10} /> Add range
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* D) Reminder Defaults */}
      <div className="industrial-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Reminder Defaults</h2>
        <ToggleRow label="In-app reminders" checked={config.in_app_reminders} onChange={(v) => set("in_app_reminders", v)} />
        <ToggleRow label="Email reminders" checked={config.email_reminders} onChange={(v) => set("email_reminders", v)} />
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Reminder Lead Time</label>
          <select className="industrial-input w-full max-w-xs" value={config.reminder_lead_time_minutes} onChange={(e) => set("reminder_lead_time_minutes", Number(e.target.value))}>
            {REMINDER_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* E) Chatbot Booking */}
      <ChatbotBookingSettings
        config={{
          chatbot_booking_enabled: config.chatbot_booking_enabled,
          booking_mode: config.booking_mode,
          ask_after_quote: config.ask_after_quote,
          default_booking_type: config.default_booking_type,
          allow_custom_time: config.allow_custom_time,
          show_available_slots: config.show_available_slots,
          booking_prompt_style: config.booking_prompt_style,
          require_name: config.require_name,
          require_phone: config.require_phone,
        }}
        onChange={(chatbotConfig) => setConfig((c) => ({ ...c, ...chatbotConfig }))}
      />

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={isDirty ? "gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" : "gap-1.5"}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-accent" : "bg-muted"
        }`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </label>
  );
}
