import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Users, MessageSquare, CalendarDays,
  TrendingUp, Flame, UserPlus, Mail,
} from "lucide-react";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

const statConfig = [
  { key: "total_companies", alt: "totalCompanies", label: "Total Companies", icon: Building2, color: "text-blue-400" },
  { key: "total_leads", alt: "totalLeads", label: "Total Leads", icon: Users, color: "text-[hsl(48,92%,53%)]" },
  { key: "total_conversations", alt: "totalConversations", label: "Total Conversations", icon: MessageSquare, color: "text-green-400" },
  { key: "total_appointments", alt: "totalAppointments", label: "Total Appointments", icon: CalendarDays, color: "text-purple-400" },
  { key: "messages_today", alt: "messagesToday", label: "Messages Today", icon: Mail, color: "text-orange-400" },
  { key: "hot_leads_active", alt: "hotLeadsActive", label: "Hot Leads Active", icon: Flame, color: "text-red-400", pulse: true },
  { key: "new_signups_today", alt: "newSignupsToday", label: "New Signups Today", icon: UserPlus, color: "text-teal-400" },
];

export default function AdminOverviewTab() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotLoading, setHotLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminGetStats()
      .then(setStats)
      .catch((e: any) => setError(e?.message || "Failed to load stats"))
      .finally(() => setLoading(false));

    api.adminGetHotLeads()
      .then((res) => setHotLeads(normalizeList(res, ["data", "alerts", "hot_leads"])))
      .catch(() => {})
      .finally(() => setHotLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-5" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statConfig.map(({ key, alt, label, icon: Icon, color, pulse }) => {
          const val = stats?.[key] ?? stats?.[alt] ?? 0;
          const showPulse = pulse && val > 0;
          return (
            <div
              key={key}
              className="rounded-lg border p-5 flex items-center gap-4"
              style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}
            >
              <div className="relative">
                <Icon size={22} className={color} />
                {showPulse && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
              <div>
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hot lead alerts table */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Flame size={16} className="text-red-400" /> Hot Lead Alerts
        </h3>
        <div className="rounded-lg border overflow-hidden" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#2A2A2A" }}>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Lead Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Trigger Reason</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {hotLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "#2A2A2A" }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : hotLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">No hot lead alerts</td>
                </tr>
              ) : (
                hotLeads.map((hl, i) => (
                  <tr key={hl.id || i} className="border-b hover:bg-secondary/30 transition-colors" style={{ borderColor: "#2A2A2A" }}>
                    <td className="px-4 py-3 font-medium">{hl.company_name || "—"}</td>
                    <td className="px-4 py-3">{hl.lead_name || hl.name || "—"}</td>
                    <td className="px-4 py-3 font-mono">{hl.score ?? hl.intent_score ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{hl.trigger_reason || hl.reason || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {hl.created_at ? new Date(hl.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/leads/${hl.lead_id}`)}
                        className="text-xs px-2 py-1 rounded border transition-colors hover:bg-secondary"
                        style={{ borderColor: "#2A2A2A" }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
