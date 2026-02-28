import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import CopilotNav from "@/components/copilot/CopilotNav";
import CopilotTopBar from "@/components/copilot/CopilotTopBar";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";

const CopilotLayout = () => {
  const navigate = useNavigate();
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    api.getBillingStatus().then(setBillingStatus).catch(() => {});
  }, []);

  useEffect(() => {
    const fetch = () => {
      api.getCopilotActiveDMs({ sort: "recent" })
        .then((res) => {
          const dms = Array.isArray(res?.dms) ? res.dms : [];
          setActiveCount(dms.length);
          setWaitingCount(dms.filter((d: any) => d.needs_response).length);
        })
        .catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  const subStatus = billingStatus?.subscription_status || billingStatus?.status;
  const trialDaysLeft = billingStatus?.trial_days_remaining ?? billingStatus?.days_remaining ?? null;
  const showTrialBanner = subStatus === "trial" && trialDaysLeft !== null;
  const showExpiredBanner = subStatus === "expired";
  const isUrgent = showTrialBanner && trialDaysLeft <= 3;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[hsl(0_0%_0%)]">
      {/* Billing banners */}
      {showTrialBanner && (
        <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium shrink-0 ${
          isUrgent ? "bg-[hsl(24_95%_53%)] text-[hsl(0_0%_4%)]" : "bg-primary text-primary-foreground"
        }`}>
          <span>Free Trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining</span>
          <span>·</span>
          <button onClick={() => navigate("/dashboard/settings/account")} className="underline hover:no-underline font-semibold">Upgrade →</button>
        </div>
      )}
      {showExpiredBanner && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground shrink-0">
          <span>Trial expired — upgrade to continue</span>
          <button onClick={() => navigate("/dashboard/settings/account")} className="underline hover:no-underline font-semibold">Upgrade →</button>
        </div>
      )}

      <ImpersonationBanner />

      {/* Top bar */}
      <CopilotTopBar activeCount={activeCount} waitingCount={waitingCount} />

      {/* Main layout: nav rail + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CopilotNav />
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CopilotLayout;
