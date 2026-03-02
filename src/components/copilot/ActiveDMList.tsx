import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Search, Loader2, MessageSquare, Check, Users, Zap, Clock, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { api as apiClient } from "@/lib/apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DM {
  lead_id: string;
  lead_name: string;
  score: number;
  channel: string;
  pipeline_stage: string;
  profile_pic: string | null;
  conversation_id: string;
  last_message_at: string;
  last_message_preview: string;
  last_message_role: string;
  needs_response: boolean;
  has_suggestions: boolean;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_name?: string | null;
  assigned_setter_status?: string | null;
  dm_status?: string;
  dm_status_updated_at?: string | null;
  waiting_seconds?: number;
  urgency?: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface Props {
  selectedLeadId: string | null;
  onSelectLead: (leadId: string, conversationId: string) => void;
  /** Increment to trigger an immediate DM list refresh (e.g. from SSE events) */
  refreshTrigger?: number;
  /** When SSE is connected, use longer polling interval */
  sseConnected?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 8_000;

type SortOption = "recent" | "score" | "waiting" | "urgency";
type FilterOption = "all" | "mine" | "unassigned";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getInitialColor = (name: string) => {
  const colors = [
    "bg-primary text-primary-foreground",
    "bg-success text-success-foreground",
    "bg-info text-info-foreground",
    "bg-destructive text-destructive-foreground",
    "bg-warning text-warning-foreground",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const getScoreColor = (score: number) => {
  if (score >= 70) return "bg-success text-success-foreground";
  if (score >= 40) return "bg-warning text-warning-foreground";
  return "bg-muted text-muted-foreground";
};

/** Minutes elapsed since the given ISO timestamp. */
const minutesSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
};

/** Return initials (up to 2 characters) from a full name. */
const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const POLL_INTERVAL_SSE = 15_000; // Safety-net polling when SSE is active (catches missed events)

const ActiveDMList = ({ selectedLeadId, onSelectLead, refreshTrigger, sseConnected }: Props) => {
  // Data
  const [dms, setDms] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [filter, setFilter] = useState<FilterOption>("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchDMs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.getCopilotActiveDMs({ sort, filter });
        setDms(Array.isArray(res?.dms) ? res.dms : []);
      } catch {
        // silent fail on poll
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [sort, filter],
  );

  useEffect(() => {
    fetchDMs();
    const interval = sseConnected ? POLL_INTERVAL_SSE : POLL_INTERVAL;
    pollRef.current = setInterval(() => fetchDMs(true), interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDMs, sseConnected]);

  // Immediate refresh when SSE event triggers it
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchDMs(true);
    }
  }, [refreshTrigger]);

  // Fetch team members when bulk-assign dropdown opens
  useEffect(() => {
    if (!bulkAssignOpen) return;
    let cancelled = false;
    const load = async () => {
      setTeamLoading(true);
      try {
        const res = await api.getCopilotTeam();
        if (!cancelled) {
          const mapMember = (m: any): TeamMember => ({
            id: m.id ?? m.user_id,
            name: m.full_name ?? m.name ?? m.display_name ?? m.email ?? "Unknown",
          });
          const members: TeamMember[] = Array.isArray(res?.members)
            ? res.members.map(mapMember)
            : Array.isArray(res)
              ? res.map(mapMember)
              : [];
          setTeamMembers(members);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setTeamLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [bulkAssignOpen]);

  // Close assign dropdown on outside click
  useEffect(() => {
    if (!bulkAssignOpen) return;
    const handler = (e: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setBulkAssignOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bulkAssignOpen]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filtered = search.trim()
    ? dms.filter((dm) => dm.lead_name.toLowerCase().includes(search.toLowerCase()))
    : dms;

  const needsResponseCount = dms.filter((d) => d.needs_response).length;

  // Filter counts (computed on the full fetched list)
  const countAll = dms.length;
  const countMine = dms.filter((d) => !!d.assigned_to).length; // server should already filter, but count locally for badge
  const countUnassigned = dms.filter((d) => !d.assigned_to).length;

  const bulkMode = selectedIds.size > 0;
  const allVisibleSelected = filtered.length > 0 && filtered.every((dm) => selectedIds.has(dm.lead_id));

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const toggleSelect = (leadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((dm) => dm.lead_id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssign = async (userId: string) => {
    setBulkActionLoading(true);
    try {
      await api.bulkAssignLeads(Array.from(selectedIds), userId);
      clearSelection();
      setBulkAssignOpen(false);
      await fetchDMs(true);
    } catch {
      // error handled by api layer
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDismiss = async () => {
    const ids = Array.from(selectedIds)
      .map((leadId) => dms.find((d) => d.lead_id === leadId)?.conversation_id)
      .filter(Boolean) as string[];
    if (ids.length === 0) return;
    setBulkActionLoading(true);
    try {
      await api.batchDismissConversations(ids);
      clearSelection();
      await fetchDMs(true);
    } catch {
      // error handled by api layer
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkSendAI = async () => {
    const items = Array.from(selectedIds)
      .map((leadId) => {
        const dm = dms.find((d) => d.lead_id === leadId);
        if (!dm || !dm.has_suggestions) return null;
        return { conversation_id: dm.conversation_id, suggestion_id: "", suggestion_index: 0 };
      })
      .filter(Boolean) as Array<{ conversation_id: string; suggestion_id: string; suggestion_index: number }>;
    if (items.length === 0) return;
    setBulkActionLoading(true);
    try {
      await api.batchSendSuggestions(items);
      clearSelection();
      await fetchDMs(true);
    } catch {
      // error handled by api layer
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-[300px] shrink-0 border-r border-border bg-[hsl(0_0%_4%)] flex flex-col h-full">
      {/* ---- Header ---- */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <MessageSquare size={14} className="text-primary" />
          DMs
          {needsResponseCount > 0 && (
            <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {needsResponseCount}
            </span>
          )}
        </h2>

        {/* Search */}
        <div className="relative mb-2">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="dark-input w-full pl-7 h-8 text-xs"
          />
        </div>

        {/* Filter tabs (underline style) */}
        <div className="flex border-b border-border mb-2">
          {(
            [
              { key: "all", label: "All", count: countAll },
              { key: "mine", label: "Mine", count: countMine },
              { key: "unassigned", label: "Unassigned", count: countUnassigned },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key);
                clearSelection();
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                filter === tab.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[16px] rounded-full px-1 text-[9px] font-bold ${
                  filter === tab.key
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
              {/* Active underline */}
              {filter === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Sort pills */}
        <div className="flex gap-1">
          {(["urgency", "recent", "score", "waiting"] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                sort === s
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "urgency" ? "Urgency" : s === "recent" ? "Recent" : s === "score" ? "Score" : "Waiting"}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Bulk action bar ---- */}
      {bulkMode && (
        <div className="px-3 py-2 bg-primary/5 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-foreground">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-1.5 relative">
            {/* Assign */}
            <div className="relative" ref={assignDropdownRef}>
              <button
                onClick={() => setBulkAssignOpen((v) => !v)}
                disabled={bulkActionLoading}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <Users size={10} />
                Assign
              </button>
              {bulkAssignOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[hsl(0_0%_8%)] border border-border rounded-md shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                  {teamLoading && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!teamLoading && teamMembers.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-3 py-2">No team members found</p>
                  )}
                  {!teamLoading &&
                    teamMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => handleBulkAssign(member.id)}
                        disabled={bulkActionLoading}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        {member.name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Send AI Pick */}
            <button
              onClick={handleBulkSendAI}
              disabled={bulkActionLoading}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Zap size={10} />
              Send AI Pick
            </button>

            {/* Dismiss */}
            <button
              onClick={handleBulkDismiss}
              disabled={bulkActionLoading}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ---- Select-all header row ---- */}
      {filtered.length > 0 && !loading && (
        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border/50 shrink-0">
          <button
            onClick={toggleSelectAll}
            className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors ${
              allVisibleSelected
                ? "bg-primary border-primary"
                : "border-muted-foreground/40 hover:border-primary/60"
            }`}
          >
            {allVisibleSelected && <Check size={10} className="text-primary-foreground" />}
          </button>
          <span className="text-[10px] text-muted-foreground">Select all</span>
        </div>
      )}

      {/* ---- List ---- */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">No active conversations</p>
          </div>
        )}

        {!loading &&
          filtered.map((dm) => {
            const isSelected = selectedIds.has(dm.lead_id);
            const assignedName = dm.assigned_to_name || dm.assigned_name;
            const urgency = dm.urgency || "none";
            const waitingSec = dm.waiting_seconds || 0;
            const waitMins = Math.floor(waitingSec / 60);
            const waitLabel =
              waitMins >= 60 ? `${Math.floor(waitMins / 60)}h` : waitMins > 0 ? `${waitMins}m` : null;

            // Urgency-based left border and background
            const urgencyStyles: Record<string, string> = {
              critical: "border-l-2 border-l-red-500 bg-red-500/5",
              warning: "border-l-2 border-l-orange-400 bg-orange-400/5",
              ok: "border-l-2 border-l-green-500",
              none: "",
            };
            const urgencyBorder = urgencyStyles[urgency] || "";

            return (
              <div
                key={dm.lead_id}
                className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex items-start gap-2 ${
                  selectedLeadId === dm.lead_id
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : urgencyBorder || "hover:bg-secondary/50"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(dm.lead_id);
                  }}
                  className={`mt-1.5 w-3.5 h-3.5 rounded-[3px] border shrink-0 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40 hover:border-primary/60"
                  }`}
                >
                  {isSelected && <Check size={10} className="text-primary-foreground" />}
                </button>

                {/* Main clickable area */}
                <button
                  onClick={() => onSelectLead(dm.lead_id, dm.conversation_id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    {dm.profile_pic ? (
                      <img src={dm.profile_pic} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${getInitialColor(dm.lead_name)}`}
                      >
                        {dm.lead_name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Name + time */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate">{dm.lead_name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(dm.last_message_at)}
                        </span>
                      </div>

                      {/* Preview */}
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {dm.last_message_preview || "..."}
                      </p>

                      {/* Meta row: urgency, assignment, waiting, AI badge */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* Score badge */}
                        {dm.score > 0 && (
                          <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-semibold ${getScoreColor(dm.score)}`}>
                            {dm.score}
                          </span>
                        )}

                        {/* Assignment indicator */}
                        {assignedName ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px]">
                            <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold">
                              {getInitials(assignedName)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/60 italic">Unassigned</span>
                        )}

                        {/* Waiting time with color */}
                        {dm.needs_response && waitLabel && (
                          <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${
                            urgency === "critical" ? "text-red-500" : urgency === "warning" ? "text-orange-400" : "text-green-500"
                          }`}>
                            <Clock size={9} />
                            {waitLabel}
                          </span>
                        )}

                        {/* Waiting for client (no action needed) */}
                        {!dm.needs_response && dm.last_message_role === "assistant" && (
                          <span className="text-[9px] text-blue-400/70 italic">Waiting for client</span>
                        )}

                        {/* AI Ready badge */}
                        {dm.has_suggestions && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-semibold">
                            <Zap size={9} />
                            AI Ready
                          </span>
                        )}
                      </div>

                      {/* Disposition buttons */}
                      <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        {[
                          { status: "booked", icon: CheckCircle, label: "Booked", color: "text-green-500 hover:bg-green-500/10" },
                          { status: "lost", icon: XCircle, label: "Lost", color: "text-red-400 hover:bg-red-400/10" },
                          { status: "done", icon: MinusCircle, label: "Done", color: "text-muted-foreground hover:bg-muted/20" },
                        ].map(({ status, icon: Icon, label, color }) => (
                          <button
                            key={status}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await apiClient.setDmStatus(dm.lead_id, status);
                                // Remove from list
                                setDms((prev) => prev.filter((d) => d.lead_id !== dm.lead_id));
                              } catch { /* handled by api layer */ }
                            }}
                            title={label}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors ${color}`}
                          >
                            <Icon size={9} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ActiveDMList;
