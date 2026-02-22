/**
 * Chatbot Booking subsection for Scheduling Settings.
 * Manages chatbot-specific booking controls.
 */

interface ChatbotBookingConfig {
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

interface Props {
  config: ChatbotBookingConfig;
  onChange: (config: ChatbotBookingConfig) => void;
}

const BOOKING_MODES = [
  { value: "off", label: "Off" },
  { value: "manual_request", label: "Manual request (recommended)" },
  { value: "direct_booking", label: "Direct booking (future-ready)" },
];

const APPOINTMENT_TYPES = [
  { value: "call", label: "Call" },
  { value: "site_visit", label: "Site Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow-up" },
];

const PROMPT_STYLES = [
  { value: "neutral", label: "Neutral" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
];

export const defaultChatbotBookingConfig = (): ChatbotBookingConfig => ({
  chatbot_booking_enabled: false,
  booking_mode: "manual_request",
  ask_after_quote: true,
  default_booking_type: "call",
  allow_custom_time: true,
  show_available_slots: true,
  booking_prompt_style: "neutral",
  require_name: false,
  require_phone: false,
});

export default function ChatbotBookingSettings({ config, onChange }: Props) {
  const set = <K extends keyof ChatbotBookingConfig>(key: K, val: ChatbotBookingConfig[K]) =>
    onChange({ ...config, [key]: val });

  const isOff = config.booking_mode === "off";

  return (
    <div className="industrial-card p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider">Chatbot Booking</h2>

      <ToggleRow
        label="Enable chatbot booking offers"
        checked={config.chatbot_booking_enabled}
        onChange={(v) => set("chatbot_booking_enabled", v)}
      />

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Booking Mode
        </label>
        <select
          className="industrial-input w-full max-w-xs"
          value={config.booking_mode}
          onChange={(e) => set("booking_mode", e.target.value)}
        >
          {BOOKING_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className={isOff ? "opacity-50 pointer-events-none" : ""}>
        <ToggleRow
          label="Ask for booking after quote flow"
          checked={config.ask_after_quote}
          onChange={(v) => set("ask_after_quote", v)}
        />

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Default Appointment Type
          </label>
          <select
            className="industrial-input w-full max-w-xs"
            value={config.default_booking_type}
            onChange={(e) => set("default_booking_type", e.target.value)}
          >
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          <ToggleRow
            label="Allow user to propose custom time"
            checked={config.allow_custom_time}
            onChange={(v) => set("allow_custom_time", v)}
          />
          <ToggleRow
            label="Show available slots when possible"
            checked={config.show_available_slots}
            onChange={(v) => set("show_available_slots", v)}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Booking Prompt Style
          </label>
          <select
            className="industrial-input w-full max-w-xs"
            value={config.booking_prompt_style}
            onChange={(e) => set("booking_prompt_style", e.target.value)}
          >
            {PROMPT_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <ToggleRow
              label="Require name before booking request"
              checked={!!config.require_name}
              onChange={(v) => set("require_name", v)}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">If enabled, chatbot will collect this before sending a booking request.</p>
          </div>
          <div>
            <ToggleRow
              label="Require phone before booking request"
              checked={!!config.require_phone}
              onChange={(v) => set("require_phone", v)}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">If enabled, chatbot will collect this before sending a booking request.</p>
          </div>
        </div>
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
