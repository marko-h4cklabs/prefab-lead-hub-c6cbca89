import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Plus, Pencil, Trash2, Copy, Loader2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) { if (Array.isArray((payload as any)[k])) return (payload as any)[k]; }
  }
  return [];
}

const CATEGORIES = ["all", "greeting", "follow_up", "objection_handling", "closing", "custom"];

const TemplatesSection = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "greeting", content: "" });

  const fetchTemplates = () => {
    api.getTemplates()
      .then((res) => setTemplates(normalizeList(res, ["templates", "data"])))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  const filtered = filter === "all" ? templates : templates.filter(t => t.category === filter);

  const openAdd = () => { setEditing(null); setForm({ name: "", category: "greeting", content: "" }); setModalOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ name: t.name || "", category: t.category || "greeting", content: t.content || "" }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.updateTemplate(editing.id, form);
      else await api.createTemplate(form);
      toast({ title: editing ? "Template updated" : "Template created" });
      setModalOpen(false);
      fetchTemplates();
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try { await api.deleteTemplate(id); toast({ title: "Template deleted" }); fetchTemplates(); } catch (err) { toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" }); }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  // Highlight {variable_name} patterns in preview
  const highlightVars = (text: string) => {
    return text.replace(/\{(\w+)\}/g, '<span class="text-primary font-semibold">{$1}</span>');
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2"><FileText size={16} className="text-primary" /> Message Templates</h2>
        <button onClick={openAdd} className="dark-btn-primary text-xs"><Plus size={12} /> Add Template</button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors ${filter === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {c === "all" ? "All" : c.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? <div className="text-xs text-muted-foreground">Loading…</div> : filtered.length === 0 ? (
        <div className="text-center py-6">
          <FileText size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="rounded-lg bg-secondary p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{t.name}</span>
                  <span className="status-badge text-[10px] bg-card text-muted-foreground capitalize">{(t.category || "custom").replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleCopy(t.content)} className="dark-btn-ghost text-xs p-1"><Copy size={12} /></button>
                  <button onClick={() => openEdit(t)} className="dark-btn-ghost text-xs p-1"><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(t.id)} className="dark-btn-ghost text-xs p-1 text-destructive"><Trash2 size={12} /></button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: highlightVars(t.content || "") }} />
              {t.use_count !== undefined && <p className="text-[10px] text-muted-foreground">Used {t.use_count} times</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Template" : "Add Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="dark-input w-full" placeholder="Template name" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} className="dark-input w-full">
                {CATEGORIES.filter(c => c !== "all").map(c => <option key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Content *</label>
              <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} className="dark-input w-full min-h-[120px] resize-y" placeholder="Type your template message here. Use {variable_name} for dynamic values." />
              {form.content.includes("{") && (
                <p className="mt-1 text-[10px] text-primary">Variables detected: {(form.content.match(/\{(\w+)\}/g) || []).join(", ")}</p>
              )}
            </div>
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.content.trim()} className="w-full dark-btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesSection;
