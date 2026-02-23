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

/* ─── Progress Bar ─── */
function StepProgress({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {Math.round((step / TOTAL_STEPS) * 100)}%
        </span>
      </div>
      <div className="w-full h-2 rounded-sm bg-muted overflow-hidden">
        <div
          className="h-full rounded-sm bg-accent transition-all duration-300"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Step 1: Business Info ─── */
function Step1({
  data,
  onChange,
  onNext,
  saving,
}: {
  data: { businessName: string; description: string; notes: string };
  onChange: (d: Partial<typeof data>) => void;
  onNext: () => void;
  saving: boolean;
}) {
  const valid = data.businessName.trim().length > 0;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Let's set up your AI appointment setter</h2>
        <p className="text-sm text-muted-foreground">Tell us about your business so your AI assistant can represent you accurately.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Business Name</label>
        <input
          value={data.businessName}
          onChange={(e) => onChange({ businessName: e.target.value })}
          className="industrial-input w-full"
          placeholder="Your company name"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Describe your business in 2-3 sentences
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="industrial-input w-full min-h-[80px] resize-y"
          placeholder="We provide residential painting services in the Zagreb area…"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Any additional context for your AI assistant?
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="industrial-input w-full min-h-[60px] resize-y"
          placeholder="Optional: special instructions, pricing notes, etc."
        />
      </div>
      <div className="flex justify-end">
        <button onClick={onNext} disabled={!valid || saving} className="industrial-btn-accent">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 2: Persona ─── */
function Step2({
  data,
  onChange,
  onNext,
  onBack,
  saving,
}: {
  data: { tone: string; responseLength: string; personaStyle: string; emojis: boolean };
  onChange: (d: Partial<typeof data>) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">How should your AI communicate?</h2>
        <p className="text-sm text-muted-foreground">Configure the personality and style of your AI assistant.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Tone</label>
        <select value={data.tone} onChange={(e) => onChange({ tone: e.target.value })} className="industrial-input w-full">
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Response Length</label>
        <select value={data.responseLength} onChange={(e) => onChange({ responseLength: e.target.value })} className="industrial-input w-full">
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Persona Style</label>
        <select value={data.personaStyle} onChange={(e) => onChange({ personaStyle: e.target.value })} className="industrial-input w-full">
          <option value="busy">Busy — straight to the point, no fluff</option>
          <option value="explanational">Explanational — detailed and thorough</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={data.emojis}
            onChange={(e) => onChange({ emojis: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
        <span className="text-sm">Enable emojis in responses</span>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="industrial-btn-ghost"><ArrowLeft size={14} /> Back</button>
        <button onClick={onNext} disabled={saving} className="industrial-btn-accent">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 3: Quote Fields ─── */
function Step3({
  enabled,
  onToggle,
  onNext,
  onBack,
  saving,
}: {
  enabled: Record<string, boolean>;
  onToggle: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">What information do you collect from leads?</h2>
        <p className="text-sm text-muted-foreground">Your AI will ask leads for this information during the conversation.</p>
      </div>
      <div className="space-y-2">
        {QUOTE_PRESETS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-3 industrial-card px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <input
              type="checkbox"
              checked={!!enabled[key]}
              onChange={() => onToggle(key)}
              className="h-4 w-4 rounded-sm border-border text-accent focus:ring-accent"
            />
            <span className="text-sm font-medium">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="industrial-btn-ghost"><ArrowLeft size={14} /> Back</button>
        <button onClick={onNext} disabled={saving} className="industrial-btn-accent">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: Instagram ─── */
function Step4({
  data,
  onChange,
  onFinish,
  onSkip,
  onBack,
  saving,
}: {
  data: { accountId: string; pageToken: string };
  onChange: (d: Partial<typeof data>) => void;
  onFinish: () => void;
  onSkip: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${API_BASE}/api/meta/webhook`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Connect your Instagram account</h2>
        <p className="text-sm text-muted-foreground">
          To receive and respond to Instagram DMs automatically, connect your Instagram Business account.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Your Webhook URL
        </label>
        <div className="flex gap-2">
          <input value={webhookUrl} readOnly className="industrial-input flex-1 text-xs font-mono" />
          <button onClick={handleCopy} className="industrial-btn-ghost px-3">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Instagram Account ID (numeric)
        </label>
        <input
          value={data.accountId}
          onChange={(e) => onChange({ accountId: e.target.value })}
          className="industrial-input w-full"
          placeholder="e.g. 17841400123456789"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Find this in Meta Business Suite → Settings → Instagram Accounts
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Page Access Token
        </label>
        <input
          value={data.pageToken}
          onChange={(e) => onChange({ pageToken: e.target.value })}
          type="password"
          className="industrial-input w-full"
          placeholder="Paste your long-lived page access token"
        />
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="industrial-btn-ghost"><ArrowLeft size={14} /> Back</button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Skip for now
          </button>
          <button onClick={onFinish} disabled={saving} className="industrial-btn-accent">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Finish Setup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Onboarding Page ─── */

const Onboarding = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [bizInfo, setBizInfo] = useState({
    businessName: localStorage.getItem("plcs_company_name") || "",
    description: "",
    notes: "",
  });

  // Step 2 state
  const [persona, setPersona] = useState({
    tone: "professional",
    responseLength: "medium",
    personaStyle: "busy",
    emojis: false,
  });

  // Step 3 state
  const [quoteEnabled, setQuoteEnabled] = useState<Record<string, boolean>>({
    full_name: true,
    email_address: true,
    phone_number: true,
  });

  // Step 4 state
  const [instagram, setInstagram] = useState({ accountId: "", pageToken: "" });

  const saveStep1 = async () => {
    setSaving(true);
    try {
      await api.putCompanyInfo({
        business_description: bizInfo.description,
        additional_notes: bizInfo.notes,
      });
      if (bizInfo.businessName.trim()) {
        await api.patchCompany(companyId, { company_name: bizInfo.businessName.trim() }).catch(() => {});
      }
      setStep(2);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    setSaving(true);
    try {
      await api.putChatbotBehavior({
        tone: persona.tone,
        response_length: persona.responseLength,
        persona_style: persona.personaStyle,
        emojis_enabled: persona.emojis,
      });
      setStep(3);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveStep3 = async () => {
    setSaving(true);
    try {
      const presets = QUOTE_PRESETS.map((p, i) => ({
        name: p.key,
        label: p.label,
        is_enabled: !!quoteEnabled[p.key],
        priority: i + 1,
      }));
      await api.putQuoteFields({ presets });
      setStep(4);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const finishSetup = async (skipInstagram = false) => {
    setSaving(true);
    try {
      if (!skipInstagram && instagram.accountId.trim() && instagram.pageToken.trim()) {
        await api.saveInstagramSettings({
          instagram_account_id: instagram.accountId.trim(),
          meta_page_access_token: instagram.pageToken.trim(),
        });
      }
      toast({ title: "Setup complete!", description: "Your workspace is ready." });
      navigate("/leads");
    } catch (e: any) {
      toast({ title: "Failed to save Instagram settings", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg px-6 py-12">
        <div className="mb-6 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Prefab Lead Control
          </div>
          <div className="font-bold text-sm text-foreground">Setup Wizard</div>
        </div>

        <StepProgress step={step} />

        <div className="industrial-card p-6">
          {step === 1 && (
            <Step1
              data={bizInfo}
              onChange={(d) => setBizInfo((p) => ({ ...p, ...d }))}
              onNext={saveStep1}
              saving={saving}
            />
          )}
          {step === 2 && (
            <Step2
              data={persona}
              onChange={(d) => setPersona((p) => ({ ...p, ...d }))}
              onNext={saveStep2}
              onBack={() => setStep(1)}
              saving={saving}
            />
          )}
          {step === 3 && (
            <Step3
              enabled={quoteEnabled}
              onToggle={(key) => setQuoteEnabled((p) => ({ ...p, [key]: !p[key] }))}
              onNext={saveStep3}
              onBack={() => setStep(2)}
              saving={saving}
            />
          )}
          {step === 4 && (
            <Step4
              data={instagram}
              onChange={(d) => setInstagram((p) => ({ ...p, ...d }))}
              onFinish={() => finishSetup(false)}
              onSkip={() => finishSetup(true)}
              onBack={() => setStep(3)}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
