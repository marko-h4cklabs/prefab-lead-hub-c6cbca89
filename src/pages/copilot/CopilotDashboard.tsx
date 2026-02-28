import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/apiClient";
import {
  Zap,
  MessageSquare,
  CheckCircle2,
  Clock,
  ThumbsUp,
  UserCheck,
  AlertCircle,
  Hourglass,
  Send,
  Trophy,
  Flame,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsData {
  active_conversations: number;
  handled_today: number;
  avg_response_time_seconds: number;
  suggestion_acceptance_rate: number;
  leads_qualified_today: number;
}

interface ActiveDM {
  id: string;
  lead_id: string;
  lead_name?: string;
  status?: string;
  suggestion_status?: string;
  last_message_at?: string;
  created_at?: string;
  assigned_user_id?: string;
  assigned_user_name?: string;
  intent_score?: number;
  hot_lead?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  dms_handled_today?: number;
  avg_response_time_seconds?: number;
  active_conversations?: number;
}

interface HotLead {
  id: string;
  lead_id: string;
  lead_name?: string;
  intent_score?: number;
  reason?: string;
  created_at?: string;
  assigned_user_name?: string;
  conversation_id?: string;
}

interface QueueHealth {
  waitingCount: number;
  oldestWaitingMinutes: number;
  pendingSuggestions: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  if (rem === 0) return `${hrs}h`;
  return `${hrs}h ${rem}m`;
}

function timeAgoMinutes(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, diff / 60000);
}

function queueSeverity(
  waitingCount: number,
  oldestMinutes: number
): "green" | "orange" | "red" {
  if (waitingCount === 0) return "green";
  if (oldestMinutes > 30 || waitingCount > 10) return "red";
  if (oldestMinutes > 10 || waitingCount > 5) return "orange";
  return "green";
}

