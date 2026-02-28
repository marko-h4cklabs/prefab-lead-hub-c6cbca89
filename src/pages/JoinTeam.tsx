import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, setAuthToken, setCompanyId } from "@/lib/apiClient";
import { Eye, EyeOff, Loader2, Users, AlertCircle } from "lucide-react";

const JoinTeam = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [invite, setInvite] = useState<{ valid: boolean; company_name?: string; role?: string; reason?: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setInvite({ valid: false });
      setValidating(false);
      return;
    }
    api.validateInvite(code)
      .then((res) => setInvite(res))
      .catch(() => setInvite({ valid: false }))
      .finally(() => setValidating(false));
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) { setError("Full name is required"); return; }
    if (!trimmedEmail) { setError("Email is required"); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await api.joinTeam({ code, email: trimmedEmail, password, full_name: trimmedName });
      setAuthToken(res.token);
      if (res.company?.id) setCompanyId(res.company.id);
      navigate("/copilot", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join team";
      setError(typeof message === "string" ? message : "Failed to join team");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!invite?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm px-6">
          <div className="dark-card p-8 text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-destructive" />
            <h1 className="text-lg font-bold text-foreground mb-2">Invalid Invite</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {invite?.reason === "expired" ? "This invite link has expired." :
               invite?.reason === "max_uses_reached" ? "This invite has reached its maximum uses." :
               "This invite link is invalid or no longer active."}
            </p>
            <Link to="/login" className="dark-btn-primary inline-flex">Go to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="dark-card p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Users size={20} className="text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Join Team</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You've been invited to join <span className="text-foreground font-medium">{invite.company_name}</span> as a <span className="text-foreground font-medium">{invite.role}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(""); }}
                placeholder="Your full name"
                className="dark-input w-full"
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@email.com"
                className="dark-input w-full"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Min. 8 characters"
                  className="dark-input w-full pr-10"
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button type="submit" disabled={loading || !fullName.trim() || !email.trim() || password.length < 8} className="dark-btn-primary w-full">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Joining...</> : "Join Team"}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors">Already have an account? Sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinTeam;
