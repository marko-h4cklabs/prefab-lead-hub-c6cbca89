import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) { if (Array.isArray((payload as any)[k])) return (payload as any)[k]; }
  }
  return [];
}

const getInitialColor = (name: string) => {
  const colors = ["bg-primary text-primary-foreground", "bg-success text-success-foreground", "bg-info text-info-foreground", "bg-destructive text-destructive-foreground", "bg-warning text-warning-foreground"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

type DateRange = "this_week" | "this_month" | "last_month" | "custom";

const Team = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfLoading, setPerfLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "setter" });
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [sortCol, setSortCol] = useState<string>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchMembers = useCallback(() => {
    api.getTeam()
      .then((res) => setMembers(normalizeList(res, ["members", "data", "team"])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getDateParams = useCallback(() => {
    const now = new Date();
    if (dateRange === "this_week") return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    if (dateRange === "last_month") { const lm = subMonths(now, 1); return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") }; }
    return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
  }, [dateRange]);

  const fetchPerformance = useCallback(() => {
    setPerfLoading(true);
    api.getTeamPerformance(getDateParams())
      .then((res) => setPerformance(normalizeList(res, ["performance", "data", "items"])))
      .catch(() => setPerformance([]))
      .finally(() => setPerfLoading(false));
  }, [getDateParams]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  const openAdd = () => { setEditingMember(null); setForm({ name: "", email: "", role: "setter" }); setModalOpen(true); };
  const openEdit = (m: any) => { setEditingMember(m); setForm({ name: m.name || "", email: m.email || "", role: m.role || "setter" }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingMember) {
        await api.updateTeamMember(editingMember.id, form);
      } else {
        await api.addTeamMember(form);
      }
      toast({ title: editingMember ? "Member updated" : "Member added" });
      setModalOpen(false);
      fetchMembers();
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    try {
      await api.removeTeamMember(id);
      toast({ title: "Member removed" });
      fetchMembers();
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const sortedPerf = [...performance].sort((a, b) => {
    const va = a[sortCol] ?? 0;
    const vb = b[sortCol] ?? 0;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Team Management</h1>
        <button onClick={openAdd} className="dark-btn-primary text-sm"><Plus size={14} /> Add Member</button>
      </div>

      {/* Members Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="dark-card p-8 text-center">
          <Users size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No team members yet</p>
          <button onClick={openAdd} className="dark-btn-primary text-sm mt-3"><Plus size={14} /> Add your first member</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => {
            const name = m.name || "Unknown";
            const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={m.id} className="dark-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${getInitialColor(name)}`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{name}</p>
                    <span className="status-badge text-[10px] bg-secondary text-muted-foreground capitalize">{m.role || "setter"}</span>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${m.active !== false ? "bg-success" : "bg-muted-foreground"}`} />
                </div>
                {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(m)} className="dark-btn-ghost text-xs px-2 py-1"><Pencil size={12} /> Edit</button>
                  <button onClick={() => handleRemove(m.id)} className="dark-btn-ghost text-xs px-2 py-1 text-destructive hover:text-destructive"><Trash2 size={12} /> Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Performance Table */}
      <div className="dark-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Performance</h2>
          <div className="flex gap-1">
            {(["this_week", "this_month", "last_month"] as DateRange[]).map((r) => (
              <button key={r} onClick={() => setDateRange(r)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dateRange === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {r === "this_week" ? "This Week" : r === "this_month" ? "This Month" : "Last Month"}
              </button>
            ))}
          </div>
        </div>

        {perfLoading ? <Skeleton className="h-48 w-full" /> : sortedPerf.length === 0 ? (
          <div className="text-center py-8">
            <Users size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No performance data yet — assign leads to team members to start tracking.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="dark-table">
              <thead>
                <tr>
                  {[
                    { key: "setter", label: "Setter" },
                    { key: "conversations", label: "Conversations" },
                    { key: "replies_sent", label: "Replies" },
                    { key: "leads_qualified", label: "Qualified" },
                    { key: "calls_booked", label: "Booked" },
                    { key: "deals_closed", label: "Deals" },
                    { key: "revenue", label: "Revenue" },
                    { key: "avg_response_time", label: "Avg Response" },
                  ].map(({ key, label }) => (
                    <th key={key} className="cursor-pointer hover:text-foreground" onClick={() => handleSort(key)}>
                      {label} {sortCol === key ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPerf.map((row, i) => (
                  <tr key={row.setter || i} className={i === 0 ? "border-l-2 border-l-primary" : ""}>
                    <td className="font-medium text-foreground">{row.setter || row.name || "—"}</td>
                    <td className="font-mono tabular-nums">{row.conversations ?? 0}</td>
                    <td className="font-mono tabular-nums">{row.replies_sent ?? 0}</td>
                    <td className="font-mono tabular-nums">{row.leads_qualified ?? 0}</td>
                    <td className="font-mono tabular-nums">{row.calls_booked ?? 0}</td>
                    <td className="font-mono tabular-nums">{row.deals_closed ?? 0}</td>
                    <td className="font-mono tabular-nums text-primary">€{(row.revenue ?? row.total_revenue ?? 0).toLocaleString()}</td>
                    <td className="font-mono tabular-nums text-muted-foreground">{row.avg_response_time ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="dark-input w-full" placeholder="Team member name" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="dark-input w-full" placeholder="email@example.com" type="email" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
              <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} className="dark-input w-full">
                <option value="setter">Setter</option>
                <option value="closer">Closer</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full dark-btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingMember ? "Update" : "Add Member"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Team;
