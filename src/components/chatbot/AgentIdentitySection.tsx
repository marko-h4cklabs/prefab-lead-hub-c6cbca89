import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

interface IdentityState {
  agent_name: string;
  agent_backstory: string;
  business_name: string;
  business_description: string;
  additional_context: string;
}

const EMPTY: IdentityState = {
  agent_name: "",
  agent_backstory: "",
  business_name: "",
  business_description: "",
  additional_context: "",
};

const AgentIdentitySection = ({ onSaved }: { onSaved?: () => void }) => {
  const [data, setData] = useState<IdentityState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(EMPTY));

  useEffect(() => {
    Promise.all([
      api.getAgentIdentity().catch(() => null),
      api.getCompanyInfo().catch(() => null),
    ]).then(([identity, company]) => {
      const merged: IdentityState = {
        agent_name: identity?.agent_name || "",
        agent_backstory: identity?.agent_backstory || "",
        business_name: identity?.business_name || company?.business_name || "",
        business_description: identity?.business_description || company?.business_description || "",
        additional_context: identity?.additional_context || company?.additional_notes || "",
      };
      setData(merged);
      initialRef.current = JSON.stringify(merged);
    }).finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<IdentityState>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      setIsDirty(JSON.stringify(next) !== initialRef.current);
      return next;
    });
  };

  const handleSave = () => {
    setSaving(true);
    api.putAgentIdentity(data)
      .then(() => {
        toast({ title: "Saved ✓", description: "Agent identity updated." });
        initialRef.current = JSON.stringify(data);
        setIsDirty(false);
        onSaved?.();
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground">🤖 Agent Identity</h2>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent Name</label>
        <input
          value={data.agent_name}
          onChange={(e) => update({ agent_name: e.target.value })}
          className="dark-input w-full"
          placeholder="e.g. Alex, Sarah, Jordan"
        />
        <p className="text-[11px] text-muted-foreground mt-1">This is the name your AI will use when talking to leads</p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent Backstory</label>
        <textarea
          value={data.agent_backstory}
          onChange={(e) => update({ agent_backstory: e.target.value })}
          className="dark-input w-full h-20 resize-y"
          placeholder="e.g. I've been with the company for 3 years helping clients find the right solution..."
        />
        <p className="text-[11px] text-muted-foreground mt-1">Gives the AI a believable human persona. Leads may ask about you.</p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Business Name</label>
        <input
          value={data.business_name}
          onChange={(e) => update({ business_name: e.target.value })}
          className="dark-input w-full"
          placeholder="Your company name"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What you do / Business Description</label>
        <textarea
          value={data.business_description}
          onChange={(e) => update({ business_description: e.target.value })}
          className="dark-input w-full h-28 resize-y"
          placeholder="Describe your business, what you offer, who you help, and the results you deliver..."
        />
        <p className="text-[11px] text-muted-foreground mt-1">The more detail here, the more accurately the AI can represent your business</p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Additional Context</label>
        <textarea
          value={data.additional_context}
          onChange={(e) => update({ additional_context: e.target.value })}
          className="dark-input w-full h-20 resize-y"
          placeholder="Pricing, special offers, geographic limitations, anything else the AI should know..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={`dark-btn ${isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"}`}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
};

export default AgentIdentitySection;
