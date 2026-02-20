import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Plus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

const CHANNELS = [
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
];

const PAGE_SIZE = 20;
const POLL_INTERVAL = 10_000;

interface LeadStatus {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

const statusClass = (name: string) => {
  const s = name?.toLowerCase();
  if (s === "new") return "status-new";
  if (s === "qualified") return "status-qualified";
  if (s === "disqualified") return "status-disqualified";
  return "status-pending";
};

const Leads = () => {
  const companyId = requireCompanyId();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("__pending__");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [newExternalId, setNewExternalId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [savingStatusFor, setSavingStatusFor] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load statuses, then set default filter to "New" if it exists
  useEffect(() => {
    api.getLeadStatuses()
      .then((res) => {
        const list = normalizeList(res, ["statuses", "items", "data"]);
        setStatuses(list);
        const newStatus = list.find((s: LeadStatus) => s.name.toLowerCase() === "new");
        setStatusFilter(newStatus ? newStatus.id : "");
      })
      .catch(() => {
        setStatusFilter("");
      });
  }, []);

  const fetchLeads = useCallback(() => {
    if (statusFilter === "__pending__") return;
    setLoading(true);
    setFetchError("");
    api.getLeads(companyId, { statusId: statusFilter || undefined, limit: PAGE_SIZE, offset })
      .then((res) => {
        const list = normalizeList(res, ["data", "leads", "items"]);
        setLeads(list);
        setTotal((res as any)?.total ?? (res as any)?.count ?? list.length);
        if (list.length === 0 && res && typeof res === "object" && (res as any).error) {
          toast({ title: "Error", description: String((res as any).error.message || (res as any).error), variant: "destructive" });
        }
      })
      .catch((err: Error) => {
        setFetchError(err.message || "Failed to load leads");
        toast({ title: "Failed to load leads", description: err.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [companyId, statusFilter, offset]);

  // Silent poll (no loading state reset)
  const pollLeads = useCallback(() => {
    if (statusFilter === "__pending__") return;
    api.getLeads(companyId, { statusId: statusFilter || undefined, limit: PAGE_SIZE, offset })
      .then((res) => {
        const list = normalizeList(res, ["data", "leads", "items"]);
        setLeads(list);
        setTotal((res as any)?.total ?? (res as any)?.count ?? list.length);
      })
      .catch(() => {});
  }, [companyId, statusFilter, offset]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Polling every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollLeads, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollLeads]);

  const handleStatusChange = async (leadId: string, newStatusId: string) => {
    const leadIndex = leads.findIndex((l) => l.id === leadId);
    if (leadIndex === -1) return;
    const prevStatusId = leads[leadIndex].status_id;
    const prevStatusName = leads[leadIndex].status_name;
    const newStatusObj = statuses.find((s) => s.id === newStatusId);
    if (!newStatusObj) return;

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, status_id: newStatusObj.id, status_name: newStatusObj.name } : l
      )
    );
    setSavingStatusFor(leadId);

    try {
      await api.updateLeadStatus(leadId, newStatusId);
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status_id: prevStatusId, status_name: prevStatusName } : l))
      );
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setSavingStatusFor(null);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    const trimmedName = newExternalId.trim();
    if (trimmedName.length < 2) {
      setCreateError("Name must be at least 2 characters.");
      setCreating(false);
      return;
    }
    const normalizedChannel = newChannel.trim().toLowerCase();
    api.createLead(companyId, { name: trimmedName, channel: normalizedChannel })
      .then(() => {
        setShowModal(false);
        setNewChannel("");
        setNewExternalId("");
        setCreateError("");
        fetchLeads();
        toast({ title: "Lead created successfully" });
      })
      .catch((err: Error) => {
        setCreateError(err.message || "Failed to create lead");
      })
      .finally(() => setCreating(false));
  };

  const getStatusId = (lead: any) => lead.status_id || "";
  const getStatusName = (lead: any) => lead.status_name || "New";
  const getLeadName = (lead: any) => lead.name || lead.external_id || "—";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Inbox</h1>
        <button onClick={() => setShowModal(true)} className="industrial-btn-accent">
          <Plus size={16} /> New Lead
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={statusFilter === "__pending__" ? "" : statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="industrial-input"
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="">All Statuses</option>
        </select>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="industrial-card overflow-hidden">
        <table className="industrial-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j}><div className="h-4 rounded-sm bg-muted animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No leads found</td></tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <td className="font-mono text-sm">{lead.channel}</td>
                  <td className="text-sm truncate max-w-[200px]">{getLeadName(lead)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={getStatusId(lead)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(lead.id, e.target.value);
                        }}
                        disabled={savingStatusFor === lead.id}
                        className={`industrial-input py-1 px-2 text-xs font-mono w-auto min-w-[100px] ${statusClass(getStatusName(lead))}`}
                      >
                        {statuses.length > 0 ? (
                          statuses.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))
                        ) : (
                          <option value="">{getStatusName(lead)}</option>
                        )}
                      </select>
                      {savingStatusFor === lead.id && (
                        <Loader2 size={12} className="animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground text-xs font-mono">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono text-xs">
          {offset + 1}–{Math.min(offset + PAGE_SIZE, total || leads.length)} of {total || leads.length}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="industrial-btn-ghost"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= (total || leads.length)}
            className="industrial-btn-ghost"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
          <div className="industrial-card w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Create Lead</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {createError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Channel</label>
                <select value={newChannel} onChange={(e) => setNewChannel(e.target.value)} className="industrial-input w-full" required>
                  <option value="" disabled>Select channel…</option>
                  {CHANNELS.map((ch) => (
                    <option key={ch.value} value={ch.value}>{ch.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Channel is case-insensitive; values are normalized automatically.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Name</label>
                <input value={newExternalId} onChange={(e) => setNewExternalId(e.target.value)} className="industrial-input w-full" required />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="industrial-btn-ghost">Cancel</button>
                <button type="submit" disabled={creating} className="industrial-btn-accent">
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
