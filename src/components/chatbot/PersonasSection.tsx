import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Plus, Pencil, Trash2, Loader2, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) { if (Array.isArray((payload as any)[k])) return (payload as any)[k]; }
  }
  return [];
}

const TONES = ["professional", "friendly", "direct"];

const PersonasSection = () => {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", agent_name: "", tone: "professional", opener_style: "greeting", system_prompt: "" });

  const fetch = () => {
    api.getPersonas()
      .then((res) => setPersonas(normalizeList(res, ["personas", "data"])))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", agent_name: "", tone: "professional", opener_style: "greeting", system_prompt: "" }); setModalOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name || "", agent_name: p.agent_name || "", tone: p.tone || "professional", opener_style: p.opener_style || "greeting", system_prompt: p.system_prompt || "" }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.updatePersona(editing.id, form);
      else await api.createPersona(form);
      toast({ title: editing ? "Persona updated" : "Persona created" });
      setModalOpen(false);
      fetch();
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this persona?")) return;
    try { await api.deletePersona(id); toast({ title: "Persona deleted" }); fetch(); } catch (err) { toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" }); }
  };

  const handleActivate = async (id: string) => {
    try { await api.activatePersona(id); toast({ title: "Persona activated" }); fetch(); } catch (err) { toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" }); }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2"><UserCircle size={16} className="text-primary" /> AI Personas</h2>
        <button onClick={openAdd} className="dark-btn-primary text-xs"><Plus size={12} /> Add Persona</button>
      </div>

      {loading ? <div className="text-xs text-muted-foreground">Loading…</div> : personas.length === 0 ? (
        <div className="text-center py-6">
          <UserCircle size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No personas yet. Create one to customize your AI's behavior.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((p) => (
            <div key={p.id} className="rounded-lg bg-secondary p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{p.name}</span>
                  {p.active && <span className="status-badge text-[10px] bg-success/15 text-success">Active</span>}
                </div>
                <div className="flex items-center gap-1">
                  {!p.active && <button onClick={() => handleActivate(p.id)} className="dark-btn text-[10px] bg-primary text-primary-foreground px-2 py-0.5">Activate</button>}
                  <button onClick={() => openEdit(p)} className="dark-btn-ghost text-xs p-1"><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(p.id)} disabled={p.active} className="dark-btn-ghost text-xs p-1 text-destructive disabled:opacity-30"><Trash2 size={12} /></button>
                </div>
              </div>
              {p.agent_name && <p className="text-xs text-muted-foreground">Agent: {p.agent_name}</p>}
              <span className="status-badge text-[10px] bg-secondary text-muted-foreground capitalize">{p.tone || "professional"}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Persona" : "Add Persona"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Persona Name *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="dark-input w-full" placeholder="e.g. Sales Pro" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Agent Name</label>
              <input value={form.agent_name} onChange={(e) => setForm(f => ({ ...f, agent_name: e.target.value }))} className="dark-input w-full" placeholder="e.g. Alex" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tone</label>
              <select value={form.tone} onChange={(e) => setForm(f => ({ ...f, tone: e.target.value }))} className="dark-input w-full">
                {TONES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Opener Style</label>
              <div className="flex gap-2">
                {["greeting", "question", "statement"].map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, opener_style: s }))} className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${form.opener_style === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">System Prompt</label>
              <textarea value={form.system_prompt} onChange={(e) => setForm(f => ({ ...f, system_prompt: e.target.value }))} className="dark-input w-full min-h-[120px] resize-y" placeholder="Write custom instructions for this persona. This overrides the default behavior settings." />
            </div>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full dark-btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonasSection;
