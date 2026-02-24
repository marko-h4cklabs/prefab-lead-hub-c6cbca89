import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, CreditCard, Check, AlertTriangle, Zap, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Billing = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    api.getBillingStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (plan: string) => {
    setCheckingOut(plan);
    try {
      const res = await api.createCheckout(plan);
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        toast({ title: "No checkout URL returned", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Checkout failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setCheckingOut(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api.createBillingPortal();
      if (res?.portal_url || res?.url) {
        window.location.href = res.portal_url || res.url;
      }
    } catch (err) {
      toast({ title: "Failed to open portal", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;
    try {
      await api.cancelSubscription();
      toast({ title: "Subscription cancelled" });
      const res = await api.getBillingStatus();
      setStatus(res);
    } catch (err) {
      toast({ title: "Failed to cancel", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
      <div className="grid md:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );

  const isTrial = status?.subscription_status === "trial" || status?.status === "trial";
  const isActive = status?.subscription_status === "active" || status?.status === "active";
  const isCancelled = status?.subscription_status === "cancelled" || status?.status === "cancelled";
  const isPastDue = status?.subscription_status === "past_due" || status?.status === "past_due";
  const planName = status?.plan || status?.plan_name || "";
  const trialDaysLeft = status?.trial_days_remaining ?? status?.days_remaining ?? 0;
  const messagesUsed = status?.messages_used ?? 0;
  const messagesLimit = status?.messages_limit ?? 2000;
  const usagePercent = messagesLimit > 0 ? Math.round((messagesUsed / messagesLimit) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">Billing & Subscription</h1>

      {/* Trial banner */}
      {isTrial && (
        <div className="dark-card p-4 border-l-4 border-l-primary flex items-center gap-3">
          <Zap size={18} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">You're on a free trial — {trialDaysLeft} days remaining</p>
            <p className="text-xs text-muted-foreground">Upgrade to keep using all features after your trial ends.</p>
          </div>
        </div>
      )}

      {/* Cancelled / Past due banner */}
      {(isCancelled || isPastDue) && (
        <div className="dark-card p-4 border-l-4 border-l-destructive flex items-center gap-3">
          <AlertTriangle size={18} className="text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">{isCancelled ? "Subscription cancelled" : "Payment past due"}</p>
            <p className="text-xs text-muted-foreground">{isCancelled ? "Re-subscribe to continue using the platform." : "Update your payment method to avoid service interruption."}</p>
          </div>
        </div>
      )}

      {/* Active subscription info */}
      {isActive && (
        <div className="dark-card p-5 border-l-4 border-l-success space-y-4">
          <div className="flex items-center gap-3">
            <span className="status-badge bg-success/15 text-success">Active</span>
            <span className="text-sm font-semibold text-foreground capitalize">{planName} Plan</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Messages used this month</span>
              <span className="font-mono">{messagesUsed.toLocaleString()} / {messagesLimit.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, usagePercent)}%` }} />
            </div>
            {usagePercent > 80 && <p className="text-xs text-warning mt-1">⚠️ You're approaching your message limit</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePortal} disabled={portalLoading} className="dark-btn-primary text-sm">
              {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Manage Subscription
            </button>
            <button onClick={handleCancel} className="text-xs text-destructive/70 hover:text-destructive transition-colors">
              Cancel Subscription
            </button>
          </div>
        </div>
      )}

      {/* Plan cards — show for trial, cancelled, past_due */}
      {(isTrial || isCancelled || isPastDue || !status) && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pro Plan */}
          <div className="dark-card p-6 border-l-4 border-l-primary space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">Pro Plan</h2>
            </div>
            <p className="text-3xl font-bold text-primary">€199<span className="text-sm text-muted-foreground font-normal">/month</span></p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> 2,000 AI messages/month</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Unlimited leads</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Google Calendar sync</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Pipeline board</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Analytics dashboard</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Email support</li>
            </ul>
            <button onClick={() => handleCheckout("pro")} disabled={checkingOut !== null} className="w-full dark-btn-primary py-3">
              {checkingOut === "pro" ? <Loader2 size={14} className="animate-spin" /> : null}
              Upgrade to Pro
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="dark-card p-6 border-l-4 border-l-info space-y-4">
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-info" />
              <h2 className="text-lg font-bold text-foreground">Enterprise Plan</h2>
            </div>
            <p className="text-3xl font-bold text-info">€499<span className="text-sm text-muted-foreground font-normal">/month</span></p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Unlimited everything</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Multi-account support</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Priority support</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Custom onboarding</li>
            </ul>
            <button onClick={() => handleCheckout("enterprise")} disabled={checkingOut !== null} className="w-full dark-btn bg-info text-info-foreground hover:bg-info/90 py-3">
              {checkingOut === "enterprise" ? <Loader2 size={14} className="animate-spin" /> : null}
              Upgrade to Enterprise
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
