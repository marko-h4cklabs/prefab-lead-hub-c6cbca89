import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Sliders, FileText, MessagesSquare, ArrowLeft, Home } from "lucide-react";
import { api } from "@/lib/apiClient";
import { StaggerContainer, StaggerItem } from "@/components/catalog/PageTransition";
import { motion } from "framer-motion";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

const ACCENT = {
  border: "hover:border-[hsl(142_71%_45%)]",
  shadow: "hover:shadow-[0_0_20px_hsl(142_71%_45%/0.15)]",
  text: "text-[hsl(142_71%_45%)]",
  iconBg: "bg-[hsl(142_71%_45%/0.20)]",
  iconText: "text-[hsl(142_71%_45%)]",
};

const AgentSection = () => {
  const navigate = useNavigate();
  const [agentName, setAgentName] = useState("");
  const [behavior, setBehavior] = useState<any>(null);
  const [quoteFields, setQuoteFields] = useState<any[]>([]);

  useEffect(() => {
    api.getChatbotBehavior().then((res) => {
      setBehavior(res);
      setAgentName(res?.persona_style ?? res?.agent_name ?? "AI Agent");
    }).catch(() => {});
    api.getQuoteFields().then((r) => setQuoteFields(normalizeList(r, ["presets", "fields", "data"]))).catch(() => {});
  }, []);

  const activeFields = quoteFields.filter((f: any) => f.enabled !== false).length;
  const requiredFields = quoteFields.filter((f: any) => f.required).length;

  const cards = [
    {
      title: "Database",
      description: "Agent identity, business info, and persona configuration",
      icon: User,
      route: "/dashboard/agent/identity",
      preview: <span className="text-sm text-muted-foreground">Agent: <span className="text-foreground font-medium">{agentName}</span></span>,
    },
    {
      title: "Behavior & Strategy",
      description: "Tone, style, guardrails, and conversation strategy",
      icon: Sliders,
      route: "/dashboard/agent/behavior",
      preview: (
        <div className="text-sm text-muted-foreground space-y-1 text-center">
          <div>Tone: <span className="text-foreground">{behavior?.tone || "—"}</span></div>
          <div>Length: <span className="text-foreground">{behavior?.response_length || "—"}</span></div>
        </div>
      ),
    },
    {
      title: "Quote Builder",
      description: "Configure what information your AI collects",
      icon: FileText,
      route: "/dashboard/agent/quote",
      preview: <span className="text-sm text-muted-foreground">{activeFields} fields configured, {requiredFields} required</span>,
    },
    {
      title: "Test Chat",
      description: "Chat with your AI agent to test behavior",
      icon: MessagesSquare,
      route: "/dashboard/agent/test",
      preview: <span className={`text-sm font-medium ${ACCENT.text}`}>Ready to test</span>,
    },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Center glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, hsl(142 71% 45% / 0.07) 0%, transparent 55%)' }}
      />

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] w-full relative z-10">
        {cards.map((card) => (
          <StaggerItem key={card.route}>
            <motion.button
              onClick={() => navigate(card.route)}
              whileHover={{ scale: 1.02 }}
              className={`w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-6 transition-all duration-200 ${ACCENT.border} ${ACCENT.shadow} flex gap-5 h-[240px] md:h-[260px]`}
            >
              <div className="flex flex-col justify-between flex-[0_0_40%]">
                <div>
                  <div className={`w-12 h-12 rounded-xl ${ACCENT.iconBg} flex items-center justify-center mb-3`}>
                    <card.icon size={24} className={ACCENT.iconText} />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
                </div>
                <span className={`text-xs font-medium ${ACCENT.text}`}>Open →</span>
              </div>
              <div className="flex-1 flex items-center justify-center rounded-lg bg-[hsl(0_0%_5%)] border border-[hsl(0_0%_13%)] p-4">
                {card.preview}
              </div>
            </motion.button>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Back / Home */}
      <div className="flex items-center gap-4 mt-8 relative z-10">
        <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Home size={14} /> Home
        </button>
      </div>
    </div>
  );
};

export default AgentSection;
