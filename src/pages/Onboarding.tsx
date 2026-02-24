import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, Copy, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOTAL_STEPS = 5;

const QUOTE_PRESETS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'email_address', label: 'Email Address' },
  { key: 'phone_number', label: 'Phone Number' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'time_window', label: 'Time Window' },
  { key: 'notes', label: 'Additional Notes' },
];

const STEP_LABELS = ["Business Info", "AI Style", "Data Collection", "ManyChat", "AI Mode"];

function StepProgress({ step, completedSteps }: { step: number; completedSteps: Set<number> }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = completedSteps.has(stepNum);
          const isCurrent = step === stepNum;
          return (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isCompleted ? "bg-success text-success-foreground" : isCurrent ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {isCompleted ? <Check size={14} /> : stepNum}
              </div>
              <span className={`text-[10px] mt-1 ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            </div>
          );
        })}
      </div>
      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
    </div>
  );
}

function Step1({ data, onChange, onNext, saving }: { data: { businessName: string; description: string; notes: string }; onChange: (d: Partial<typeof data>) => void; onNext: () => void; saving: boolean }) {
  const valid = data.businessName.trim().length > 0;
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">Set up your AI appointment setter</h2><p className="text-sm text-muted-foreground">Tell us about your business.</p></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Business Name</label><input value={data.businessName} onChange={(e) => onChange({ businessName: e.target.value })} className="dark-input w-full" placeholder="Your company name" /></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Business Description</label><textarea value={data.description} onChange={(e) => onChange({ description: e.target.value })} className="dark-input w-full min-h-[80px] resize-y" placeholder="We provide residential painting services…" /></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Additional Context</label><textarea value={data.notes} onChange={(e) => onChange({ notes: e.target.value })} className="dark-input w-full min-h-[60px] resize-y" placeholder="Optional: special instructions, pricing notes…" /></div>
      <div className="flex justify-end"><button onClick={onNext} disabled={!valid || saving} className="dark-btn-primary">{saving ? <Loader2 size={14} className="animate-spin" /> : null} Next <ArrowRight size={14} /></button></div>
    </div>
  );
}

function Step2({ data, onChange, onNext, onBack, saving }: { data: { tone: string; responseLength: string; personaStyle: string; emojis: boolean }; onChange: (d: Partial<typeof data>) => void; onNext: () => void; onBack: () => void; saving: boolean }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">AI Communication Style</h2><p className="text-sm text-muted-foreground">Configure your AI assistant's personality.</p></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tone</label><select value={data.tone} onChange={(e) => onChange({ tone: e.target.value })} className="dark-input w-full"><option value="professional">Professional</option><option value="friendly">Friendly</option></select></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Response Length</label><select value={data.responseLength} onChange={(e) => onChange({ responseLength: e.target.value })} className="dark-input w-full"><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Persona</label><select value={data.personaStyle} onChange={(e) => onChange({ personaStyle: e.target.value })} className="dark-input w-full"><option value="busy">Busy — straight to the point</option><option value="explanational">Explanational — detailed</option></select></div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange({ emojis: !data.emojis })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${data.emojis ? "bg-primary" : "bg-secondary"}`}><span className={`inline-block h-4 w-4 rounded-full bg-foreground transition-transform ${data.emojis ? "translate-x-6" : "translate-x-1"}`} /></button>
        <span className="text-sm">Enable emojis</span>
      </div>
      <div className="flex justify-between"><button onClick={onBack} className="dark-btn-ghost"><ArrowLeft size={14} /> Back</button><button onClick={onNext} disabled={saving} className="dark-btn-primary">{saving ? <Loader2 size={14} className="animate-spin" /> : null} Next <ArrowRight size={14} /></button></div>
    </div>
  );
}

function Step3({ enabled, onToggle, onNext, onBack, saving }: { enabled: Record<string, boolean>; onToggle: (key: string) => void; onNext: () => void; onBack: () => void; saving: boolean }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">Data Collection</h2><p className="text-sm text-muted-foreground">Select what info your AI collects from leads.</p></div>
      <div className="space-y-2">
        {QUOTE_PRESETS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 dark-card px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors">
            <input type="checkbox" checked={!!enabled[key]} onChange={() => onToggle(key)} className="h-4 w-4 rounded border-border accent-primary" />
            <span className="text-sm font-medium">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-between"><button onClick={onBack} className="dark-btn-ghost"><ArrowLeft size={14} /> Back</button><button onClick={onNext} disabled={saving} className="dark-btn-primary">{saving ? <Loader2 size={14} className="animate-spin" /> : null} Next <ArrowRight size={14} /></button></div>
    </div>
  );
}

