import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      // Check onboarding status before redirecting
      try {
        const onboarding = await api.getOnboardingStatus();
        if (!onboarding?.completed) {
          navigate("/onboarding", { replace: true });
          return;
        }
      } catch {
        // If check fails, go to dashboard anyway
      }
      navigate("/dashboard", { replace: true });
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
              <Link to="/signup" className="text-xs text-muted-foreground hover:text-primary transition-colors">Create account</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
