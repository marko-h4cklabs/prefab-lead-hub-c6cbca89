import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

const CompanyInfoSection = () => {
  const [businessDescription, setBusinessDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const initialRef = useRef({ businessDescription: "", additionalNotes: "" });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    api.getCompanyInfo()
      .then((res) => {
        if (!mountedRef.current) return;
        const b = res.business_description || "";
        const n = res.additional_notes || "";
        setBusinessDescription(b);
        setAdditionalNotes(n);
        initialRef.current = { businessDescription: b, additionalNotes: n };
        setIsDirty(false);
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, []);

  const checkDirty = (b: string, n: string) => {
    const init = initialRef.current;
    setIsDirty(b !== init.businessDescription || n !== init.additionalNotes);
  };

  const handleSave = () => {
    setSaving(true);
    api.putCompanyInfo({ business_description: businessDescription, additional_notes: additionalNotes })
      .then(() => {
        toast({ title: "Saved", description: "Company info updated." });
        initialRef.current = { businessDescription, additionalNotes };
        setIsDirty(false);
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="industrial-card p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider">Company Info</h2>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Business Description</label>
        <textarea
          value={businessDescription}
          onChange={(e) => { setBusinessDescription(e.target.value); checkDirty(e.target.value, additionalNotes); }}
          className="industrial-input w-full h-24"
          placeholder="Describe your business…"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Additional Notes</label>
        <textarea
          value={additionalNotes}
          onChange={(e) => { setAdditionalNotes(e.target.value); checkDirty(businessDescription, e.target.value); }}
          className="industrial-input w-full h-24"
          placeholder="Any extra context for the chatbot…"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={isDirty ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};

export default CompanyInfoSection;
