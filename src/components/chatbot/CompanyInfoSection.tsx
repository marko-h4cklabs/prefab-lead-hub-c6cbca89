import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

interface Props {
  onScrapeComplete?: () => void;
}

const CompanyInfoSection = ({ onScrapeComplete }: Props) => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Scrape status: null | queued | running | summarizing | done/finished | error/failed
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const initialRef = useRef({ websiteUrl: "", businessDescription: "", additionalNotes: "" });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number>(0);

  // Normalize backend status to consistent values
  const normalizeStatus = (s: string | null): string | null => {
    if (!s) return null;
    if (s === "finished") return "done";
    if (s === "failed") return "error";
    return s;
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Apply fetched company info to state — does NOT overwrite businessDescription during polling
  const applyCompanyInfo = useCallback((res: any, isPolling = false) => {
    const w = res.website_url || "";
    const b = res.business_description || "";
    const n = res.additional_notes || "";
    const status = normalizeStatus(res.scrape_status || null);
    const error = res.scrape_error || null;
    const summary = res.scraped_summary || res.business_description || "";

    setWebsiteUrl(w);
    setAdditionalNotes(n);
    setScrapeStatus(status);
    setScrapeError(error);

    if (isPolling) {
      // During polling: only auto-fill business description when scrape finishes and field is empty
      if (status === "done" && summary) {
        setBusinessDescription((prev) => {
          const val = prev || summary;
          initialRef.current = { websiteUrl: w, businessDescription: val, additionalNotes: n };
          return val;
        });
      }
      // Don't update initialRef for other polling states to avoid resetting dirty
    } else {
      // Initial load: set everything
      setBusinessDescription(b);
      initialRef.current = { websiteUrl: w, businessDescription: b, additionalNotes: n };
      setIsDirty(false);
    }

    return { status };
  }, []);

  // Start polling GET /api/chatbot/company-info every 4s
  const startPolling = useCallback(() => {
    stopPolling();
    pollingStartRef.current = Date.now();

    pollingRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollingStartRef.current;
      if (elapsed > 60_000) {
        stopPolling();
        setScraping(false);
        toast({ title: "Still processing", description: "Refresh in a moment." });
        return;
      }
      try {
        const res = await api.getCompanyInfo();
        const { status } = applyCompanyInfo(res, true);

        if (status === "done") {
          stopPolling();
          setScraping(false);
          toast({ title: "Scrape complete", description: "Business description updated." });
          onScrapeComplete?.();
        } else if (status === "error") {
          stopPolling();
          setScraping(false);
          toast({ title: "Scrape failed", description: res.scrape_error || "Unknown error", variant: "destructive" });
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000);
  }, [stopPolling, applyCompanyInfo, onScrapeComplete]);

  useEffect(() => {
    api.getCompanyInfo()
      .then((res) => {
        const { status } = applyCompanyInfo(res, false);
        if (status === "queued" || status === "running" || status === "summarizing") {
          setScraping(true);
          startPolling();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setScrapeStatus("queued");
    setScrapeError(null);
    try {
      if (isDirty) {
        await api.putCompanyInfo({ website_url: websiteUrl, business_description: businessDescription, additional_notes: additionalNotes });
        initialRef.current = { websiteUrl, businessDescription, additionalNotes };
        setIsDirty(false);
      }
      await api.scrapeCompanyInfo({ website_url: normalized });
      toast({ title: "Scrape queued", description: "Website content will be processed shortly." });
      startPolling();
    } catch {
      setScraping(false);
      setScrapeStatus(null);
    }
  };

  const isValidUrl = (() => {
    try {
      if (!websiteUrl.trim()) return false;
      new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
      return true;
    } catch { return false; }
  })();

  const isScrapeInProgress = scrapeStatus === "queued" || scrapeStatus === "running" || scrapeStatus === "summarizing";
  const hasWebsite = websiteUrl.trim().length > 0;

  // Business description disabled until: website exists AND scrape is done
  const descriptionDisabled = !hasWebsite || isScrapeInProgress || scrapeStatus === "error" || (scrapeStatus !== "done" && scrapeStatus !== null);

  // Status label text for near-button indicator
  const statusLabel = (() => {
    if (scrapeStatus === "queued") return "queued";
    if (scrapeStatus === "running") return "running";
    if (scrapeStatus === "summarizing") return "running";
    if (scrapeStatus === "done") return "finished";
    if (scrapeStatus === "error") return "failed";
    return null;
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
          placeholder={descriptionDisabled ? "" : "Describe your business…"}
          disabled={descriptionDisabled}
          readOnly={descriptionDisabled}
        />
        {!hasWebsite && (
          <p className="mt-1 text-xs text-muted-foreground">Add website URL and run scrape to generate this.</p>
        )}
        {isScrapeInProgress && (
          <p className="mt-1 text-xs text-accent-foreground flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Scrape in progress: {scrapeStatus}
          </p>
        )}
        {scrapeStatus === "error" && scrapeError && (
          <p className="mt-1 text-xs text-destructive">{scrapeError}</p>
        )}
        {scrapeStatus === "error" && !scrapeError && (
          <p className="mt-1 text-xs text-destructive">Scrape failed. Try again.</p>
        )}
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
          disabled={!isValidUrl || isScrapeInProgress}
          className="industrial-btn-primary"
        >
          {isScrapeInProgress ? <Loader2 size={16} className="animate-spin" /> : null}
          {isScrapeInProgress ? "Scraping…" : scrapeStatus === "error" ? "Retry scrape" : "Request website scrape"}
        </button>
        {statusLabel && (
          <span className={`text-xs font-mono uppercase tracking-wider ${scrapeStatus === "error" ? "text-destructive" : scrapeStatus === "done" ? "text-accent-foreground" : "text-muted-foreground"}`}>
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default CompanyInfoSection;
