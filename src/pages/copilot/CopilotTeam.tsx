import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/apiClient";
import {
  Users,
  Trophy,
  Clock,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  Loader2,
  Plus,
  Copy,
  Check,
  Trash2,
  Settings2,
  X,
} from "lucide-react";

// -- Types --

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  setter_status: string;
  account_type: string;
  max_concurrent_dms: number;
  active_dms: number;
  dms_handled: number;
  avg_response_seconds: number;
  leads_qualified: number;
  created_at: string;
}

interface Invite {
  id: string;
  code: string;
  role: string;
  expires_at: string;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_by_name: string;
  created_at: string;
}

interface PerformanceData {
  daily: any[];
  totals: any;
}

// -- Helpers --

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600",
  "bg-amber-600", "bg-rose-600", "bg-cyan-600",
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success",
  away: "bg-[hsl(48_92%_53%)]",
  offline: "bg-muted-foreground/50",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
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

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

// -- Component --

const CopilotTeam = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState("setter");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteCreating, setInviteCreating] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Capacity edit
  const [editCapacityId, setEditCapacityId] = useState<string | null>(null);
  const [editCapacityVal, setEditCapacityVal] = useState("");
  const capacityRef = useRef<HTMLDivElement>(null);

  // Performance
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // -- Data fetching --

  const fetchTeam = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getCopilotTeam(),
      api.getTeamInvites().catch(() => []),
    ])
      .then(([teamRes, invitesRes]: any[]) => {
        setTeam(Array.isArray(teamRes) ? teamRes : teamRes?.team ?? []);
        setInvites(Array.isArray(invitesRes) ? invitesRes : []);
      })
      .catch((err: any) => setError(err?.message ?? "Failed to load team"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTeam(); }, []);

  // -- Invite actions --

  const handleCreateInvite = async () => {
    setInviteCreating(true);
    try {
      const res = await api.createTeamInvite({
        role: inviteRole,
        max_uses: inviteMaxUses ? Number(inviteMaxUses) : undefined,
      });
      setNewInviteCode(res.code);
      setInvites((prev) => [res, ...prev]);
    } catch { /* handled by api layer */ }
    setInviteCreating(false);
  };

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeInvite = async (id: string) => {
    try {
      await api.revokeTeamInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch { /* handled by api layer */ }
  };

  // -- Member actions --

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this team member? Their leads will be unassigned.")) return;
    try {
      await api.removeTeamMemberCopilot(userId);
      setTeam((prev) => prev.filter((m) => m.id !== userId));
    } catch { /* handled by api layer */ }
  };

  const handleSaveCapacity = async (userId: string) => {
    const val = Number(editCapacityVal);
    if (!val || val < 1) return;
    try {
      await api.setTeamMemberCapacity(userId, val);
      setTeam((prev) => prev.map((m) => m.id === userId ? { ...m, max_concurrent_dms: val } : m));
    } catch { /* handled by api layer */ }
    setEditCapacityId(null);
  };

  // -- Performance --

  const selectMember = (id: string) => {
    if (selectedId === id) { setSelectedId(null); setPerfData(null); return; }
    setSelectedId(id);
    setPerfData(null);
    setPerfLoading(true);
    api.getCopilotTeamPerformance(id)
      .then((res: any) => setPerfData({ daily: res?.daily ?? [], totals: res?.totals ?? {} }))
      .catch(() => setPerfData(null))
      .finally(() => setPerfLoading(false));
  };

  const selectedMember = team.find((m) => m.id === selectedId);
  const leaderboard = [...team].sort((a, b) => b.dms_handled - a.dms_handled);

  // Close capacity on outside click
  useEffect(() => {
    if (!editCapacityId) return;
    const handler = (e: MouseEvent) => {
      if (capacityRef.current && !capacityRef.current.contains(e.target as Node)) setEditCapacityId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editCapacityId]);

  // -- Loading/Error/Empty --

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Team Members
        </h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Team Members
        </h1>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={fetchTeam} className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-[hsl(0_0%_4%)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" /> Team Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{team.length} member{team.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowInviteModal(true); setNewInviteCode(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Invite Member
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            {newInviteCode ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Share this invite link with your team member:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs text-foreground font-mono break-all select-all">
                    {window.location.origin}/join/{newInviteCode}
                  </code>
                  <button onClick={() => handleCopyInvite(newInviteCode)} className="dark-btn-ghost p-2 shrink-0">
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </div>
                <button onClick={() => setShowInviteModal(false)} className="w-full dark-btn-primary text-sm">Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="dark-input w-full">
                    <option value="setter">Setter</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max Uses (optional)</label>
                  <input type="number" value={inviteMaxUses} onChange={(e) => setInviteMaxUses(e.target.value)} placeholder="Unlimited" className="dark-input w-full" min={1} />
                </div>
                <button onClick={handleCreateInvite} disabled={inviteCreating} className="w-full dark-btn-primary text-sm">
                  {inviteCreating ? <Loader2 size={14} className="animate-spin" /> : "Generate Invite Link"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.map((member, idx) => {
          const isSelected = selectedId === member.id;
          return (
            <div
              key={member.id}
              className={`text-left bg-card border rounded-xl p-5 transition-all ${
                isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
              }`}
            >
              {/* Avatar + name + status */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                    {getInitials(member.full_name)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${STATUS_COLORS[member.setter_status] || STATUS_COLORS.offline}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{member.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/15 text-primary">{member.role}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{member.setter_status || "offline"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditCapacityId(member.id); setEditCapacityVal(String(member.max_concurrent_dms || 20)); }} title="Edit capacity" className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <Settings2 size={13} />
                  </button>
                  {member.account_type === "team_member" && (
                    <button onClick={() => handleRemoveMember(member.id)} title="Remove member" className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Capacity editor */}
              {editCapacityId === member.id && (
                <div ref={capacityRef} className="mb-3 flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground shrink-0">Max DMs:</label>
                  <input type="number" value={editCapacityVal} onChange={(e) => setEditCapacityVal(e.target.value)} className="dark-input h-7 w-16 text-xs" min={1} max={100} />
                  <button onClick={() => handleSaveCapacity(member.id)} className="text-[10px] px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Save</button>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">{member.active_dms || 0}</p>
                  <p className="text-[9px] text-muted-foreground">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">{member.dms_handled}</p>
                  <p className="text-[9px] text-muted-foreground">Handled</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">{formatResponseTime(member.avg_response_seconds)}</p>
                  <p className="text-[9px] text-muted-foreground">Avg Time</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">{member.leads_qualified}</p>
                  <p className="text-[9px] text-muted-foreground">Booked</p>
                </div>
              </div>

              {/* Capacity bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
                  <span>DM Load</span>
                  <span>{member.active_dms || 0}/{member.max_concurrent_dms || 20}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (member.active_dms || 0) >= (member.max_concurrent_dms || 20)
                        ? "bg-destructive"
                        : (member.active_dms || 0) >= (member.max_concurrent_dms || 20) * 0.8
                        ? "bg-warning"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, ((member.active_dms || 0) / (member.max_concurrent_dms || 20)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Expand for performance */}
              <button onClick={() => selectMember(member.id)} className="mt-3 w-full text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                <ChevronRight size={12} className={`transition-transform ${isSelected ? "rotate-90" : ""}`} />
                {isSelected ? "Hide" : "View"} Performance
              </button>
            </div>
          );
        })}
      </div>

      {/* Performance Detail */}
      {selectedId && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">{selectedMember?.full_name ?? "Member"} — Performance</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
            </div>
            <button onClick={() => { setSelectedId(null); setPerfData(null); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-primary/40">Close</button>
          </div>

          {perfLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : perfData ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: "Total DMs", value: perfData.totals.dms_handled ?? 0 },
                  { label: "Suggestions Sent", value: perfData.totals.suggestions_sent ?? 0 },
                  { label: "Accepted", value: perfData.totals.suggestions_accepted ?? 0 },
                  { label: "Avg Response", value: formatResponseTime(perfData.totals.avg_response_seconds ?? 0), isText: true },
                  { label: "Booked", value: perfData.totals.leads_qualified ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{stat.isText ? stat.value : String(stat.value)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {perfData.daily.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">DMs</th>
                        <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-right">Avg Response</th>
                        <th className="py-2 text-xs font-medium text-muted-foreground text-right">Booked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.daily.map((day: any) => (
                        <tr key={day.date} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-2 pr-4 text-xs text-foreground">{formatDate(day.date)}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right font-medium">{day.dms_handled ?? 0}</td>
                          <td className="py-2 pr-4 text-xs text-foreground text-right">{formatResponseTime(day.avg_response_seconds ?? 0)}</td>
                          <td className="py-2 text-xs text-foreground text-right font-medium">{day.leads_qualified ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Unable to load performance data</p>
          )}
        </div>
      )}

      {/* Active Invites */}
      {invites.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Active Invites</h3>
          <div className="space-y-2">
            {invites.filter((i) => i.is_active).map((invite) => (
              <div key={invite.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground">{invite.code}</code>
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/15 text-primary">{invite.role}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {invite.used_count} use{invite.used_count !== 1 ? "s" : ""}
                    {invite.max_uses ? ` / ${invite.max_uses} max` : ""}
                    {" · "}{timeUntil(invite.expires_at)}
                    {invite.created_by_name ? ` · by ${invite.created_by_name}` : ""}
                  </p>
                </div>
                <button onClick={() => handleCopyInvite(invite.code)} title="Copy link" className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Copy size={13} />
                </button>
                <button onClick={() => handleRevokeInvite(invite.id)} title="Revoke" className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {team.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-yellow-500" /> Today's Leaderboard
          </h3>
          <div className="space-y-2">
            {leaderboard.map((member, idx) => {
              const rank = idx + 1;
              const isTop = rank === 1;
              return (
                <div key={member.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isTop ? "bg-yellow-500/10" : "hover:bg-muted/20"}`}>
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isTop ? "bg-yellow-500/20 text-yellow-500" : "bg-muted/40 text-muted-foreground"}`}>{rank}</span>
                  <span className={`flex-1 text-sm ${isTop ? "font-bold text-foreground" : "text-foreground"}`}>
                    {member.full_name}
                    {isTop && <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-500/20 text-yellow-500">Top Performer</span>}
                  </span>
                  <span className="text-sm font-bold text-foreground">{member.dms_handled}</span>
                  <span className="text-[10px] text-muted-foreground">DMs</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotTeam;
