import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Mail, Loader2, CheckCircle } from "lucide-react";

const RESEND_COOLDOWN = 30;

const VerifyEmailPending = () => {
  const location = useLocation();
  const email = (location.state as any)?.email || "";
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const hasToken = !!localStorage.getItem("auth_token");
      if (hasToken) {
        await api.resendVerification();
      } else if (email) {
        await api.resendVerificationPublic(email);
      } else {
        setError("No email address available. Please go back and try again.");
        return;
      }
      setSent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      setError(err?.message || "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="dark-card p-8 text-center">
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail size={32} className="text-primary" />
          </div>

          <h1 className="text-xl font-bold text-foreground mb-2">Check your inbox</h1>
          <p className="text-sm text-muted-foreground mb-1">
            We sent a verification link to
          </p>
          {email && (
            <p className="text-sm font-medium text-foreground mb-6">{email}</p>
          )}
          <p className="text-sm text-muted-foreground mb-6">
            Click it to activate your account.
          </p>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Didn't get it? Check spam, or:</p>

            <button
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="dark-btn-primary w-full"
            >
              {resending ? (
                <><Loader2 size={16} className="animate-spin" /> Sending…</>
              ) : sent && cooldown > 0 ? (
                <><CheckCircle size={16} className="text-success" /> Sent! Resend in {cooldown}s</>
              ) : (
                "Resend verification email"
              )}
            </button>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Link to="/login" className="block text-xs text-muted-foreground hover:text-primary transition-colors pt-2">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPending;
