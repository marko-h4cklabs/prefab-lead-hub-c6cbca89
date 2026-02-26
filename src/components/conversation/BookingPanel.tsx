import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Check, X, Loader2, Clock, MapPin, Phone, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, requireCompanyId } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errorUtils";

export interface BookingSlot {
  id?: string;
  start?: string;
  startAt?: string;
  end?: string;
  endAt?: string;
  label?: string;
  date?: string;
  time?: string;
  timezone?: string;
}

export type BookingMode =
  | "offer" | "booking_offer"
  | "slots" | "booking_slots"
  | "awaiting_name" | "awaiting_phone"
  | "awaiting_custom_time" | "booking_collect_time"
  | "confirmed" | "booking_confirm" | "booking_success"
  | "declined"
  | "not_available"
  | null;

export interface BookingPayload {
  mode: BookingMode;
  slots?: BookingSlot[];
  availableSlots?: BookingSlot[];
  appointment_type?: string;
  appointmentType?: string;
  timezone?: string;
  confirmed_slot?: BookingSlot;
  appointment_id?: string;
  appointment?: {
    id?: string;
    title?: string;
    start_at?: string;
    startAt?: string;
    end_at?: string;
    endAt?: string;
    type?: string;
    appointmentType?: string;
    timezone?: string;
    status?: string;
  };
  summary?: {
    type?: string;
    date?: string;
    time?: string;
    timezone?: string;
  };
  draft?: {
    type?: string;
    date?: string;
    time?: string;
    timezone?: string;
  };
  requiredBeforeBooking?: string[];
  missingPrereqs?: string[];
  quickActions?: Array<{ label: string; value: string }>;
  flowStatus?: string;
  bookingMode?: string;
  requiresName?: boolean;
  requiresPhone?: boolean;
  message?: string;
  source?: string;
  debug?: { reason?: string };
}

interface Props {
  booking: BookingPayload;
  leadId: string;
  conversationId?: string | null;
  onBookingUpdate?: (updated: BookingPayload) => void;
  onSendMessage?: (content: string) => void;
  onDismiss?: () => void;
}

function slotStart(slot: BookingSlot): string {
  return slot.startAt || (slot as any).start_at || slot.start || (slot as any).slotStart || "";
}

function slotEnd(slot: BookingSlot): string {
  return slot.endAt || (slot as any).end_at || slot.end || (slot as any).slotEnd || "";
}

/** Normalize a slot into canonical booking payload fields */
export function normalizeSlotForBooking(
  slot: BookingSlot,
  defaults?: { defaultAppointmentType?: string; timezone?: string }
): { startAt: string; endAt: string; appointmentType: string; timezone: string } {
  return {
    startAt: slotStart(slot),
    endAt: slotEnd(slot),
    appointmentType: (slot as any).appointmentType || (slot as any).appointment_type || (slot as any).type || defaults?.defaultAppointmentType || "call",
    timezone: slot.timezone || (slot as any).timeZone || defaults?.timezone || "Europe/Zagreb",
  };
}

/** Dedupe and sort slots, filtering out invalid ones */
export function dedupeSlots(
  slots: BookingSlot[],
  defaults?: { defaultAppointmentType?: string; timezone?: string },
  max: number = 5
): BookingSlot[] {
  const seen = new Set<string>();
  const valid: BookingSlot[] = [];
  for (const slot of slots) {
    const n = normalizeSlotForBooking(slot, defaults);
    if (!n.startAt) continue; // skip invalid
    const key = `${n.startAt}|${n.endAt}|${n.appointmentType}|${n.timezone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(slot);
  }
  // Sort by startAt ascending
  valid.sort((a, b) => slotStart(a).localeCompare(slotStart(b)));
  return valid.slice(0, max);
}

function formatSlotLabel(slot: BookingSlot): string {
  if (slot.label) return slot.label;
  const raw = slotStart(slot);
  if (!raw) return slot.date && slot.time ? `${slot.date} ${slot.time}` : "—";
  try {
    const d = new Date(raw);
    const dateStr = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const endRaw = slotEnd(slot);
    if (endRaw) {
      const endStr = new Date(endRaw).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${dateStr} · ${timeStr} – ${endStr}`;
    }
    return `${dateStr} · ${timeStr}`;
  } catch {
    return raw;
  }
}

const TYPE_ICONS: Record<string, string> = {
  call: "📞", meeting: "🤝", follow_up: "🔄",
};

