import { useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";

interface QueueStats {
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
}

const FOLLOW_UP_TYPES = [
  { value: "no_reply", label: "No Reply" },
  { value: "post_quote", label: "Post Quote" },
  { value: "cold_lead", label: "Cold Lead" },
  { value: "custom", label: "Custom" },
];

const StatPill = ({ label, value }: { label: string; value: number | undefined }) => (
  <div className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5">
    <span className="text-xs font-mono text-muted-foreground">{label}</span>
    <span className="text-sm font-bold font-mono">{value ?? 0}</span>
  </div>
);

const FollowUpQueue = () => {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  // Form state
  const [leadId, setLeadId] = useState("");
  const [type, setType] = useState("no_reply");
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    setStatsError("");
    api.getQueueStats()
      .then(setStats)
      .catch((err) => setStatsError(getErrorMessage(err)))
      .finally(() => setStatsLoading(false));
  }, []);

  const handleSchedule = async () => {
    if (!leadId.trim()) {
      toast({ title: "Lead ID is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        lead_id: leadId.trim(),
        type,
        delay_minutes: delayMinutes,
      };
      if (type === "custom" && message.trim()) {
        payload.message = message.trim();
      }
      await api.scheduleFollowUp(payload);
      toast({ title: "Follow-up scheduled successfully" });
      setLeadId("");
      setMessage("");
      setDelayMinutes(60);
      // Refresh stats
      api.getQueueStats().then(setStats).catch(() => {});
    } catch (err) {
      toast({ title: "Failed to schedule follow-up", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue stats */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Queue Stats</h3>
        {statsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading stats…
          </div>
        ) : statsError ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle size={14} /> {statsError}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatPill label="Waiting" value={stats?.waiting} />
            <StatPill label="Active" value={stats?.active} />
            <StatPill label="Completed" value={stats?.completed} />
            <StatPill label="Failed" value={stats?.failed} />
            <StatPill label="Delayed" value={stats?.delayed} />
          </div>
        )}
      </div>

      {/* Schedule form */}
      <div className="industrial-card p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider">Schedule Follow-up</h3>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Lead ID</label>
          <input
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            className="industrial-input w-full"
            placeholder="Enter lead ID or search by name"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="industrial-input w-full"
          >
            {FOLLOW_UP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Delay (minutes)</label>
          <input
            type="number"
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Math.max(1, Number(e.target.value) || 60))}
            className="industrial-input w-32"
            min={1}
          />
        </div>

        {type === "custom" && (
          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="industrial-input w-full min-h-[80px] resize-y"
              placeholder="Custom follow-up message…"
            />
          </div>
        )}

        <button
          onClick={handleSchedule}
          disabled={submitting || !leadId.trim()}
          className="industrial-btn-accent"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          <span className="ml-1.5">Schedule</span>
        </button>
      </div>
    </div>
  );
};

export default FollowUpQueue;
