import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearAuth, setAuthToken, setCompanyId } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, Loader2, Shield, X, Building2, Users, MessageSquare, CalendarDays, TrendingUp, UserPlus, AlertTriangle } from "lucide-react";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") { for (const k of keys) { if (Array.isArray((payload as any)[k])) return (payload as any)[k]; } }
  return [];
}

function StatCard({ label, value, icon: Icon, small }: { label: string; value: string | number | null; icon: React.ElementType; small?: boolean }) {
  return (
    <div className="dark-card p-5 flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/15 text-warning"><Icon size={small ? 16 : 20} /></div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`font-bold ${small ? "text-lg" : "text-2xl"}`}>{value ?? "—"}</div>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { setLoading(true); api.adminGetStats().then(setStats).catch((e: any) => setError(e?.message || "Failed")).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dark-card p-5"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-16" /></div>)}</div>;
  if (error) return <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Workspaces" value={stats?.total_workspaces ?? stats?.totalWorkspaces} icon={Building2} />
        <StatCard label="Total Leads" value={stats?.total_leads ?? stats?.totalLeads} icon={Users} />
        <StatCard label="Total Conversations" value={stats?.total_conversations ?? stats?.totalConversations} icon={MessageSquare} />
        <StatCard label="Total Appointments" value={stats?.total_appointments ?? stats?.totalAppointments} icon={CalendarDays} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New Workspaces (30d)" value={stats?.new_workspaces_30d ?? stats?.newWorkspaces30d} icon={TrendingUp} small />
        <StatCard label="New Leads (30d)" value={stats?.new_leads_30d ?? stats?.newLeads30d} icon={UserPlus} small />
      </div>
    </div>
  );
}

