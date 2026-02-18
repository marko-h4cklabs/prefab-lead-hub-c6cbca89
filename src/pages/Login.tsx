import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setCompanyId } from "@/lib/apiClient";

const Login = () => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Company ID is required");
      return;
    }
    // Basic UUID check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      setError("Must be a valid UUID");
      return;
    }
    setCompanyId(trimmed);
    navigate("/leads");
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
                Company ID
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="industrial-input w-full"
                autoFocus
              />
              {error && (
                <p className="mt-1.5 text-xs text-destructive font-mono">{error}</p>
              )}
            </div>

            <button type="submit" className="industrial-btn-accent w-full">
              Connect
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
