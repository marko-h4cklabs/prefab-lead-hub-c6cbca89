import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const companyId = params.get("companyId");
    const redirect = params.get("redirect") || "/dashboard";
    const error = params.get("error");

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (token && companyId) {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("company_id", companyId);
      localStorage.setItem("plcs_company_id", companyId);
      navigate(redirect, { replace: true });
    } else {
      navigate("/login?error=auth_failed", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 size={32} className="animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
