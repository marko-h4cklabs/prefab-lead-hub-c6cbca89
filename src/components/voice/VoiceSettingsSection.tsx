import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mic, Play, Pause, Check, Trash2, Upload, Volume2, Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface VoiceSettings {
  voice_enabled: boolean;
  voice_mode: "match" | "always" | "never";
  voice_model: string;
  selected_voice_id: string | null;
  selected_voice_name: string | null;
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean;
}

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface VoiceClone {
  voice_id: string;
  name: string;
  description?: string;
  sample_count?: number;
}

interface VoiceUsage {
  characters_used: number;
  character_limit: number;
}

const MODE_CARDS = [
  { value: "match", icon: "🔄", title: "Match Mode", desc: "Reply with voice only when the lead sends a voice message", recommended: true },
  { value: "always", icon: "🎤", title: "Always Voice", desc: "Every AI reply is sent as an audio message", recommended: false },
  { value: "never", icon: "💬", title: "Text Only", desc: "Disable voice replies (same as turning off voice)", recommended: false },
] as const;

const MODELS = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 (Fastest, recommended)" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2 (Best quality)" },
  { value: "eleven_monolingual_v1", label: "English v1 (Legacy)" },
];

const VOICE_CATEGORIES = ["All", "Premade", "Professional", "High Quality"];

