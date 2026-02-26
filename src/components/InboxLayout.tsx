import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Search, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

interface LeadStatus {
  id: string;
  name: string;
  position?: number;
  sort_order?: number;
}

const PAGE_SIZE = 50;
const POLL_INTERVAL = 10_000;

const getLeadName = (lead: any) => {
  if (lead.name) return lead.name;
  if (lead.channel && lead.external_id) return `${lead.channel} · ${lead.external_id}`;
  return lead.external_id || "—";
};

const getInitialColor = (name: string) => {
  const colors = [
    "bg-primary text-primary-foreground",
    "bg-success text-success-foreground",
    "bg-info text-info-foreground",
    "bg-destructive text-destructive-foreground",
    "bg-warning text-warning-foreground",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const InboxLayout = () => {
  const companyId = requireCompanyId();
  const navigate = useNavigate();
  const { leadId } = useParams();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("__pending__");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getLeadStatuses()
      .then((res) => {
        const list = normalizeList(res, ["statuses", "items", "data"]);
        const sorted = [...list].sort((a, b) => (a.position ?? a.sort_order ?? 0) - (b.position ?? b.sort_order ?? 0));
        setStatuses(sorted);
        const newStatus = sorted.find((s: LeadStatus) => s.name.toLowerCase() === "new");
        setStatusFilter(newStatus ? newStatus.id : (sorted[0]?.id || ""));
      })
      .catch(() => setStatusFilter(""));
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 300);
  };

  const fetchLeads = useCallback(() => {
    if (statusFilter === "__pending__") return;
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset: 0, source: "inbox" };
    if (statusFilter && statusFilter !== "__ALL__") params.statusId = statusFilter;
    if (searchQuery) params.query = searchQuery;
    api.getLeads(companyId, params)
      .then((res) => {
        setLeads(normalizeList(res, ["data", "leads", "items"]));
      })
      .catch((err: any) => {
        toast({ title: "Failed to load leads", description: err?.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [companyId, statusFilter, searchQuery]);

  const pollLeads = useCallback(() => {
    if (statusFilter === "__pending__") return;
    const params: any = { limit: PAGE_SIZE, offset: 0, source: "inbox" };
    if (statusFilter && statusFilter !== "__ALL__") params.statusId = statusFilter;
    if (searchQuery) params.query = searchQuery;
    api.getLeads(companyId, params)
      .then((res) => setLeads(normalizeList(res, ["data", "leads", "items"])))
      .catch(() => {});
  }, [companyId, statusFilter, searchQuery]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollLeads, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollLeads]);

  // Group leads by status for display
  const groupedByStatus = leads.reduce((acc: Record<string, any[]>, lead) => {
    const status = lead.status_name || "Unknown";
    if (!acc[status]) acc[status] = [];
    acc[status].push(lead);
    return acc;
  }, {});

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-[hsl(0_0%_13%)] bg-[hsl(0_0%_4%)] flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-[hsl(0_0%_13%)] space-y-3">
          <h2 className="text-sm font-bold text-foreground tracking-wide">Inbox</h2>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[hsl(0_0%_8%)] border border-[hsl(0_0%_16%)] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(48_92%_53%/0.5)] transition-colors"
            />
          </div>
          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {statuses.slice(0, 4).map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  statusFilter === s.id
                    ? "bg-[hsl(48_92%_53%)] text-[hsl(0_0%_4%)] shadow-sm"
                    : "bg-[hsl(0_0%_10%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)]"
                }`}
              >
                {s.name}
              </button>
            ))}
            <button
              onClick={() => setStatusFilter("__ALL__")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                statusFilter === "__ALL__"
                  ? "bg-[hsl(48_92%_53%)] text-[hsl(0_0%_4%)] shadow-sm"
                  : "bg-[hsl(0_0%_10%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)]"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No leads found</div>
          ) : statusFilter === "__ALL__" ? (
            Object.entries(groupedByStatus).map(([status, statusLeads]: [string, any[]]) => (
              <div key={status}>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-[hsl(0_0%_3%)] sticky top-0 border-b border-[hsl(0_0%_10%)]">
                  {status} · {statusLeads.length}
                </div>
                {statusLeads.map((lead: any) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    isActive={lead.id === leadId}
                    onClick={() => navigate(`/dashboard/leads/inbox/${lead.id}`)}
                  />
                ))}
              </div>
            ))
          ) : (
            leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                isActive={lead.id === leadId}
                onClick={() => navigate(`/dashboard/leads/inbox/${lead.id}`)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-[hsl(0_0%_2%)]">
        <Outlet />
      </div>
    </div>
  );
};

function LeadRow({ lead, isActive, onClick }: { lead: any; isActive: boolean; onClick: () => void }) {
  const name = getLeadName(lead);
  const initial = name.charAt(0).toUpperCase();
  const colorClass = getInitialColor(name);
  const timeAgo = lead.created_at
    ? formatTimeAgo(lead.created_at)
    : "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all border-l-2 ${
        isActive
          ? "bg-[hsl(48_92%_53%/0.08)] border-l-[hsl(48_92%_53%)]"
          : "border-l-transparent hover:bg-[hsl(0_0%_8%)]"
      }`}
    >
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${colorClass}`}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm truncate ${isActive ? "font-semibold text-foreground" : "text-foreground/90"}`}>
            {name}
          </span>
          {timeAgo && (
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {lead.channel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0_0%_10%)] text-muted-foreground">{lead.channel}</span>
          )}
          {lead.score > 0 && (
            <span className={`text-[10px] font-semibold ${
              lead.score > 60 ? "text-success" : lead.score > 30 ? "text-warning" : "text-destructive"
            }`}>
              {lead.score}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export default InboxLayout;
