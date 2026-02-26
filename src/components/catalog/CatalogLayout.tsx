import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import TopBar from "./TopBar";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";

const CatalogLayout = () => {
  const navigate = useNavigate();
  const [billingStatus, setBillingStatus] = useState<any>(null);

  useEffect(() => {
    api.getBillingStatus().then(setBillingStatus).catch(() => {});
  }, []);

  const subStatus = billingStatus?.subscription_status || billingStatus?.status;
  const trialDaysLeft = billingStatus?.trial_days_remaining ?? billingStatus?.days_remaining ?? null;
  const showTrialBanner = subStatus === "trial" && trialDaysLeft !== null;
  const showPastDueBanner = subStatus === "past_due";
  const showExpiredBanner = subStatus === "expired";
  const isUrgent = showTrialBanner && trialDaysLeft <= 3;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[hsl(0_0%_0%)]">
      {/* Trial / billing banners */}
      {showTrialBanner && (
        <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium shrink-0 ${
          isUrgent ? "bg-[hsl(24_95%_53%)] text-[hsl(0_0%_4%)]" : "bg-primary text-primary-foreground"
        }`}>
          {isUrgent && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(0_0%_4%)]/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(0_0%_4%)]" />
            </span>
          )}
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
      {showPastDueBanner && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground shrink-0">
          <span>Payment failed</span>
          <button onClick={() => navigate("/dashboard/settings/account")} className="underline hover:no-underline font-semibold">Update billing →</button>
        </div>
      )}

      <ImpersonationBanner />
      <TopBar />

      {/* Main content — fills remaining viewport */}
      <main className="flex-1 min-h-0 overflow-hidden grid-bg">
        <Outlet />
      </main>
    </div>
  );
};

export default CatalogLayout;
