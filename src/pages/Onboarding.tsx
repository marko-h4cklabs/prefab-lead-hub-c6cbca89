import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, Copy, ArrowRight, ArrowLeft } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOTAL_STEPS = 4;

const QUOTE_PRESETS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'email_address', label: 'Email Address' },
  { key: 'phone_number', label: 'Phone Number' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'time_window', label: 'Time Window' },
  { key: 'notes', label: 'Additional Notes' },
];

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
        <span className="text-xs text-muted-foreground">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
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

function Step4({ data, onChange, onFinish, onSkip, onBack, saving }: { data: { accountId: string; pageToken: string }; onChange: (d: Partial<typeof data>) => void; onFinish: () => void; onSkip: () => void; onBack: () => void; saving: boolean }) {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${API_BASE}/api/meta/webhook`;
  const handleCopy = () => { navigator.clipboard.writeText(webhookUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-bold mb-1">Connect Instagram</h2><p className="text-sm text-muted-foreground">Connect your Instagram Business account for auto DM replies.</p></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Webhook URL</label><div className="flex gap-2"><input value={webhookUrl} readOnly className="dark-input flex-1 text-xs font-mono" /><button onClick={handleCopy} className="dark-btn-ghost px-3">{copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}</button></div></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Instagram Account ID</label><input value={data.accountId} onChange={(e) => onChange({ accountId: e.target.value })} className="dark-input w-full" placeholder="e.g. 17841400123456789" /></div>
      <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">Page Access Token</label><input value={data.pageToken} onChange={(e) => onChange({ pageToken: e.target.value })} type="password" className="dark-input w-full" placeholder="Paste your long-lived token" /></div>
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="dark-btn-ghost"><ArrowLeft size={14} /> Back</button>
        <div className="flex items-center gap-3"><button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Skip for now</button><button onClick={onFinish} disabled={saving} className="dark-btn-primary">{saving ? <Loader2 size={14} className="animate-spin" /> : null} Finish Setup</button></div>
      </div>
    </div>
  );
}

const Onboarding = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [bizInfo, setBizInfo] = useState({ businessName: localStorage.getItem("plcs_company_name") || "", description: "", notes: "" });
  const [persona, setPersona] = useState({ tone: "professional", responseLength: "medium", personaStyle: "busy", emojis: false });
  const [quoteEnabled, setQuoteEnabled] = useState<Record<string, boolean>>({ full_name: true, email_address: true, phone_number: true });
  const [instagram, setInstagram] = useState({ accountId: "", pageToken: "" });

  const saveStep1 = async () => { setSaving(true); try { await api.putCompanyInfo({ business_description: bizInfo.description, additional_notes: bizInfo.notes }); if (bizInfo.businessName.trim()) { await api.patchCompany(companyId, { company_name: bizInfo.businessName.trim() }).catch(() => {}); } setStep(2); } catch (e: any) { toast({ title: "Failed to save", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const saveStep2 = async () => { setSaving(true); try { await api.putChatbotBehavior({ tone: persona.tone, response_length: persona.responseLength, persona_style: persona.personaStyle, emojis_enabled: persona.emojis }); setStep(3); } catch (e: any) { toast({ title: "Failed to save", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const saveStep3 = async () => { setSaving(true); try { const presets = QUOTE_PRESETS.map((p, i) => ({ name: p.key, label: p.label, is_enabled: !!quoteEnabled[p.key], priority: i + 1 })); await api.putQuoteFields({ presets }); setStep(4); } catch (e: any) { toast({ title: "Failed to save", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };
  const finishSetup = async (skipInstagram = false) => { setSaving(true); try { if (!skipInstagram && instagram.accountId.trim() && instagram.pageToken.trim()) { await api.saveInstagramSettings({ instagram_account_id: instagram.accountId.trim(), meta_page_access_token: instagram.pageToken.trim() }); } toast({ title: "Setup complete!", description: "Your workspace is ready." }); navigate("/leads"); } catch (e: any) { toast({ title: "Failed to save Instagram settings", description: e?.message, variant: "destructive" }); } finally { setSaving(false); } };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg px-6 py-12">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">P</span>
          </div>
          <div className="font-semibold text-sm text-foreground">Setup Wizard</div>
        </div>
        <StepProgress step={step} />
        <div className="dark-card p-6">
          {step === 1 && <Step1 data={bizInfo} onChange={(d) => setBizInfo((p) => ({ ...p, ...d }))} onNext={saveStep1} saving={saving} />}
          {step === 2 && <Step2 data={persona} onChange={(d) => setPersona((p) => ({ ...p, ...d }))} onNext={saveStep2} onBack={() => setStep(1)} saving={saving} />}
          {step === 3 && <Step3 enabled={quoteEnabled} onToggle={(key) => setQuoteEnabled((p) => ({ ...p, [key]: !p[key] }))} onNext={saveStep3} onBack={() => setStep(2)} saving={saving} />}
          {step === 4 && <Step4 data={instagram} onChange={(d) => setInstagram((p) => ({ ...p, ...d }))} onFinish={() => finishSetup(false)} onSkip={() => finishSetup(true)} onBack={() => setStep(3)} saving={saving} />}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
