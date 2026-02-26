import {
  NormalizedAppointment,
  TYPE_LABELS,
  STATUS_CLASSES,
  formatAppointmentTime,
  extractDate,
} from "@/lib/appointmentUtils";
import { Clock } from "lucide-react";

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));

interface Props {
  appointments: NormalizedAppointment[];
  onSelect: (appt: NormalizedAppointment) => void;
}

export default function UpcomingPanel({ appointments, onSelect }: Props) {
  // Show next 3 scheduled appointments
  const upcoming = appointments
    .filter((a) => a.status === "scheduled" && a.startAt)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="dark-card rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-accent" />
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          Coming Up
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {upcoming.map((appt) => {
          const dateStr = extractDate(appt.startAt);
          return (
            <button
              key={appt.id}
              onClick={() => onSelect(appt)}
              className="text-left dark-card rounded-xl p-3 hover:bg-muted/30 transition-colors border-l-2 border-l-accent"
            >
              <div className="text-sm font-medium truncate">{str(appt.title)}</div>
              {str(appt.lead?.name) && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">{str(appt.lead?.name)}</div>
              )}
              <div className="text-xs font-mono text-muted-foreground mt-1">
                {dateStr ? new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
                {" · "}
                {formatAppointmentTime(appt)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="status-badge bg-muted text-muted-foreground text-[10px]">
                  {TYPE_LABELS[str(appt.appointmentType)] || str(appt.appointmentType)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
