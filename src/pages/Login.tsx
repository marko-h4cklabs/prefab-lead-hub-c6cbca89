import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setCompanyId, setAuthToken, api } from "@/lib/apiClient";

const Login = () => {
  const [value, setValue] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }
    if (!trimmedPassword) {
      setError("Password is required");
      return;
    }
    if (!trimmed) {
      setError("Company ID is required");
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      setError("Must be a valid UUID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.login(trimmed, trimmedEmail, trimmedPassword);
      setAuthToken(res.token);
      setCompanyId(res.company_id || trimmed);
      navigate("/leads");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed";
      // Only render a string — never an object
      setError(typeof message === "string" ? message : "Login failed");
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
            <h1 className="text-2xl font-bold text-foreground">System Login</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                className="industrial-input w-full"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Company ID
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="industrial-input w-full"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="mt-1.5 text-xs text-destructive font-mono">{error}</p>
            )}

            <button type="submit" disabled={loading} className="industrial-btn-accent w-full">
              {loading ? "Connecting…" : "Connect"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
