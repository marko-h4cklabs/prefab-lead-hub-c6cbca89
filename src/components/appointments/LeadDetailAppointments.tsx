/**
 * Inline appointments list for the Lead Detail page.
 * Renders appointments from the lead response payload (lead.appointments).
 * Falls back gracefully if no appointments exist.
 */
import { CalendarDays, Phone, MapPin, Clock } from "lucide-react";

interface LeadAppointment {
  id?: string;
  title?: string;
  type?: string;
  appointmentType?: string;
  appointment_type?: string;
  start_at?: string;
  startAt?: string;
  end_at?: string;
  endAt?: string;
  timezone?: string;
  status?: string;
  source?: string;
}

interface Props {
  appointments: LeadAppointment[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone size={12} />,
  meeting: <CalendarDays size={12} />,
  follow_up: <Clock size={12} />,
};

const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

function formatDateTime(raw?: string): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return raw;
  }
}

export default function LeadDetailAppointments({ appointments }: Props) {
  const safe = Array.isArray(appointments) ? appointments : [];

  if (safe.length === 0) {
    return (
      <div className="industrial-card p-6 mt-6">
        <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Appointments
        </h2>
        <p className="text-sm text-muted-foreground">No appointments yet</p>
      </div>
    );
  }

  const now = new Date();
  const upcoming = safe.filter((a) => {
    const s = a.start_at || a.startAt;
    return s && new Date(s) >= now;
  }).sort((a, b) => new Date(a.start_at || a.startAt || "").getTime() - new Date(b.start_at || b.startAt || "").getTime());

  const past = safe.filter((a) => {
    const s = a.start_at || a.startAt;
    return !s || new Date(s) < now;
  }).sort((a, b) => new Date(b.start_at || b.startAt || "").getTime() - new Date(a.start_at || a.startAt || "").getTime());

  const renderAppt = (appt: LeadAppointment, i: number) => {
    const type = appt.type || appt.appointmentType || appt.appointment_type || "";
    const start = appt.start_at || appt.startAt || "";
    const status = appt.status || "scheduled";
    return (
      <div key={appt.id || i} className="flex items-start gap-3 py-2 border-b border-border last:border-b-0">
        <div className="mt-0.5 text-muted-foreground">
          {TYPE_ICONS[type] || <CalendarDays size={12} />}
        </div>
        <div className="flex-1 min-w-0">
          {appt.title && <p className="text-sm font-medium truncate">{appt.title}</p>}
          <p className="text-xs font-mono text-muted-foreground">{formatDateTime(start)}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="status-badge bg-muted text-muted-foreground text-[10px]">
              {TYPE_LABELS[type] || type || "Appointment"}
            </span>
            <span className={`status-badge text-[10px] ${status === "scheduled" ? "bg-accent/15 text-accent" : status === "completed" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
              {status}
            </span>
            {appt.source && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {appt.source}
              </span>
            )}
            {appt.timezone && (
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                <MapPin size={8} /> {appt.timezone}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="industrial-card p-6 mt-6">
      <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground mb-3">
        Appointments
      </h2>
      {upcoming.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">Upcoming</h3>
          {upcoming.map(renderAppt)}
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Past</h3>
          {past.map(renderAppt)}
        </div>
      )}
    </div>
  );
}
