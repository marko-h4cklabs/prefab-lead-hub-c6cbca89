import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { CalendarPlus, X, ExternalLink, Search, AlertCircle } from "lucide-react";

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS = ["all", "open", "converted", "closed", "cancelled"];
const TYPE_OPTIONS = ["all", "call", "site_visit", "meeting", "follow_up"];
const SOURCE_OPTIONS = ["all", "chatbot", "manual", "simulation"];

interface Props {
  onConvertToAppointment: (request: NormalizedSchedulingRequest) => void;
}

export default function CalendarSchedulingRequests({ onConvertToAppointment }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NormalizedSchedulingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError("");
    api.getSchedulingRequests({
      status: statusFilter,
      type: typeFilter,
      source: sourceFilter,
      search: searchQuery.trim() || undefined,
      limit: 50,
    })
      .then((res) => setItems(normalizeSchedulingRequestList(res)))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, sourceFilter, searchQuery]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleClose = async (id: string) => {
    try {
      await api.closeSchedulingRequest(id);
      toast({ title: "Request closed" });
      fetchRequests();
    } catch (err) {
      toast({ title: "Failed to close", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="dark-input rounded-lg py-1.5 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : REQUEST_STATUS_LABELS[s] || s}</option>
          ))}
        </select>
        <select className="dark-input rounded-lg py-1.5 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All Types" : REQUEST_TYPE_LABELS[t] || t}</option>
          ))}
        </select>
        <select className="dark-input rounded-lg py-1.5 text-xs" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Sources" : REQUEST_SOURCE_LABELS[s] || s}</option>
          ))}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead…"
            className="pl-8 h-8 text-xs w-40"
          />
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="dark-card rounded-xl p-6 flex items-center gap-3 mb-4 border-destructive/30">
          <AlertCircle size={18} className="text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load scheduling requests</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dark-card rounded-xl p-4">
              <div className="h-4 w-48 bg-muted animate-pulse rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="dark-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-sm">No scheduling requests found</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((req) => (
            <div key={req.id} className="dark-card rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-mono ${REQUEST_STATUS_CLASSES[str(req.status)] || "status-pending"}`}>
                    {REQUEST_STATUS_LABELS[str(req.status)] || str(req.status)}
                  </span>
                  <span className="status-badge bg-muted text-muted-foreground text-[10px]">
                    {REQUEST_TYPE_LABELS[str(req.requestType)] || str(req.requestType)}
                  </span>
                  {str(req.lead?.name) && (
                    <span className="text-sm font-medium truncate">{str(req.lead?.name)}</span>
                  )}
                  {str(req.lead?.channel) && (
                    <span className="status-badge bg-muted text-muted-foreground text-[10px] hidden sm:inline-flex">{str(req.lead?.channel)}</span>
                  )}
                  {str(req.preferredDate) && (
                    <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                      {str(req.preferredDate)}{str(req.preferredTime) ? ` ${str(req.preferredTime)}` : ""}
                    </span>
                  )}
                  {str(req.preferredTimeWindow) && (
                    <span className="text-xs text-muted-foreground hidden lg:inline">({str(req.preferredTimeWindow)})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="status-badge bg-muted text-muted-foreground text-[10px]">
                    {REQUEST_SOURCE_LABELS[str(req.source)] || str(req.source)}
                  </span>
                  {req.status === "open" && (
                    <>
                      <button
                        onClick={() => onConvertToAppointment(req)}
                        className="industrial-btn-accent text-xs py-1 px-2"
                        title="Convert to appointment"
                      >
                        <CalendarPlus size={12} />
                      </button>
                      <button
                        onClick={() => handleClose(req.id)}
                        className="industrial-btn-ghost text-xs py-1 px-2"
                        title="Close request"
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                  {req.leadId && (
                    <button
                      onClick={() => navigate(`/leads/${req.leadId}`)}
                      className="industrial-btn-ghost text-xs py-1 px-2"
                      title="Open lead"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
              {str(req.notes) && (
                <p className="text-xs text-muted-foreground mt-1.5 truncate">{str(req.notes)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
