import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Search, Loader2, LayoutList } from "lucide-react";
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

const statusBadgeClass = (name: string) => {
  const s = name?.toLowerCase();
  if (s === "new") return "bg-primary/15 text-primary";
  if (s === "qualified") return "bg-success/15 text-success";
  if (s === "disqualified") return "bg-secondary text-muted-foreground";
  return "bg-info/15 text-info";
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const LeadBoardPage = () => {
  const companyId = requireCompanyId();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("__pending__");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getLeadStatuses()
      .then((res) => {
        const list = normalizeList(res, ["statuses", "items", "data"]);
        const sorted = [...list].sort(
          (a, b) => (a.position ?? a.sort_order ?? 0) - (b.position ?? b.sort_order ?? 0)
        );
        setStatuses(sorted);
        setStatusFilter("__ALL__");
      })
      .catch(() => setStatusFilter("__ALL__"));
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 300);
  };

  const fetchLeads = useCallback(() => {
    if (statusFilter === "__pending__") return;
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset: 0 };
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

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const getLeadName = (lead: any) => {
    if (lead.name) return lead.name;
    if (lead.channel && lead.external_id) return `${lead.channel} · ${lead.external_id}`;
    return lead.external_id || "—";
  };

  return (
    <div className="h-full p-6 overflow-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <LayoutList size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Lead Board</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading..." : `${leads.length} lead${leads.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </div>

      {/* Search + Status Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search leads..."
            className="dark-input w-full pl-8 py-1.5 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter("__ALL__")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              statusFilter === "__ALL__"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center">
            <LayoutList size={24} className="text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No leads found</h2>
          <p className="text-sm text-muted-foreground max-w-xs text-center">
            {searchQuery || statusFilter !== "__ALL__"
              ? "Try adjusting your search or filters."
              : "Once leads start flowing in, they will appear here."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const name = getLeadName(lead);
                const score = Number(lead.score ?? lead.intent_score ?? 0);
                const scoreColor =
                  score > 60 ? "text-success" : score > 30 ? "text-warning" : "text-destructive";
                return (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/dashboard/leads/inbox/${lead.id}`)}
                    className="border-b border-border last:border-b-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.channel || "—"}</td>
                    <td className="px-4 py-3">
                      {score > 0 ? (
                        <span className={`font-semibold ${scoreColor}`}>{score}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeClass(lead.status_name || "")}`}>
                        {lead.status_name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeadBoardPage;
