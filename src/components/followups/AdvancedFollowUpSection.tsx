import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Pause, Play, SkipForward, X, ChevronDown, ChevronUp,
  BarChart3, Clock, Send, AlertTriangle, TrendingUp, Zap, Brain, RefreshCw,
} from "lucide-react";

/* ── Types ── */
interface DashboardStats {
  active_enrollments: number;
  paused_enrollments: number;
  completed_enrollments: number;
  escalated_count: number;
  total_messages_sent: number;
  reply_rate: number;
  positive_replies: number;
  negative_replies: number;
}

interface WarmingStep {
  id: string;
  step_order: number;
  delay_minutes: number;
  message_template: string;
  step_type: string;
  conditions: any;
  ai_context_prompt: string | null;
}

interface Sequence {
  id: string;
  name: string;
  trigger_event: string;
  is_active: boolean;
  no_reply_delay_hours: number;
  max_follow_ups: number;
  escalation_action: string | null;
  escalation_value: string | null;
  category: string;
  steps: WarmingStep[];
}

interface Enrollment {
  id: string;
  lead_id: string;
  sequence_id: string;
  lead_name: string | null;
  sequence_name: string | null;
  current_step: number;
  follow_ups_sent: number;
  paused: boolean;
  escalated: boolean;
  escalation_action: string | null;
  next_send_at: string | null;
  enrolled_at: string;
  status: string;
}

interface SeqStat {
  sequence_id: string;
  sequence_name: string;
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  total_messages: number;
  total_replies: number;
  reply_rate: number;
  positive_replies: number;
  negative_replies: number;
}

/* ── Helpers ── */
const TRIGGER_LABELS: Record<string, string> = {
  call_booked: "Call Booked",
  no_show_detected: "No-Show",
  no_reply_72h: "No Reply",
  post_quote: "Post Quote",
  re_engagement: "Re-Engagement",
  custom: "Custom",
};

const ESCALATION_LABELS: Record<string, string> = {
  tag_cold: "Tag as Cold",
  notify_owner: "Notify Owner",
  move_stage: "Move Pipeline Stage",
  pause: "Pause Sequence",
};

