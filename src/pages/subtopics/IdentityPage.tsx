import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, UserCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import AgentIdentitySection from "@/components/chatbot/AgentIdentitySection";
import PersonasSection from "@/components/chatbot/PersonasSection";
import AILearningGround from "@/components/chatbot/AILearningGround";

const IdentityPage = () => {
  const navigate = useNavigate();
  const [previewKey, setPreviewKey] = useState(0);
  const [activePersona, setActivePersona] = useState<any>(null);

  const fetchActivePersona = useCallback(() => {
    api.getPersonas()
      .then((res: unknown) => {
        const list = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.personas || (res as any)?.data || [];
        setActivePersona(list.find((p: any) => p.active) || null);
      })
      .catch(() => {});
  }, []);

  const refreshPreview = useCallback(() => {
    setPreviewKey((k) => k + 1);
    fetchActivePersona();
  }, [fetchActivePersona]);

  useEffect(() => { fetchActivePersona(); }, [fetchActivePersona]);

  return (
    <div className="h-full p-6 overflow-hidden flex flex-col">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3 shrink-0 self-start">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Active Persona Banner */}
      <div className={`shrink-0 mb-4 rounded-lg px-4 py-3 flex items-center gap-3 ${activePersona ? "bg-success/10 border border-success/30" : "bg-muted border border-border"}`}>
        {activePersona ? (
          <>
            <Zap size={18} className="text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{activePersona.name}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/20 text-success">LIVE</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Agent: {activePersona.agent_name || "\u2014"} &middot; Tone: {activePersona.tone || "professional"} &middot; Opener: {activePersona.opener_style || "greeting"}
              </p>
            </div>
          </>
        ) : (
          <>
            <UserCircle size={18} className="text-muted-foreground shrink-0" />
            <div>
              <span className="text-sm font-medium text-muted-foreground">No persona active</span>
              <p className="text-xs text-muted-foreground">Using default Agent Identity settings below</p>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <h2 className="text-lg font-bold text-foreground">Database</h2>
          <AILearningGround onApplied={refreshPreview} />
          <div className="dark-card border-l-4 border-l-primary">
            <AgentIdentitySection onDirty={() => {}} onSaved={refreshPreview} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pl-2">
          <h2 className="text-lg font-bold text-foreground">Personas</h2>
          <div className="dark-card border-l-4 border-l-primary">
            <PersonasSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentityPage;
