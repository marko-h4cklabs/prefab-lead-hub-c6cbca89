import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Search, Loader2, MessageSquare } from "lucide-react";

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
}

interface Props {
  selectedLeadId: string | null;
  onSelectLead: (leadId: string, conversationId: string) => void;
}

const POLL_INTERVAL = 8_000;

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

type SortOption = "recent" | "score" | "waiting";

const ActiveDMList = ({ selectedLeadId, onSelectLead }: Props) => {
  const [dms, setDms] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDMs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getCopilotActiveDMs({ sort });
      setDms(Array.isArray(res?.dms) ? res.dms : []);
    } catch {
      // silent fail on poll
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchDMs();
    pollRef.current = setInterval(() => fetchDMs(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchDMs]);

  const filtered = search.trim()
    ? dms.filter((dm) => dm.lead_name.toLowerCase().includes(search.toLowerCase()))
    : dms;

  return (
    <div className="w-[280px] shrink-0 border-r border-border bg-[hsl(0_0%_4%)] flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <MessageSquare size={14} className="text-primary" />
          Active DMs
          {dms.filter((d) => d.needs_response).length > 0 && (
            <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {dms.filter((d) => d.needs_response).length}
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
        {/* Sort */}
        <div className="flex gap-1">
          {(["recent", "score", "waiting"] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                sort === s ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "recent" ? "Recent" : s === "score" ? "Score" : "Waiting"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
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
        {!loading && filtered.map((dm) => (
          <button
            key={dm.lead_id}
            onClick={() => onSelectLead(dm.lead_id, dm.conversation_id)}
            className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors ${
              selectedLeadId === dm.lead_id
                ? "bg-primary/10 border-l-2 border-l-primary"
                : "hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {/* Avatar */}
              {dm.profile_pic ? (
                <img src={dm.profile_pic} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
              ) : (
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${getInitialColor(dm.lead_name)}`}>
                  {dm.lead_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">{dm.lead_name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(dm.last_message_at)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{dm.last_message_preview || "..."}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {dm.score > 0 && (
                    <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-semibold ${getScoreColor(dm.score)}`}>
                      {dm.score}
                    </span>
                  )}
                  {dm.needs_response && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  {dm.has_suggestions && (
                    <span className="text-[9px] text-primary font-medium">AI Ready</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActiveDMList;
