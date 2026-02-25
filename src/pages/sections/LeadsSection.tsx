import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutList, MessageSquare, TrendingUp, CalendarDays } from "lucide-react";
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

const LeadsSection = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();
  const [leadCount, setLeadCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dealStats, setDealStats] = useState<any>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    api.getLeads(companyId, { limit: 1 }).then((res) => {
      setLeadCount(res?.total ?? normalizeList(res, ["leads", "data"]).length);
    }).catch(() => {});
    api.getAnalyticsOverview().then((res) => {
      setUnreadCount(res?.needs_reply ?? res?.active_conversations ?? 0);
    }).catch(() => {});
    api.getDealStats().then(setDealStats).catch(() => {});
    api.getUpcomingAppointments().then((res) => {
      const list = normalizeList(res, ["appointments", "data", "items"]);
      setUpcomingCount(list.length);
    }).catch(() => {});
  }, [companyId]);

  const cards = [
    {
      title: "Lead Board",
      description: "View, filter, and manage all your leads",
      icon: LayoutList,
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      route: "/dashboard/leads/board",
      preview: <span className="text-sm text-muted-foreground">{leadCount} total leads</span>,
    },
    {
      title: "Inbox",
      description: "Live conversations and AI reply suggestions",
      icon: MessageSquare,
      iconBg: "bg-success/20",
      iconColor: "text-success",
      route: "/dashboard/leads/inbox",
      preview: <span className="text-sm text-muted-foreground">{unreadCount} need reply</span>,
    },
    {
      title: "Pipeline & Deals",
      description: "Track deals through your sales pipeline",
      icon: TrendingUp,
      iconBg: "bg-info/20",
      iconColor: "text-info",
      route: "/dashboard/leads/pipeline",
      preview: (
        <div className="text-sm text-muted-foreground">
          <span className="text-primary font-semibold">€{Number(dealStats?.total_revenue ?? 0).toLocaleString()}</span> total · {dealStats?.deals_closed ?? 0} deals
        </div>
      ),
    },
    {
      title: "Calendar",
      description: "Appointments, scheduling, and reminders",
      icon: CalendarDays,
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      route: "/dashboard/leads/calendar",
      preview: <span className="text-sm text-muted-foreground">{upcomingCount} upcoming</span>,
    },
  ];

  return (
    <div className="h-full flex items-center justify-center px-6">
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] w-full">
        {cards.map((card) => (
          <StaggerItem key={card.route}>
            <SectionCard card={card} onClick={() => navigate(card.route)} />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
};

function SectionCard({ card, onClick }: { card: any; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      className="w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-6 transition-all duration-200 hover:border-primary hover:shadow-[0_0_20px_hsl(48_92%_53%/0.15)] flex gap-5 h-[240px] md:h-[260px]"
    >
      {/* Left — 40% */}
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

      {/* Right — 60% (live preview) */}
      <div className="flex-1 flex items-center justify-center rounded-lg bg-[hsl(0_0%_5%)] border border-[hsl(0_0%_13%)] p-4">
        {card.preview}
      </div>
    </motion.button>
  );
}

export default LeadsSection;
