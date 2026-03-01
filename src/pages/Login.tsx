import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const errorMessages: Record<string, string> = {
  google_not_configured: "Google sign-in is not available right now",
  google_denied: "Google sign-in was cancelled",
  google_failed: "Google sign-in failed. Try email instead.",
  auth_failed: "Authentication failed. Please try again.",
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlError = searchParams.get("error");

  useEffect(() => {
    if (urlError && errorMessages[urlError]) {
      setError(errorMessages[urlError]);
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.login(trimmedEmail, password);
      const token = res.token;
      if (!token) { setError("Login response missing token"); return; }
      const companyId = res.user?.companyId || res.company_id || (res as any).companyId;
      localStorage.setItem("auth_token", token);
      if (companyId) localStorage.setItem("company_id", companyId);
      if (res.role) localStorage.setItem("user_role", res.role);
      console.log("[auth] stored token key=auth_token tokenLen=" + token.length);
      try {
        const onboarding = await api.getOnboardingStatus();
        if (!onboarding?.completed) {
          navigate("/onboarding", { replace: true });
          return;
        }
      } catch {
        // If check fails, go to dashboard anyway
      }
      navigate("/copilot", { replace: true });
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError("Backend unreachable. Please try again or contact support.");
      } else {
        const message = err instanceof Error ? err.message : "Login failed";
        setError(typeof message === "string" ? message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="dark-card p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">P</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          {/* Google Sign In */}
          <a
            href={`${API_BASE}/api/auth/google`}
            className="flex items-center justify-center gap-3 w-full border border-border rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </a>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="you@company.com" className="dark-input w-full" autoFocus disabled={loading} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="••••••••" className="dark-input w-full pr-10" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="dark-btn-primary w-full">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign in"}
            </button>
            <div className="text-center">
              <Link to="/signup" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Don't have an account? <span className="text-primary">Sign up</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
