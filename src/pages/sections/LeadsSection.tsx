import { useNavigate } from "react-router-dom";
import { MessageSquare, TrendingUp, CalendarDays, BarChart3, ArrowLeft, Home } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/catalog/PageTransition";
import { motion } from "framer-motion";

const ACCENT = {
  border: "hover:border-[hsl(48_92%_53%)]",
  shadow: "hover:shadow-[0_0_20px_hsl(48_92%_53%/0.15)]",
  text: "text-[hsl(48_92%_53%)]",
  iconBg: "bg-[hsl(48_92%_53%/0.20)]",
  iconText: "text-[hsl(48_92%_53%)]",
};

const cards = [
  {
    title: "Inbox",
    description: "Live conversations and AI reply suggestions",
    icon: MessageSquare,
    route: "/dashboard/leads/inbox",
  },
  {
    title: "Analytics",
    description: "Performance metrics, trends, and insights",
    icon: BarChart3,
    route: "/dashboard/leads/analytics",
  },
  {
    title: "Pipeline & Deals",
    description: "Track deals through your sales pipeline",
    icon: TrendingUp,
    route: "/dashboard/leads/pipeline",
  },
  {
    title: "Calendar",
    description: "Appointments, scheduling, and reminders",
    icon: CalendarDays,
    route: "/dashboard/leads/calendar",
  },
];

const LeadsSection = () => {
  const navigate = useNavigate();

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
        style={{ background: 'radial-gradient(ellipse at 50% 50%, hsl(48 92% 53% / 0.07) 0%, transparent 55%)' }}
      />

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[800px] w-full relative z-10">
        {cards.map((card) => (
          <StaggerItem key={card.route}>
            <motion.button
              onClick={() => navigate(card.route)}
              whileHover={{ scale: 1.02 }}
              className={`w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-5 transition-all duration-200 ${ACCENT.border} ${ACCENT.shadow} flex flex-col gap-3 h-[180px]`}
            >
              <div className={`w-10 h-10 rounded-xl ${ACCENT.iconBg} flex items-center justify-center`}>
                <card.icon size={20} className={ACCENT.iconText} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground mb-1">{card.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
              <span className={`text-xs font-medium ${ACCENT.text}`}>Open →</span>
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

export default LeadsSection;
