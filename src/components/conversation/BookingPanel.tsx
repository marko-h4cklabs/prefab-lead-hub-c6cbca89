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

export interface BookingPayload {
  mode: "offer" | "slots" | "awaiting_name" | "awaiting_phone" | "awaiting_custom_time" | "confirmed" | "declined" | "not_available" | null;
  slots?: BookingSlot[];
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
  requiredBeforeBooking?: string[];
  message?: string;
  debug?: { reason?: string };
}

interface Props {
  booking: BookingPayload;
  leadId: string;
  conversationId?: string | null;
  onBookingUpdate?: (updated: BookingPayload) => void;
  onSendMessage?: (content: string) => void;
}

function slotStart(slot: BookingSlot): string {
  return slot.startAt || slot.start || "";
}

function slotEnd(slot: BookingSlot): string {
  return slot.endAt || slot.end || "";
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
  call: "📞", site_visit: "📍", meeting: "🤝", follow_up: "🔄",
};

export default function BookingPanel({ booking, leadId, conversationId, onBookingUpdate, onSendMessage }: Props) {
  const navigate = useNavigate();
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null);

  const handleSlotSelect = async (slot: BookingSlot) => {
    if (bookingInProgress) return;
    const slotKey = slot.id || slotStart(slot) || String(Math.random());
    setBookingInProgress(slotKey);
    try {
      const companyId = requireCompanyId();
      const res = await api.bookSlot(companyId, leadId, {
        slot_id: slot.id,
        start: slotStart(slot),
        end: slotEnd(slot) || undefined,
        conversation_id: conversationId || undefined,
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

  const safeSlots = Array.isArray(booking.slots) ? booking.slots : [];
  const visibleSlots = safeSlots.slice(0, 5);
  const apptType = booking.appointment_type || booking.appointmentType || "";

  switch (booking.mode) {
    case "offer":
      return (
        <div className="mt-2 flex gap-2 flex-wrap">
          <button
            onClick={() => onSendMessage?.("Yes, I'd like to book")}
            className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-xs font-mono text-accent hover:bg-accent/20 transition-colors"
          >
            <CalendarDays size={12} />
            Book a call
          </button>
          <button
            onClick={() => onSendMessage?.("Not now")}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Not now
          </button>
        </div>
      );

    case "slots":
      return (
        <div className="mt-2 space-y-1.5">
          {visibleSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No available slots provided.</p>
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

    case "awaiting_custom_time":
      return (
        <div className="mt-2 rounded-sm border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <Clock size={12} />
            Type your preferred day and time.
          </p>
        </div>
      );

    case "confirmed": {
      const appt = booking.appointment || {};
      const slot = booking.confirmed_slot;
      const startRaw = appt.start_at || appt.startAt || (slot ? slotStart(slot) : "");
      const confirmedType = appt.type || appt.appointmentType || apptType;
      const tz = appt.timezone || booking.timezone || slot?.timezone;
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
            onClick={() => navigate("/calendar")}
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
        <div className="mt-2 rounded-sm border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <CalendarDays size={12} />
            No slots available at this time
          </p>
        </div>
      );

    default:
      return null;
  }
}
