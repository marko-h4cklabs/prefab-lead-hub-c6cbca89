import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Clock, AlertCircle, CalendarDays, CalendarCheck } from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  lead_created: "Lead created",
  status_changed: "Status changed",
  message_received: "Message received",
  message_sent: "Message sent",
  ai_reply: "AI reply sent",
  note_created: "Note created",
  note_updated: "Note updated",
  note_deleted: "Note deleted",
  task_created: "Task created",
  task_completed: "Task completed",
  task_cancelled: "Task cancelled",
  task_reopened: "Task reopened",
  task_deleted: "Task deleted",
  scheduling_request_created: "Scheduling request created",
  scheduling_request_converted: "Scheduling request converted",
  appointment_created: "Appointment created",
  appointment_status_changed: "Appointment status changed",
  appointment_cancelled: "Appointment cancelled",
  appointment_completed: "Appointment completed",
};

const SCHEDULING_EVENTS = new Set([
  "scheduling_request_created",
  "scheduling_request_converted",
  "appointment_created",
  "appointment_status_changed",
  "appointment_cancelled",
  "appointment_completed",
]);

function formatEventLabel(type: string): string {
  return EVENT_LABELS[type] || type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Safely coerce to a renderable string — prevents React error #31 from API objects. */
const str = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? "" : String(v);

interface Props {
  leadId: string;
}

export default function CrmActivityTab({ leadId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetch = useCallback(() => {
    setLoading(true);
    setError("");
    api.getLeadActivity(leadId, { limit: 30 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.items || res?.data || res?.activity || [];
        setItems(list);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (error) {
    return (
      <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading activity…</p>;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>;
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={item.id || i} className="flex gap-3 py-2.5 border-b border-border last:border-0">
          <div className="mt-0.5 text-muted-foreground">
            {SCHEDULING_EVENTS.has(str(item.event_type) || str(item.type))
              ? (str(item.event_type) || str(item.type)).includes("appointment")
                ? <CalendarCheck size={14} className="text-accent" />
                : <CalendarDays size={14} className="text-accent" />
              : <Clock size={14} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{formatEventLabel(str(item.event_type) || str(item.type))}</p>
            {item.metadata && typeof item.metadata === "object" && Object.keys(item.metadata).length > 0 && (
              <p className="text-xs text-muted-foreground truncate">
                {str(item.metadata.from) && str(item.metadata.to)
                  ? `${str(item.metadata.from)} → ${str(item.metadata.to)}`
                  : Object.entries(item.metadata).map(([k, v]) => `${k}: ${str(v)}`).join(", ")}
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
            {item.created_at ? timeAgo(item.created_at) : ""}
          </div>
          {(str(item.actor) || str(item.source)) && (
            <span className="status-badge bg-muted text-muted-foreground text-[10px] self-start">
              {str(item.actor) || str(item.source)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
