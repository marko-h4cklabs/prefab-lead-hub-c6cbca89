import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Check, X, Loader2, Clock, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api, requireCompanyId } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errorUtils";

export interface BookingSlot {
  id?: string;
  start: string;
  end?: string;
  label?: string;
  date?: string;
  time?: string;
}

export interface BookingPayload {
  mode: "offer" | "slots" | "awaiting_custom_time" | "confirmed" | "declined" | "not_available";
  slots?: BookingSlot[];
  appointment_type?: string;
  timezone?: string;
  confirmed_slot?: BookingSlot;
  appointment_id?: string;
  appointment?: {
    id?: string;
    title?: string;
    start_at?: string;
    end_at?: string;
    type?: string;
    timezone?: string;
  };
  message?: string;
}

interface Props {
  booking: BookingPayload;
  leadId: string;
  conversationId?: string | null;
  onBookingUpdate?: (updated: BookingPayload) => void;
  onSendMessage?: (content: string) => void;
}

function formatSlotLabel(slot: BookingSlot): string {
  if (slot.label) return slot.label;
  try {
    const d = new Date(slot.start);
    const dateStr = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (slot.end) {
      const endStr = new Date(slot.end).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${dateStr} · ${timeStr} – ${endStr}`;
    }
    return `${dateStr} · ${timeStr}`;
  } catch {
    return slot.date && slot.time ? `${slot.date} ${slot.time}` : slot.start;
  }
}

export default function BookingPanel({ booking, leadId, conversationId, onBookingUpdate, onSendMessage }: Props) {
  const navigate = useNavigate();
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null);

  const handleSlotSelect = async (slot: BookingSlot) => {
    if (bookingInProgress) return;
    const slotKey = slot.id || slot.start;
    setBookingInProgress(slotKey);
    try {
      const companyId = requireCompanyId();
      const res = await api.bookSlot(companyId, leadId, {
        slot_id: slot.id,
        start: slot.start,
        end: slot.end,
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

  switch (booking.mode) {
    case "offer":
      // Offer mode: quick reply buttons rendered separately via quick_replies.
      // If no quick_replies exist, show minimal CTA.
      return null;

    case "slots":
      return (
        <div className="mt-2 space-y-1.5">
          {visibleSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No available slots provided.</p>
          ) : (
            visibleSlots.map((slot, i) => {
              const key = slot.id || slot.start || String(i);
              const isLoading = bookingInProgress === (slot.id || slot.start);
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

    case "awaiting_custom_time":
      return (
        <div className="mt-2 rounded-sm border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <Clock size={12} />
            Waiting for your preferred time…
          </p>
        </div>
      );

    case "confirmed": {
      const appt = booking.appointment || {};
      const slot = booking.confirmed_slot;
      const startRaw = appt.start_at || slot?.start;
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
          {(booking.timezone || appt.timezone) && (
            <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <MapPin size={10} />
              {booking.timezone || appt.timezone}
            </p>
          )}
          {(booking.appointment_type || appt.type) && (
            <p className="text-[10px] font-mono text-muted-foreground">
              Type: {booking.appointment_type || appt.type}
            </p>
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
        <div className="mt-2 rounded-sm border border-destructive/20 bg-destructive/5 px-3 py-2">
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
