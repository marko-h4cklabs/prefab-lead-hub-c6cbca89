import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Users,
  Trophy,
  Clock,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  dms_handled: number;
  avg_response_seconds: number;
  leads_qualified: number;
}

interface PerformanceDay {
  date: string;
  dms: number;
  suggestions_sent: number;
  suggestions_edited: number;
  custom_replies: number;
  avg_response_seconds: number;
  leads_qualified: number;
}

interface PerformanceTotals {
  dms: number;
  suggestions_sent: number;
  suggestions_edited: number;
  custom_replies: number;
  avg_response_seconds: number;
  leads_qualified: number;
}

interface PerformanceData {
  daily: PerformanceDay[];
  totals: PerformanceTotals;
}

// ── Helpers ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function formatResponseTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });
}

// ── Skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

const CopilotTeam = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // ── Fetch team list ────────────────────────────────────────────────

  const fetchTeam = () => {
    setLoading(true);
    setError(null);
    api
      .getCopilotTeam()
      .then((res: any) => {
        setTeam(res?.team ?? []);
      })
      .catch((err: any) => {
        setError(err?.message ?? "Failed to load team data");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  // ── Fetch individual performance ───────────────────────────────────

  const selectMember = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setPerfData(null);
      return;
    }
    setSelectedId(id);
    setPerfData(null);
    setPerfLoading(true);
    api
      .getCopilotTeamPerformance(id)
      .then((res: any) => {
        setPerfData({ daily: res?.daily ?? [], totals: res?.totals ?? {} });
      })
      .catch(() => {
        setPerfData(null);
      })
      .finally(() => setPerfLoading(false));
  };

  const selectedMember = team.find((m) => m.id === selectedId);

  // ── Leaderboard (sorted by DMs handled today, descending) ─────────

  const leaderboard = [...team].sort((a, b) => b.dms_handled - a.dms_handled);

  // ── Render ─────────────────────────────────────────────────────────

  // Loading state
  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" /> Team Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Loading team data...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" /> Team Performance
          </h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchTeam}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (team.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" /> Team Performance
          </h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No team members yet</p>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Team Performance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your team's daily activity and performance
        </p>
      </div>

      {/* ── Team Members Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.map((member, idx) => {
          const isSelected = selectedId === member.id;
          return (
            <button
              key={member.id}
              onClick={() => selectMember(member.id)}
              className={`text-left bg-card border rounded-xl p-5 transition-all hover:border-primary/50 ${
                isSelected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border"
              }`}
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    AVATAR_COLORS[idx % AVATAR_COLORS.length]
                  }`}
                >
                  {getInitials(member.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {member.full_name}
                  </p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/15 text-primary">
                    {member.role}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-muted-foreground transition-transform ${
                    isSelected ? "rotate-90" : ""
                  }`}
                />
              </div>

              {/* Today's stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{member.dms_handled}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    <MessageSquare size={10} /> DMs
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">
                    {formatResponseTime(member.avg_response_seconds)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    <Clock size={10} /> Avg Time
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{member.leads_qualified}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    <TrendingUp size={10} /> Leads
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Performance Detail Panel ────────────────────────────────── */}
      {selectedId && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {selectedMember?.full_name ?? "Member"} — Performance
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
            </div>
            <button
              onClick={() => {
                setSelectedId(null);
                setPerfData(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-primary/40"
            >
              Close
            </button>
          </div>

          {perfLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : perfData ? (
            <>
              {/* Totals row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Total DMs", value: perfData.totals.dms ?? 0 },
                  { label: "Suggestions Sent", value: perfData.totals.suggestions_sent ?? 0 },
                  { label: "Suggestions Edited", value: perfData.totals.suggestions_edited ?? 0 },
                  { label: "Custom Replies", value: perfData.totals.custom_replies ?? 0 },
                  {
                    label: "Avg Response Time",
                    value: formatResponseTime(perfData.totals.avg_response_seconds ?? 0),
                    isText: true,
                  },
                  { label: "Leads Qualified", value: perfData.totals.leads_qualified ?? 0 },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-muted/30 rounded-lg p-3 text-center"
                  >
                    <p className="text-lg font-bold text-foreground">
                      {stat.isText ? stat.value : String(stat.value)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Daily breakdown table */}
              {perfData.daily.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">DMs</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">Suggestions Sent</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">Edited</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">Custom</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">Avg Response</th>
                        <th className="py-2 text-xs font-medium text-muted-foreground text-right">Qualified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.daily.map((day) => (
                        <tr
                          key={day.date}
                          className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2 pr-4 text-xs text-foreground">{formatDate(day.date)}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right font-medium">{day.dms}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right">{day.suggestions_sent}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right">{day.suggestions_edited}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right">{day.custom_replies}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right">
                            {formatResponseTime(day.avg_response_seconds)}
                          </td>
                          <td className="py-2 text-xs text-foreground text-right font-medium">{day.leads_qualified}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">
              Unable to load performance data
            </p>
          )}
        </div>
      )}

      {/* ── Leaderboard ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Trophy size={14} className="text-yellow-500" /> Today's Leaderboard
        </h3>

        <div className="space-y-2">
          {leaderboard.map((member, idx) => {
            const rank = idx + 1;
            const isTop = rank === 1;
            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isTop ? "bg-yellow-500/10" : "hover:bg-muted/20"
                }`}
              >
                {/* Rank */}
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                    isTop
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {rank}
                </span>

                {/* Name */}
                <span className={`flex-1 text-sm ${isTop ? "font-bold text-foreground" : "text-foreground"}`}>
                  {member.full_name}
                  {isTop && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-500/20 text-yellow-500">
                      Top Performer
                    </span>
                  )}
                </span>

                {/* DMs count */}
                <span className="text-sm font-bold text-foreground">
                  {member.dms_handled}
                </span>
                <span className="text-[10px] text-muted-foreground">DMs</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CopilotTeam;
