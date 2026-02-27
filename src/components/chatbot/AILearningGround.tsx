import { useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import {
  Brain, Plus, X, Upload, Loader2, Check, Sparkles, FileText, Image as ImageIcon,
} from "lucide-react";

interface AnalysisResult {
  agent_backstory: string;
  tone: string;
  response_length: string;
  opener_style: string;
  emojis_enabled: boolean;
  style_summary: string;
}

const AILearningGround = ({ onApplied }: { onApplied?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState<string[]>([""]);
  const [conversations, setConversations] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [applying, setApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addScript = () => setScripts((prev) => [...prev, ""]);
  const updateScript = (i: number, val: string) =>
    setScripts((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  const removeScript = (i: number) =>
    setScripts((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).slice(0, 10 - images.length).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Max 5MB per image", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    const allTexts = [...scripts.filter((s) => s.trim()), conversations.trim() ? conversations : ""].filter(Boolean);
    if (allTexts.length === 0) {
      toast({ title: "Add at least one script or conversation example", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await api.analyzeStyle({ texts: allTexts, images: images.length > 0 ? images : undefined });
      setResult(res);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      // Save backstory + identity
      await api.putAgentIdentity({ agent_backstory: result.agent_backstory });
      // Save behavior settings
      await api.putChatbotBehavior({
        tone: result.tone,
        response_length: result.response_length,
        opener_style: result.opener_style,
        emojis_enabled: result.emojis_enabled,
      } as any);
      toast({ title: "Persona applied successfully" });
      onApplied?.();
      setOpen(false);
      setResult(null);
    } catch (err: any) {
      toast({ title: "Failed to apply", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all p-4"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Brain size={20} className="text-primary" />
        </div>
        <div className="text-left">
          <span className="text-sm font-semibold text-foreground block">AI Learning Ground</span>
          <span className="text-[11px] text-muted-foreground">
            Paste your scripts and conversations — AI will create a persona that matches your style
          </span>
        </div>
        <Sparkles size={16} className="text-primary ml-auto shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">AI Learning Ground</h3>
        </div>
        <button onClick={() => { setOpen(false); setResult(null); }} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Paste your sales scripts, conversation examples, or upload screenshots of your Instagram DMs. The AI will analyze your communication style and generate a matching persona.
      </p>

      {/* Scripts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText size={12} /> Your Scripts
          </label>
          <button onClick={addScript} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5">
            <Plus size={10} /> Add Script
          </button>
        </div>
        {scripts.map((s, i) => (
          <div key={i} className="relative">
            <textarea
              value={s}
              onChange={(e) => updateScript(i, e.target.value)}
              placeholder={`Paste a sales script or message template you use...${i === 0 ? "\n\nExample: 'Hey! Thanks for reaching out. What are you looking for?'" : ""}`}
              className="dark-input w-full h-24 resize-y text-xs"
            />
            {scripts.length > 1 && (
              <button onClick={() => removeScript(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Conversation Examples */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
          <FileText size={12} /> Conversation Examples
        </label>
        <textarea
          value={conversations}
          onChange={(e) => setConversations(e.target.value)}
          placeholder={"Paste real conversation transcripts here...\n\nExample:\nLead: Hey, how much does it cost?\nYou: depends on what u need tbh, what are you looking for?\nLead: I need a website\nYou: cool, for business or personal?"}
          className="dark-input w-full h-32 resize-y text-xs"
        />
      </div>

      {/* Image Upload */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
          <ImageIcon size={12} /> Screenshots (optional)
        </label>
        <p className="text-[10px] text-muted-foreground mb-2">Upload screenshots of your Instagram DM conversations. Max 10 images, 5MB each.</p>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80">
                <X size={8} />
              </button>
            </div>
          ))}
          {images.length < 10 && (
            <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Upload size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Analyze Button */}
      {!result && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-10 gap-2"
        >
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {analyzing ? "Analyzing your style..." : "Generate Persona"}
        </button>
      )}

      {/* Result Preview */}
      {result && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Sparkles size={12} /> Generated Persona
          </h4>

          {result.style_summary && (
            <p className="text-xs text-foreground italic">{result.style_summary}</p>
          )}

          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground block">Agent Backstory</label>
              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap bg-card/80 rounded p-2 border border-border/50">{result.agent_backstory}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block">Tone</label>
                <span className="text-xs font-medium text-foreground capitalize">{result.tone}</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block">Response Length</label>
                <span className="text-xs font-medium text-foreground capitalize">{result.response_length}</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block">Opener Style</label>
                <span className="text-xs font-medium text-foreground capitalize">{result.opener_style}</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block">Emojis</label>
                <span className="text-xs font-medium text-foreground">{result.emojis_enabled ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex-1 dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-1.5"
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {applying ? "Applying..." : "Apply Persona"}
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="dark-btn-ghost h-9 px-3 text-xs"
            >
              {analyzing ? <Loader2 size={12} className="animate-spin" /> : "Regenerate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AILearningGround;
