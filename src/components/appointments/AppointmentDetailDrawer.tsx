import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  NormalizedAppointment,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_CLASSES,
  SOURCE_LABELS,
  formatAppointmentTime,
  extractDate,
  computeDuration,
} from "@/lib/appointmentUtils";
import { Calendar, Clock, MapPin, Bell, FileText, User, ExternalLink, CheckCircle, XCircle, Pencil, Video } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));

interface Props {
  appointment: NormalizedAppointment | null;
  open: boolean;
  onClose: () => void;
  onEdit: (appt: NormalizedAppointment) => void;
  onMarkCompleted: (id: string) => void;
  onCancel: (id: string) => void;
}

export default function AppointmentDetailDrawer({
  appointment,
  open,
  onClose,
  onEdit,
  onMarkCompleted,
  onCancel,
}: Props) {
  const navigate = useNavigate();
  const appt = appointment;
  if (!appt) return null;

  const dateStr = extractDate(appt.startAt);
  const timeStr = formatAppointmentTime(appt);
  const duration = computeDuration(appt);
  const isActive = appt.status === "scheduled";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-wider">
            Appointment Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title + Status */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-tight">{str(appt.title)}</h3>
            <span className={`shrink-0 ${STATUS_CLASSES[str(appt.status)] || "status-pending"}`}>
              {STATUS_LABELS[str(appt.status)] || str(appt.status)}
            </span>
          </div>

          {/* Info grid */}
          <dl className="space-y-2.5 text-sm">
            {/* Lead */}
            {str(appt.lead?.name) && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-muted-foreground shrink-0" />
                <dt className="text-muted-foreground w-20 shrink-0">Lead</dt>
                <dd className="font-medium flex items-center gap-1.5">
                  {str(appt.lead?.name)}
                  {str(appt.lead?.channel) && (
                    <span className="status-badge bg-muted text-muted-foreground text-[10px]">{str(appt.lead?.channel)}</span>
                  )}
                  {appt.leadId && (
                    <button
                      onClick={() => { onClose(); navigate(`/leads/${appt.leadId}`); }}
                      className="text-accent hover:text-accent/80 transition-colors"
                      title="Open Lead"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </dd>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <dt className="text-muted-foreground w-20 shrink-0">Date</dt>
              <dd className="font-medium font-mono">
                {dateStr ? new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—"}
              </dd>
            </div>

            {/* Time */}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground shrink-0" />
              <dt className="text-muted-foreground w-20 shrink-0">Time</dt>
              <dd className="font-medium font-mono">{timeStr} ({duration} min)</dd>
            </div>

            {/* Timezone */}
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-muted-foreground shrink-0" />
              <dt className="text-muted-foreground w-20 shrink-0">Timezone</dt>
              <dd className="font-medium">{str(appt.timezone)}</dd>
            </div>

            {/* Type */}
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <dt className="text-muted-foreground w-20 shrink-0">Type</dt>
              <dd>
                <span className="status-badge bg-muted text-muted-foreground">
                  {TYPE_LABELS[str(appt.appointmentType)] || str(appt.appointmentType)}
                </span>
              </dd>
            </div>

            {/* Source */}
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <dt className="text-muted-foreground w-20 shrink-0">Source</dt>
              <dd className="text-muted-foreground">{SOURCE_LABELS[str(appt.source)] || str(appt.source)}</dd>
            </div>

            {/* Reminder */}
            {appt.reminderMinutesBefore && (
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-muted-foreground shrink-0" />
                <dt className="text-muted-foreground w-20 shrink-0">Reminder</dt>
                <dd className="font-medium">
                  {appt.reminderMinutesBefore >= 60
                    ? `${Math.round(appt.reminderMinutesBefore / 60)}h before`
                    : `${appt.reminderMinutesBefore}m before`}
                </dd>
              </div>
            )}

            {/* Notes */}
            {str(appt.notes) && (
              <div className="pt-2 border-t border-border">
                <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Notes</dt>
                <dd className="text-sm whitespace-pre-wrap">{str(appt.notes)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex gap-2">
            {isActive && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => onMarkCompleted(appt.id)}
                >
                  <CheckCircle size={12} /> Complete
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => onCancel(appt.id)}
                >
                  <XCircle size={12} /> Cancel
                </Button>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onEdit(appt)}
          >
            <Pencil size={12} /> Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
