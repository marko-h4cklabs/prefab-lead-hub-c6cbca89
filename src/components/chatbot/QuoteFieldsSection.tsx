import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Plus, Trash2 } from "lucide-react";

interface QuoteField {
  field_name: string;
  field_type: string;
  units: string;
  priority: number;
  required: boolean;
}

const emptyField: QuoteField = {
  field_name: "",
  field_type: "text",
  units: "",
  priority: 0,
  required: true,
};

const QuoteFieldsSection = () => {
  const [fields, setFields] = useState<QuoteField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getQuoteFields()
      .then((res) => {
        const data = res.fields || res.data || res || [];
        setFields(
          Array.isArray(data)
            ? data.map((f: any) => ({
                field_name: f.field_name || "",
                field_type: f.field_type || "text",
                units: f.units || "",
                priority: f.priority ?? f.display_order ?? 0,
                required: f.required ?? true,
              }))
            : []
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    const sorted = [...fields].sort((a, b) => a.priority - b.priority);
    api.putQuoteFields({ fields: sorted })
      .then(() => toast({ title: "Saved", description: "Quote fields updated." }))
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const addField = () => {
    const maxPriority = fields.reduce((max, f) => Math.max(max, f.priority), 0);
    setFields([...fields, { ...emptyField, priority: maxPriority + 1 }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<QuoteField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="industrial-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider">Quote Requirements</h2>
        <button onClick={addField} className="industrial-btn-primary text-xs">
          <Plus size={14} /> Add Field
        </button>
      </div>

      <div className="overflow-hidden">
        <table className="industrial-table">
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Type</th>
              <th>Units</th>
              <th>Priority</th>
              <th>Required</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No quote fields configured. Click "Add Field" to start.
                </td>
              </tr>
            ) : (
              fields.map((f, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={f.field_name}
                      onChange={(e) => updateField(i, { field_name: e.target.value })}
                      className="industrial-input w-full"
                      placeholder="Field name"
                    />
                  </td>
                  <td>
                    <select
                      value={f.field_type}
                      onChange={(e) => updateField(i, { field_type: e.target.value })}
                      className="industrial-input w-full"
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="select">select</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={f.units}
                      onChange={(e) => updateField(i, { units: e.target.value })}
                      className="industrial-input w-full"
                      placeholder="e.g. kg, m²"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={f.priority}
                      onChange={(e) => updateField(i, { priority: Number(e.target.value) })}
                      className="industrial-input w-16"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => updateField(i, { required: !f.required })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        f.required ? "bg-accent" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-card transition-transform ${
                        f.required ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </td>
                  <td>
                    <button onClick={() => removeField(i)} className="industrial-btn-ghost p-1.5 text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button onClick={handleSave} disabled={saving} className="industrial-btn-accent">
        <Save size={16} /> {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
};

export default QuoteFieldsSection;
