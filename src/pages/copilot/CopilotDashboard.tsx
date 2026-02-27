import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, BarChart3 } from "lucide-react";
import CopilotStatsCards from "@/components/copilot/CopilotStatsCards";

interface ActivityDay {
  date: string;
  handled: number;
}

const CopilotDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCopilotStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activity: ActivityDay[] = stats?.activity_chart || [];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" /> Co-Pilot Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your appointment setter performance</p>
      </div>

      {stats && (
        <CopilotStatsCards stats={{
          active_conversations: stats.active_conversations ?? 0,
          handled_today: stats.handled_today ?? 0,
          avg_response_time_seconds: stats.avg_response_time_seconds ?? 0,
          suggestion_acceptance_rate: stats.suggestion_acceptance_rate ?? 0,
          leads_qualified_today: stats.leads_qualified_today ?? 0,
        }} />
      )}

      {/* Activity chart - simple bar visualization */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground mb-4">Activity — Last 7 Days</h3>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No activity data yet</p>
        ) : (
          <div className="flex items-end gap-2 h-[120px]">
            {(() => {
              const max = Math.max(...activity.map((d) => d.handled), 1);
              return activity.map((day) => {
                const pct = (day.handled / max) * 100;
                const dateStr = new Date(day.date).toLocaleDateString([], { weekday: "short" });
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-foreground font-semibold">{day.handled}</span>
                    <div className="w-full max-w-[40px] bg-secondary rounded-t-md overflow-hidden" style={{ height: "100px" }}>
                      <div
                        className="w-full bg-primary rounded-t-md transition-all"
                        style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotDashboard;
