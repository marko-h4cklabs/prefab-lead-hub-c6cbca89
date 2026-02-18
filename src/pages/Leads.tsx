import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CHANNELS = [
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
];

const PAGE_SIZE = 20;

const statusClass = (status: string) => {
  const s = status?.toLowerCase();
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
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [newExternalId, setNewExternalId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [fetchError, setFetchError] = useState("");

  const fetchLeads = () => {
    setLoading(true);
    setFetchError("");
    api.getLeads(companyId, { status: statusFilter || undefined, limit: PAGE_SIZE, offset })
      .then((res) => {
        setLeads(res.data || res.leads || res || []);
        setTotal(res.total ?? res.count ?? (res.data?.length || 0));
      })
      .catch((err: Error) => setFetchError(err.message || "Failed to load leads"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, [offset, statusFilter]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    const normalizedChannel = newChannel.trim().toLowerCase();
    api.createLead(companyId, { channel: normalizedChannel, external_id: newExternalId.trim() })
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Leads</h1>
        <button onClick={() => setShowModal(true)} className="industrial-btn-accent">
          <Plus size={16} /> New Lead
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="industrial-input"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="disqualified">Disqualified</option>
          <option value="pending_review">Pending Review</option>
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
              <th>External ID</th>
              <th>Score</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No leads found</td></tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <td className="font-mono text-sm">{lead.channel}</td>
                  <td className="font-mono text-sm truncate max-w-[200px]">{lead.external_id ?? "—"}</td>
                  <td className="font-mono">{lead.score ?? "—"}</td>
                  <td><span className={statusClass(lead.status)}>{lead.status}</span></td>
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
                <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">External ID</label>
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
