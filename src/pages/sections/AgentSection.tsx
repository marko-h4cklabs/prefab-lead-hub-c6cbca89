import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Sliders, FileText, MessagesSquare } from "lucide-react";
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
      title: "Identity & Persona",
      description: "Name, backstory, and personality of your AI agent",
      icon: User,
      iconBg: "bg-success/20",
      iconColor: "text-success",
      route: "/dashboard/agent/identity",
      preview: <span className="text-sm text-muted-foreground">Agent: <span className="text-foreground font-medium">{agentName}</span></span>,
    },
    {
      title: "Behavior & Strategy",
      description: "Tone, style, guardrails, and conversation strategy",
      icon: Sliders,
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
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
      iconBg: "bg-info/20",
      iconColor: "text-info",
      route: "/dashboard/agent/quote",
      preview: <span className="text-sm text-muted-foreground">{activeFields} fields configured, {requiredFields} required</span>,
    },
    {
      title: "Test Chat",
      description: "Chat with your AI agent to test behavior",
      icon: MessagesSquare,
      iconBg: "bg-success/20",
      iconColor: "text-success",
      route: "/dashboard/agent/test",
      preview: <span className="text-sm text-success font-medium">Ready to test</span>,
    },
  ];

  return (
    <div className="h-full flex items-center justify-center px-6">
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] w-full">
        {cards.map((card) => (
          <StaggerItem key={card.route}>
            <motion.button
              onClick={() => navigate(card.route)}
              whileHover={{ scale: 1.02 }}
              className="w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-6 transition-all duration-200 hover:border-primary hover:shadow-[0_0_20px_hsl(48_92%_53%/0.15)] flex gap-5 h-[240px] md:h-[260px]"
            >
              <div className="flex flex-col justify-between flex-[0_0_40%]">
                <div>
                  <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
                    <card.icon size={24} className={card.iconColor} />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
                </div>
                <span className="text-xs text-primary font-medium">Open →</span>
              </div>
              <div className="flex-1 flex items-center justify-center rounded-lg bg-[hsl(0_0%_5%)] border border-[hsl(0_0%_13%)] p-4">
                {card.preview}
              </div>
            </motion.button>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
};

export default AgentSection;
