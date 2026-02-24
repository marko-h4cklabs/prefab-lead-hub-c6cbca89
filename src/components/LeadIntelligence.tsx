import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface IntelligenceData {
  intent_score?: number;
  is_hot_lead?: boolean;
  intent_tags?: string[];
  budget_detected?: string | null;
  conversation_summary?: string[] | null;
  summary_updated_at?: string;
}

const POLL_MS = 30_000;

const scoreColor = (score: number) => {
  if (score >= 81) return { bar: "bg-primary", text: "text-primary" };
  if (score >= 61) return { bar: "bg-[hsl(24_95%_53%)]", text: "text-[hsl(24_95%_53%)]" };
  if (score >= 31) return { bar: "bg-info", text: "text-info" };
  return { bar: "bg-muted-foreground", text: "text-muted-foreground" };
};

const LeadIntelligence = ({ leadId }: { leadId: string }) => {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetch = () => {
      api.getLeadIntelligence(leadId).then(setData).catch(() => setData(null));
    };
    fetch();
    intervalRef.current = setInterval(fetch, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [leadId]);

  if (!data || (data.intent_score === undefined && !data.intent_tags?.length && !data.budget_detected && !data.conversation_summary?.length)) {
    return null;
  }

  const score = data.intent_score ?? 0;
  const colors = scoreColor(score);

  return (
    <div className="bg-[hsl(0_0%_7%)] border border-border rounded-lg p-3 space-y-3">
      {/* Score */}
      {data.intent_score !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Lead Score</span>
            <div className="flex items-center gap-2">
              {data.is_hot_lead && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold animate-pulse">
                  🔥 Hot Lead
                </span>
              )}
              <span className={`text-sm font-bold font-mono ${colors.text}`}>{score} / 100</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${Math.min(100, score)}%` }} />
          </div>
        </div>
      )}

      {/* Intent Tags */}
      {data.intent_tags && data.intent_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.intent_tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center px-2 py-1 rounded-full bg-card border border-border text-primary text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Budget */}
      {data.budget_detected && (
        <p className="text-xs font-medium text-success">💰 Budget: {data.budget_detected}</p>
      )}

      {/* AI Summary */}
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">AI Summary</span>
            {data.summary_updated_at && (
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {new Date(data.summary_updated_at).toLocaleString()}
              </span>
            )}
          </div>
          {summaryOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {data.conversation_summary && data.conversation_summary.length > 0 ? (
            <ul className="space-y-1">
              {data.conversation_summary.map((line, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">Summary will appear after a few messages</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default LeadIntelligence;
