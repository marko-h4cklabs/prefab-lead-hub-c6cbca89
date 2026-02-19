import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Eye, EyeOff } from "lucide-react";

const Signup = () => {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const passwordsMatch = password === confirmPassword;
  const canSubmit = companyName.trim() && email.trim() && password && confirmPassword && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedCompany) { setError("Company name is required"); return; }
    if (!trimmedEmail) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    if (!confirmPassword) { setError("Please confirm your password"); return; }
    if (!passwordsMatch) { setError("Passwords do not match"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await api.signup(trimmedCompany, trimmedEmail, password);
      localStorage.setItem("auth_token", res.token);
      if (res.companyId) localStorage.setItem("company_id", res.companyId);
      navigate("/leads");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(typeof message === "string" ? message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        <div className="industrial-card p-8">
          <div className="mb-8 text-center">
            <div className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Prefab Lead Control
            </div>
            <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setError(""); }}
                placeholder="Acme Inc."
                className="industrial-input w-full"
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@company.com"
                className="industrial-input w-full"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className="industrial-input w-full pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className="industrial-input w-full pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-destructive font-mono">Passwords do not match</p>
              )}
            </div>

            {error && (
              <p className="mt-1.5 text-xs text-destructive font-mono">{error}</p>
            )}

            <button type="submit" disabled={!canSubmit} className="industrial-btn-accent w-full">
              {loading ? "Creating…" : "Create account"}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