function WorkspaceDrawer({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.adminGetWorkspace(companyId).then(setData).catch(() => toast({ title: "Failed", variant: "destructive" })).finally(() => setLoading(false)); }, [companyId]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-lg flex flex-col overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-border"><h3 className="font-bold text-sm">Workspace Details</h3><button onClick={onClose} className="dark-btn-ghost p-1"><X size={16} /></button></div>
        <div className="p-4 flex-1 overflow-auto">
          {loading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div> : !data ? <p className="text-muted-foreground text-sm">No data</p> : (
            <div className="space-y-4">
              <div><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Company Name</div><div className="text-sm font-semibold">{data.company_name || data.name || "—"}</div></div>
              <div><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Company ID</div><div className="text-sm font-mono">{data.id || companyId}</div></div>
              <div><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</div><div className="text-sm font-mono">{data.created_at ? new Date(data.created_at).toLocaleString() : "—"}</div></div>
              {(data.stats || data.lead_count !== undefined) && <div className="grid grid-cols-2 gap-3"><StatCard label="Leads" value={data.stats?.lead_count ?? data.lead_count} icon={Users} small /><StatCard label="Users" value={data.stats?.user_count ?? data.user_count} icon={UserPlus} small /></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const WS_PAGE_SIZE = 50;

function WorkspacesTab() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(() => {
    setLoading(true); setError("");
    api.adminGetWorkspaces({ limit: WS_PAGE_SIZE, offset, search: search.trim() || undefined }).then((res: any) => { const list = normalizeList(res, ["data", "workspaces", "items"]); setWorkspaces(list); setTotal(res?.total ?? res?.count ?? list.length); }).catch((e: any) => setError(e?.message || "Failed")).finally(() => setLoading(false));
  }, [offset, search]);
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const handleImpersonate = async (companyId: string) => {
    setImpersonating(companyId);
    try { const res = await api.adminImpersonate(companyId); const token = res?.token || res?.access_token; if (!token) throw new Error("No token"); localStorage.setItem("plcs_token", token); localStorage.setItem("plcs_company_id", companyId); setAuthToken(token); setCompanyId(companyId); navigate("/leads"); } catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); } finally { setImpersonating(null); }
  };

  return (
    <div>
      <div className="mb-4 relative max-w-sm"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Search…" className="dark-input w-full pl-8" /></div>
      {error && <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      <div className="dark-card overflow-hidden">
        <table className="dark-table"><thead><tr><th>Company</th><th>Created</th><th>Leads</th><th>Users</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>) : workspaces.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No workspaces</td></tr> : workspaces.map((ws) => (
              <tr key={ws.id}>
                <td className="text-sm font-semibold">{ws.company_name || ws.name || "—"}</td>
                <td className="font-mono text-xs text-muted-foreground">{ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "—"}</td>
                <td className="font-mono text-sm">{ws.lead_count ?? "—"}</td>
                <td className="font-mono text-sm">{ws.user_count ?? "—"}</td>
                <td><div className="flex gap-2"><button onClick={() => setDrawerCompanyId(ws.id)} className="dark-btn-ghost text-xs py-1 px-2">View</button><button onClick={() => handleImpersonate(ws.id)} disabled={impersonating === ws.id} className="dark-btn bg-warning/15 text-warning hover:bg-warning/25 text-xs py-1 px-2">{impersonating === ws.id ? <Loader2 size={12} className="animate-spin" /> : "Impersonate"}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono text-xs">{total > 0 ? `${offset + 1}–${Math.min(offset + WS_PAGE_SIZE, total)} of ${total}` : "0 results"}</span>
        <div className="flex gap-2"><button onClick={() => setOffset(Math.max(0, offset - WS_PAGE_SIZE))} disabled={offset === 0} className="dark-btn-ghost"><ChevronLeft size={16} /></button><button onClick={() => setOffset(offset + WS_PAGE_SIZE)} disabled={offset + WS_PAGE_SIZE >= total} className="dark-btn-ghost"><ChevronRight size={16} /></button></div>
      </div>
      {drawerCompanyId && <WorkspaceDrawer companyId={drawerCompanyId} onClose={() => setDrawerCompanyId(null)} />}
    </div>
  );
}

function ImpersonateTab() {
  const navigate = useNavigate();
  const [companyInput, setCompanyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const handleImpersonate = async () => { const id = companyInput.trim(); if (!id) return; setLoading(true); try { const res = await api.adminImpersonate(id); const token = res?.token || res?.access_token; if (!token) throw new Error("No token"); localStorage.setItem("plcs_token", token); localStorage.setItem("plcs_company_id", id); setAuthToken(token); setCompanyId(id); navigate("/leads"); } catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); } finally { setLoading(false); } };
  const handleReturnToAdmin = () => { clearAuth(); localStorage.removeItem("plcs_token"); localStorage.removeItem("plcs_company_id"); navigate("/admin"); };

  return (
    <div className="max-w-lg space-y-6">
      <div className="dark-card p-5 space-y-3"><p className="text-sm text-muted-foreground">When you impersonate a workspace, you are issued a temporary 1-hour token. All actions will be performed as that workspace.</p></div>
      <div className="dark-card p-5 space-y-4"><div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Impersonate by Company ID</div><div className="flex gap-2"><input value={companyInput} onChange={(e) => setCompanyInput(e.target.value)} placeholder="Enter company ID…" className="dark-input flex-1" onKeyDown={(e) => e.key === "Enter" && handleImpersonate()} /><button onClick={handleImpersonate} disabled={loading || !companyInput.trim()} className="dark-btn bg-warning/15 text-warning hover:bg-warning/25">{loading ? <Loader2 size={14} className="animate-spin" /> : "Impersonate"}</button></div></div>
      <div className="dark-card p-5 space-y-3"><p className="text-sm text-muted-foreground">Clear session and return to admin.</p><button onClick={handleReturnToAdmin} className="dark-btn-secondary">Return to Admin</button></div>
    </div>
  );
}

type TabKey = "overview" | "workspaces" | "impersonate";
const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "workspaces", label: "Workspaces" },
  { key: "impersonate", label: "Impersonate" },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth guard
  useEffect(() => {
    api.me().then((res: any) => {
      if (res?.is_admin || res?.role === "admin" || res?.role === "super_admin") {
        setIsAdmin(true);
      } else {
        navigate("/leads", { replace: true });
      }
    }).catch(() => {
      navigate("/login", { replace: true });
    }).finally(() => setAuthChecking(false));
  }, [navigate]);

  if (authChecking) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-background border-r border-border">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2 text-warning"><Shield size={16} /><span className="font-bold text-sm">Admin Panel</span></div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors w-full text-left ${activeTab === key ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{label}</button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 h-14">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <h2 className="text-sm font-semibold text-warning">Admin Control Panel</h2>
          </div>
          <div className="font-mono text-xs text-muted-foreground">{new Date().toLocaleDateString()}</div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "workspaces" && <WorkspacesTab />}
          {activeTab === "impersonate" && <ImpersonateTab />}
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
