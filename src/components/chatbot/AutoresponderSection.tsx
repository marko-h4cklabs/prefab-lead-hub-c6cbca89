import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Plus, Pencil, Trash2, Loader2, Zap, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) { if (Array.isArray((payload as any)[k])) return (payload as any)[k]; }
  }
  return [];
}

const TRIGGER_TYPES = [
  { value: "keyword", label: "Message contains keyword" },
  { value: "first_message", label: "First message ever" },
  { value: "intent_score", label: "Intent score above" },
  { value: "budget_detected", label: "Budget detected" },
  { value: "no_reply", label: "No reply for X hours" },
];

const ACTION_TYPES = [
  { value: "send_message", label: "Send message" },
  { value: "assign_setter", label: "Assign to setter" },
  { value: "move_stage", label: "Move pipeline stage" },
  { value: "send_template", label: "Send template" },
  { value: "notify_team", label: "Notify team" },
];

const AutoresponderSection = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", trigger_type: "keyword", trigger_value: "",
    action_type: "send_message", action_value: "", active: true,
  });

  const fetchRules = () => {
    api.getAutoresponderRules()
      .then((res) => {
        const list = normalizeList(res, ["rules", "data"]);
        setRules(list);
        if (typeof res?.enabled === "boolean") setGlobalEnabled(res.enabled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRules(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", trigger_type: "keyword", trigger_value: "", action_type: "send_message", action_value: "", active: true }); setModalOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ name: r.name || "", trigger_type: r.trigger_type || "keyword", trigger_value: r.trigger_value || "", action_type: r.action_type || "send_message", action_value: r.action_value || "", active: r.active !== false }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.updateAutoresponderRule(editing.id, form);
      else await api.createAutoresponderRule(form);
      toast({ title: editing ? "Rule updated" : "Rule created" });
      setModalOpen(false);
      fetchRules();
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try { await api.deleteAutoresponderRule(id); toast({ title: "Rule deleted" }); fetchRules(); } catch (err) { toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" }); }
  };

  const handleToggleGlobal = async () => {
    const newVal = !globalEnabled;
    setGlobalEnabled(newVal);
    try { await api.toggleAutoresponder(newVal); } catch { setGlobalEnabled(!newVal); }
  };

  const handleToggleRule = async (rule: any) => {
    const newActive = !rule.active;
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: newActive } : r));
    try { await api.updateAutoresponderRule(rule.id, { active: newActive }); } catch { setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !newActive } : r)); }
  };

  const triggerNeedsValue = (type: string) => !["first_message", "budget_detected"].includes(type);
  const actionNeedsValue = (type: string) => !["notify_team"].includes(type);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2"><Zap size={16} className="text-primary" /> Autoresponder Rules</h2>
        <div className="flex items-center gap-3">
          <button onClick={handleToggleGlobal} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${globalEnabled ? "bg-primary" : "bg-secondary"}`}>
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-foreground transition-transform ${globalEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
          </button>
          <button onClick={openAdd} className="dark-btn-primary text-xs"><Plus size={12} /> Add Rule</button>
        </div>
      </div>

      {loading ? <div className="text-xs text-muted-foreground">Loading…</div> : rules.length === 0 ? (
        <div className="text-center py-6">
          <Zap size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No autoresponder rules yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r, i) => (
            <div key={r.id} className={`rounded-lg bg-secondary p-3 flex items-center gap-3 ${!globalEnabled ? "opacity-50" : ""}`}>
              <GripVertical size={14} className="text-muted-foreground shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{r.name}</span>
                  <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-info">When:</span> {TRIGGER_TYPES.find(t => t.value === r.trigger_type)?.label || r.trigger_type}
                  {r.trigger_value ? ` "${r.trigger_value}"` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-success">Then:</span> {ACTION_TYPES.find(a => a.value === r.action_type)?.label || r.action_type}
                  {r.action_value ? `: ${r.action_value}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleToggleRule(r)} className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${r.active ? "bg-success" : "bg-muted"}`}>
                  <span className={`inline-block h-3 w-3 rounded-full bg-foreground transition-transform ${r.active ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </button>
                <button onClick={() => openEdit(r)} className="dark-btn-ghost p-1"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(r.id)} className="dark-btn-ghost p-1 text-destructive"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Rule" : "Add Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Rule Name *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="dark-input w-full" placeholder="e.g. Auto-qualify high intent" />
            </div>
            <div className="dark-card p-4 space-y-3">
              <h3 className="text-xs font-bold text-info uppercase tracking-wider">Trigger</h3>
              <select value={form.trigger_type} onChange={(e) => setForm(f => ({ ...f, trigger_type: e.target.value }))} className="dark-input w-full">
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {triggerNeedsValue(form.trigger_type) && (
                <input value={form.trigger_value} onChange={(e) => setForm(f => ({ ...f, trigger_value: e.target.value }))} className="dark-input w-full" placeholder={form.trigger_type === "keyword" ? "Enter keyword…" : form.trigger_type === "intent_score" ? "e.g. 70" : "e.g. 24"} />
              )}
            </div>
            <div className="dark-card p-4 space-y-3">
              <h3 className="text-xs font-bold text-success uppercase tracking-wider">Action</h3>
              <select value={form.action_type} onChange={(e) => setForm(f => ({ ...f, action_type: e.target.value }))} className="dark-input w-full">
                {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              {actionNeedsValue(form.action_type) && (
                <input value={form.action_value} onChange={(e) => setForm(f => ({ ...f, action_value: e.target.value }))} className="dark-input w-full" placeholder="Value…" />
              )}
            </div>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full dark-btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Rule
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoresponderSection;
