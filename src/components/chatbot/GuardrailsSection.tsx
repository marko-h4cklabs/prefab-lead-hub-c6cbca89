import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Save, Loader2, Check, X } from "lucide-react";

interface GuardrailsState {
  bot_deny_response: string;
  prohibited_topics: string;
  handoff_trigger: string;
  human_fallback_message: string;
  max_messages_before_handoff: number;
}

const DEFAULTS: GuardrailsState = {
  bot_deny_response: "",
  prohibited_topics: "",
  handoff_trigger: "",
  human_fallback_message: "",
  max_messages_before_handoff: 20,
};

// Note: handoff_trigger, human_fallback_message, max_messages_before_handoff
// are still sent to the API for backward compat, but the UI for advanced
// handoff rules is now in the Human-Break panel (right side).

const STORAGE_KEY = "chatbot_guardrails_draft";

const GuardrailsSection = ({ onSaved, onDirty }: { onSaved?: () => void; onDirty?: () => void }) => {
  const [data, setData] = useState<GuardrailsState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef(JSON.stringify(DEFAULTS));

  useEffect(() => {
    api.getGuardrails()
      .then((res) => {
        const hasRealData = res.bot_deny_response || res.prohibited_topics || res.handoff_trigger;
        if (hasRealData) {
          const merged: GuardrailsState = {
            bot_deny_response: res.bot_deny_response || "",
            prohibited_topics: res.prohibited_topics || "",
            handoff_trigger: res.handoff_trigger || "",
            human_fallback_message: res.human_fallback_message || "",
            max_messages_before_handoff: res.max_messages_before_handoff ?? 20,
          };
          setData(merged);
          initialRef.current = JSON.stringify(merged);
          sessionStorage.removeItem(STORAGE_KEY);
        } else {
          const draft = sessionStorage.getItem(STORAGE_KEY);
          if (draft) {
            try { setData(JSON.parse(draft)); } catch {}
          }
        }
      })
      .catch(() => {
        const draft = sessionStorage.getItem(STORAGE_KEY);
        if (draft) {
          try { setData(JSON.parse(draft)); } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // SessionStorage backup
  useEffect(() => {
    if (!loading) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, loading]);

  const update = (patch: Partial<GuardrailsState>) => {
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
      await api.putGuardrails(data);
      initialRef.current = JSON.stringify(data);
      setIsDirty(false);
      setSaveStatus('saved');
      sessionStorage.removeItem(STORAGE_KEY);
      onSaved?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Failed to save. Please try again.');
    }
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground">🛡️ Guardrails</h2>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">When asked "are you a bot?", reply with:</label>
        <input value={data.bot_deny_response} onChange={(e) => update({ bot_deny_response: e.target.value })} className="dark-input w-full" placeholder={"I'm a real person, I just respond fast! 😄"} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Prohibited Topics</label>
        <textarea value={data.prohibited_topics} onChange={(e) => update({ prohibited_topics: e.target.value })} className="dark-input w-full h-20 resize-y" placeholder="e.g. politics, religion, competitor pricing, refund disputes..." />
        <p className="text-[11px] text-muted-foreground mt-1">The AI will avoid these topics entirely</p>
      </div>

      <div className="bg-secondary/30 rounded-lg px-3 py-2">
        <p className="text-[10px] text-muted-foreground">Advanced handoff rules (keyword triggers, auto-pause, bridging messages) are configured in the <b className="text-foreground">Human-Break</b> tab on the right panel.</p>
      </div>

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

export default GuardrailsSection;