function Step4({ data, onChange, onNext, onSkip, onBack, saving }: { data: { apiKey: string; pageId: string }; onChange: (d: Partial<typeof data>) => void; onNext: () => void; onSkip: () => void; onBack: () => void; saving: boolean }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<"connected" | "not_connected" | null>(null);

  useEffect(() => {
    api.getWebhookUrl()
      .then((res) => setWebhookUrl(res?.webhook_url || res?.url || ""))
      .catch(() => setWebhookUrl(""))
      .finally(() => setWebhookLoading(false));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.getManychatSettings();
      setVerifyResult(res?.manychat_api_key && res?.manychat_page_id ? "connected" : "not_connected");
    } catch {
      setVerifyResult("not_connected");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">Connect Instagram via ManyChat</h2><p className="text-sm text-muted-foreground">Connect your ManyChat account for automated messaging.</p></div>
      <div className="dark-card p-4 space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How to connect:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to ManyChat → Settings → API</li>
          <li>Copy your API Key</li>
          <li>Find your Page ID from the ManyChat dashboard URL</li>
          <li>Paste both values below</li>
        </ol>
      </div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">ManyChat API Key</label><input value={data.apiKey} onChange={(e) => onChange({ apiKey: e.target.value })} type="password" className="dark-input w-full" placeholder="Your ManyChat API key" /></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">ManyChat Page ID</label><input value={data.pageId} onChange={(e) => onChange({ pageId: e.target.value })} className="dark-input w-full" placeholder="e.g. 123456789" /></div>

      {/* Webhook URL Section */}
      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Your Webhook URL</h3>
        <p className="text-xs text-muted-foreground">Copy this URL into ManyChat to receive Instagram DMs.</p>
        {webhookLoading ? (
          <div className="h-10 bg-secondary animate-pulse rounded-md" />
        ) : webhookUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs text-foreground font-mono break-all select-all">{webhookUrl}</code>
            <button onClick={handleCopy} className="dark-btn-ghost p-2 shrink-0">
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Webhook URL will be available after saving your ManyChat settings.</p>
        )}

        <div className="dark-card p-4 space-y-2 text-xs text-muted-foreground border-l-2 border-l-primary">
          <p className="font-medium text-foreground">ManyChat Webhook Setup:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to ManyChat → Automation → New Flow</li>
            <li>Add an "External Request" action</li>
            <li>Paste the webhook URL above</li>
            <li>Set method to <strong className="text-foreground">POST</strong></li>
            <li>Add header: <code className="text-foreground">Content-Type: application/json</code></li>
            <li>In the request body, map the subscriber fields</li>
          </ol>
        </div>

        <button onClick={handleVerify} disabled={verifying} className="dark-btn-secondary text-xs w-full">
          {verifying ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          <span className="ml-1">{verifying ? "Verifying…" : "Verify Connection"}</span>
        </button>
        {verifyResult === "connected" && (
          <div className="flex items-center gap-2 text-xs text-success"><span className="h-2 w-2 rounded-full bg-success" /> Connected successfully</div>
        )}
        {verifyResult === "not_connected" && (
          <div className="flex items-center gap-2 text-xs text-destructive"><span className="h-2 w-2 rounded-full bg-destructive" /> Not connected — check your credentials above</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="dark-btn-ghost"><ArrowLeft size={14} /> Back</button>
        <div className="flex items-center gap-3"><button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Skip for now</button><button onClick={onNext} disabled={saving} className="dark-btn-primary">{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save & Continue <ArrowRight size={14} /></button></div>
      </div>
    </div>
  );
}

function Step5({ onSelect, onBack, saving }: { onSelect: (mode: "autopilot" | "copilot") => void; onBack: () => void; saving: boolean }) {
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">Choose Your AI Mode</h2><p className="text-sm text-muted-foreground">How do you want your AI to work? You can change this anytime in Settings.</p></div>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { setLoadingMode("autopilot"); onSelect("autopilot"); }} disabled={saving || loadingMode !== null} className="dark-card p-4 text-left hover:border-primary transition-all space-y-2">
          <p className="text-sm font-bold">🤖 AI Autopilot</p>
          <p className="text-xs text-muted-foreground">Fully automated DM handling 24/7</p>
          {loadingMode === "autopilot" && <Loader2 size={14} className="animate-spin text-primary" />}
        </button>
        <button onClick={() => { setLoadingMode("copilot"); onSelect("copilot"); }} disabled={saving || loadingMode !== null} className="dark-card p-4 text-left hover:border-primary transition-all space-y-2">
          <p className="text-sm font-bold">🧠 AI Co-Pilot</p>
          <p className="text-xs text-muted-foreground">AI suggests replies, you send them</p>
          {loadingMode === "copilot" && <Loader2 size={14} className="animate-spin text-primary" />}
        </button>
      </div>
      <button onClick={onBack} className="dark-btn-ghost"><ArrowLeft size={14} /> Back</button>
    </div>
  );
}

const Onboarding = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [bizInfo, setBizInfo] = useState({ businessName: localStorage.getItem("plcs_company_name") || "", description: "", notes: "" });
  const [persona, setPersona] = useState({ tone: "professional", responseLength: "medium", personaStyle: "busy", emojis: false });
  const [quoteEnabled, setQuoteEnabled] = useState<Record<string, boolean>>({ full_name: true, email_address: true, phone_number: true });
  const [manychat, setManychat] = useState({ apiKey: "", pageId: "" });

  // Fetch onboarding status to restore progress
  useEffect(() => {
    api.getOnboardingStatus()
      .then((res) => {
        const completed = new Set<number>();
        const steps = res?.completed_steps || res?.steps || [];
        if (Array.isArray(steps)) {
          steps.forEach((s: any) => {
            const num = typeof s === "number" ? s : s?.step;
            if (num) completed.add(num);
          });
        }
        setCompletedSteps(completed);
        // Restore to first incomplete step
        const currentStep = res?.current_step;
        if (currentStep && currentStep >= 1 && currentStep <= TOTAL_STEPS) {
          setStep(currentStep);
        } else {
          // Find first incomplete step
          for (let i = 1; i <= TOTAL_STEPS; i++) {
            if (!completed.has(i)) { setStep(i); break; }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  const markComplete = (stepNum: number) => {
    setCompletedSteps((prev) => new Set([...prev, stepNum]));
  };

  const saveStep1 = async () => { setSaving(true); try { await api.putCompanyInfo({ business_description: bizInfo.description, additional_notes: bizInfo.notes }); if (bizInfo.businessName.trim()) { await api.patchCompany(companyId, { company_name: bizInfo.businessName.trim() }).catch(() => {}); } markComplete(1); setStep(2); } catch (e: any) { toast({ title: "Failed to save", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const saveStep2 = async () => { setSaving(true); try { await api.putChatbotBehavior({ tone: persona.tone, response_length: persona.responseLength, persona_style: persona.personaStyle, emojis_enabled: persona.emojis }); markComplete(2); setStep(3); } catch (e: any) { toast({ title: "Failed to save", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const saveStep3 = async () => { setSaving(true); try { const presets = QUOTE_PRESETS.map((p, i) => ({ name: p.key, label: p.label, is_enabled: !!quoteEnabled[p.key], priority: i + 1 })); await api.putQuoteFields({ presets }); markComplete(3); setStep(4); } catch (e: any) { toast({ title: "Failed to save", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const saveStep4 = async (skipManychat = false) => { setSaving(true); try { if (!skipManychat && manychat.apiKey.trim()) { await api.saveManychatSettings({ manychat_api_key: manychat.apiKey.trim(), manychat_page_id: manychat.pageId.trim() }); } markComplete(4); setStep(5); } catch (e: any) { toast({ title: "Failed to save ManyChat settings", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const finishSetup = async (mode: "autopilot" | "copilot") => {
    setSaving(true);
    try {
      await api.setOperatingMode(mode);
      markComplete(5);
      // Call onboarding complete
      await api.completeOnboarding().catch(() => {});
      toast({ title: "Setup complete!", description: "Your workspace is ready." });
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast({ title: "Failed to set mode", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loadingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg px-6 py-12">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">P</span>
          </div>
          <div className="font-semibold text-sm text-foreground">Setup Wizard</div>
        </div>
        <StepProgress step={step} completedSteps={completedSteps} />
        <div className="dark-card p-6">
          {step === 1 && <Step1 data={bizInfo} onChange={(d) => setBizInfo((p) => ({ ...p, ...d }))} onNext={saveStep1} saving={saving} />}
          {step === 2 && <Step2 data={persona} onChange={(d) => setPersona((p) => ({ ...p, ...d }))} onNext={saveStep2} onBack={() => setStep(1)} saving={saving} />}
          {step === 3 && <Step3 enabled={quoteEnabled} onToggle={(key) => setQuoteEnabled((p) => ({ ...p, [key]: !p[key] }))} onNext={saveStep3} onBack={() => setStep(2)} saving={saving} />}
          {step === 4 && <Step4 data={manychat} onChange={(d) => setManychat((p) => ({ ...p, ...d }))} onNext={() => saveStep4(false)} onSkip={() => saveStep4(true)} onBack={() => setStep(3)} saving={saving} />}
          {step === 5 && <Step5 onSelect={finishSetup} onBack={() => setStep(4)} saving={saving} />}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