/** Normalize mode aliases into canonical values */
function normalizeMode(mode: BookingMode): string | null {
  if (!mode) return null;
  const m = String(mode);
  if (m === "offer" || m === "booking_offer") return "offer";
  if (m === "slots" || m === "booking_slots") return "slots";
  if (m === "awaiting_custom_time" || m === "booking_collect_time") return "collect_time";
  if (m === "booking_confirm") return "confirm";
  if (m === "confirmed" || m === "booking_success") return "confirmed";
  if (m === "awaiting_name") return "awaiting_name";
  if (m === "awaiting_phone") return "awaiting_phone";
  if (m === "declined") return "declined";
  if (m === "not_available") return "not_available";
  return m;
}

/** Get human-readable flow status label for sidebar hints */
export function getBookingFlowLabel(booking?: BookingPayload | null): string | null {
  if (!booking?.mode) return null;
  const n = normalizeMode(booking.mode);
  switch (n) {
    case "offer": return "Offered";
    case "slots": return "Selecting slot";
    case "collect_time": return "Awaiting time";
    case "confirm": return "Confirming";
    case "confirmed": return "Confirmed";
    case "declined": return "Declined";
    case "not_available": return "No slots";
    case "awaiting_name": return "Awaiting name";
    case "awaiting_phone": return "Awaiting phone";
    default: return null;
  }
}

