import { useEffect, useState } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Field {
  id: string;
  field_name: string;
  field_key: string;
  field_type: string;
  units?: string;
  required: boolean;
  scoring_weight: number;
  display_order: number;
  validation_rules?: any;
}

const emptyField = {
  field_name: "",
  field_key: "",
  field_type: "text",
  units: "",
  required: false,
  scoring_weight: 0,
  display_order: 0,
  validation_rules: "",
};

const Fields = () => {
  const companyId = requireCompanyId();
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyField);
  const [saving, setSaving] = useState(false);

  const fetchFields = () => {
    setLoading(true);
    api.getFields(companyId)
      .then((res) => setFields(res.data || res.fields || res || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFields(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyField);
    setShowModal(true);
  };

  const openEdit = (f: Field) => {
    setEditingId(f.id);
    setForm({
      field_name: f.field_name,
      field_key: f.field_key,
      field_type: f.field_type,
      units: f.units || "",
      required: f.required,
      scoring_weight: f.scoring_weight,
      display_order: f.display_order,
      validation_rules: f.validation_rules ? JSON.stringify(f.validation_rules, null, 2) : "",
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this field?")) return;
    api.deleteField(companyId, id).then(fetchFields).catch(() => {});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let validationRules = undefined;
    if (form.validation_rules) {
      try { validationRules = JSON.parse(form.validation_rules); }
      catch { alert("Invalid JSON in validation rules"); setSaving(false); return; }
    }

    const payload = {
      field_name: form.field_name,
      field_key: form.field_key,
      field_type: form.field_type,
      units: form.units || undefined,
      required: form.required,
      scoring_weight: Number(form.scoring_weight),
      display_order: Number(form.display_order),
      validation_rules: validationRules,
    };

    const action = editingId
      ? api.patchField(companyId, editingId, payload)
      : api.createField(companyId, payload);

    action
      .then(() => { setShowModal(false); fetchFields(); })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Fields</h1>
        <button onClick={openCreate} className="industrial-btn-accent">
          <Plus size={16} /> New Field
        </button>
      </div>

      <div className="industrial-card overflow-hidden">
        <table className="industrial-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Type</th>
              <th>Required</th>
              <th>Weight</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
            ) : fields.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No fields configured</td></tr>
            ) : (
              fields.map((f) => (
                <tr key={f.id}>
                  <td className="font-medium">{f.field_name}</td>
                  <td className="font-mono text-xs">{f.field_key}</td>
                  <td className="font-mono text-xs">{f.field_type}</td>
                  <td>{f.required ? "Yes" : "No"}</td>
                  <td className="font-mono">{f.scoring_weight}</td>
                  <td className="font-mono">{f.display_order}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(f)} className="industrial-btn-ghost p-1.5">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="industrial-btn-ghost p-1.5 text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
          <div className="industrial-card w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editingId ? "Edit" : "Create"} Field</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Field Name</label>
                  <input value={form.field_name} onChange={(e) => setForm({...form, field_name: e.target.value})} className="industrial-input w-full" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Field Key</label>
                  <input value={form.field_key} onChange={(e) => setForm({...form, field_key: e.target.value})} className="industrial-input w-full" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Type</label>
                  <select value={form.field_type} onChange={(e) => setForm({...form, field_type: e.target.value})} className="industrial-input w-full">
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="select">select</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Units</label>
                  <input value={form.units} onChange={(e) => setForm({...form, units: e.target.value})} className="industrial-input w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Scoring Weight</label>
                  <input type="number" value={form.scoring_weight} onChange={(e) => setForm({...form, scoring_weight: Number(e.target.value)})} className="industrial-input w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Display Order</label>
                  <input type="number" value={form.display_order} onChange={(e) => setForm({...form, display_order: Number(e.target.value)})} className="industrial-input w-full" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="req" checked={form.required} onChange={(e) => setForm({...form, required: e.target.checked})} />
                <label htmlFor="req" className="text-sm">Required</label>
              </div>
              <div>
                <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Validation Rules (JSON)</label>
                <textarea value={form.validation_rules} onChange={(e) => setForm({...form, validation_rules: e.target.value})} className="industrial-input w-full h-24 font-mono text-xs" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="industrial-btn-ghost">Cancel</button>
                <button type="submit" disabled={saving} className="industrial-btn-accent">
                  {saving ? "Saving…" : editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fields;
