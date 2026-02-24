import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Save, Loader2, Trash2, ImagePlus, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SocialProofState {
  enabled: boolean;
  examples: string;
}

interface ProofImage {
  id: string;
  url: string;
  caption?: string;
}

const DEFAULTS: SocialProofState = { enabled: false, examples: "" };

const PLACEHOLDER = `• "We helped a coaching business go from 3 to 12 clients in 60 days"
• "Our average client sees ROI within the first 30 days"
• "Over 500 businesses have used our system"`;

const SocialProofSection = ({ onSaved, onDirty }: { onSaved?: () => void; onDirty?: () => void }) => {
  const [data, setData] = useState<SocialProofState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(DEFAULTS));

  // Images
  const [images, setImages] = useState<ProofImage[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.getSocialProof().catch(() => null),
      api.getSocialProofImages().catch(() => []),
    ]).then(([res, imgs]) => {
      if (res) {
        const merged: SocialProofState = {
          enabled: res.enabled ?? res.social_proof_enabled ?? false,
          examples: res.examples || res.social_proof_examples || "",
        };
        setData(merged);
        initialRef.current = JSON.stringify(merged);
      }
      const imgList = Array.isArray(imgs) ? imgs : (imgs as any)?.images || [];
      setImages(imgList);
    }).finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<SocialProofState>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      const dirty = JSON.stringify(next) !== initialRef.current;
      setIsDirty(dirty);
      if (dirty) onDirty?.();
      return next;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      await api.putSocialProof(data);
      initialRef.current = JSON.stringify(data);
      setIsDirty(false);
      setSaveStatus('saved');
      onSaved?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Failed to save. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const res = await api.uploadSocialProofImage(uploadFile, uploadCaption);
      const newImg = res?.image || res;
      if (newImg?.id) setImages((prev) => [...prev, newImg]);
      setUploadFile(null);
      setUploadCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setSaveError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (!confirm("Remove this image?")) return;
    try {
      await api.deleteSocialProofImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch {}
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">⭐ Social Proof</h2>
        <Switch checked={data.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>

      <p className="text-xs text-muted-foreground">Enable social proof in conversations — the AI will weave these in naturally when relevant</p>

      {data.enabled && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Social Proof Examples</label>
            <textarea value={data.examples} onChange={(e) => update({ examples: e.target.value })} className="dark-input w-full h-32 resize-y" placeholder={PLACEHOLDER} />
            <p className="text-[11px] text-muted-foreground mt-1">The AI will weave these in naturally when relevant — never robotically</p>
          </div>

          {/* Proof Images */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">📸 Proof Images</h3>
              <p className="text-xs text-muted-foreground mt-0.5">These images are automatically sent when a lead asks for examples, results, or proof</p>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border bg-secondary">
                    <img src={img.url} alt={img.caption || "Proof"} className="w-full h-24 object-cover" />
                    {img.caption && <p className="text-[10px] text-muted-foreground px-2 py-1 truncate">{img.caption}</p>}
                    <button onClick={() => handleDeleteImage(img.id)} className="absolute top-1 right-1 p-1 rounded bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length >= 6 ? (
              <p className="text-xs text-muted-foreground">Remove an image to add more (max 6)</p>
            ) : !uploadFile ? (
              <button onClick={() => fileInputRef.current?.click()} className="dark-btn text-xs flex items-center gap-2">
                <ImagePlus size={14} /> Click to add image
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground truncate max-w-[120px]">{uploadFile.name}</span>
                <input value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} placeholder="Caption (optional)" className="dark-input flex-1 text-xs" />
                <button onClick={handleUpload} disabled={uploading} className="dark-btn-primary text-xs h-8 px-3">
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : "Upload"}
                </button>
                <button onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUploadFile(file); }} />
          </div>
        </>
      )}

      <div>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || saveStatus === 'saved' || !isDirty}
          className={`dark-btn ${
            saveStatus === 'saved' ? "bg-success/15 text-success" :
            saveStatus === 'error' ? "bg-destructive/15 text-destructive" :
            isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
          }`}
        >
          {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> :
           saveStatus === 'saved' ? <Check size={16} /> :
           saveStatus === 'error' ? <X size={16} /> : <Save size={16} />}
          {saveStatus === 'saving' ? "Saving…" :
           saveStatus === 'saved' ? "Saved ✓" :
           saveStatus === 'error' ? "Save failed" : "Save"}
        </button>
        {saveStatus === 'error' && <p className="text-xs text-destructive mt-2">{saveError}</p>}
      </div>
    </div>
  );
};

export default SocialProofSection;
