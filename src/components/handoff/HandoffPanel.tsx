import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Plus, X, Play, Shield, Clock, AlertTriangle,
  Save, Check, ChevronDown, ChevronUp, MessageSquare, Users,
} from "lucide-react";

/* ── Types ── */
interface HandoffRule {
  id: string;
  rule_type: string;
  trigger_value: string;
  action: string;
  bridging_message: string | null;
  is_active: boolean;
  priority: number;
}

interface ActiveHandoff {
  lead_id: string;
  lead_name: string | null;
  paused_at: string | null;
  paused_reason: string | null;
  paused_by: string | null;
  conversation_id?: string;
}

interface HandoffSettings {
  auto_resume_minutes: number;
  handoff_bridging_message: string;
}

/* ── Constants ── */
const RULE_TYPES: Record<string, string> = {
  keyword: "Keyword Match",
  topic: "Topic Detection",
  sentiment: "Negative Sentiment",
  explicit_request: "Human Request",
  message_count: "Message Count",
  hot_lead: "Hot Lead Score",
};

const RULE_ICONS: Record<string, React.ReactNode> = {
  keyword: <MessageSquare size={11} />,
  topic: <MessageSquare size={11} />,
  sentiment: <AlertTriangle size={11} />,
  explicit_request: <Users size={11} />,
  message_count: <Clock size={11} />,
  hot_lead: <Shield size={11} />,
};

