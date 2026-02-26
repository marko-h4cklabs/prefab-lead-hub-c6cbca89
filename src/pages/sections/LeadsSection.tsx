import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, TrendingUp, CalendarDays, ArrowLeft, Home } from "lucide-react";
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

const ACCENT = {
  border: "hover:border-[hsl(48_92%_53%)]",
  shadow: "hover:shadow-[0_0_20px_hsl(48_92%_53%/0.15)]",
  text: "text-[hsl(48_92%_53%)]",
  iconBg: "bg-[hsl(48_92%_53%/0.20)]",
  iconText: "text-[hsl(48_92%_53%)]",
};

const LeadsSection = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dealStats, setDealStats] = useState<any>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    api.getAnalyticsOverview().then((res) => {
      setUnreadCount(res?.needs_reply ?? res?.active_conversations ?? 0);
    }).catch(() => {});
    api.getDealStats().then(setDealStats).catch(() => {});
    api.getUpcomingAppointments().then((res) => {
      const list = normalizeList(res, ["appointments", "data", "items"]);
      setUpcomingCount(list.length);
    }).catch(() => {});
  }, [companyId]);

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

      <StaggerContainer className="flex flex-col gap-6 max-w-[1100px] w-full relative z-10">
        {/* Inbox — full width top row */}
        <StaggerItem>
          <motion.button
            onClick={() => navigate("/dashboard/leads/inbox")}
            whileHover={{ scale: 1.02 }}
            className={`w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-6 transition-all duration-200 ${ACCENT.border} ${ACCENT.shadow} flex gap-5 h-[240px] md:h-[260px]`}
          >
            <div className="flex flex-col justify-between flex-[0_0_40%]">
              <div>
                <div className={`w-12 h-12 rounded-xl ${ACCENT.iconBg} flex items-center justify-center mb-3`}>
                  <MessageSquare size={24} className={ACCENT.iconText} />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">Inbox</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Live conversations and AI reply suggestions</p>
              </div>
              <span className={`text-xs font-medium ${ACCENT.text}`}>Open →</span>
            </div>
            <div className="flex-1 flex items-center justify-center rounded-lg bg-[hsl(0_0%_5%)] border border-[hsl(0_0%_13%)] p-4">
              <span className="text-sm text-muted-foreground">{unreadCount} need reply</span>
            </div>
          </motion.button>
        </StaggerItem>

        {/* Pipeline & Calendar — 2-col bottom row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StaggerItem>
            <motion.button
              onClick={() => navigate("/dashboard/leads/pipeline")}
              whileHover={{ scale: 1.02 }}
              className={`w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-6 transition-all duration-200 ${ACCENT.border} ${ACCENT.shadow} flex gap-5 h-[240px] md:h-[260px]`}
            >
              <div className="flex flex-col justify-between flex-[0_0_40%]">
                <div>
                  <div className={`w-12 h-12 rounded-xl ${ACCENT.iconBg} flex items-center justify-center mb-3`}>
                    <TrendingUp size={24} className={ACCENT.iconText} />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">Pipeline & Deals</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Track deals through your sales pipeline</p>
                </div>
                <span className={`text-xs font-medium ${ACCENT.text}`}>Open →</span>
              </div>
              <div className="flex-1 flex items-center justify-center rounded-lg bg-[hsl(0_0%_5%)] border border-[hsl(0_0%_13%)] p-4">
                <div className="text-sm text-muted-foreground">
                  <span className={`font-semibold ${ACCENT.text}`}>€{Number(dealStats?.total_revenue ?? 0).toLocaleString()}</span> total · {dealStats?.deals_closed ?? 0} deals
                </div>
              </div>
            </motion.button>
          </StaggerItem>

          <StaggerItem>
            <motion.button
              onClick={() => navigate("/dashboard/leads/calendar")}
              whileHover={{ scale: 1.02 }}
              className={`w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-6 transition-all duration-200 ${ACCENT.border} ${ACCENT.shadow} flex gap-5 h-[240px] md:h-[260px]`}
            >
              <div className="flex flex-col justify-between flex-[0_0_40%]">
                <div>
                  <div className={`w-12 h-12 rounded-xl ${ACCENT.iconBg} flex items-center justify-center mb-3`}>
                    <CalendarDays size={24} className={ACCENT.iconText} />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">Calendar</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Appointments, scheduling, and reminders</p>
                </div>
                <span className={`text-xs font-medium ${ACCENT.text}`}>Open →</span>
              </div>
              <div className="flex-1 flex items-center justify-center rounded-lg bg-[hsl(0_0%_5%)] border border-[hsl(0_0%_13%)] p-4">
                <span className="text-sm text-muted-foreground">{upcomingCount} upcoming</span>
              </div>
            </motion.button>
          </StaggerItem>
        </div>
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
