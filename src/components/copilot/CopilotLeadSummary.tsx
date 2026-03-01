import { useEffect, useState } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquare,
  ArrowLeft,
  User,
  CheckCircle2,
  Circle,
  Target,
  Flame,
  Clock,
  StickyNote,
  Plus,
  Loader2,
  ChevronDown,
} from "lucide-react";

// ---------- Types ----------

interface CopilotLeadSummaryProps {
  leadId: string;
  onOpenChat: () => void;
  onBack: () => void;
  /** Increment to trigger an immediate data refresh (e.g. from SSE events) */
  refreshTrigger?: number;
}

interface LeadData {
  name: string;
  channel: string;
  score: number;
  pipeline_stage: string;
  created_at: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
}

interface Intelligence {
  intent_score: number;
  intent_tags: string[];
  budget_detected: string | null;
  urgency_level: string;
  is_hot_lead: boolean;
  conversation_summary: string[];
}

/** Normalize the raw API intelligence object so arrays are always arrays and nulls are safe defaults. */
function normalizeIntelligence(raw: any): Intelligence {
  const cs = raw?.conversation_summary;
  let summaryArr: string[] = [];
  if (Array.isArray(cs)) summaryArr = cs;
  else if (typeof cs === 'string' && cs.trim()) summaryArr = [cs];

  const tags = raw?.intent_tags;
  let tagsArr: string[] = [];
  if (Array.isArray(tags)) tagsArr = tags;
  else if (typeof tags === 'string' && tags.trim()) tagsArr = tags.split(',').map((t: string) => t.trim());

  return {
    intent_score: Number(raw?.intent_score) || 0,
    intent_tags: tagsArr,
    budget_detected: raw?.budget_detected ?? null,
    urgency_level: raw?.urgency_level || 'low',
    is_hot_lead: !!raw?.is_hot_lead,
    conversation_summary: summaryArr,
  };
}

interface ActivityEvent {
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface Note {
  id?: string;
  content: string;
  created_at: string;
}

interface FieldDef {
  variable_name?: string;
  name: string;
  label?: string;
  is_enabled?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface SummaryResponse {
  lead: LeadData;
  parsed_fields: Record<string, any>;
  intelligence: Intelligence;
  activity: ActivityEvent[];
  notes: Note[];
  pending_suggestions: number;
}

// ---------- Helpers ----------

const PIPELINE_STAGES = [
  { value: "new", label: "New", color: "bg-muted text-muted-foreground" },
  { value: "contacted", label: "Contacted", color: "bg-primary/15 text-primary" },
  { value: "qualified", label: "Qualified", color: "bg-success/15 text-success" },
  { value: "proposal", label: "Proposal", color: "bg-info/15 text-info" },
  { value: "negotiation", label: "Negotiation", color: "bg-warning/15 text-warning" },
  { value: "won", label: "Won", color: "bg-success text-success-foreground" },
  { value: "lost", label: "Lost", color: "bg-destructive/15 text-destructive" },
];

const getScoreColor = (score: number) => {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-muted";
};

const getScoreTextColor = (score: number) => {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-muted-foreground";
};

const getUrgencyStyle = (level: string) => {
  switch (level) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStageBadge = (stage: string) => {
  const found = PIPELINE_STAGES.find((s) => s.value === stage);
  return found || { value: stage, label: stage, color: "bg-muted text-muted-foreground" };
};

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case "ai_reply":
      return <MessageSquare size={12} className="text-primary" />;
    case "user_message":
      return <MessageSquare size={12} className="text-success" />;
    case "field_extracted":
      return <CheckCircle2 size={12} className="text-info" />;
    case "stage_changed":
      return <Target size={12} className="text-warning" />;
    case "note_added":
      return <StickyNote size={12} className="text-muted-foreground" />;
    case "assigned":
      return <User size={12} className="text-primary" />;
    default:
      return <Clock size={12} className="text-muted-foreground" />;
  }
};

const getEventLabel = (event: ActivityEvent) => {
  switch (event.event_type) {
    case "ai_reply":
      return "AI sent a reply";
    case "user_message":
      return "Lead sent a message";
    case "field_extracted":
      return `Extracted: ${event.metadata?.field || "field"}`;
    case "stage_changed":
      return `Stage changed to ${event.metadata?.new_stage || "unknown"}`;
    case "note_added":
      return "Note added";
    case "assigned":
      return `Assigned to ${event.metadata?.assigned_to_name || "team member"}`;
    default:
      return event.event_type.replace(/_/g, " ");
  }
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const INTENT_TAG_COLORS = [
  "bg-primary/15 text-primary",
  "bg-success/15 text-success",
  "bg-info/15 text-info",
  "bg-warning/15 text-warning",
  "bg-destructive/15 text-destructive",
];

// ---------- Sub-components ----------

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`bg-secondary/50 rounded animate-pulse ${className}`} />
);