function fmtDelay(mins: number) {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Sub-tabs ── */
type SubTab = "overview" | "sequences" | "enrollments" | "analytics";

/* ── Main Component ── */
const AdvancedFollowUpSection = () => {
  const [tab, setTab] = useState<SubTab>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [seqStats, setSeqStats] = useState<SeqStat[]>([]);
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null);

  // Create sequence state
  const [showCreate, setShowCreate] = useState(false);
  const [newSeq, setNewSeq] = useState({ name: "", trigger_event: "no_reply_72h", max_follow_ups: 5, escalation_action: "" });
  const [newSteps, setNewSteps] = useState<{ delay_minutes: number; message_template: string; step_type: string; ai_context_prompt: string }[]>([
    { delay_minutes: 0, message_template: "", step_type: "message", ai_context_prompt: "" },
  ]);
  const [creating, setCreating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, seqRes, enrRes, statsRes] = await Promise.all([
        api.getFollowUpDashboard(),
        api.getWarmingSequences(),
        api.getWarmingEnrollments("active"),
        api.getFollowUpStats(),
      ]);
      setStats(dashRes);
      setSequences(seqRes?.data || []);
      setEnrollments(enrRes?.data || []);
      setSeqStats(statsRes?.data || []);
    } catch {
      toast({ title: "Failed to load follow-up data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Actions ── */
  const toggleSequence = async (id: string, active: boolean) => {
    try {
      await api.updateWarmingSequence(id, { is_active: !active });
      setSequences(prev => prev.map(s => s.id === id ? { ...s, is_active: !active } : s));
      toast({ title: active ? "Sequence paused" : "Sequence activated" });
    } catch { toast({ title: "Failed to toggle sequence", variant: "destructive" }); }
  };

  const handleEnrollmentAction = async (id: string, action: "pause" | "resume" | "skip" | "cancel") => {
    try {
      if (action === "pause") await api.pauseEnrollment(id);
      else if (action === "resume") await api.resumeEnrollment(id);
      else if (action === "skip") await api.skipEnrollmentStep(id);
      else await api.cancelEnrollment(id);
      toast({ title: `Enrollment ${action}d` });
      fetchAll();
    } catch { toast({ title: `Failed to ${action} enrollment`, variant: "destructive" }); }
  };

  const handleCreateSequence = async () => {
    if (!newSeq.name.trim()) return;
    const validSteps = newSteps.filter(s => s.message_template.trim() || s.step_type === "ai_generated");
    if (validSteps.length === 0) { toast({ title: "Add at least one step", variant: "destructive" }); return; }
    setCreating(true);
    try {
      await api.createWarmingSequence({
        name: newSeq.name,
        trigger_event: newSeq.trigger_event,
        max_follow_ups: newSeq.max_follow_ups,
        escalation_action: newSeq.escalation_action || null,
        steps: validSteps,
      });
      toast({ title: "Sequence created" });
      setShowCreate(false);
      setNewSeq({ name: "", trigger_event: "no_reply_72h", max_follow_ups: 5, escalation_action: "" });
      setNewSteps([{ delay_minutes: 0, message_template: "", step_type: "message", ai_context_prompt: "" }]);
      fetchAll();
    } catch { toast({ title: "Failed to create sequence", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  return (
    <div className="p-5 space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(["overview", "sequences", "enrollments", "analytics"] as SubTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? "Overview" : t === "sequences" ? "Sequences" : t === "enrollments" ? "Active" : "Analytics"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && stats && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatCard icon={<Send size={14} />} label="Messages Sent" value={stats.total_messages_sent} />
            <StatCard icon={<TrendingUp size={14} />} label="Reply Rate" value={`${stats.reply_rate}%`} color={stats.reply_rate > 20 ? "text-success" : "text-warning"} />
            <StatCard icon={<Play size={14} />} label="Active" value={stats.active_enrollments} color="text-primary" />
            <StatCard icon={<Pause size={14} />} label="Paused" value={stats.paused_enrollments} color="text-warning" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Zap size={14} />} label="Completed" value={stats.completed_enrollments} />
            <StatCard icon={<AlertTriangle size={14} />} label="Escalated" value={stats.escalated_count} color={stats.escalated_count > 0 ? "text-destructive" : undefined} />
            <StatCard icon={<BarChart3 size={14} />} label="Positive" value={stats.positive_replies} color="text-success" />
          </div>

          {/* Quick sequence performance */}
          {seqStats.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sequence Performance</h4>
              {seqStats.map(s => (
                <div key={s.sequence_id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs font-medium text-foreground">{s.sequence_name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{s.active_enrollments} active</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{s.total_messages} sent</span>
                    <span className={`text-xs font-semibold ${s.reply_rate > 20 ? "text-success" : s.reply_rate > 0 ? "text-warning" : "text-muted-foreground"}`}>
                      {s.reply_rate}% reply
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SEQUENCES TAB ── */}
      {tab === "sequences" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{sequences.length} sequence{sequences.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setShowCreate(!showCreate)} className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs gap-1">
              <Plus size={12} /> New Sequence
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3 border border-border">
              <h4 className="text-xs font-semibold text-foreground">Create Sequence</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Name</label>
                  <input value={newSeq.name} onChange={e => setNewSeq(p => ({ ...p, name: e.target.value }))} className="dark-input w-full text-xs" placeholder="Post-Quote Nurture" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Trigger</label>
                  <select value={newSeq.trigger_event} onChange={e => setNewSeq(p => ({ ...p, trigger_event: e.target.value }))} className="dark-input w-full text-xs">
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Max Follow-ups</label>
                  <input type="number" min={1} max={20} value={newSeq.max_follow_ups} onChange={e => setNewSeq(p => ({ ...p, max_follow_ups: parseInt(e.target.value) || 5 }))} className="dark-input w-full text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">On Escalation</label>
                  <select value={newSeq.escalation_action} onChange={e => setNewSeq(p => ({ ...p, escalation_action: e.target.value }))} className="dark-input w-full text-xs">
                    <option value="">None</option>
                    {Object.entries(ESCALATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Steps</label>
                {newSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start bg-background rounded-lg p-2 border border-border/50">
                    <span className="text-[10px] text-muted-foreground font-mono mt-2 shrink-0">#{i + 1}</span>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-2">
                        <select value={step.step_type} onChange={e => { const ns = [...newSteps]; ns[i].step_type = e.target.value; setNewSteps(ns); }} className="dark-input text-xs w-32">
                          <option value="message">Template</option>
                          <option value="ai_generated">AI Generated</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-muted-foreground" />
                          <input type="number" min={0} value={step.delay_minutes} onChange={e => { const ns = [...newSteps]; ns[i].delay_minutes = parseInt(e.target.value) || 0; setNewSteps(ns); }} className="dark-input w-16 text-xs" />
                          <span className="text-[10px] text-muted-foreground">min</span>
                        </div>
                      </div>
                      {step.step_type === "ai_generated" ? (
                        <input value={step.ai_context_prompt} onChange={e => { const ns = [...newSteps]; ns[i].ai_context_prompt = e.target.value; setNewSteps(ns); }} className="dark-input w-full text-xs" placeholder="AI instruction (optional): e.g. mention their budget..." />
                      ) : (
                        <input value={step.message_template} onChange={e => { const ns = [...newSteps]; ns[i].message_template = e.target.value; setNewSteps(ns); }} className="dark-input w-full text-xs" placeholder="Hey {name}, just wanted to check in..." />
                      )}
                    </div>
                    {newSteps.length > 1 && (
                      <button onClick={() => setNewSteps(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive mt-2">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setNewSteps(prev => [...prev, { delay_minutes: 1440, message_template: "", step_type: "message", ai_context_prompt: "" }])} className="dark-btn-ghost text-[10px] h-6 gap-1 w-full border border-dashed border-border hover:border-primary">
                  <Plus size={10} /> Add Step
                </button>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="dark-btn-ghost text-xs h-7">Cancel</button>
                <button onClick={handleCreateSequence} disabled={creating} className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-7">
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create
                </button>
              </div>
            </div>
          )}

          {/* Sequence list */}
          {sequences.map(seq => (
            <div key={seq.id} className="bg-secondary/50 rounded-lg border border-border/50 overflow-hidden">
              <button onClick={() => setExpandedSeq(expandedSeq === seq.id ? null : seq.id)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${seq.is_active ? "bg-success" : "bg-muted-foreground/30"}`} />
                  <span className="text-xs font-medium text-foreground truncate">{seq.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">{TRIGGER_LABELS[seq.trigger_event] || seq.trigger_event}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{seq.steps.length} steps</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={e => { e.stopPropagation(); toggleSequence(seq.id, seq.is_active); }}
                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${seq.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {seq.is_active ? "Active" : "Paused"}
                  </button>
                  {expandedSeq === seq.id ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                </div>
              </button>

              {expandedSeq === seq.id && (
                <div className="border-t border-border/50 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>Max follow-ups: <b className="text-foreground">{seq.max_follow_ups}</b></span>
                    <span>Category: <b className="text-foreground">{seq.category}</b></span>
                    {seq.escalation_action && <span>Escalation: <b className="text-foreground">{ESCALATION_LABELS[seq.escalation_action] || seq.escalation_action}</b></span>}
                  </div>
                  {seq.steps.map(step => (
                    <div key={step.id} className="flex items-center gap-2 bg-background rounded px-2.5 py-1.5 border border-border/30">
                      <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0">#{step.step_order}</span>
                      <Clock size={10} className="text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtDelay(step.delay_minutes)}</span>
                      {step.step_type === "ai_generated" ? (
                        <span className="flex items-center gap-1 text-[10px] text-purple-400"><Brain size={10} /> AI Generated</span>
                      ) : (
                        <span className="text-[10px] text-foreground/80 truncate">{step.message_template || "—"}</span>
                      )}
                      {step.conditions && <span className="text-[9px] px-1 rounded bg-warning/10 text-warning shrink-0">Conditional</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sequences.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">No sequences yet. Create your first follow-up sequence above.</div>
          )}
        </div>
      )}

      {/* ── ENROLLMENTS TAB ── */}
      {tab === "enrollments" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{enrollments.length} active enrollment{enrollments.length !== 1 ? "s" : ""}</span>
            <button onClick={fetchAll} className="dark-btn-ghost text-[10px] h-6 gap-1"><RefreshCw size={10} /> Refresh</button>
          </div>
          {enrollments.map(enr => (
            <div key={enr.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{enr.lead_name || "Unknown Lead"}</span>
                  {enr.paused && <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Paused</span>}
                  {enr.escalated && <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">Escalated</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{enr.sequence_name}</span>
                  <span>Step {enr.current_step}</span>
                  <span>{enr.follow_ups_sent} sent</span>
                  {enr.next_send_at && <span>Next: {fmtDate(enr.next_send_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {enr.paused ? (
                  <button onClick={() => handleEnrollmentAction(enr.id, "resume")} className="dark-btn-ghost h-6 w-6 p-0" title="Resume"><Play size={11} className="text-success" /></button>
                ) : (
                  <button onClick={() => handleEnrollmentAction(enr.id, "pause")} className="dark-btn-ghost h-6 w-6 p-0" title="Pause"><Pause size={11} className="text-warning" /></button>
                )}
                <button onClick={() => handleEnrollmentAction(enr.id, "skip")} className="dark-btn-ghost h-6 w-6 p-0" title="Skip Step"><SkipForward size={11} /></button>
                <button onClick={() => handleEnrollmentAction(enr.id, "cancel")} className="dark-btn-ghost h-6 w-6 p-0" title="Cancel"><X size={11} className="text-destructive" /></button>
              </div>
            </div>
          ))}
          {enrollments.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">No active enrollments</div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === "analytics" && (
        <div className="space-y-3">
          {seqStats.length > 0 ? seqStats.map(s => (
            <div key={s.sequence_id} className="bg-secondary/50 rounded-lg p-3 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{s.sequence_name}</span>
                <span className={`text-sm font-bold ${s.reply_rate > 20 ? "text-success" : s.reply_rate > 0 ? "text-warning" : "text-muted-foreground"}`}>
                  {s.reply_rate}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, s.reply_rate)}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-sm font-semibold text-foreground">{s.total_enrollments}</div>
                  <div className="text-[9px] text-muted-foreground">Enrolled</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{s.total_messages}</div>
                  <div className="text-[9px] text-muted-foreground">Sent</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-success">{s.positive_replies}</div>
                  <div className="text-[9px] text-muted-foreground">Positive</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-destructive">{s.negative_replies}</div>
                  <div className="text-[9px] text-muted-foreground">Negative</div>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-6 text-xs text-muted-foreground">No analytics data yet. Analytics populate as follow-ups are sent.</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Stat Card ── */
const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) => (
  <div className="bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-[10px]">{label}</span></div>
    <div className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</div>
  </div>
);

export default AdvancedFollowUpSection;