const VoiceSettingsSection = () => {
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [clones, setClones] = useState<VoiceClone[]>([]);
  const [usage, setUsage] = useState<VoiceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Voice preview
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice search/filter
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voiceCategory, setVoiceCategory] = useState("All");

  // Clone form
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloning, setCloning] = useState(false);
  const cloneInputRef = useRef<HTMLInputElement>(null);

  // Fine-tuning
  const [testText, setTestText] = useState("Hey, thanks for reaching out! I'd love to tell you more about what we offer.");
  const [testPlaying, setTestPlaying] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Voice tab
  const [voiceTab, setVoiceTab] = useState("library");

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getVoiceSettings().catch(() => null),
      api.getVoices().catch(() => []),
      api.getVoiceUsage().catch(() => null),
      api.getVoiceClones().catch(() => []),
    ]).then(([s, v, u, c]) => {
      if (s) setSettings(s as VoiceSettings);
      else setSettings({ voice_enabled: false, voice_mode: "match", voice_model: "eleven_turbo_v2_5", selected_voice_id: null, selected_voice_name: null, stability: 0.5, similarity_boost: 0.75, style: 0, speaker_boost: true });
      const voiceList = Array.isArray(v) ? v : (v as any)?.voices ?? [];
      setVoices(voiceList);
      if (u) setUsage(u as VoiceUsage);
      const cloneList = Array.isArray(c) ? c : (c as any)?.clones ?? [];
      setClones(cloneList);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateSetting = async (patch: Partial<VoiceSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    try {
      await api.updateVoiceSettings(patch);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const handlePreview = async (voice: Voice) => {
    if (playingId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    setPreviewingId(voice.voice_id);
    try {
      const res = await api.previewVoice({ voice_id: voice.voice_id, text: "Hi! This is a preview of how I sound." });
      const audioData = (res as any).audio_base64;
      const contentType = (res as any).content_type || "audio/mpeg";
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(`data:${contentType};base64,${audioData}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      await audio.play();
      setPlayingId(voice.voice_id);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err?.message || "Could not play preview", variant: "destructive" });
    } finally {
      setPreviewingId(null);
    }
  };

  const handleSelect = async (voiceId: string, voiceName: string) => {
    await updateSetting({ selected_voice_id: voiceId, selected_voice_name: voiceName });
    toast({ title: "Voice selected", description: `Now using "${voiceName}"` });
  };

  const handleClone = async () => {
    if (!cloneName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (cloneFiles.length === 0) { toast({ title: "At least 1 audio sample required", variant: "destructive" }); return; }
    setCloning(true);
    try {
      await api.cloneVoice(cloneName, cloneDesc, cloneFiles);
      toast({ title: "Voice cloned successfully!", description: "It's now set as your active voice." });
      setCloneName(""); setCloneDesc(""); setCloneFiles([]);
      setVoiceTab("clones");
      fetchAll();
    } catch (err: any) {
      toast({ title: "Clone failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setCloning(false);
    }
  };

  const handleDeleteClone = async (voiceId: string) => {
    if (!confirm("Delete this cloned voice?")) return;
    try {
      await api.deleteVoiceClone(voiceId);
      toast({ title: "Voice deleted" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const handleTestPlay = async () => {
    if (!testText.trim()) return;
    setTestPlaying(true);
    try {
      const res = await api.testVoice({ text: testText });
      const audioData = (res as any).audio_base64;
      const contentType = (res as any).content_type || "audio/mpeg";
      const audio = new Audio(`data:${contentType};base64,${audioData}`);
      audio.onended = () => setTestPlaying(false);
      await audio.play();
    } catch (err: any) {
      toast({ title: "Test failed", description: err?.message || "Unknown error", variant: "destructive" });
      setTestPlaying(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.updateVoiceSettings({
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
        style: settings.style,
        speaker_boost: settings.speaker_boost,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredVoices = voices.filter((v) => {
    if (voiceSearch && !v.name.toLowerCase().includes(voiceSearch.toLowerCase())) return false;
    if (voiceCategory !== "All" && v.category?.toLowerCase() !== voiceCategory.toLowerCase()) return false;
    return true;
  });

  const usagePct = usage ? Math.round((usage.characters_used / usage.character_limit) * 100) : 0;
  const disabled = !settings?.voice_enabled;

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-section 1 — Enable & Mode */}
      <div className="dark-card border-l-4 border-l-primary p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">🎙️ Voice Replies</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enable AI voice responses for your leads</p>
          </div>
          <Switch
            checked={settings?.voice_enabled ?? false}
            onCheckedChange={(checked) => updateSetting({ voice_enabled: checked })}
          />
        </div>

        {/* Mode Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
          {MODE_CARDS.map((card) => (
            <button
              key={card.value}
              onClick={() => updateSetting({ voice_mode: card.value })}
              className={`rounded-lg p-4 text-left border transition-all ${
                settings?.voice_mode === card.value
                  ? "border-primary shadow-[0_0_12px_hsl(48_92%_53%/0.15)] bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <div className="text-xl mb-2">{card.icon}</div>
              <div className="text-sm font-semibold text-foreground">{card.title}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
              {card.recommended && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-md bg-success/15 text-success font-medium">Recommended</span>
              )}
            </button>
          ))}
        </div>

        {/* Model Selector */}
        <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Voice Model</label>
          <select
            value={settings?.voice_model || "eleven_turbo_v2_5"}
            onChange={(e) => updateSetting({ voice_model: e.target.value })}
            className="dark-input w-full max-w-md"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Usage Bar */}
        {usage && (
          <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>ElevenLabs Usage</span>
              <span>{usage.characters_used.toLocaleString()} / {usage.character_limit.toLocaleString()} characters</span>
            </div>
            <Progress value={usagePct} className="h-2" />
            {usagePct > 80 && (
              <p className="text-xs text-warning mt-1">⚠️ You've used over 80% of your character limit</p>
            )}
          </div>
        )}
      </div>

      {/* Sub-section 2 — Voice Selection */}
      <div className={`dark-card border-l-4 border-l-primary p-6 space-y-4 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
        <h2 className="text-base font-bold text-foreground">Select a Voice</h2>
        {settings?.selected_voice_name && (
          <p className="text-xs text-muted-foreground">Currently active: <span className="text-primary font-medium">{settings.selected_voice_name}</span></p>
        )}

        <Tabs value={voiceTab} onValueChange={setVoiceTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="library">Voice Library</TabsTrigger>
            <TabsTrigger value="clones">My Cloned Voices</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-4 mt-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.value)}
                  placeholder="Search voices..."
                  className="dark-input w-full pl-9"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {VOICE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setVoiceCategory(cat)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      voiceCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVoices.map((voice) => {
                const isSelected = settings?.selected_voice_id === voice.voice_id;
                const isPreviewing = previewingId === voice.voice_id;
                const isPlaying = playingId === voice.voice_id;
                const labels = voice.labels ? Object.values(voice.labels) : [];
                return (
                  <div key={voice.voice_id} className="rounded-lg bg-card border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{voice.name}</span>
                      {voice.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{voice.category}</span>
                      )}
                    </div>
                    {voice.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{voice.description}</p>
                    )}
                    {labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {labels.slice(0, 4).map((l, li) => (
                          <span key={li} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{l}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handlePreview(voice)}
                        disabled={isPreviewing}
                        className="dark-btn-ghost h-7 px-3 text-xs border border-border"
                      >
                        {isPreviewing ? <Loader2 size={12} className="animate-spin" /> : isPlaying ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Preview</>}
                      </button>
                      <button
                        onClick={() => handleSelect(voice.voice_id, voice.name)}
                        disabled={isSelected}
                        className={`h-7 px-3 text-xs rounded-md font-medium transition-colors ${
                          isSelected
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {isSelected ? <><Check size={12} /> Selected</> : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredVoices.length === 0 && (
              <div className="text-center py-8">
                <Volume2 size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">No voices found matching your search</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="clones" className="space-y-4 mt-4">
            {clones.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clones.map((clone) => {
                  const isSelected = settings?.selected_voice_id === clone.voice_id;
                  return (
                    <div key={clone.voice_id} className="rounded-lg bg-card border border-border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{clone.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">Cloned</span>
                      </div>
                      {clone.description && <p className="text-xs text-muted-foreground">{clone.description}</p>}
                      {clone.sample_count !== undefined && <p className="text-[10px] text-muted-foreground">{clone.sample_count} samples</p>}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleSelect(clone.voice_id, clone.name)}
                          disabled={isSelected}
                          className={`h-7 px-3 text-xs rounded-md font-medium transition-colors ${
                            isSelected
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {isSelected ? <><Check size={12} /> Selected</> : "Select"}
                        </button>
                        <button
                          onClick={() => handleDeleteClone(clone.voice_id)}
                          disabled={isSelected}
                          className="dark-btn-ghost h-7 px-3 text-xs text-destructive border border-destructive/30 disabled:opacity-30"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mic size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground mb-3">No cloned voices yet</p>
                <button onClick={() => {
                  const el = document.getElementById("voice-clone-section");
                  el?.scrollIntoView({ behavior: "smooth" });
                }} className="dark-btn-primary text-xs h-8 px-4">Clone My Voice</button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sub-section 3 — Voice Cloning */}
      <div id="voice-clone-section" className={`dark-card border-l-4 border-l-primary p-6 space-y-4 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
        <h2 className="text-base font-bold text-foreground">🧬 Clone Your Voice</h2>
        <p className="text-xs text-muted-foreground">Upload audio samples of your voice. For best results, use clear recordings of 30-60 seconds each in a quiet environment. Minimum 1 sample, maximum 5.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Voice Name</label>
            <input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="e.g. My Voice" className="dark-input w-full max-w-md" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
            <input value={cloneDesc} onChange={(e) => setCloneDesc(e.target.value)} placeholder="Short description" className="dark-input w-full max-w-md" />
          </div>

          {/* Upload Zone */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Upload Voice Samples</label>
            <div
              onClick={() => cloneInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter((f) =>
                  ["audio/mp3", "audio/mpeg", "audio/wav", "audio/m4a", "audio/ogg", "audio/x-m4a"].includes(f.type)
                ).slice(0, 5);
                setCloneFiles((prev) => [...prev, ...files].slice(0, 5));
              }}
              className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <Upload size={24} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Drag audio files here or click to browse</p>
              <p className="text-[10px] text-muted-foreground">MP3, WAV, M4A, OGG — max 5 files, 10MB each</p>
            </div>
            <input
              ref={cloneInputRef}
              type="file"
              accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/ogg"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []).slice(0, 5);
                setCloneFiles((prev) => [...prev, ...files].slice(0, 5));
                if (cloneInputRef.current) cloneInputRef.current.value = "";
              }}
            />
          </div>

          {cloneFiles.length > 0 && (
            <div className="space-y-1">
              {cloneFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-foreground bg-secondary rounded-md px-3 py-2">
                  <Check size={12} className="text-success shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                  <button onClick={() => setCloneFiles((prev) => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          <div className="rounded-lg border-l-4 border-l-primary bg-muted p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">💡 Tips for best results:</p>
            <p>• Record in a quiet room with no echo</p>
            <p>• Speak naturally and clearly</p>
            <p>• Each sample should be 30-90 seconds long</p>
            <p>• Avoid background music or noise</p>
            <p>• Use the same microphone you normally use</p>
          </div>

          <button onClick={handleClone} disabled={cloning || !cloneName.trim() || cloneFiles.length === 0} className="dark-btn-primary w-full h-10">
            {cloning ? <><Loader2 size={14} className="animate-spin" /> Cloning your voice... this may take a minute</> : "🧬 Create Voice Clone"}
          </button>
        </div>
      </div>

      {/* Sub-section 4 — Voice Settings / Fine-tuning */}
      {settings?.selected_voice_id && (
        <div className={`dark-card border-l-4 border-l-primary p-6 space-y-5 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
          <h2 className="text-base font-bold text-foreground">🎛️ Voice Settings</h2>

          {/* Stability */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-foreground">Stability</label>
              <span className="text-xs text-primary font-mono">{settings.stability.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground shrink-0">More Variable</span>
              <Slider
                value={[settings.stability]}
                onValueChange={([v]) => setSettings({ ...settings, stability: v })}
                min={0} max={1} step={0.05}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground shrink-0">More Stable</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Lower values create more expressive, emotional speech. Higher values are more consistent but may sound monotone.</p>
          </div>

          {/* Similarity Boost */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-foreground">Similarity Boost</label>
              <span className="text-xs text-primary font-mono">{settings.similarity_boost.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground shrink-0">More Creative</span>
              <Slider
                value={[settings.similarity_boost]}
                onValueChange={([v]) => setSettings({ ...settings, similarity_boost: v })}
                min={0} max={1} step={0.05}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground shrink-0">More Similar</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">How closely the AI should match the original voice. Too high may cause artifacts.</p>
          </div>

          {/* Style */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-foreground">Style Exaggeration</label>
              <span className="text-xs text-primary font-mono">{settings.style.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground shrink-0">Natural</span>
              <Slider
                value={[settings.style]}
                onValueChange={([v]) => setSettings({ ...settings, style: v })}
                min={0} max={1} step={0.05}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground shrink-0">Exaggerated</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Amplifies the style of the original speaker. Use sparingly — high values may reduce quality.</p>
          </div>

          {/* Speaker Boost */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-medium text-foreground">Speaker Boost</label>
              <p className="text-[10px] text-muted-foreground">Boosts similarity to the target speaker. Slightly increases latency.</p>
            </div>
            <Switch
              checked={settings.speaker_boost}
              onCheckedChange={(v) => setSettings({ ...settings, speaker_boost: v })}
            />
          </div>

          {/* Test */}
          <div className="border-t border-border pt-4 space-y-3">
            <label className="text-xs font-medium text-muted-foreground block">Test Current Settings</label>
            <input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Enter a test message..." className="dark-input w-full" />
            <button onClick={handleTestPlay} disabled={testPlaying || !testText.trim()} className="dark-btn-ghost h-8 px-4 text-xs border border-border">
              {testPlaying ? <><Loader2 size={12} className="animate-spin" /> Playing...</> : "🔊 Play Test"}
            </button>
          </div>

          {/* Save */}
          <button onClick={handleSaveSettings} disabled={saving} className="dark-btn-primary w-full h-10">
            {saving ? <Loader2 size={14} className="animate-spin" /> : settingsSaved ? "Saved ✓" : "Save Voice Settings"}
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceSettingsSection;
