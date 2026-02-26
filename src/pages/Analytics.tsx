import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import {
  TrendingUp, TrendingDown, DollarSign, Target, Clock, Award, Users, BarChart3,
  RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from "recharts";
import { format } from "date-fns";

const GRID_COLOR = "hsl(0, 0%, 16%)";
const AXIS_COLOR = "hsl(0, 0%, 40%)";
const YELLOW = "hsl(48, 92%, 53%)";

interface DealStats {
  total_revenue?: number;
  deals_closed?: number;
  avg_deal_value?: number;
  conversion_rate?: number;
  avg_time_to_close?: number;
  best_setter?: { name: string; deal_count: number };
  mom_growth?: number;
  revenue_over_time?: { month: string; revenue: number; deal_count: number }[];
  revenue_by_source?: { source: string; revenue: number; deal_count: number }[];
  pipeline_funnel?: { stage: string; count: number }[];
  setter_performance?: { setter: string; deals_closed: number; total_revenue: number; avg_deal_value: number; conversion_rate: number }[];
}

interface Deal {
  id: string;
  lead_id: string;
  lead_name?: string;
  amount: number;
  currency?: string;
  setter_name?: string;
  closer_name?: string;
  source_content?: string;
  campaign?: string;
  created_at?: string;
}

const FUNNEL_COLORS = [
  "hsl(0, 0%, 40%)",
  "hsl(0, 0%, 45%)",
  "hsl(0, 0%, 50%)",
  "hsl(217, 91%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(24, 95%, 53%)",
  "hsl(48, 92%, 53%)",
  "hsl(142, 71%, 45%)",
];

const Analytics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DealStats | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [error, setError] = useState("");

  // Deals table filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [setterFilter, setSetterFilter] = useState("");
  const [dealsPage, setDealsPage] = useState(0);
  const [dealsTotalPages, setDealsTotalPages] = useState(1);
  const PAGE_SIZE = 10;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dealStats, pipelineStats] = await Promise.all([
        api.getDealStats().catch(() => ({})),
        api.getPipelineStats().catch(() => ({})),
      ]);
      // Map backend field names → frontend DealStats interface
      const ds = dealStats?.data && typeof dealStats.data === "object" ? dealStats.data : dealStats;
      const normalized: DealStats = {
        total_revenue: ds?.total_revenue ?? 0,
        deals_closed: ds?.deals_closed ?? ds?.total_deals ?? 0,
        avg_deal_value: ds?.avg_deal_value ?? 0,
        conversion_rate: ds?.conversion_rate ?? 0,
        avg_time_to_close: ds?.avg_time_to_close ?? ds?.avg_time_to_close_days ?? 0,
        mom_growth: ds?.mom_growth ?? ds?.mom_growth_percent ?? 0,
        best_setter: ds?.best_setter
          ? { name: ds.best_setter.name, deal_count: ds.best_setter.deal_count ?? ds.best_setter.deals ?? 0 }
          : undefined,
        revenue_over_time: (ds?.revenue_over_time ?? ds?.revenue_by_month ?? []).map((r: any) => ({
          month: r.month,
          revenue: r.revenue ?? 0,
          deal_count: r.deal_count ?? r.deals ?? 0,
        })),
        revenue_by_source: (ds?.revenue_by_source ?? []).map((r: any) => ({
          source: r.source,
          revenue: r.revenue ?? 0,
          deal_count: r.deal_count ?? r.deals ?? 0,
        })),
        setter_performance: ds?.setter_performance ?? [],
      };
      // Build pipeline funnel from pipeline stats
      const byStage = pipelineStats?.by_stage;
      if (byStage && typeof byStage === "object") {
        const stageOrder = ["new_inquiry", "contacted", "qualified", "proposal_sent", "call_booked", "call_done", "closed_won", "closed_lost"];
        normalized.pipeline_funnel = stageOrder
          .filter((s) => (byStage[s] ?? 0) > 0)
          .map((s) => ({ stage: s.replace(/_/g, " "), count: byStage[s] ?? 0 }));
      }
      setStats(normalized);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      toast({ title: "Failed to load analytics", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    setDealsLoading(true);
    try {
      const res = await api.getDeals({
        from: dateFrom || undefined,
        to: dateTo || undefined,
        setter: setterFilter || undefined,
        limit: PAGE_SIZE,
        offset: dealsPage * PAGE_SIZE,
      });
      const list = Array.isArray(res) ? res : res?.items || res?.deals || res?.data || [];
      setDeals(list);
      const total = res?.total || res?.totalCount || list.length;
      setDealsTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch {
      setDeals([]);
    } finally {
      setDealsLoading(false);
    }
  }, [dateFrom, dateTo, setterFilter, dealsPage]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const s = stats || {};
  const fmt = (n?: number) => n !== undefined && n !== null ? `€${n.toLocaleString()}` : "€0";

  // Unique setters for filter
  const setterOptions = useMemo(() => {
    const setters = stats?.setter_performance?.map((sp) => sp.setter) || [];
    return [...new Set(setters)];
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Revenue tracking, deal attribution & performance</p>
        </div>
        <button onClick={fetchStats} disabled={loading} className="dark-btn-ghost px-2 py-1.5">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && !loading && (
        <div className="dark-card p-6 border-destructive/50 text-center space-y-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button onClick={fetchStats} className="dark-btn-primary text-xs">Retry</button>
        </div>
      )}

      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Revenue"
          value={loading ? undefined : fmt(s.total_revenue)}
          badge={s.mom_growth}
          icon={<DollarSign size={14} />}
          loading={loading}
          accent
        />
        <KpiCard label="Deals Closed" value={s.deals_closed} icon={<Target size={14} />} loading={loading} />
        <KpiCard label="Avg Deal Value" value={loading ? undefined : fmt(s.avg_deal_value)} icon={<BarChart3 size={14} />} loading={loading} />
        <KpiCard label="Conversion Rate" value={s.conversion_rate != null ? `${Math.round(s.conversion_rate)}%` : undefined} icon={<TrendingUp size={14} />} loading={loading} />
        <KpiCard label="Avg Time to Close" value={s.avg_time_to_close != null ? `${Math.round(s.avg_time_to_close)} days` : undefined} icon={<Clock size={14} />} loading={loading} />
        <KpiCard label="Best Setter" value={s.best_setter ? `${s.best_setter.name} (${s.best_setter.deal_count})` : undefined} icon={<Award size={14} />} loading={loading} />
      </div>

      {/* Row 2 — Revenue Over Time */}
      <div className="dark-card p-6">
        <h2 className="text-sm font-semibold text-primary mb-4">Revenue Over Time</h2>
        {loading ? <Skeleton className="h-64 w-full" /> : <RevenueChart data={s.revenue_over_time} />}
      </div>

      {/* Row 3 — Two side-by-side charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="dark-card p-6">
          <h2 className="text-sm font-semibold text-primary mb-4">Revenue by Source</h2>
          {loading ? <Skeleton className="h-64 w-full" /> : <SourceChart data={s.revenue_by_source} />}
        </div>
        <div className="dark-card p-6">
          <h2 className="text-sm font-semibold text-primary mb-4">Pipeline Funnel</h2>
          {loading ? <Skeleton className="h-64 w-full" /> : <FunnelChart data={s.pipeline_funnel} />}
        </div>
      </div>

      {/* Row 4 — Deals Table */}
      <div className="dark-card p-6">
        <h2 className="text-sm font-semibold text-primary mb-4">Recent Deals</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDealsPage(0); }} className="dark-input py-1.5 text-xs" />
          <span className="text-muted-foreground text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDealsPage(0); }} className="dark-input py-1.5 text-xs" />
          <select value={setterFilter} onChange={(e) => { setSetterFilter(e.target.value); setDealsPage(0); }} className="dark-input py-1.5 text-xs min-w-[120px]">
            <option value="">All Setters</option>
            {setterOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {dealsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : deals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No deals found</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="dark-table">
                <thead>
                  <tr>
                    <th>Lead Name</th>
                    <th>Amount</th>
                    <th>Setter</th>
                    <th>Closer</th>
                    <th>Source</th>
                    <th>Campaign</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id}>
                      <td>
                        <button
                          onClick={() => deal.lead_id && navigate(`/leads/${deal.lead_id}`)}
                          className="text-primary hover:underline font-medium"
                        >
                          {deal.lead_name || deal.lead_id || "—"}
                        </button>
                      </td>
                      <td className="text-primary font-mono font-semibold tabular-nums">
                        {deal.currency === "USD" ? "$" : deal.currency === "GBP" ? "£" : "€"}
                        {deal.amount?.toLocaleString()}
                      </td>
                      <td className="text-muted-foreground">{deal.setter_name || "—"}</td>
                      <td className="text-muted-foreground">{deal.closer_name || "—"}</td>
                      <td className="text-muted-foreground">{deal.source_content || "—"}</td>
                      <td className="text-muted-foreground">{deal.campaign || "—"}</td>
                      <td className="text-muted-foreground font-mono text-xs">
                        {deal.created_at ? format(new Date(deal.created_at), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground">Page {dealsPage + 1} of {dealsTotalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setDealsPage((p) => Math.max(0, p - 1))} disabled={dealsPage === 0} className="dark-btn-ghost px-2 py-1 text-xs">
                  <ChevronLeft size={14} /> Previous
                </button>
                <button onClick={() => setDealsPage((p) => Math.min(dealsTotalPages - 1, p + 1))} disabled={dealsPage >= dealsTotalPages - 1} className="dark-btn-ghost px-2 py-1 text-xs">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Row 5 — Setter Performance */}
      <div className="dark-card p-6">
        <h2 className="text-sm font-semibold text-primary mb-4">Setter Performance</h2>
        {loading ? <Skeleton className="h-48 w-full" /> : <SetterTable data={s.setter_performance} />}
      </div>

      {/* Row 6 — AI Usage Stats */}
      <div className="dark-card p-6">
        <h2 className="text-sm font-semibold text-primary mb-4">AI Usage This Month</h2>
        <AiUsageCard />
      </div>
    </div>
  );
};

// --- Sub-components ---

function KpiCard({ label, value, icon, loading, badge, accent }: {
  label: string;
  value?: number | string;
  icon: React.ReactNode;
  loading: boolean;
  badge?: number;
  accent?: boolean;
}) {
  return (
    <div className="dark-card p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="flex items-center gap-2">
          <p className={`text-xl font-bold tabular-nums ${accent ? "text-primary" : "text-primary"}`}>
            {value ?? "—"}
          </p>
          {badge !== undefined && badge !== null && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              badge >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}>
              {badge >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(badge).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex items-center justify-center h-56 text-sm text-muted-foreground"><p>{message}</p></div>;
}

function RevenueChart({ data }: { data?: DealStats["revenue_over_time"] }) {
  if (!data || data.length === 0) return <EmptyChart message="No revenue data yet. Log deals to see trends." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} />
        <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}`, background: "hsl(0,0%,7%)", color: "#fff" }}
          formatter={(value: number, name: string) => [
            name === "revenue" ? `€${value.toLocaleString()}` : value,
            name === "revenue" ? "Revenue" : "Deals",
          ]}
        />
        <Line type="monotone" dataKey="revenue" stroke={YELLOW} strokeWidth={2.5} dot={{ fill: YELLOW, r: 3 }} name="revenue" />
        <Line type="monotone" dataKey="deal_count" stroke="hsl(0,0%,50%)" strokeWidth={1.5} dot={false} name="deal_count" />
        <Legend />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SourceChart({ data }: { data?: DealStats["revenue_by_source"] }) {
  if (!data || data.length === 0) return <EmptyChart message="No source data yet." />;
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 40)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} tickFormatter={(v) => `€${v.toLocaleString()}`} />
        <YAxis dataKey="source" type="category" width={120} tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}`, background: "hsl(0,0%,7%)", color: "#fff" }}
          formatter={(value: number) => [`€${value.toLocaleString()}`, "Revenue"]}
        />
        <Bar dataKey="revenue" fill={YELLOW} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FunnelChart({ data }: { data?: DealStats["pipeline_funnel"] }) {
  if (!data || data.length === 0) return <EmptyChart message="No pipeline data yet." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} />
        <YAxis dataKey="stage" type="category" width={110} tick={{ fontSize: 11, fill: AXIS_COLOR }} stroke={GRID_COLOR} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}`, background: "hsl(0,0%,7%)", color: "#fff" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SetterTable({ data }: { data?: DealStats["setter_performance"] }) {
  if (!data || data.length === 0) return <EmptyChart message="No setter performance data yet." />;
  const sorted = [...data].sort((a, b) => b.total_revenue - a.total_revenue);
  return (
    <div className="overflow-auto">
      <table className="dark-table">
        <thead>
          <tr>
            <th>Setter Name</th>
            <th>Deals Closed</th>
            <th>Total Revenue</th>
            <th>Avg Deal Value</th>
            <th>Conversion Rate</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.setter} className={i === 0 ? "border-l-2 border-l-primary" : ""}>
              <td className="font-medium text-foreground">{row.setter}</td>
              <td className="font-mono tabular-nums">{row.deals_closed}</td>
              <td className="font-mono tabular-nums text-primary">€{row.total_revenue.toLocaleString()}</td>
              <td className="font-mono tabular-nums">€{row.avg_deal_value.toLocaleString()}</td>
              <td className="font-mono tabular-nums">{Math.round(row.conversion_rate)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiUsageCard() {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    api.getBillingStatus().then(setStatus).catch(() => {});
  }, []);
  const used = status?.messages_used ?? 0;
  const limit = status?.messages_limit ?? 2000;
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Messages sent</span>
        <span className="font-mono">{used.toLocaleString()} / {limit.toLocaleString()}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct > 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {pct > 80 && <p className="text-xs text-warning">⚠️ Over 80% of your monthly limit</p>}
      <p className="text-xs text-muted-foreground">{pct}% used</p>
    </div>
  );
}

export default Analytics;