/* ── Main Component ── */
const HandoffPanel = () => {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<HandoffRule[]>([]);
  const [activeHandoffs, setActiveHandoffs] = useState<ActiveHandoff[]>([]);
  const [settings, setSettings] = useState<HandoffSettings>({ auto_resume_minutes: 30, handoff_bridging_message: "" });
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Create rule state
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ rule_type: "keyword", trigger_value: "", action: "pause_and_notify", bridging_message: "" });
  const [creating, setCreating] = useState(false);

  // Expanded section
  const [expanded, setExpanded] = useState<"active" | "rules" | "settings">("active");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, activeRes, settingsRes] = await Promise.all([
        api.getHandoffRules(),
        api.getActiveHandoffs(),
        api.getHandoffSettings(),
      ]);
      setRules(rulesRes?.data || rulesRes?.rules || []);
      setActiveHandoffs(activeRes?.data || activeRes?.conversations || []);
      setSettings({
        auto_resume_minutes: settingsRes?.auto_resume_minutes ?? 30,
        handoff_bridging_message: settingsRes?.handoff_bridging_message ?? "",
      });
    } catch {
      // Silently fail — endpoints may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Actions ── */
  const handleResume = async (leadId: string) => {
    try {
      await api.resumeBot(leadId);
      toast({ title: "Bot resumed for this lead" });
      fetchAll();
    } catch { toast({ title: "Failed to resume", variant: "destructive" }); }
  };

  const handleCreateRule = async () => {
    if (!newRule.trigger_value.trim() && newRule.rule_type !== "explicit_request") return;
    setCreating(true);
    try {
      await api.createHandoffRule({
        rule_type: newRule.rule_type,
        trigger_value: newRule.trigger_value,
        action: newRule.action,
        bridging_message: newRule.bridging_message || null,
      });
      toast({ title: "Rule created" });
      setShowCreate(false);
      setNewRule({ rule_type: "keyword", trigger_value: "", action: "pause_and_notify", bridging_message: "" });
      fetchAll();
    } catch { toast({ title: "Failed to create rule", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.deleteHandoffRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      toast({ title: "Rule deleted" });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  const handleToggleRule = async (id: string, active: boolean) => {
    try {
      await api.updateHandoffRule(id, { is_active: !active });
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !active } : r));
    } catch { toast({ title: "Failed to toggle rule", variant: "destructive" }); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.updateHandoffSettings(settings);
      setSettingsDirty(false);
      toast({ title: "Settings saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSavingSettings(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>;

  return (
    <div className="space-y-2 p-3">
      {/* ── Active Handoffs ── */}
      <SectionToggle label="Active Handoffs" count={activeHandoffs.length} open={expanded === "active"} onClick={() => setExpanded(expanded === "active" ? "rules" : "active")} color={activeHandoffs.length > 0 ? "text-warning" : undefined} />
      {expanded === "active" && (
        <div className="space-y-1.5">
          {activeHandoffs.length > 0 ? activeHandoffs.map(h => (
            <div key={h.lead_id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-2.5 py-2 border border-border/50">
              <div className="min-w-0">
                <span className="text-xs font-medium text-foreground truncate block">{h.lead_name || "Unknown"}</span>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {h.paused_reason && <span className="truncate max-w-[120px]">{h.paused_reason}</span>}
                  {h.paused_at && <span>{new Date(h.paused_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              </div>
              <button onClick={() => handleResume(h.lead_id)} className="dark-btn bg-success/15 text-success hover:bg-success/25 h-6 text-[10px] px-2 gap-1 shrink-0">
                <Play size={10} /> Resume
              </button>
            </div>
          )) : (
            <div className="text-center py-3 text-[10px] text-muted-foreground">No active handoffs — bot is running for all conversations</div>
          )}
        </div>
      )}

      {/* ── Handoff Rules ── */}
      <SectionToggle label="Trigger Rules" count={rules.length} open={expanded === "rules"} onClick={() => setExpanded(expanded === "rules" ? "active" : "rules")} />
      {expanded === "rules" && (
        <div className="space-y-1.5">
          <button onClick={() => setShowCreate(!showCreate)} className="w-full dark-btn-ghost text-[10px] h-6 gap-1 border border-dashed border-border hover:border-primary">
            <Plus size={10} /> Add Rule
          </button>

          {showCreate && (
            <div className="bg-secondary/50 rounded-lg p-2.5 space-y-2 border border-border">
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Type</label>
                  <select value={newRule.rule_type} onChange={e => setNewRule(p => ({ ...p, rule_type: e.target.value }))} className="dark-input w-full text-[10px] h-7">
                    {Object.entries(RULE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Trigger Value</label>
                  <input value={newRule.trigger_value} onChange={e => setNewRule(p => ({ ...p, trigger_value: e.target.value }))} className="dark-input w-full text-[10px] h-7" placeholder={newRule.rule_type === "keyword" ? "price, cost, discount" : newRule.rule_type === "message_count" ? "10" : "value..."} />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground block mb-0.5">Bridging Message (optional)</label>
                <input value={newRule.bridging_message} onChange={e => setNewRule(p => ({ ...p, bridging_message: e.target.value }))} className="dark-input w-full text-[10px] h-7" placeholder="Let me get my colleague for you..." />
              </div>
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setShowCreate(false)} className="dark-btn-ghost text-[10px] h-6">Cancel</button>
                <button onClick={handleCreateRule} disabled={creating} className="dark-btn bg-primary text-primary-foreground text-[10px] h-6 px-2">
                  {creating ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Create
                </button>
              </div>
            </div>
          )}

          {rules.map(rule => (
            <div key={rule.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-2.5 py-1.5 border border-border/50">
              <div className="text-muted-foreground shrink-0">{RULE_ICONS[rule.rule_type] || <Shield size={11} />}</div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-medium text-foreground">{RULE_TYPES[rule.rule_type] || rule.rule_type}</span>
                {rule.trigger_value && <span className="text-[10px] text-muted-foreground ml-1">"{rule.trigger_value}"</span>}
              </div>
              <button onClick={() => handleToggleRule(rule.id, rule.is_active)} className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${rule.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {rule.is_active ? "On" : "Off"}
              </button>
              <button onClick={() => handleDeleteRule(rule.id)} className="text-muted-foreground hover:text-destructive shrink-0"><X size={11} /></button>
            </div>
          ))}

          {rules.length === 0 && !showCreate && (
            <div className="text-center py-2 text-[10px] text-muted-foreground">No rules configured</div>
          )}
        </div>
      )}

      {/* ── Settings ── */}
      <SectionToggle label="Settings" open={expanded === "settings"} onClick={() => setExpanded(expanded === "settings" ? "active" : "settings")} />
      {expanded === "settings" && (
        <div className="space-y-2 bg-secondary/50 rounded-lg p-2.5 border border-border/50">
          <div>
            <label className="text-[9px] text-muted-foreground block mb-0.5">Auto-resume after (minutes)</label>
            <input type="number" min={5} max={480} value={settings.auto_resume_minutes} onChange={e => { setSettings(p => ({ ...p, auto_resume_minutes: parseInt(e.target.value) || 30 })); setSettingsDirty(true); }} className="dark-input w-20 text-[10px] h-7" />
            <p className="text-[9px] text-muted-foreground mt-0.5">Bot auto-resumes if owner doesn't respond in time</p>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground block mb-0.5">Default bridging message</label>
            <input value={settings.handoff_bridging_message} onChange={e => { setSettings(p => ({ ...p, handoff_bridging_message: e.target.value })); setSettingsDirty(true); }} className="dark-input w-full text-[10px] h-7" placeholder="Let me connect you with someone who can help..." />
          </div>
          {settingsDirty && (
            <button onClick={handleSaveSettings} disabled={savingSettings} className="dark-btn bg-primary text-primary-foreground text-[10px] h-6 px-2 gap-1">
              {savingSettings ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Section Toggle Header ── */
const SectionToggle = ({ label, count, open, onClick, color }: { label: string; count?: number; open: boolean; onClick: () => void; color?: string }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between bg-secondary/30 rounded px-2.5 py-1.5 hover:bg-secondary/60 transition-colors">
    <div className="flex items-center gap-1.5">
      <span className={`text-[11px] font-semibold ${color || "text-foreground"}`}>{label}</span>
      {count !== undefined && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{count}</span>}
    </div>
    {open ? <ChevronUp size={11} className="text-muted-foreground" /> : <ChevronDown size={11} className="text-muted-foreground" />}
  </button>
);

export default HandoffPanel;
