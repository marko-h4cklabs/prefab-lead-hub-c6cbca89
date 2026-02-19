import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, X } from "lucide-react";

interface Props {
  onScrapeComplete?: () => void;
}

type ScrapeStatus = "idle" | "queued" | "running" | "summarizing" | "finished" | "failed";

const normalizeStatus = (s: string | null | undefined): ScrapeStatus => {
  if (!s) return "idle";
  if (s === "done" || s === "finished") return "finished";
  if (s === "error" || s === "failed") return "failed";
  if (s === "queued" || s === "running" || s === "summarizing") return s;
  return "idle";
};

const CompanyInfoSection = ({ onScrapeComplete }: Props) => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>("idle");
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const initialRef = useRef({ websiteUrl: "", businessDescription: "", additionalNotes: "" });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  const checkDirty = useCallback((w: string, b: string, n: string) => {
    const init = initialRef.current;
    setIsDirty(w !== init.websiteUrl || b !== init.businessDescription || n !== init.additionalNotes);
  }, []);

  // Initial load — fetch data, do NOT start polling or scrape
  useEffect(() => {
    api.getCompanyInfo()
      .then((res) => {
        if (!mountedRef.current) return;
        const w = res.website_url || "";
        const b = res.business_description || "";
        const n = res.additional_notes || "";
        const status = normalizeStatus(res.scrape_status);
        const error = res.scrape_error || null;

        setWebsiteUrl(w);
        setBusinessDescription(b);
        setAdditionalNotes(n);
        setScrapeStatus(status);
        setScrapeError(error);
        initialRef.current = { websiteUrl: w, businessDescription: b, additionalNotes: n };
        setIsDirty(false);

        // Resume polling ONLY if backend says scrape is actively in progress
        if (status === "queued" || status === "running" || status === "summarizing") {
          startPolling();
        }
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingStartRef.current = Date.now();

    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current) { stopPolling(); return; }

      const elapsed = Date.now() - pollingStartRef.current;
      if (elapsed > 60_000) {
        stopPolling();
        setScrapeStatus("idle");
        toast({ title: "Still processing", description: "Refresh in a moment." });
        return;
      }

      try {
        const res = await api.getCompanyInfo();
        if (!mountedRef.current) return;

        const status = normalizeStatus(res.scrape_status);
        const error = res.scrape_error || null;
        const summary = res.scraped_summary || "";

        setScrapeStatus(status);
        setScrapeError(error);

        if (status === "finished") {
          stopPolling();
          if (summary) {
            setBusinessDescription((prev) => {
              const val = prev || summary;
              // Update initial so dirty resets
              setWebsiteUrl((curW) => {
                setAdditionalNotes((curN) => {
                  initialRef.current = { websiteUrl: curW, businessDescription: val, additionalNotes: curN };
                  return curN;
                });
                return curW;
              });
              return val;
            });
          }
          toast({ title: "Scrape complete", description: "Business description updated." });
          onScrapeComplete?.();
        } else if (status === "failed") {
          stopPolling();
          toast({ title: "Scrape failed", description: error || "Unknown error", variant: "destructive" });
        }
        // queued/running/summarizing — keep polling
      } catch {
        // transient error, keep polling
      }
    }, 3000);
  }, [stopPolling, onScrapeComplete]);

  const normalizeUrl = (url: string): string | null => {
    let v = url.trim();
    if (!v) return null;
    if (v.startsWith("//")) v = `https:${v}`;
    else if (!v.startsWith("http://") && !v.startsWith("https://")) v = `https://${v}`;
    try { new URL(v); return v; } catch { return null; }
  };

  const handleSave = () => {
    setSaving(true);
    api.putCompanyInfo({ website_url: websiteUrl, business_description: businessDescription, additional_notes: additionalNotes })
      .then(() => {
        toast({ title: "Saved", description: "Company info updated." });
        initialRef.current = { websiteUrl, businessDescription, additionalNotes };
        setIsDirty(false);
        // If URL changed, reset scrape status so user must re-scrape
        // (description stays as-is but locked until next scrape)
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const handleScrape = async () => {
    const normalized = normalizeUrl(websiteUrl);
    if (!normalized) {
      toast({ title: "Error", description: "Website URL is required and must be valid.", variant: "destructive" });
      return;
    }
    setScrapeStatus("queued");
    setScrapeError(null);
    try {
      // Save pending changes first
      if (isDirty) {
        await api.putCompanyInfo({ website_url: websiteUrl, business_description: businessDescription, additional_notes: additionalNotes });
        initialRef.current = { websiteUrl, businessDescription, additionalNotes };
        setIsDirty(false);
      }
      await api.scrapeCompanyInfo({ website_url: normalized });
      toast({ title: "Scrape queued", description: "Website content will be processed shortly." });
      startPolling();
    } catch {
      setScrapeStatus("idle");
    }
  };

  const handleClearUrl = () => {
    stopPolling();
    setWebsiteUrl("");
    setBusinessDescription("");
    setScrapeStatus("idle");
    setScrapeError(null);
    checkDirty("", businessDescription, additionalNotes);
    // Re-check dirty with cleared URL + cleared description
    const init = initialRef.current;
    setIsDirty("" !== init.websiteUrl || "" !== init.businessDescription || additionalNotes !== init.additionalNotes);
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

  // Business description disabled unless scrape is finished
  const descriptionDisabled = !hasWebsite || scrapeStatus !== "finished";

  const statusLabel = (() => {
    if (scrapeStatus === "idle") return null;
    if (scrapeStatus === "summarizing") return "running";
    return scrapeStatus;
  })();

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="industrial-card p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider">Company Info</h2>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Website Link</label>
        <div className="relative">
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => {
              const v = e.target.value;
              setWebsiteUrl(v);
              // Reset scrape state when URL changes
              if (scrapeStatus === "finished" || scrapeStatus === "failed") {
                setScrapeStatus("idle");
                setScrapeError(null);
              }
              checkDirty(v, businessDescription, additionalNotes);
            }}
            className="industrial-input w-full pr-8"
            placeholder="https://example.com"
          />
          {hasWebsite && (
            <button
              type="button"
              onClick={handleClearUrl}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear URL"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Website content will be used as the chatbot knowledge base.</p>
        {scrapeStatus === "failed" && scrapeError && (
          <p className="mt-1 text-xs text-destructive">{scrapeError}</p>
        )}
        {scrapeStatus === "failed" && !scrapeError && (
          <p className="mt-1 text-xs text-destructive">Scrape failed. Try again.</p>
        )}
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
        {hasWebsite && scrapeStatus === "idle" && (
          <p className="mt-1 text-xs text-muted-foreground">Run scrape to generate description.</p>
        )}
        {isScrapeInProgress && (
          <p className="mt-1 text-xs text-accent-foreground flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Scrape in progress: {scrapeStatus}
          </p>
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
          {isScrapeInProgress ? "Scraping…" : "Request website scrape"}
        </button>
        {statusLabel && (
          <span className={`text-xs font-mono uppercase tracking-wider ${scrapeStatus === "failed" ? "text-destructive" : scrapeStatus === "finished" ? "text-accent-foreground" : "text-muted-foreground"}`}>
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default CompanyInfoSection;