export default function BookingPanel({ booking, leadId, conversationId, onBookingUpdate, onSendMessage, onDismiss }: Props) {
  const navigate = useNavigate();
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null);

  const handleSlotSelect = async (slot: BookingSlot) => {
    if (bookingInProgress) return;
    const slotKey = slot.id || slotStart(slot) || String(Math.random());
    setBookingInProgress(slotKey);
    try {
      const companyId = requireCompanyId();
      const normalized = normalizeSlotForBooking(slot, {
        defaultAppointmentType: booking.appointment_type || booking.appointmentType || "call",
        timezone: booking.timezone,
      });
      const res = await api.bookSlot(companyId, leadId, {
        slot_id: slot.id,
        startAt: normalized.startAt,
        endAt: normalized.endAt || undefined,
        conversation_id: conversationId || undefined,
        appointment_type: normalized.appointmentType,
        timezone: normalized.timezone,
        source: "chatbot",
      });
      if (onBookingUpdate && res?.booking) {
        onBookingUpdate(res.booking);
      } else if (onBookingUpdate) {
        onBookingUpdate({ ...booking, mode: "confirmed", confirmed_slot: slot });
      }
      toast({ title: "Appointment booked" });
    } catch (err) {
      toast({ title: "Booking failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setBookingInProgress(null);
    }
  };

  const safeSlots = Array.isArray(booking.slots) ? booking.slots : Array.isArray(booking.availableSlots) ? booking.availableSlots : [];
  const slotDefaults = { defaultAppointmentType: booking.appointment_type || booking.appointmentType || "call", timezone: booking.timezone || "Europe/Zagreb" };
  const visibleSlots = dedupeSlots(safeSlots, slotDefaults, 5);
  const apptType = booking.appointment_type || booking.appointmentType || "";
  const normalizedMode = normalizeMode(booking.mode);

  // Quick action buttons from backend or inferred
  const quickActions = Array.isArray(booking.quickActions) ? booking.quickActions : [];

  switch (normalizedMode) {
    case "offer": {
      const actions = quickActions.length > 0 ? quickActions : [
        { label: "Show available slots", value: "Show available slots" },
        { label: "Propose a time", value: "I'd like to propose a time" },
      ];
      return (
        <div className="mt-2 flex gap-2 flex-wrap">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => onSendMessage?.(a.value)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
            >
              {a.label.toLowerCase().includes("slot") && <CalendarDays size={12} />}
              {a.label.toLowerCase().includes("propose") && <Clock size={12} />}
              {a.label}
            </button>
          ))}
          <button
            onClick={() => onDismiss?.()}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={12} />
            Not now
          </button>
        </div>
      );
    }

    case "slots":
      return (
        <div className="mt-2 space-y-1.5">
          {visibleSlots.length === 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-mono">
                No available slots found in this range. You can still propose a preferred time.
              </p>
              <button
                onClick={() => onSendMessage?.("I'd like to propose a time")}
                className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
              >
                <Clock size={12} />
                Propose a time
              </button>
            </div>
          ) : (
            visibleSlots.map((slot, i) => {
              const key = slot.id || slotStart(slot) || String(i);
              const isLoading = bookingInProgress === (slot.id || slotStart(slot));
              const isDisabled = bookingInProgress !== null;
              return (
                <button
                  key={key}
                  onClick={() => handleSlotSelect(slot)}
                  disabled={isDisabled}
                  className="w-full flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-left text-sm font-mono hover:bg-accent/10 hover:border-accent/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock size={13} className="text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{formatSlotLabel(slot)}</span>
                  {slot.timezone && <span className="text-[10px] text-muted-foreground shrink-0">{slot.timezone}</span>}
                  {isLoading && <Loader2 size={14} className="animate-spin text-accent shrink-0" />}
                </button>
              );
            })
          )}
          {safeSlots.length > 5 && (
            <p className="text-[10px] text-muted-foreground font-mono">
              +{safeSlots.length - 5} more slots available
            </p>
          )}
        </div>
      );

    case "collect_time": {
      const timeChips = [
        { label: "Today afternoon", value: "Today afternoon" },
        { label: "Tomorrow morning", value: "Tomorrow morning" },
        { label: "This week", value: "This week" },
      ];
      return (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <Clock size={12} />
            Type your preferred day and time, or pick a suggestion:
          </p>
          <div className="flex gap-2 flex-wrap">
            {timeChips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => onSendMessage?.(chip.value)}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/30 px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case "confirm": {
      const s = booking.summary || booking.draft || {};
      const confirmType = s.type || apptType;
      return (
        <div className="mt-2 rounded-sm border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
            <CalendarDays size={13} className="text-accent" />
            Confirm booking
          </p>
          {(s.date || s.time) && (
            <p className="text-sm font-mono text-muted-foreground">
              {[s.date, s.time].filter(Boolean).join(" · ")}
            </p>
          )}
          {confirmType && <p className="text-[10px] font-mono text-muted-foreground">{TYPE_ICONS[confirmType] || ""} {confirmType.replace(/_/g, " ")}</p>}
          {s.timezone && <p className="text-[10px] font-mono text-muted-foreground"><MapPin size={10} className="inline" /> {s.timezone}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onSendMessage?.("Confirm")}
              className="inline-flex items-center gap-1 rounded-sm border border-accent bg-accent/10 px-3 py-1 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
            >
              <Check size={12} /> Confirm
            </button>
            <button
              onClick={() => onSendMessage?.("I'd like to change the time")}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/30 px-3 py-1 text-xs font-mono text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      );
    }

    case "awaiting_name":
      return (
        <div className="mt-2 rounded-sm border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <User size={12} />
            Please provide your name to continue booking.
          </p>
        </div>
      );

    case "awaiting_phone":
      return (
        <div className="mt-2 rounded-sm border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <Phone size={12} />
            Please provide your phone number to continue booking.
          </p>
        </div>
      );

    case "confirmed": {
      const appt = booking.appointment || {};
      const slot = booking.confirmed_slot;
      const startRaw = appt.start_at || appt.startAt || (slot ? slotStart(slot) : "");
      const confirmedType = appt.type || appt.appointmentType || apptType;
      const tz = appt.timezone || booking.timezone || slot?.timezone;
      const apptId = appt.id || booking.appointment_id;
      let dateDisplay = "";
      let timeDisplay = "";
      if (startRaw) {
        try {
          const d = new Date(startRaw);
          dateDisplay = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          timeDisplay = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        } catch { /* safe */ }
      }

      return (
        <div className="mt-2 rounded-sm border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-accent text-xs font-mono font-medium">
            <Check size={13} />
            Appointment Confirmed
          </div>
          {dateDisplay && (
            <p className="text-sm font-medium flex items-center gap-1.5">
              <CalendarDays size={13} className="text-muted-foreground" />
              {dateDisplay}
              {timeDisplay && <span className="text-muted-foreground">· {timeDisplay}</span>}
            </p>
          )}
          {tz && (
            <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <MapPin size={10} />
              {tz}
            </p>
          )}
          {confirmedType && (
            <p className="text-[10px] font-mono text-muted-foreground">
              {TYPE_ICONS[confirmedType] || ""} {confirmedType.replace(/_/g, " ")}
            </p>
          )}
          {appt.status && (
            <p className="text-[10px] font-mono text-muted-foreground">Status: {appt.status}</p>
          )}
          <button
            onClick={() => navigate(apptId ? `/calendar` : "/calendar")}
            className="text-[10px] font-mono text-accent hover:underline mt-1 inline-block"
          >
            View in Appointments →
          </button>
        </div>
      );
    }

    case "declined":
      return (
        <div className="mt-2 rounded-sm border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <X size={12} />
            Booking declined
          </p>
        </div>
      );

    case "not_available":
      return (
        <div className="mt-2 rounded-sm border border-border bg-muted/20 px-3 py-2 space-y-1.5">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <CalendarDays size={12} />
            No slots available at this time
          </p>
          <button
            onClick={() => onSendMessage?.("I'd like to propose a time")}
            className="inline-flex items-center gap-1 rounded-sm border border-accent bg-accent/10 px-2.5 py-1 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
          >
            <Clock size={12} />
            Propose a time
          </button>
        </div>
      );

    default:
      return null;
  }
}
