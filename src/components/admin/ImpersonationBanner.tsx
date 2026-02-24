import { useNavigate } from "react-router-dom";
import { api, setAuthToken, setCompanyId } from "@/lib/apiClient";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const companyName = localStorage.getItem("plcs_impersonating");

  if (!companyName) return null;

  const handleReturn = async () => {
    setEnding(true);
    try {
      await api.adminEndImpersonation();
    } catch {
      // Even if the API fails, restore admin token
    }

    const adminToken = localStorage.getItem("plcs_admin_token");
    if (adminToken) {
      localStorage.setItem("plcs_token", adminToken);
      localStorage.setItem("auth_token", adminToken);
      setAuthToken(adminToken);
    }

    localStorage.removeItem("plcs_admin_token");
    localStorage.removeItem("plcs_impersonating");
    localStorage.removeItem("plcs_company_id");
    localStorage.removeItem("company_id");

    navigate("/admin");
    // Force reload to reset all state
    window.location.reload();
  };

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold shrink-0"
      style={{ background: "#F5C518", color: "#000" }}
    >
      <span>⚠️ Impersonating {companyName}</span>
      <span>—</span>
      <button
        onClick={handleReturn}
        disabled={ending}
        className="underline font-bold hover:no-underline disabled:opacity-50 inline-flex items-center gap-1"
      >
        {ending ? <Loader2 size={12} className="animate-spin" /> : null}
        Return to Admin
      </button>
    </div>
  );
}
