import { useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  X,
  Loader2,
  Check,
  Sparkles,
  FileText,
  FileJson,
  File,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const ACCEPTED = ".json,.txt,.docx,.xlsx";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "energetic", label: "Energetic" },
];

const LENGTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

const OPENER_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "direct", label: "Direct" },
  { value: "curious", label: "Curious" },
];

const APPROACH_OPTIONS = [
  { value: "field_focused", label: "Straight to Fields", desc: "Efficient — collect info quickly" },
  { value: "rapport_building", label: "Rapport Building", desc: "Connect first, collect naturally" },
];

const FOLLOW_UP_OPTIONS = [
  { value: "gentle", label: "Gentle", desc: "Soft nudges, no pressure" },
  { value: "persistent", label: "Persistent", desc: "Clear CTAs, mild urgency" },
  { value: "value_first", label: "Value-First", desc: "Lead with insight" },
];

const CLOSING_OPTIONS = [
  { value: "soft", label: "Soft" },
  { value: "direct", label: "Direct" },
  { value: "assumptive", label: "Assumptive" },
];

const ERROR_TYPES = [
  { key: "typos", label: "Occasional typos", desc: 'e.g. "teh", "somethng"' },
  { key: "no_periods", label: "No period at end", desc: "Skip trailing period" },
  { key: "lowercase_starts", label: "Lowercase starts", desc: "Like real texts" },
  { key: "short_forms", label: "Short forms", desc: '"ur", "gonna", "tbh"' },
  { key: "double_messages", label: "Split messages", desc: "Send in 2 parts" },
];

