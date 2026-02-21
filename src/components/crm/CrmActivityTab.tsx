import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Clock, AlertCircle } from "lucide-react";

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
};

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
          <div className="mt-0.5 text-muted-foreground"><Clock size={14} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{formatEventLabel(item.event_type || item.type)}</p>
            {item.metadata && typeof item.metadata === "object" && (
              <p className="text-xs text-muted-foreground truncate">
                {item.metadata.from && item.metadata.to
                  ? `${item.metadata.from} → ${item.metadata.to}`
                  : Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(", ")}
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
            {item.created_at ? timeAgo(item.created_at) : ""}
          </div>
          {(item.actor || item.source) && (
            <span className="status-badge bg-muted text-muted-foreground text-[10px] self-start">
              {item.actor || item.source}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
