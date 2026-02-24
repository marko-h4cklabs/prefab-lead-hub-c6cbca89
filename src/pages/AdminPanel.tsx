import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Loader2, Shield } from "lucide-react";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminCompaniesTab from "@/components/admin/AdminCompaniesTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";

type TabKey = "overview" | "companies" | "users";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "companies", label: "Companies" },
  { key: "users", label: "Users" },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    api.me()
      .then((res: any) => {
        if (res?.is_admin || res?.role === "admin" || res?.role === "super_admin") {
          setIsAdmin(true);
        } else {
          navigate("/leads", { replace: true });
        }
      })
      .catch(() => {
        navigate("/login", { replace: true });
      })
      .finally(() => setAuthChecking(false));
  }, [navigate]);

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Red header banner */}
      <header className="flex items-center gap-3 px-6 py-3 shrink-0" style={{ background: "#EF4444" }}>
        <Shield size={18} className="text-white" />
        <h1 className="text-sm font-bold text-white">🛡️ Admin Control Panel</h1>
      </header>

      {/* Tab bar */}
      <div className="border-b px-6 flex gap-1 shrink-0" style={{ borderColor: "#2A2A2A" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-red-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        {activeTab === "overview" && <AdminOverviewTab />}
        {activeTab === "companies" && <AdminCompaniesTab />}
        {activeTab === "users" && <AdminUsersTab />}
      </main>
    </div>
  );
};

export default AdminPanel;
