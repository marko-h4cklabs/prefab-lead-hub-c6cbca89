import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

const CompanyInfoSection = () => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef({ websiteUrl: "", businessDescription: "", additionalNotes: "" });

  useEffect(() => {
    api.getCompanyInfo()
      .then((res) => {
        const w = res.website_url || "";
        const b = res.business_description || "";
        const n = res.additional_notes || "";
        setWebsiteUrl(w);
        setBusinessDescription(b);
        setAdditionalNotes(n);
        initialRef.current = { websiteUrl: w, businessDescription: b, additionalNotes: n };
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const checkDirty = (w: string, b: string, n: string) => {
    const init = initialRef.current;
    setIsDirty(w !== init.websiteUrl || b !== init.businessDescription || n !== init.additionalNotes);
  };

  const handleSave = () => {
    setSaving(true);
    api.putCompanyInfo({ website_url: websiteUrl, business_description: businessDescription, additional_notes: additionalNotes })
      .then(() => {
        toast({ title: "Saved", description: "Company info updated." });
        initialRef.current = { websiteUrl, businessDescription, additionalNotes };
        setIsDirty(false);
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const normalizeUrl = (url: string): string | null => {
    let v = url.trim();
    if (!v) return null;
    if (v.startsWith("//")) v = `https:${v}`;
    else if (!v.startsWith("http://") && !v.startsWith("https://")) v = `https://${v}`;
    try { new URL(v); return v; } catch { return null; }
  };

  const handleScrape = async () => {
    const normalized = normalizeUrl(websiteUrl);
    if (!normalized) {
      toast({ title: "Error", description: "Website URL is required and must be valid.", variant: "destructive" });
      return;
    }
    setScraping(true);
    try {
      if (isDirty) {
        await api.putCompanyInfo({ website_url: websiteUrl, business_description: businessDescription, additional_notes: additionalNotes });
        initialRef.current = { websiteUrl, businessDescription, additionalNotes };
        setIsDirty(false);
      }
      await api.scrapeCompanyInfo({ website_url: normalized });
      toast({ title: "Scrape queued", description: "Website content will be processed shortly." });
    } catch { /* errors handled by apiClient */ }
    finally { setScraping(false); }
  };

  const isValidUrl = (() => {
    try {
      if (!websiteUrl.trim()) return false;
      new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
      return true;
    } catch { return false; }
  })();

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="industrial-card p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider">Company Info</h2>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Website Link</label>
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => { setWebsiteUrl(e.target.value); checkDirty(e.target.value, businessDescription, additionalNotes); }}
          className="industrial-input w-full"
          placeholder="https://example.com"
        />
        <p className="mt-1 text-xs text-muted-foreground">Website content will be used as the chatbot knowledge base.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Business Description</label>
        <textarea
          value={businessDescription}
          onChange={(e) => { setBusinessDescription(e.target.value); checkDirty(websiteUrl, e.target.value, additionalNotes); }}
          className="industrial-input w-full h-24"
          placeholder="Describe your business…"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Additional Notes</label>
        <textarea
          value={additionalNotes}
          onChange={(e) => { setAdditionalNotes(e.target.value); checkDirty(websiteUrl, businessDescription, e.target.value); }}
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
          <Save size={16} /> {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={handleScrape}
          disabled={!isValidUrl || scraping}
          className="industrial-btn-primary"
        >
          {scraping ? <Loader2 size={16} className="animate-spin" /> : null}
          {scraping ? "Scraping…" : "Request website scrape"}
        </button>
      </div>
    </div>
  );
};

export default CompanyInfoSection;
