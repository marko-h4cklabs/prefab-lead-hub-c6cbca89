import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import {
  normalizeSchedulingRequestList,
  NormalizedSchedulingRequest,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_CLASSES,
  REQUEST_TYPE_LABELS,
  REQUEST_SOURCE_LABELS,
} from "@/lib/schedulingRequestUtils";
import { CalendarPlus, X, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface Props {
  leadId: string;
  leadName: string;
  onConvertToAppointment: (request: NormalizedSchedulingRequest) => void;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function LeadSchedulingRequests({ leadId, leadName, onConvertToAppointment }: Props) {
  const [items, setItems] = useState<NormalizedSchedulingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError("");
    api.getLeadSchedulingRequests(leadId)
      .then((res) => setItems(normalizeSchedulingRequestList(res)))
      .catch((err) => {
        const msg = getErrorMessage(err);
        // If endpoint doesn't exist yet, hide section gracefully
        if (msg.includes("404") || msg.includes("not found") || msg.includes("Not Found")) {
          setHidden(true);
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleClose = async (id: string) => {
    try {
      await api.closeSchedulingRequest(id);
      toast({ title: "Request closed" });
      fetchRequests();
    } catch (err) {
      toast({ title: "Failed to close request", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (hidden) return null;

  return (
    <div className="industrial-card p-6 mt-6">
      <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground mb-4">
        Calendly Offered to Lead
      </h2>

      {error && (
        <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2 mb-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-muted-foreground py-2 text-center">No Calendly offers yet</p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-0">
          {items.map((req) => (
            <div key={req.id} className="border-b border-border last:border-0 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-mono ${REQUEST_STATUS_CLASSES[req.status] || "status-pending"}`}>
                    {REQUEST_STATUS_LABELS[req.status] || req.status}
                  </span>
                  <span className="status-badge bg-muted text-muted-foreground text-[10px]">
                    {REQUEST_TYPE_LABELS[req.requestType] || req.requestType}
                  </span>
                  {req.preferredDate && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {req.preferredDate}{req.preferredTime ? ` ${req.preferredTime}` : ""}
                    </span>
                  )}
                  {req.preferredTimeWindow && (
                    <span className="text-xs text-muted-foreground">({req.preferredTimeWindow})</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-mono">{timeAgo(req.createdAt)}</span>
                  <button
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedId === req.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {expandedId === req.id && (
                <div className="mt-2 pl-2 space-y-2">
                  <dl className="text-xs space-y-1">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Source:</dt>
                      <dd>{REQUEST_SOURCE_LABELS[req.source] || req.source}</dd>
                    </div>
                    {req.notes && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Notes:</dt>
                        <dd>{req.notes}</dd>
                      </div>
                    )}
                    {req.convertedAppointmentId && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Converted to:</dt>
                        <dd className="font-mono">{req.convertedAppointmentId}</dd>
                      </div>
                    )}
                  </dl>
                  {req.status === "open" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onConvertToAppointment(req)}
                        className="industrial-btn-accent text-xs py-1 px-2"
                      >
                        <CalendarPlus size={12} /> Convert to Appointment
                      </button>
                      <button
                        onClick={() => handleClose(req.id)}
                        className="industrial-btn-ghost text-xs py-1 px-2"
                      >
                        <X size={12} /> Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