function fileIcon(name: string) {
  if (name.endsWith(".json")) return <FileJson size={14} className="text-primary" />;
  if (name.endsWith(".txt")) return <FileText size={14} className="text-muted-foreground" />;
  return <File size={14} className="text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// Sub-component: ToggleGroup
// ---------------------------------------------------------------------------

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; desc?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2.5 text-center transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="text-sm font-semibold">{o.label}</div>
          {o.desc && <div className="text-[10px] opacity-70 hidden sm:block">{o.desc}</div>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona preview form (shown after generation)
// ---------------------------------------------------------------------------

interface PersonaFields {
  agent_name: string;
  agent_backstory: string;
  tone: string;
  response_length: string;
  emojis_enabled: boolean;
  opener_style: string;
  conversation_approach: string;
  follow_up_style: string;
  closing_style: string;
  human_error_enabled: boolean;
  human_error_types: string[];
  human_error_random: boolean;
  no_trailing_period: boolean;
  bot_deny_response: string;
}

function PersonaPreviewForm({
  initial,
  styleSummary,
  onApply,
}: {
  initial: PersonaFields;
  styleSummary: string;
  onApply: (data: PersonaFields) => Promise<void>;
}) {
  const [data, setData] = useState<PersonaFields>(initial);
  const [applying, setApplying] = useState(false);

  const update = (patch: Partial<PersonaFields>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const toggleErrorType = (key: string) => {
    const types = data.human_error_types.includes(key)
      ? data.human_error_types.filter((t) => t !== key)
      : [...data.human_error_types, key];
    update({ human_error_types: types });
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(data);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mt-4 space-y-5 border border-border rounded-xl p-5 bg-card">
      {/* Style summary callout */}
      {styleSummary && (
        <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3">
          <p className="text-xs font-medium text-primary mb-1">AI Analysis</p>
          <p className="text-sm text-foreground">{styleSummary}</p>
        </div>
      )}

      {/* Agent name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent Name</label>
        <input
          value={data.agent_name}
          onChange={(e) => update({ agent_name: e.target.value })}
          className="dark-input w-full"
          placeholder="e.g. Alex"
        />
      </div>

      {/* Backstory */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent Backstory</label>
        <textarea
          value={data.agent_backstory}
          onChange={(e) => update({ agent_backstory: e.target.value })}
          className="dark-input w-full min-h-[80px] resize-none"
          placeholder="Brief background for the AI persona..."
        />
      </div>

      {/* Tone */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tone</label>
        <ToggleGroup options={TONE_OPTIONS} value={data.tone} onChange={(v) => update({ tone: v })} />
      </div>

      {/* Response length */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Response Length</label>
        <ToggleGroup options={LENGTH_OPTIONS} value={data.response_length} onChange={(v) => update({ response_length: v })} />
      </div>

      {/* Opener style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Opener Style</label>
        <ToggleGroup options={OPENER_OPTIONS} value={data.opener_style} onChange={(v) => update({ opener_style: v })} />
      </div>

      {/* Conversation approach */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Field Collection Approach</label>
        <ToggleGroup options={APPROACH_OPTIONS} value={data.conversation_approach} onChange={(v) => update({ conversation_approach: v })} />
      </div>

      {/* Follow-up style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Follow-up Style</label>
        <ToggleGroup options={FOLLOW_UP_OPTIONS} value={data.follow_up_style} onChange={(v) => update({ follow_up_style: v })} />
      </div>

      {/* Closing style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Closing Style</label>
        <ToggleGroup options={CLOSING_OPTIONS} value={data.closing_style} onChange={(v) => update({ closing_style: v })} />
      </div>

      {/* Emojis */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Use Emojis</p>
          <p className="text-[10px] text-muted-foreground">Include emojis in messages</p>
        </div>
        <Switch checked={data.emojis_enabled} onCheckedChange={(v) => update({ emojis_enabled: v })} />
      </div>

      {/* No trailing period */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">No Dot at End of Messages</p>
          <p className="text-[10px] text-muted-foreground">Skip period — feels more like texting</p>
        </div>
        <Switch checked={data.no_trailing_period} onCheckedChange={(v) => update({ no_trailing_period: v })} />
      </div>

      {/* Human error enabled */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Human Writing Style</p>
          <p className="text-[10px] text-muted-foreground">Make messages feel less robotic</p>
        </div>
        <Switch checked={data.human_error_enabled} onCheckedChange={(v) => update({ human_error_enabled: v })} />
      </div>

      {/* Error types (conditional) */}
      {data.human_error_enabled && (
        <div className="space-y-2 pl-1">
          {ERROR_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleErrorType(t.key)}
              className={`w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-all ${
                data.human_error_types.includes(t.key)
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  data.human_error_types.includes(t.key)
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              >
                {data.human_error_types.includes(t.key) && (
                  <Check size={10} className="text-primary-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-foreground">{t.label}</span>
                <span className="text-[10px] text-muted-foreground ml-1.5">{t.desc}</span>
              </div>
            </button>
          ))}

          {/* Random mode */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-medium text-foreground">Random Mode</p>
              <p className="text-[10px] text-muted-foreground">Apply errors randomly, not every message</p>
            </div>
            <Switch
              checked={data.human_error_random}
              onCheckedChange={(v) => update({ human_error_random: v })}
            />
          </div>
        </div>
      )}

      {/* Bot deny response */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Bot Denial Response
        </label>
        <input
          value={data.bot_deny_response}
          onChange={(e) => update({ bot_deny_response: e.target.value })}
          className="dark-input w-full"
          placeholder={`e.g. "I'm a real person, just quick at responding!"`}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Reply when someone asks if they're talking to a bot
        </p>
      </div>

      {/* Apply button */}
      <button
        type="button"
        onClick={handleApply}
        disabled={applying}
        className="dark-btn w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {applying ? "Applying…" : "Apply & Activate AI Persona"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  onApplied?: () => void;
}

export default function PersonaGeneratorPanel({ onApplied }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [persona, setPersona] = useState<PersonaFields | null>(null);
  const [styleSummary, setStyleSummary] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // --- File handling ---

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) =>
      [".json", ".txt", ".docx", ".xlsx"].some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (valid.length < incoming.length) {
      toast({ title: "Unsupported file type", description: "Only .json, .txt, .docx, .xlsx are accepted", variant: "destructive" });
    }
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  // --- Generate ---

  const handleGenerate = async () => {
    if (files.length === 0) {
      toast({ title: "No files selected", description: "Upload at least one file to analyze", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setPersona(null);
    setStyleSummary("");
    try {
      const result = await api.generateCopilotPersona(files);
      const p = result?.persona ?? result;
      setPersona({
        agent_name: p.agent_name ?? "",
        agent_backstory: p.agent_backstory ?? "",
        tone: p.tone ?? "professional",
        response_length: p.response_length ?? "medium",
        emojis_enabled: p.emojis_enabled ?? false,
        opener_style: p.opener_style ?? "casual",
        conversation_approach: p.conversation_approach ?? "field_focused",
        follow_up_style: p.follow_up_style ?? "gentle",
        closing_style: p.closing_style ?? "soft",
        human_error_enabled: p.human_error_enabled ?? false,
        human_error_types: Array.isArray(p.human_error_types) ? p.human_error_types : [],
        human_error_random: p.human_error_random ?? false,
        no_trailing_period: p.no_trailing_period ?? false,
        bot_deny_response: p.bot_deny_response ?? "",
      });
      setStyleSummary(result?.style_summary ?? p.style_summary ?? "");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err?.message ?? "Could not analyze files", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // --- Apply ---

  const handleApply = async (data: PersonaFields) => {
    await api.putCopilotAiPersona(data);
    toast({ title: "AI Persona activated", description: "Your persona has been saved and is now active." });
    onApplied?.();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mt-4 space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 py-8 px-4 text-center ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 bg-card/50"
        }`}
      >
        <Upload size={28} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-0.5">Instagram DMs, transcripts, or documents</p>
        </div>
        {/* Format badges */}
        <div className="flex flex-wrap gap-2 justify-center mt-1">
          {[
            { label: "IG DMs (.json)", color: "bg-primary/10 text-primary border-primary/20" },
            { label: "Transcripts (.txt)", color: "bg-muted text-muted-foreground border-border" },
            { label: "Docs (.docx/.xlsx)", color: "bg-muted text-muted-foreground border-border" },
          ].map((b) => (
            <span key={b.label} className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${b.color}`}>
              {b.label}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2"
            >
              {fileIcon(f.name)}
              <span className="flex-1 text-xs text-foreground truncate">{f.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || files.length === 0}
        className={`dark-btn w-full ${
          files.length === 0
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {generating ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {generating ? "Analyzing messages…" : "Analyze & Generate Persona"}
      </button>

      {/* Loading skeleton */}
      {generating && (
        <div className="space-y-3 mt-2 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/40" />
          ))}
        </div>
      )}

      {/* Results */}
      {persona && !generating && (
        <PersonaPreviewForm
          initial={persona}
          styleSummary={styleSummary}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
