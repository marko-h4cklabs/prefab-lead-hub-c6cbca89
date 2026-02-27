import { MessageSquare, CheckCircle2, Clock, ThumbsUp, UserCheck } from "lucide-react";

interface Stats {
  active_conversations: number;
  handled_today: number;
  avg_response_time_seconds: number;
  suggestion_acceptance_rate: number;
  leads_qualified_today: number;
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const CopilotStatsCards = ({ stats }: { stats: Stats }) => {
  const cards = [
    {
      label: "Active Conversations",
      value: stats.active_conversations,
      icon: MessageSquare,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      label: "Handled Today",
      value: stats.handled_today,
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Avg Response Time",
      value: formatDuration(stats.avg_response_time_seconds),
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Suggestion Acceptance",
      value: `${stats.suggestion_acceptance_rate}%`,
      icon: ThumbsUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Qualified Today",
      value: stats.leads_qualified_today,
      icon: UserCheck,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon size={16} className={card.color} />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{card.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{card.label}</p>
        </div>
      ))}
    </div>
  );
};

export default CopilotStatsCards;
