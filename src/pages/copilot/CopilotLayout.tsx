import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/apiClient";
import CopilotNav from "@/components/copilot/CopilotNav";
import CopilotTopBar from "@/components/copilot/CopilotTopBar";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";

// Notification sound — a short beep using the Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gain.gain.value = 0.15;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

const CopilotLayout = () => {
  const navigate = useNavigate();
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const prevWaitingRef = useRef(0);

  useEffect(() => {
    api.getBillingStatus().then(setBillingStatus).catch(() => {});
  }, []);

  // Request browser notification permission on mount if enabled
  useEffect(() => {
    const browserEnabled = localStorage.getItem("notif_browser_enabled");
    if (browserEnabled === "true" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    const browserEnabled = localStorage.getItem("notif_browser_enabled");
    if (browserEnabled !== "true") return;

    // Desktop notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "copilot-dm",
        });
      } catch {
        // Notification API not available
      }
    }

    // Sound
    const soundEnabled = localStorage.getItem("notif_sound_enabled");
    if (soundEnabled !== "false") {
      playNotificationSound();
    }
  }, []);

  useEffect(() => {
    const fetchDMs = () => {
      api.getCopilotActiveDMs({ sort: "recent" })
        .then((res) => {
          const dms = Array.isArray(res?.dms) ? res.dms : [];
          const newActiveCount = dms.length;
          const newWaitingCount = dms.filter((d: any) => d.needs_response).length;

          setActiveCount(newActiveCount);
          setWaitingCount(newWaitingCount);

          // If waiting count increased, show browser notification
          if (newWaitingCount > prevWaitingRef.current && prevWaitingRef.current >= 0) {
            const diff = newWaitingCount - prevWaitingRef.current;
            showBrowserNotification(
              "New DM" + (diff > 1 ? "s" : ""),
              `You have ${diff} new DM${diff > 1 ? "s" : ""} waiting for a response.`
            );
          }
          prevWaitingRef.current = newWaitingCount;
        })
        .catch(() => {});
    };
    fetchDMs();
    const interval = setInterval(fetchDMs, 10000);
    return () => clearInterval(interval);
  }, [showBrowserNotification]);

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