const severityStyles = {
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
    label: "Healthy",
  },
  orange: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-400",
    dot: "bg-amber-500",
    label: "Needs Attention",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-400",
    dot: "bg-red-500",
    label: "Critical",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
  trend,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  trend?: { direction: "up" | "down"; label: string } | null;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div
          className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}
        >
          <Icon size={16} className={iconColor} />
        </div>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-medium ${
              trend.direction === "up" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend.direction === "up" ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {trend.label}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function QueueHealthCard({
  icon: Icon,
  value,
  label,
  severity,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  severity: "green" | "orange" | "red";
}) {
  const s = severityStyles[severity];
  return (
    <div
      className={`rounded-xl border ${s.border} ${s.bg} p-4 flex flex-col gap-2`}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className={s.text} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${s.text}`}>{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-muted mb-3" />
      <div className="h-7 w-16 bg-muted rounded mb-1" />
      <div className="h-3 w-24 bg-muted rounded" />
    </div>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3">
      <div className="h-5 w-40 bg-muted rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-muted rounded" />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[260px]">
        {description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 30_000;

const CopilotDashboard = () => {
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [activeDMs, setActiveDMs] = useState<ActiveDM[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [queueHealth, setQueueHealth] = useState<QueueHealth>({
    waitingCount: 0,
    oldestWaitingMinutes: 0,
    pendingSuggestions: 0,
  });

  // Derive queue health from active DMs
  const deriveQueueHealth = useCallback((dms: ActiveDM[]): QueueHealth => {
    const waiting = dms.filter(
      (dm) =>
        dm.status === "needs_response" &&
        (!dm.suggestion_status || dm.suggestion_status === "none")
    );
    const pending = dms.filter(
      (dm) => dm.suggestion_status === "generated" || dm.suggestion_status === "ready"
    );

    let oldestMinutes = 0;
    if (waiting.length > 0) {
      const times = waiting
        .map((dm) => timeAgoMinutes(dm.last_message_at || dm.created_at))
        .filter((t) => t > 0);
      oldestMinutes = times.length > 0 ? Math.max(...times) : 0;
    }

    return {
      waitingCount: waiting.length,
      oldestWaitingMinutes: oldestMinutes,
      pendingSuggestions: pending.length,
    };
  }, []);

  const fetchData = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        setError(null);

        const [statsRes, dmsRes, teamRes, hotLeadsRes] =
          await Promise.allSettled([
            api.getCopilotStats(),
            api.getCopilotActiveDMs({}),
            api.getCopilotTeam(),
            api.getHotLeads(),
          ]);

        // Stats
        if (statsRes.status === "fulfilled" && statsRes.value) {
          setStats({
            active_conversations: statsRes.value.active_conversations ?? 0,
            handled_today: statsRes.value.handled_today ?? 0,
            avg_response_time_seconds:
              statsRes.value.avg_response_time_seconds ?? 0,
            suggestion_acceptance_rate:
              statsRes.value.suggestion_acceptance_rate ?? 0,
            leads_qualified_today: statsRes.value.leads_qualified_today ?? 0,
          });
        }

        // Active DMs
        if (dmsRes.status === "fulfilled") {
          const dms: ActiveDM[] = Array.isArray(dmsRes.value)
            ? dmsRes.value
            : dmsRes.value?.conversations || dmsRes.value?.dms || [];
          setActiveDMs(dms);
          setQueueHealth(deriveQueueHealth(dms));

          // If stats endpoint failed, derive some stats from DMs
          if (statsRes.status !== "fulfilled") {
            setStats((prev) => ({
              active_conversations: dms.length,
              handled_today: prev?.handled_today ?? 0,
              avg_response_time_seconds: prev?.avg_response_time_seconds ?? 0,
              suggestion_acceptance_rate:
                prev?.suggestion_acceptance_rate ?? 0,
              leads_qualified_today: prev?.leads_qualified_today ?? 0,
            }));
          }
        }

        // Team
        if (teamRes.status === "fulfilled") {
          const members: TeamMember[] = Array.isArray(teamRes.value)
            ? teamRes.value
            : teamRes.value?.members || teamRes.value?.team || [];
          setTeamMembers(members);
        }

        // Hot Leads
        if (hotLeadsRes.status === "fulfilled") {
          const leads: HotLead[] = Array.isArray(hotLeadsRes.value)
            ? hotLeadsRes.value
            : hotLeadsRes.value?.leads || hotLeadsRes.value?.alerts || [];
          setHotLeads(leads);
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [deriveQueueHealth]
  );

  // Initial fetch + polling
  useEffect(() => {
    fetchData(true);

    pollRef.current = setInterval(() => {
      fetchData(false);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  const severity = queueSeverity(
    queueHealth.waitingCount,
    queueHealth.oldestWaitingMinutes
  );
  const sStyle = severityStyles[severity];

  const topSetters = [...teamMembers]
    .sort((a, b) => (b.dms_handled_today ?? 0) - (a.dms_handled_today ?? 0))
    .slice(0, 5);

  const visibleHotLeads = hotLeads.slice(0, 6);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-[hsl(0_0%_4%)] p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-9 h-9 rounded-lg bg-muted" />
          <div className="h-6 w-48 bg-muted rounded" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        {/* Sections skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={5} />
        </div>
        <SectionSkeleton rows={4} />
      </div>
    );
  }

  if (error && !stats && activeDMs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[hsl(0_0%_4%)]">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle size={24} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Unable to Load Dashboard
            </p>
            <p className="text-xs text-muted-foreground max-w-[300px]">
              {error}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[hsl(0_0%_4%)] p-6 space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Co-Pilot Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Real-time overview of your appointment setter operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={() => fetchData(false)}
            className="p-2 rounded-lg hover:bg-card border border-border transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Show non-fatal error banner */}
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">{error}</p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Stats Cards Row                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={MessageSquare}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          value={stats?.active_conversations ?? 0}
          label="Active Conversations"
        />
        <StatCard
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          value={stats?.handled_today ?? 0}
          label="Handled Today"
          trend={
            (stats?.handled_today ?? 0) > 0
              ? { direction: "up", label: `${stats?.handled_today ?? 0} today` }
              : null
          }
        />
        <StatCard
          icon={Clock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          value={formatDuration(stats?.avg_response_time_seconds ?? 0)}
          label="Avg Response Time"
          trend={
            (stats?.avg_response_time_seconds ?? 0) > 0
              ? {
                  direction:
                    (stats?.avg_response_time_seconds ?? 0) <= 300
                      ? "up"
                      : "down",
                  label:
                    (stats?.avg_response_time_seconds ?? 0) <= 300
                      ? "On track"
                      : "Slow",
                }
              : null
          }
        />
        <StatCard
          icon={ThumbsUp}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          value={`${stats?.suggestion_acceptance_rate ?? 0}%`}
          label="Suggestion Acceptance"
          trend={
            (stats?.suggestion_acceptance_rate ?? 0) > 0
              ? {
                  direction:
                    (stats?.suggestion_acceptance_rate ?? 0) >= 50
                      ? "up"
                      : "down",
                  label: `${stats?.suggestion_acceptance_rate ?? 0}% accepted`,
                }
              : null
          }
        />
        <StatCard
          icon={UserCheck}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          value={stats?.leads_qualified_today ?? 0}
          label="Leads Qualified Today"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Queue Health + Team Leaderboard Row                              */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue Health */}
        <div
          className={`rounded-xl border ${sStyle.border} ${sStyle.bg} p-5 space-y-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Queue Health
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${sStyle.text}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${sStyle.dot} animate-pulse`}
                />
                {sStyle.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <QueueHealthCard
              icon={AlertCircle}
              value={queueHealth.waitingCount}
              label="Waiting DMs"
              severity={
                queueHealth.waitingCount === 0
                  ? "green"
                  : queueHealth.waitingCount > 10
                    ? "red"
                    : queueHealth.waitingCount > 5
                      ? "orange"
                      : "green"
              }
            />
            <QueueHealthCard
              icon={Hourglass}
              value={
                queueHealth.oldestWaitingMinutes > 0
                  ? formatMinutesAgo(queueHealth.oldestWaitingMinutes)
                  : "--"
              }
              label="Oldest Waiting"
              severity={
                queueHealth.oldestWaitingMinutes === 0
                  ? "green"
                  : queueHealth.oldestWaitingMinutes > 30
                    ? "red"
                    : queueHealth.oldestWaitingMinutes > 10
                      ? "orange"
                      : "green"
              }
            />
            <QueueHealthCard
              icon={Send}
              value={queueHealth.pendingSuggestions}
              label="Pending Suggestions"
              severity={
                queueHealth.pendingSuggestions === 0
                  ? "green"
                  : queueHealth.pendingSuggestions > 10
                    ? "red"
                    : queueHealth.pendingSuggestions > 5
                      ? "orange"
                      : "green"
              }
            />
          </div>

          {queueHealth.waitingCount > 0 && (
            <button
              onClick={() => navigate("/copilot/conversations")}
              className="w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card/50 text-xs font-medium text-foreground hover:bg-card transition-colors"
            >
              View Waiting Conversations
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Team Leaderboard */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <h2 className="text-lg font-semibold text-foreground">
                Team Leaderboard
              </h2>
            </div>
            {teamMembers.length > 5 && (
              <button
                onClick={() => navigate("/copilot/pipeline")}
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                View All
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          {topSetters.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Team Data"
              description="Team member performance data will appear here once setters start handling conversations."
            />
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[28px_1fr_80px_100px] gap-2 px-3 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                <span>#</span>
                <span>Name</span>
                <span className="text-right">DMs</span>
                <span className="text-right">Avg Time</span>
              </div>
              {topSetters.map((member, idx) => (
                <div
                  key={member.id}
                  className={`grid grid-cols-[28px_1fr_80px_100px] gap-2 px-3 py-2.5 rounded-lg items-center ${
                    idx === 0
                      ? "bg-amber-500/5 border border-amber-500/20"
                      : "hover:bg-muted/30"
                  } transition-colors`}
                >
                  <span
                    className={`text-sm font-bold ${
                      idx === 0
                        ? "text-amber-400"
                        : idx === 1
                          ? "text-zinc-300"
                          : idx === 2
                            ? "text-amber-700"
                            : "text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm text-foreground font-medium truncate">
                    {member.name}
                  </span>
                  <span className="text-sm text-foreground font-semibold text-right">
                    {member.dms_handled_today ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground text-right">
                    {member.avg_response_time_seconds
                      ? formatDuration(member.avg_response_time_seconds)
                      : "--"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Hot Leads Section                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-orange-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Hot Leads
            </h2>
            {hotLeads.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-medium">
                {hotLeads.length}
              </span>
            )}
          </div>
          {hotLeads.length > 6 && (
            <button
              onClick={() => navigate("/copilot/pipeline")}
              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
            >
              View All
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {visibleHotLeads.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No Hot Leads"
            description="High-intent leads will appear here when detected. Keep monitoring your conversations for engagement signals."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleHotLeads.map((lead) => {
              const waitMinutes = timeAgoMinutes(lead.created_at);
              return (
                <button
                  key={lead.id}
                  onClick={() => navigate("/copilot/conversations")}
                  className="text-left rounded-lg border border-border hover:border-orange-500/30 bg-card hover:bg-orange-500/5 p-4 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-foreground group-hover:text-orange-300 truncate max-w-[70%] transition-colors">
                      {lead.lead_name || "Unknown Lead"}
                    </span>
                    {lead.intent_score != null && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          lead.intent_score >= 80
                            ? "bg-red-500/15 text-red-400"
                            : lead.intent_score >= 60
                              ? "bg-orange-500/15 text-orange-400"
                              : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {lead.intent_score}%
                      </span>
                    )}
                  </div>
                  {lead.reason && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {lead.reason}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {waitMinutes > 0 ? formatMinutesAgo(waitMinutes) : "--"}{" "}
                      ago
                    </span>
                    {lead.assigned_user_name && (
                      <span className="truncate max-w-[120px]">
                        {lead.assigned_user_name}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open conversation
                    <ArrowRight size={10} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotDashboard;
