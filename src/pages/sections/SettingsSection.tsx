import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plug, CreditCard, ArrowLeft, Home } from "lucide-react";
import { api } from "@/lib/apiClient";
import { StaggerContainer, StaggerItem } from "@/components/catalog/PageTransition";
import { motion } from "framer-motion";

const ACCENT = {
  border: "hover:border-[hsl(217_91%_60%)]",
  shadow: "hover:shadow-[0_0_20px_hsl(217_91%_60%/0.15)]",
  text: "text-[hsl(217_91%_60%)]",
  iconBg: "bg-[hsl(217_91%_60%/0.20)]",
  iconText: "text-[hsl(217_91%_60%)]",
};

const SettingsSection = () => {
  const navigate = useNavigate();
  const [manychat, setManychat] = useState<any>(null);
  const [billingStatus, setBillingStatus] = useState<any>(null);

  useEffect(() => {
    api.getManychatSettings().then(setManychat).catch(() => {});
    api.getBillingStatus().then(setBillingStatus).catch(() => {});
  }, []);

  const manychatConnected = !!(manychat?.manychat_api_key || manychat?.connected);
  const planName = billingStatus?.plan || billingStatus?.plan_name || "Free";

  const cards = [
    {
      title: "Integrations",
      description: "ManyChat, Calendly, voice, and webhooks",
      icon: Plug,
      route: "/dashboard/settings/integrations",
      preview: (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${manychatConnected ? "bg-success" : "bg-muted-foreground"}`} />
            <span className="text-muted-foreground">ManyChat</span>
          </div>
        </div>
      ),
    },
    {
      title: "Account & Billing",
      description: "Subscription, notifications, and company settings",
      icon: CreditCard,
      route: "/dashboard/settings/account",
      preview: (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(217_91%_60%/0.15)] ${ACCENT.text} capitalize`}>
          {planName} Plan
        </span>
      ),
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
        style={{ background: 'radial-gradient(ellipse at 50% 50%, hsl(217 91% 60% / 0.07) 0%, transparent 55%)' }}
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

export default SettingsSection;
