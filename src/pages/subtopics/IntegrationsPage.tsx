import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Calendar, Link2, Loader2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import Settings from "@/pages/Settings";

interface IntegrationStatus {
  manychat: boolean;
  calendly: boolean;
  webhook: boolean;
}

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<IntegrationStatus>({
    manychat: false,
    calendly: false,
    webhook: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getManychatSettings().catch(() => null),
      api.getWebhookUrl().catch(() => null),
      api.getBookingSettings().catch(() => null),
    ]).then(([mc, wh, booking]) => {
      const mcConnected = !!(mc?.manychat_api_key && mc?.manychat_page_id);
      setStatus({
        manychat: mcConnected,
        calendly: !!(booking?.calendly_url),
        webhook: mcConnected && !!(wh?.webhook_url || wh?.url),
      });
    }).finally(() => setLoading(false));
  }, []);

  const integrations = [
    {
      name: "ManyChat",
      desc: "Instagram DM automation",
      icon: MessageSquare,
      connected: status.manychat,
    },
    {
      name: "Webhook",
      desc: "Receive DMs via webhook",
      icon: Link2,
      connected: status.webhook,
    },
    {
      name: "Calendly",
      desc: "Booking link integration",
      icon: Link2,
      connected: status.calendly,
    },
  ];

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-4 shrink-0 self-start">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* LEFT — Integration status overview */}
        <div className="w-72 shrink-0 overflow-y-auto space-y-4 pr-2">
          <h2 className="text-lg font-bold text-foreground">Integrations</h2>
          <p className="text-xs text-muted-foreground">Connect your tools to automate lead capture and scheduling.</p>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="space-y-2">
              {integrations.map((int) => (
                <div
                  key={int.name}
                  className="rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <int.icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{int.name}</div>
                    <div className="text-[11px] text-muted-foreground">{int.desc}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`h-2 w-2 rounded-full ${int.connected ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className={`text-[10px] font-medium ${int.connected ? "text-success" : "text-muted-foreground"}`}>
                      {int.connected ? "Active" : "Off"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Full settings configuration */}
        <div className="flex-1 overflow-y-auto pl-2">
          <Settings />
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
