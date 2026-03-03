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
  Image,
  Plus,
  User,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const ACCEPTED = ".json,.txt,.docx,.xlsx,.jpg,.jpeg,.png,.webp,.heic";

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

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);
function isImageName(name: string) {
  return IMAGE_EXTS.has(name.slice(name.lastIndexOf(".")).toLowerCase());
}
function fileIcon(name: string) {
  if (name.endsWith(".json")) return <FileJson size={14} className="text-primary" />;
  if (name.endsWith(".txt")) return <FileText size={14} className="text-muted-foreground" />;
  if (isImageName(name)) return <Image size={14} className="text-blue-400" />;
  return <File size={14} className="text-muted-foreground" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
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
  onApply: (data: PersonaFields, personaName: string) => Promise<void>;
}) {
  const [data, setData] = useState<PersonaFields>(initial);
  const [personaName, setPersonaName] = useState(initial.agent_name || "My Persona");
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
    if (!personaName.trim()) {
      toast({ title: "Enter a persona name", variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      await onApply(data, personaName.trim());
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

      {/* Persona template name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Persona Template Name <span className="text-destructive">*</span>
        </label>
        <input
          value={personaName}
          onChange={(e) => setPersonaName(e.target.value)}
          className="dark-input w-full"
          placeholder="e.g. Jordan — Friendly Closer"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Give this persona a name so you can save and switch between multiple.</p>
      </div>

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
        {applying ? "Saving…" : "Save & Activate Persona"}
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

interface FileEntry {
  id: string;
  file: File;
  displayName: string; // may differ from file.name when duplicates exist
}

/** Unique fingerprint per file — allows same-named files of different content */
function fileKey(f: File) {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

/** Build display name: first occurrence keeps original, duplicates get "(2)", "(3)", … suffix */
function buildDisplayName(fileName: string, countSoFar: number): string {
  if (countSoFar === 0) return fileName;
  const dot = fileName.lastIndexOf(".");
  if (dot > 0) {
    return `${fileName.slice(0, dot)} (${countSoFar + 1})${fileName.slice(dot)}`;
  }
  return `${fileName} (${countSoFar + 1})`;
}

export default function PersonaGeneratorPanel({ onApplied }: Props) {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [senderName, setSenderName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [persona, setPersona] = useState<PersonaFields | null>(null);
  const [styleSummary, setStyleSummary] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");

  // Hidden file input ref — kept OUTSIDE the drop zone to avoid nested click loops
  const inputRef = useRef<HTMLInputElement>(null);
  // Track drag depth so onDragLeave doesn't fire when moving over child elements
  const dragDepthRef = useRef(0);

  // --- File handling ---

  const addFiles = useCallback((incoming: File[]) => {
    const ALLOWED_EXTS = [".json", ".txt", ".docx", ".xlsx", ".jpg", ".jpeg", ".png", ".webp", ".heic"];
    const valid = incoming.filter((f) =>
      ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (valid.length < incoming.length) {
      toast({
        title: "Unsupported file type",
        description: "Accepted: .json, .txt, .docx, .xlsx, .jpg, .png, .webp (screenshots)",
        variant: "destructive",
      });
    }
    if (valid.length === 0) return;
    setFileEntries((prev) => {
      // Dedup by content fingerprint (name + size + lastModified), not just name
      const existingKeys = new Set(prev.map((e) => fileKey(e.file)));
      // Track how many times each base name already appears so we can number new dupes
      const nameCount = new Map<string, number>();
      prev.forEach((e) => nameCount.set(e.file.name, (nameCount.get(e.file.name) ?? 0) + 1));

      const newEntries: FileEntry[] = [];
      for (const f of valid) {
        if (existingKeys.has(fileKey(f))) continue; // true duplicate — skip
        const count = nameCount.get(f.name) ?? 0;
        newEntries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          displayName: buildDisplayName(f.name, count),
        });
        nameCount.set(f.name, count + 1);
        existingKeys.add(fileKey(f));
      }
      return [...prev, ...newEntries];
    });
  }, []);

  // Drag handlers with depth counter to avoid false onDragLeave from child elements
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    // Reset input so the same file can be re-added after removal
    e.target.value = "";
  };

  const removeFile = (id: string) =>
    setFileEntries((prev) => prev.filter((e) => e.id !== id));

  const openPicker = () => inputRef.current?.click();

  // --- Generate ---

  const handleGenerate = async () => {
    if (fileEntries.length === 0) {
      toast({ title: "No files selected", description: "Upload at least one file to analyze", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setPersona(null);
    setStyleSummary("");
    setKnowledgeBase("");
    try {
      const result = await api.generateCopilotPersona(fileEntries.map((e) => e.file), senderName.trim() || undefined);
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
      setKnowledgeBase(result?.knowledge_base ?? "");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err?.message ?? "Could not analyze files", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // --- Apply: create named persona, then activate it ---

  const handleApply = async (data: PersonaFields, personaName: string) => {
    const { style_summary: _s, ...snapshot } = data as any;
    const created = await api.createCopilotAiPersona({
      name: personaName,
      snapshot,
      style_summary: styleSummary || undefined,
      knowledge_base: knowledgeBase || undefined,
    });
    await api.activateCopilotAiPersona(created.id);
    toast({ title: `"${personaName}" saved & activated`, description: "AI persona is now active across all conversations." });
    onApplied?.();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    // Outer wrapper is the full drag target — covers drop zone + file list area
    <div
      className="mt-4 space-y-4"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Hidden file input — lives OUTSIDE the drop zone to avoid nested click loops */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={onInputChange}
      />

      {/* Drop zone */}
      {fileEntries.length === 0 ? (
        // Empty state: full drop zone
        <div
          onClick={openPicker}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 py-8 px-4 text-center ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 bg-card/50"
          }`}
        >
          <Upload size={28} className={dragging ? "text-primary" : "text-muted-foreground"} />
          <div>
            <p className="text-sm font-medium text-foreground">
              {dragging ? "Drop files here" : "Drop files here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instagram DMs, transcripts, or documents
            </p>
          </div>
          {/* Format badges */}
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {[
              { label: "IG DMs (.json)", color: "bg-primary/10 text-primary border-primary/20" },
              { label: "Transcripts (.txt)", color: "bg-muted text-muted-foreground border-border" },
              { label: "Docs (.docx/.xlsx)", color: "bg-muted text-muted-foreground border-border" },
              { label: "Screenshots (.jpg/.png)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            ].map((b) => (
              <span key={b.label} className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${b.color}`}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        // Files loaded: compact drop bar at top
        <div
          onClick={openPicker}
          className={`cursor-pointer rounded-xl border border-dashed transition-colors flex items-center gap-3 px-4 py-3 ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 bg-card/50"
          }`}
        >
          <Upload size={16} className={dragging ? "text-primary" : "text-muted-foreground"} />
          <span className="text-sm text-muted-foreground flex-1">
            {dragging ? "Drop to add more files" : "Drop more files or click to add"}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
            {fileEntries.length} file{fileEntries.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openPicker(); }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={13} />
            Add
          </button>
        </div>
      )}

      {/* File list */}
      {fileEntries.length > 0 && (
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {fileEntries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2"
            >
              {fileIcon(e.file.name)}
              <span className="flex-1 text-xs text-foreground truncate">{e.displayName}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatBytes(e.file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(e.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sender name field */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <User size={12} />
          Your name in these chats
          <span className="text-muted-foreground/50 font-normal">(optional but recommended)</span>
        </label>
        <input
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          className="dark-input w-full"
          placeholder="e.g. Marco"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Helps AI focus only on your messages in the conversations — if left blank, AI will try to figure it out automatically
        </p>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || fileEntries.length === 0}
        className={`dark-btn w-full ${
          fileEntries.length === 0
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
