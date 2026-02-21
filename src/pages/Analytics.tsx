import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getCompanyId } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { RefreshCw, TrendingUp, Users, MessageSquare, CheckCircle, BarChart3, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

// ---------- types (match exact backend camelCase) ----------
interface Filters {
  range: 7 | 30 | 90;
  source: string;
  channel: string;
}

interface DashboardData {
  summary?: {
    totalLeads?: number;
    newLeadsToday?: number;
    conversationsStarted?: number;
    quoteDataCompletionRate?: number;
    avgCollectedFieldsPerLead?: number;
    inboxCount?: number;
    simulationCount?: number;
    inboxPct?: number;
    simulationPct?: number;
  };
  leadsOverTime?: { day: string; inbox: number; simulation: number; total: number }[];
  channelBreakdown?: { channel: string; count: number }[];
  statusBreakdown?: { status: string; count: number }[];
  fieldCompletion?: { field: string; label: string; collected: number; total: number; pct: number }[];
  topSignals?: { channel: string; total: number; withConversation: number; conversionPct: number }[];
  available_channels?: string[];
  applied_filters?: { range?: number; source?: string; channel?: string };
}

const RANGE_OPTIONS: { value: 7 | 30 | 90; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "inbox", label: "Inbox" },
  { value: "simulation", label: "Simulation" },
];

const CHART_COLORS = [
  "hsl(213, 40%, 32%)",
  "hsl(25, 95%, 53%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 14%, 60%)",
  "hsl(270, 50%, 50%)",
  "hsl(190, 60%, 45%)",
];

// ---------- component ----------
const Analytics = () => {
  const [filters, setFilters] = useState<Filters>({ range: 30, source: "all", channel: "all" });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);

  const fetchData = useCallback(async (f: Filters) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        range: f.range,
        source: f.source.toLowerCase(),
        channel: f.channel.toLowerCase(),
      };
      console.log("[Analytics] companyId:", getCompanyId());
      console.log("[Analytics] fetch params:", params);

      const raw = await api.getAnalyticsDashboard(params);

      // Normalize: backend may wrap payload in { data: {...} } or return flat
      const res: DashboardData = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;

      console.log("[Analytics] payload keys:", res ? Object.keys(res) : []);
      console.log("[Analytics] summary.totalLeads:", res?.summary?.totalLeads);
      console.log("[Analytics] leadsOverTime length:", (res?.leadsOverTime ?? []).length);
      console.log("[Analytics] channelBreakdown length:", (res?.channelBreakdown ?? []).length);
      console.log("[Analytics] statusBreakdown length:", (res?.statusBreakdown ?? []).length);
      console.log("[Analytics] fieldCompletion length:", (res?.fieldCompletion ?? []).length);
      console.log("[Analytics] topSignals length:", (res?.topSignals ?? []).length);
      console.log("[Analytics] available_channels:", res?.available_channels);

      setData(res);

      // Build channel options
      const channels = res?.available_channels
        ?? (res?.channelBreakdown ?? []).map((c) => c.channel).filter(Boolean);
      if (channels.length > 0) {
        setAvailableChannels(channels);
        if (f.channel !== "all" && !channels.includes(f.channel)) {
          setFilters((p) => ({ ...p, channel: "all" }));
        }
      }
      setChannelsLoaded(true);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast({ title: "Failed to load analytics", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(filters); }, [filters, fetchData]);

  const channelOptions = useMemo(() => [
    { value: "all", label: "All Channels" },
    ...availableChannels.map((c) => ({
      value: c.toLowerCase(),
      label: c.charAt(0).toUpperCase() + c.slice(1),
    })),
  ], [availableChannels]);

  const s = data?.summary ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Lead performance, quote quality, and channel insights</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground font-mono">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => fetchData(filters)} disabled={loading} className="industrial-btn-ghost px-2 py-1.5">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="industrial-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 rounded-sm border border-border overflow-hidden">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((p) => ({ ...p, range: opt.value }))}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                filters.range === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-sm border border-border overflow-hidden">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((p) => ({ ...p, source: opt.value }))}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                filters.source === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={filters.channel}
          onChange={(e) => setFilters((p) => ({ ...p, channel: e.target.value }))}
          className="industrial-input py-1.5 text-xs"
          disabled={!channelsLoaded}
        >
          {!channelsLoaded ? (
            <option value="all">Loading channels…</option>
          ) : (
            channelOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))
          )}
        </select>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="industrial-card p-6 border-destructive/50 bg-destructive/5 text-center space-y-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button onClick={() => fetchData(filters)} className="industrial-btn-primary text-xs">Retry</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Leads" value={s.totalLeads} icon={<Users size={14} />} loading={loading} />
        <KpiCard label="New Today" value={s.newLeadsToday} icon={<TrendingUp size={14} />} loading={loading} />
        <KpiCard label="Conversations" value={s.conversationsStarted} icon={<MessageSquare size={14} />} loading={loading} />
        <KpiCard label="Quote Completion" value={s.quoteDataCompletionRate != null ? `${Math.round(s.quoteDataCompletionRate)}%` : undefined} icon={<CheckCircle size={14} />} loading={loading} />
        <KpiCard label="Avg Fields" value={s.avgCollectedFieldsPerLead != null ? Number(s.avgCollectedFieldsPerLead).toFixed(1) : undefined} icon={<BarChart3 size={14} />} loading={loading} />
        <KpiCard label="Inbox / Sim" value={s.inboxCount != null ? `${s.inboxCount} / ${s.simulationCount ?? 0}` : undefined} icon={<Inbox size={14} />} loading={loading} />
      </div>

      {/* Charts */}
      {!error && (
        <div className="space-y-6">
          <div className="industrial-card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4">Leads Over Time</h2>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              <ChartLeadsOverTime data={data?.leadsOverTime ?? []} emptyMsg={getEmptyMessage(filters)} />
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="industrial-card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4">Channel Breakdown</h2>
              {loading ? <Skeleton className="h-56 w-full" /> : (
                <ChartChannelBreakdown data={data?.channelBreakdown ?? []} emptyMsg={getEmptyMessage(filters)} />
              )}
            </div>
            <div className="industrial-card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4">Status Breakdown</h2>
              {loading ? <Skeleton className="h-56 w-full" /> : (
                <ChartStatusBreakdown data={data?.statusBreakdown ?? []} emptyMsg={getEmptyMessage(filters)} />
              )}
            </div>
          </div>

          <div className="industrial-card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4">Field Completion</h2>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <FieldCompletionTable data={data?.fieldCompletion ?? []} />
            )}
          </div>

          <div className="industrial-card p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4">Channel Conversion</h2>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <TopSignalsTable data={data?.topSignals ?? []} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- sub-components ----------