const LoadingSkeleton = () => (
  <div className="flex-1 overflow-y-auto bg-[hsl(0_0%_4%)] p-6 space-y-6">
    {/* Header skeleton */}
    <div className="space-y-3">
      <SkeletonBlock className="h-7 w-48" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
        <SkeletonBlock className="h-5 w-24 rounded-full" />
      </div>
      <SkeletonBlock className="h-2 w-full rounded-full" />
      <SkeletonBlock className="h-4 w-32" />
    </div>
    {/* Actions skeleton */}
    <div className="flex gap-2">
      <SkeletonBlock className="h-9 w-40 rounded-lg" />
      <SkeletonBlock className="h-9 w-24 rounded-lg" />
      <SkeletonBlock className="h-9 w-32 rounded-lg" />
    </div>
    {/* Cards skeleton */}
    {[0, 1, 2].map((i) => (
      <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-3/4" />
      </div>
    ))}
  </div>
);

// ---------- Main component ----------

const CopilotLeadSummary = ({ leadId, onOpenChat, onBack, refreshTrigger }: CopilotLeadSummaryProps) => {
  const companyId = requireCompanyId();

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdowns
  const [assignOpen, setAssignOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);

  // Notes
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState<Note[]>([]);

  // Assign / stage mutation loading
  const [assigning, setAssigning] = useState(false);
  const [changingStage, setChangingStage] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, fieldsRes, teamRes] = await Promise.all([
        api.getCopilotLeadSummary(leadId),
        api.getCopilotFields().catch(() => ({ fields: [] })),
        api.getCopilotTeam().catch(() => ({ members: [] })),
      ]);
      // Normalize API response: map recent_activity->activity, normalize intelligence
      const normalized: SummaryResponse = {
        lead: summaryRes?.lead || {},
        parsed_fields: summaryRes?.parsed_fields || {},
        intelligence: normalizeIntelligence(summaryRes?.intelligence),
        activity: summaryRes?.recent_activity || summaryRes?.activity || [],
        notes: Array.isArray(summaryRes?.notes) ? summaryRes.notes : [],
        pending_suggestions: summaryRes?.pending_suggestions || 0,
      };
      setSummary(normalized);
      setLocalNotes(normalized.notes);
      const allFields = Array.isArray(fieldsRes?.fields)
        ? fieldsRes.fields
        : Array.isArray(fieldsRes?.presets)
          ? fieldsRes.presets
          : Array.isArray(fieldsRes)
            ? fieldsRes
            : [];
      setFields(allFields.filter((f: FieldDef) => f.is_enabled !== false));
      const members = Array.isArray(teamRes?.members)
        ? teamRes.members
        : Array.isArray(teamRes)
          ? teamRes
          : [];
      setTeam(members);
    } catch (err: any) {
      setError(err?.message || "Failed to load lead summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [leadId, companyId]);

  // Re-fetch when SSE triggers a refresh (new messages update parsed_fields/intelligence)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && !loading) {
      fetchData();
    }
  }, [refreshTrigger]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => {
      setAssignOpen(false);
      setStageOpen(false);
    };
    if (assignOpen || stageOpen) {
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [assignOpen, stageOpen]);

  // --- Actions ---

  const handleAssign = async (userId: string | null) => {
    setAssigning(true);
    setAssignOpen(false);
    try {
      await api.assignCopilotLead(leadId, userId);
      const member = team.find((m) => m.id === userId);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              lead: {
                ...prev.lead,
                assigned_to: userId,
                assigned_to_name: member?.name || null,
              },
            }
          : prev
      );
      toast({ title: userId ? `Assigned to ${member?.name || "team member"}` : "Unassigned" });
    } catch {
      toast({ title: "Failed to assign lead", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleStageChange = async (stage: string) => {
    setChangingStage(true);
    setStageOpen(false);
    try {
      await api.updateLeadPipelineStage(leadId, { stage });
      setSummary((prev) =>
        prev ? { ...prev, lead: { ...prev.lead, pipeline_stage: stage } } : prev
      );
      toast({ title: `Stage changed to ${getStageBadge(stage).label}` });
    } catch {
      toast({ title: "Failed to update stage", variant: "destructive" });
    } finally {
      setChangingStage(false);
    }
  };

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setAddingNote(true);
    try {
      const created = await api.createLeadNote(leadId, { content: text });
      setLocalNotes((prev) => [created, ...prev]);
      setNewNote("");
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  // --- Loading state ---
  if (loading) return <LoadingSkeleton />;

  // --- Error state ---
  if (error || !summary) {
    return (
      <div className="flex-1 bg-[hsl(0_0%_4%)] flex flex-col items-center justify-center gap-4 p-6">
        <div className="bg-card border border-border rounded-xl p-6 text-center max-w-sm">
          <p className="text-sm text-destructive font-semibold mb-2">
            {error || "Failed to load lead summary"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Something went wrong while loading the lead data. Please try again.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={12} /> Back
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { lead, parsed_fields, intelligence, activity } = summary;
  const stageBadge = getStageBadge(lead.pipeline_stage);
  const displayNotes = localNotes.slice(0, 5);
  const displayActivity = (activity || []).slice(0, 10);

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(0_0%_4%)] min-h-0">
      <div className="max-w-2xl mx-auto p-6 space-y-5">

        {/* ========== Header Section ========== */}
        <div className="space-y-3">
          {/* Lead name */}
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-foreground">{lead.name || "Unknown"}</h2>
            {intelligence.is_hot_lead && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider shrink-0">
                <Flame size={11} /> Hot Lead
              </span>
            )}
          </div>

          {/* Channel badge + pipeline stage badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Channel */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold capitalize">
              <MessageSquare size={11} />
              {lead.channel || "unknown"}
            </span>
            {/* Pipeline stage */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${stageBadge.color}`}>
              {stageBadge.label}
            </span>
            {/* Pending suggestions */}
            {summary.pending_suggestions > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-info/10 text-info text-[10px] font-semibold">
                {summary.pending_suggestions} pending
              </span>
            )}
          </div>

          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Lead Score</span>
              <span className={`text-xs font-bold ${getScoreTextColor(lead.score)}`}>
                {lead.score}/100
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreColor(lead.score)}`}
                style={{ width: `${Math.min(lead.score, 100)}%` }}
              />
            </div>
          </div>

          {/* Assigned to */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User size={12} />
            <span>
              Assigned to:{" "}
              <span className="text-foreground font-medium">
                {lead.assigned_to_name || "Unassigned"}
              </span>
            </span>
          </div>
        </div>

        {/* ========== Quick Actions Row ========== */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Open Conversation */}
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <MessageSquare size={14} />
            Open Conversation
          </button>

          {/* Assign dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAssignOpen((v) => !v);
                setStageOpen(false);
              }}
              disabled={assigning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {assigning ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <User size={12} />
              )}
              Assign
              <ChevronDown size={10} />
            </button>
            {assignOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-50 py-1 max-h-56 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
                >
                  Unassign
                </button>
                {team.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-secondary/50 transition-colors ${
                      lead.assigned_to === member.id
                        ? "text-primary font-semibold"
                        : "text-foreground"
                    }`}
                  >
                    {member.name}
                    {member.role && (
                      <span className="text-muted-foreground ml-1.5">({member.role})</span>
                    )}
                  </button>
                ))}
                {team.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No team members</p>
                )}
              </div>
            )}
          </div>

          {/* Pipeline stage selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStageOpen((v) => !v);
                setAssignOpen(false);
              }}
              disabled={changingStage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {changingStage ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Target size={12} />
              )}
              Stage
              <ChevronDown size={10} />
            </button>
            {stageOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-50 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                {PIPELINE_STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStageChange(s.value)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-secondary/50 transition-colors ${
                      lead.pipeline_stage === s.value
                        ? "text-primary font-semibold"
                        : "text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Back button */}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors ml-auto"
          >
            <ArrowLeft size={12} />
            Back
          </button>
        </div>

        {/* ========== Conversation Summary Card ========== */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare size={13} className="text-primary" />
            Conversation Summary
          </h3>
          {intelligence.conversation_summary && intelligence.conversation_summary.length > 0 ? (
            <ul className="space-y-2">
              {intelligence.conversation_summary.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  <span className="text-sm text-foreground leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No conversation yet</p>
          )}
        </div>

        {/* ========== Collected Fields Card ========== */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-success" />
            Collected Fields
          </h3>
          <div className="space-y-2">
            {fields.map((field) => {
              const key = field.variable_name || field.name;
              const val = parsed_fields[key] || parsed_fields[field.name];
              const collected = val !== undefined && val !== null && val !== "";
              return (
                <div key={key} className="flex items-start gap-2.5">
                  {collected ? (
                    <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-muted-foreground">
                      {field.label || field.name}
                    </span>
                    {collected && (
                      <p className="text-xs text-foreground font-medium truncate">
                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {fields.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No fields configured</p>
            )}
          </div>
        </div>

        {/* ========== Intent Signals Card ========== */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <Target size={13} className="text-warning" />
            Intent Signals
          </h3>

          {/* Intent score bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Intent Score</span>
              <span className={`text-xs font-bold ${getScoreTextColor(intelligence.intent_score)}`}>
                {intelligence.intent_score}/100
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreColor(intelligence.intent_score)}`}
                style={{ width: `${Math.min(intelligence.intent_score, 100)}%` }}
              />
            </div>
          </div>

          {/* Intent tags */}
          {intelligence.intent_tags && intelligence.intent_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {intelligence.intent_tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    INTENT_TAG_COLORS[i % INTENT_TAG_COLORS.length]
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Budget + Urgency row */}
          <div className="flex items-center gap-3 flex-wrap">
            {intelligence.budget_detected && (
              <div className="text-xs text-muted-foreground">
                Budget:{" "}
                <span className="text-foreground font-semibold">
                  {intelligence.budget_detected}
                </span>
              </div>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${getUrgencyStyle(intelligence.urgency_level)}`}
            >
              {intelligence.urgency_level || "low"} urgency
            </span>
          </div>
        </div>

        {/* ========== Recent Activity Timeline ========== */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock size={13} className="text-info" />
            Recent Activity
          </h3>
          {displayActivity.length > 0 ? (
            <div className="relative pl-5">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />

              <div className="space-y-3">
                {displayActivity.map((event, i) => (
                  <div key={i} className="relative flex items-start gap-3">
                    {/* Timeline dot */}
                    <div className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-card border border-border flex items-center justify-center">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground">{getEventLabel(event)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {timeAgo(event.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </div>

        {/* ========== Notes Section ========== */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <StickyNote size={13} className="text-muted-foreground" />
            Notes
          </h3>

          {/* Quick add note */}
          <div className="flex gap-1.5 mb-3">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNote();
              }}
              placeholder="Add a note..."
              className="dark-input flex-1 text-xs h-8"
              disabled={addingNote}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || addingNote}
              className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {addingNote ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
            </button>
          </div>

          {/* Notes list */}
          {displayNotes.length > 0 ? (
            <div className="space-y-2">
              {displayNotes.map((note, i) => (
                <div key={note.id || i} className="bg-secondary/50 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-foreground leading-relaxed">{note.content}</p>
                  {note.created_at && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      {timeAgo(note.created_at)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No notes yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CopilotLeadSummary;
