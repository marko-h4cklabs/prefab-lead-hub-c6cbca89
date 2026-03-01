import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, getAuthToken, invalidateCache } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, ArrowRight, ArrowLeft } from "lucide-react";

const TOTAL_STEPS = 2;
const STEP_LABELS = ["Agency Profile", "About Your Business"];

const BUSINESS_TYPES = [
  { value: "coaching", label: "Coaching" },
  { value: "agency", label: "Agency" },
  { value: "course_creator", label: "Course Creator" },
  { value: "other", label: "Other" },
];

const TEAM_SIZES = [
  { value: "solo", label: "Just me" },
  { value: "2-5", label: "2\u20135" },
  { value: "6-10", label: "6\u201310" },
  { value: "10+", label: "10+" },
];

const DM_VOLUMES = [
  { value: "under_50", label: "Under 50" },
  { value: "50-200", label: "50\u2013200" },
  { value: "200-500", label: "200\u2013500" },
  { value: "500+", label: "500+" },
];

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

function OptionCard({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Step1({ data, onChange, onNext, saving }: {
  data: { businessName: string; description: string; notes: string };
  onChange: (d: Partial<typeof data>) => void;
  onNext: () => void;
  saving: boolean;
}) {
  const valid = data.businessName.trim().length > 0 && data.description.trim().length > 0;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold mb-1">Set up your Agency profile</h2>
        <p className="text-sm text-muted-foreground">Tell us about your business so we can personalize your experience.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Business Name <span className="text-destructive">*</span>
        </label>
        <input
          value={data.businessName}
          onChange={(e) => onChange({ businessName: e.target.value })}
          className="dark-input w-full"
          placeholder="Your company name"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Business Description <span className="text-destructive">*</span>
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="dark-input w-full min-h-[80px] resize-y"
          placeholder="What does your business do? Who do you serve?"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Additional Context <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="dark-input w-full min-h-[60px] resize-y"
          placeholder="Anything else we should know — pricing, specialties, etc."
        />
      </div>
      <div className="flex justify-end">
        <button onClick={onNext} disabled={!valid || saving} className="dark-btn-primary">
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Step2({ data, onChange, onBack, onSubmit, saving }: {
  data: { businessType: string; teamSize: string; dmVolume: string };
  onChange: (d: Partial<typeof data>) => void;
  onBack: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const valid = data.businessType && data.teamSize && data.dmVolume;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">Tell us about your business</h2>
        <p className="text-sm text-muted-foreground">This helps us tailor the platform to your needs.</p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">What best describes your business?</label>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_TYPES.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={data.businessType === opt.value}
              onClick={() => onChange({ businessType: opt.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">How many setters/closers do you plan to have?</label>
        <div className="flex flex-wrap gap-2">
          {TEAM_SIZES.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={data.teamSize === opt.value}
              onClick={() => onChange({ teamSize: opt.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">How many Instagram DMs do you get per month?</label>
        <div className="flex flex-wrap gap-2">
          {DM_VOLUMES.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={data.dmVolume === opt.value}
              onClick={() => onChange({ dmVolume: opt.value })}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="dark-btn-ghost">
          <ArrowLeft size={14} /> Back
        </button>
        <button onClick={onSubmit} disabled={!valid || saving} className="dark-btn-primary w-auto">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving&hellip;</> : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  const [profile, setProfile] = useState({ businessName: "", description: "", notes: "" });
  const [business, setBusiness] = useState({ businessType: "", teamSize: "", dmVolume: "" });

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    // Pre-fill company name from existing data
    api.me()
      .then((res: any) => {
        if (res.company_name) {
          setProfile((p) => ({ ...p, businessName: p.businessName || res.company_name }));
        }
      })
      .catch(() => {
        // If token is invalid, redirect to login
        navigate("/login", { replace: true });
      })
      .finally(() => setReady(true));
  }, [navigate]);

  const handleNext = () => {
    setCompletedSteps((prev) => new Set([...prev, 1]));
    setStep(2);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await api.saveOnboardingProfile({
        business_name: profile.businessName.trim(),
        business_description: profile.description.trim(),
        additional_notes: profile.notes.trim() || undefined,
        business_type: business.businessType,
        team_size: business.teamSize,
        monthly_lead_volume: business.dmVolume,
      });

      // Clear cached api.me() so ModeGate sees the updated status (active)
      invalidateCache("/api/auth/me");
      toast({ title: "Setup complete!", description: "Welcome to EightPath." });
      navigate("/copilot", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(typeof message === "string" ? message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
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
          <img src="/favicon.ico" alt="EightPath" className="mx-auto mb-3 h-10 w-10 rounded-lg" />
          <div className="font-semibold text-sm text-foreground">Complete Your Setup</div>
        </div>
        <StepProgress step={step} completedSteps={completedSteps} />
        <div className="dark-card p-6">
          {step === 1 && (
            <Step1
              data={profile}
              onChange={(d) => setProfile((p) => ({ ...p, ...d }))}
              onNext={handleNext}
              saving={saving}
            />
          )}
          {step === 2 && (
            <Step2
              data={business}
              onChange={(d) => setBusiness((p) => ({ ...p, ...d }))}
              onBack={() => setStep(1)}
              onSubmit={handleSubmit}
              saving={saving}
            />
          )}
          {error && <p className="mt-4 text-xs text-destructive text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