function KpiCard({ label, value, icon, loading }: { label: string; value?: number | string; icon: React.ReactNode; loading: boolean }) {
  return (
    <div className="industrial-card p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] font-mono uppercase tracking-wider">{label}</span></div>
      {loading ? <Skeleton className="h-7 w-16" /> : (
        <p className="text-xl font-bold tabular-nums">{value ?? 0}</p>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-56 text-sm text-muted-foreground text-center px-4">
      <p>{message}</p>
    </div>
  );
}

function getEmptyMessage(filters: Filters): string {
  if (filters.source === "simulation") return "No simulation leads found for this period.";
  if (filters.source === "inbox") return "No inbox leads found for this period.";
  return "No leads found for this period. Try switching to 30D/90D or a different source.";
}

function ChartLeadsOverTime({ data, emptyMsg }: { data: DashboardData["leadsOverTime"]; emptyMsg: string }) {
  if (!data || data.length === 0) return <EmptyChart message={emptyMsg} />;
  const hasBreakdown = data.some((d) => d.inbox != null || d.simulation != null);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,86%)" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(220,10%,46%)" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(220,10%,46%)" />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid hsl(220,13%,86%)" }} />
        {hasBreakdown ? (
          <>
            <Line type="monotone" dataKey="inbox" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Inbox" />
            <Line type="monotone" dataKey="simulation" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} name="Simulation" />
            <Line type="monotone" dataKey="total" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} name="Total" />
          </>
        ) : (
          <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Leads" />
        )}
        <Legend />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartChannelBreakdown({ data, emptyMsg }: { data: DashboardData["channelBreakdown"]; emptyMsg: string }) {
  if (!data || data.length === 0) return <EmptyChart message={emptyMsg} />;
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 36)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,86%)" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(220,10%,46%)" />
        <YAxis dataKey="channel" type="category" width={90} tick={{ fontSize: 11 }} stroke="hsl(220,10%,46%)" />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid hsl(220,13%,86%)" }} />
        <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartStatusBreakdown({ data, emptyMsg }: { data: DashboardData["statusBreakdown"]; emptyMsg: string }) {
  if (!data || data.length === 0) return <EmptyChart message={emptyMsg} />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid hsl(220,13%,86%)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function FieldCompletionTable({ data }: { data: DashboardData["fieldCompletion"] }) {
  if (!data || data.length === 0) return <EmptyChart message="No field completion data yet." />;

  return (
    <div className="overflow-auto">
      <table className="industrial-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Collected</th>
            <th>Total</th>
            <th>Rate</th>
            <th className="w-40">Progress</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.field || row.label}>
              <td className="font-medium capitalize">{row.label || row.field}</td>
              <td className="font-mono tabular-nums">{row.collected}</td>
              <td className="font-mono tabular-nums">{row.total}</td>
              <td className="font-mono tabular-nums">{Math.round(row.pct)}%</td>
              <td>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopSignalsTable({ data }: { data: DashboardData["topSignals"] }) {
  if (!data || data.length === 0) return <EmptyChart message="No conversion data yet." />;
  const sorted = [...data].sort((a, b) => b.conversionPct - a.conversionPct);

  return (
    <div className="overflow-auto">
      <table className="industrial-table">
        <thead>
          <tr>
            <th>Channel</th>
            <th>Total</th>
            <th>With Conversation</th>
            <th>Conversion %</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.channel}>
              <td className="font-medium capitalize">{row.channel}</td>
              <td className="font-mono tabular-nums">{row.total}</td>
              <td className="font-mono tabular-nums">{row.withConversation}</td>
              <td className="font-mono tabular-nums">{Math.round(row.conversionPct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Analytics;
