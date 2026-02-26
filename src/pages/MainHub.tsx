import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Bot, Wrench, ArrowLeft, Home } from "lucide-react";
import { api, requireCompanyId } from "@/lib/apiClient";
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

const sections = [
  {
    title: "LEADS & CRM",
    description: "Manage leads, conversations, pipeline, and appointments.",
    icon: Users,
    route: "/dashboard/leads",
    gradient: "from-[hsl(48_92%_53%/0.15)] to-transparent",
    glowColor: "hsl(48 92% 53% / 0.08)",
    hoverBorder: "hover:border-[hsl(48_92%_53%)]",
    hoverShadow: "hover:shadow-[0_0_20px_hsl(48_92%_53%/0.15)]",
    accentText: "text-[hsl(48_92%_53%)]",
    iconHover: "group-hover:text-[hsl(48_92%_53%)]",
    iconBorderHover: "group-hover:border-[hsl(48_92%_53%/0.5)]",
  },
  {
    title: "AI AGENT",
    description: "Configure your AI assistant's identity, behavior, and capabilities.",
    icon: Bot,
    route: "/dashboard/agent",
    gradient: "from-[hsl(142_71%_45%/0.15)] to-transparent",
    glowColor: "hsl(142 71% 45% / 0.08)",
    hoverBorder: "hover:border-[hsl(142_71%_45%)]",
    hoverShadow: "hover:shadow-[0_0_20px_hsl(142_71%_45%/0.15)]",
    accentText: "text-[hsl(142_71%_45%)]",
    iconHover: "group-hover:text-[hsl(142_71%_45%)]",
    iconBorderHover: "group-hover:border-[hsl(142_71%_45%/0.5)]",
  },
  {
    title: "SETTINGS & TOOLS",
    description: "Integrations, scheduling, analytics, and account management.",
    icon: Wrench,
    route: "/dashboard/settings",
    gradient: "from-[hsl(217_91%_60%/0.15)] to-transparent",
    glowColor: "hsl(217 91% 60% / 0.08)",
    hoverBorder: "hover:border-[hsl(217_91%_60%)]",
    hoverShadow: "hover:shadow-[0_0_20px_hsl(217_91%_60%/0.15)]",
    accentText: "text-[hsl(217_91%_60%)]",
    iconHover: "group-hover:text-[hsl(217_91%_60%)]",
    iconBorderHover: "group-hover:border-[hsl(217_91%_60%/0.5)]",
  },
];

const MainHub = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();
  const [stats, setStats] = useState({ activeLeads: 0, appointmentsToday: 0, messagesThisWeek: 0 });

  useEffect(() => {
    api.getAnalyticsOverview().then((res) => {
      setStats({
        activeLeads: res?.active_leads ?? res?.total_leads ?? 0,
        appointmentsToday: res?.appointments_today ?? 0,
        messagesThisWeek: res?.messages_this_week ?? res?.messages_sent ?? 0,
      });
    }).catch(() => {});
  }, [companyId]);

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1200px] w-full">
        {sections.map((section) => (
          <StaggerItem key={section.route}>
            <motion.button
              onClick={() => navigate(section.route)}
              whileHover={{ scale: 1.02 }}
              className={`w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] overflow-hidden transition-all duration-200 ${section.hoverBorder} ${section.hoverShadow} group h-[340px] md:h-[380px] flex flex-col`}
            >
              {/* Gradient top section */}
              <div
                className={`flex-[0_0_40%] flex flex-col items-center justify-center bg-gradient-to-b ${section.gradient}`}
              >
                <div className={`w-16 h-16 rounded-2xl bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_16%)] flex items-center justify-center mb-3 ${section.iconBorderHover} transition-colors`}>
                  <section.icon size={28} className={`text-muted-foreground ${section.iconHover} transition-colors`} />
                </div>
                <h2 className="text-lg font-bold text-foreground tracking-wider">{section.title}</h2>
              </div>

              {/* Bottom section */}
              <div className="flex-[0_0_60%] p-6 flex flex-col justify-between">
                <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
                <div className={`flex items-center text-xs font-medium mt-4 group-hover:translate-x-1 transition-transform ${section.accentText}`}>
                  Explore →
                </div>
              </div>
            </motion.button>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Stats */}
      <div className="mt-8 text-xs text-muted-foreground text-center">
        {stats.activeLeads} active leads · {stats.appointmentsToday} appointments today · {stats.messagesThisWeek} messages this week
      </div>

      {/* Back / Home */}
      <div className="flex items-center gap-4 mt-4">
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

export default MainHub;
