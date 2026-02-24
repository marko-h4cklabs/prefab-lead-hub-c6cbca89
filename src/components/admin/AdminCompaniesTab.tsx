import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuthToken, setCompanyId } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import CompanyDrawer from "./CompanyDrawer";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

const PAGE_SIZE = 25;

function ModeBadge({ mode }: { mode?: string | null }) {
  if (mode === "autopilot") return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(245,197,24,0.15)", color: "#F5C518" }}>Autopilot</span>;
  if (mode === "copilot") return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>Co-Pilot</span>;
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" style={{ background: "rgba(255,255,255,0.05)" }}>Not Set</span>;
}

function ManychatBadge({ connected }: { connected?: boolean }) {
  if (connected) return <span className="text-green-400 text-xs font-medium">Connected</span>;
  return <span className="text-red-400 text-xs font-medium">Not connected</span>;
}

export default function AdminCompaniesTab() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchCompanies = useCallback(() => {
    setLoading(true);
    setError("");
    const offset = (page - 1) * PAGE_SIZE;
    api.adminGetCompanies({ limit: PAGE_SIZE, offset, search: debouncedSearch.trim() || undefined })
      .then((res: any) => {
        const list = normalizeList(res, ["data", "companies", "items"]);
        setCompanies(list);
        setTotal(res?.total ?? res?.count ?? list.length);
      })
      .catch((e: any) => setError(e?.message || "Failed"))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleImpersonate = async (company: any) => {
    const companyId = company.id;
    setImpersonating(companyId);
    try {
      const res = await api.adminImpersonateCompany(companyId);
      const adminToken = res?.admin_token;
      const impersonateToken = res?.impersonate_token || res?.token || res?.access_token;
      if (!impersonateToken) throw new Error("No token returned");

      // Store admin token for restoration later
      const currentToken = localStorage.getItem("auth_token") || localStorage.getItem("plcs_token");
      if (adminToken) {
        localStorage.setItem("plcs_admin_token", adminToken);
      } else if (currentToken) {
        localStorage.setItem("plcs_admin_token", currentToken);
      }

      localStorage.setItem("plcs_impersonating", company.company_name || company.name || companyId);
      localStorage.setItem("plcs_token", impersonateToken);
      localStorage.setItem("auth_token", impersonateToken);
      localStorage.setItem("plcs_company_id", companyId);
      localStorage.setItem("company_id", companyId);
      setAuthToken(impersonateToken);
      setCompanyId(companyId);
      navigate("/leads");
    } catch (e: any) {
      setError(e?.message || "Impersonation failed");
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div>
      {/* Search bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="w-full rounded-md border px-3 py-2 pl-8 text-sm bg-background"
            style={{ borderColor: "#2A2A2A" }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono ml-4">{total} results</span>
      </div>

      {error && <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "#2A2A2A" }}>
              {["Company Name", "Created", "Mode", "Leads", "Conversations", "ManyChat", "Last Active", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: "#2A2A2A" }}>
                  {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              ))
            ) : companies.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No companies found</td></tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-b hover:bg-secondary/20 transition-colors" style={{ borderColor: "#2A2A2A" }}>
                  <td className="px-4 py-3 font-semibold">{c.company_name || c.name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3"><ModeBadge mode={c.operating_mode || c.mode} /></td>
                  <td className="px-4 py-3 font-mono">{c.lead_count ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{c.conversation_count ?? c.conversations ?? "—"}</td>
                  <td className="px-4 py-3"><ManychatBadge connected={c.manychat_connected} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.last_active ? new Date(c.last_active).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDrawerCompanyId(c.id)}
                        className="text-xs px-2 py-1 rounded border transition-colors hover:bg-secondary"
                        style={{ borderColor: "#2A2A2A" }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleImpersonate(c)}
                        disabled={impersonating === c.id}
                        className="text-xs px-2 py-1 rounded font-semibold transition-colors disabled:opacity-50"
                        style={{ background: "rgba(245,197,24,0.15)", color: "#F5C518" }}
                      >
                        {impersonating === c.id ? <Loader2 size={12} className="animate-spin" /> : "Impersonate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono text-xs">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded border transition-colors hover:bg-secondary disabled:opacity-30"
            style={{ borderColor: "#2A2A2A" }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded border transition-colors hover:bg-secondary disabled:opacity-30"
            style={{ borderColor: "#2A2A2A" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {drawerCompanyId && <CompanyDrawer companyId={drawerCompanyId} onClose={() => setDrawerCompanyId(null)} />}
    </div>
  );
}
