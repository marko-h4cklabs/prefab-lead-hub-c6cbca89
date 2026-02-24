import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Settings, TrendingUp, MessageSquare, Flame, UserPlus, ChevronRight, CalendarDays, Bot, Clipboard, ExternalLink } from "lucide-react";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import LogDealModal from "@/components/deals/LogDealModal";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function intentColor(score: number) {
  if (score > 70) return "bg-success";
  if (score > 40) return "bg-warning";
  return "bg-destructive";
}

const POLL_MS = 60_000;

const Dashboard = () => {
  const navigate = useNavigate();
  const companyId = requireCompanyId();

  const [companyName, setCompanyName] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [dealStats, setDealStats] = useState<any>(null);
  const [pipelineStats, setPipelineStats] = useState<any>(null);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [topLeads, setTopLeads] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [mode, setMode] = useState<any>(null);
  const [chatbotBehavior, setChatbotBehavior] = useState<any>(null);
  const [quoteFields, setQuoteFields] = useState<any[]>([]);
  const [manychat, setManychat] = useState<any>(null);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [gcalStatus, setGcalStatus] = useState<any>(null);
  const [gcalEvents, setGcalEvents] = useState<any[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<any>(null);

  const fetchAll = useCallback(() => {
    api.getCompany(companyId).then((c) => setCompanyName(c.company_name || c.name || "")).catch(() => {});
    api.getAnalyticsOverview().then(setOverview).catch(() => {});
    api.getDealStats().then(setDealStats).catch(() => {});
    api.getPipelineStats().then(setPipelineStats).catch(() => {});
    api.getHotLeads().then((r) => setHotLeads(normalizeList(r, ["alerts", "hot_leads", "data", "items"]))).catch(() => {});
    api.getLeads(companyId, { limit: 5 }).then((r) => {
      const list = normalizeList(r, ["leads", "data", "items"]);
      list.sort((a: any, b: any) => (b.intent_score ?? b.score ?? 0) - (a.intent_score ?? a.score ?? 0));
      setTopLeads(list.slice(0, 5));
    }).catch(() => {});
    api.getAppointments({ status: "scheduled" }).then((r) => {
      const list = normalizeList(r, ["appointments", "data", "items"]);
      list.sort((a: any, b: any) => new Date(a.start_at || a.date).getTime() - new Date(b.start_at || b.date).getTime());
      setAppointments(list.slice(0, 5));
    }).catch(() => {});
    api.getOperatingMode().then(setMode).catch(() => {});
    api.getChatbotBehavior().then(setChatbotBehavior).catch(() => {});
    api.getQuoteFields().then((r) => setQuoteFields(normalizeList(r, ["presets", "fields", "data"]))).catch(() => {});
    api.getManychatSettings().then(setManychat).catch(() => {});
    api.getGoogleCalendarStatus().then((res) => {
      setGcalStatus(res);
      if (res?.connected) {
        api.getGoogleUpcomingEvents().then((r) => {
          const list = Array.isArray(r) ? r : Array.isArray(r?.events) ? r.events : Array.isArray(r?.data) ? r.data : [];
          setGcalEvents(list.slice(0, 3));
        }).catch(() => {});
      }
    }).catch(() => setGcalStatus(null));
    api.getVoiceSettings().then(setVoiceSettings).catch(() => setVoiceSettings(null));
  }, [companyId]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // Derived stats
  const newLeadsToday = overview?.new_leads_today ?? overview?.leads_today ?? 0;
  const newLeadsYesterday = overview?.new_leads_yesterday ?? overview?.leads_yesterday ?? 0;
  const activeConversations = overview?.active_conversations ?? 0;
  const needsReply = overview?.needs_reply ?? 0;
  const hotCount = hotLeads.length;
  const hotNewToday = overview?.hot_leads_today ?? 0;
  const revenueThisMonth = dealStats?.total_revenue ?? dealStats?.revenue_this_month ?? 0;
  const momGrowth = dealStats?.mom_growth ?? dealStats?.growth_percent ?? null;
  const dealsClosedCount = dealStats?.deals_closed ?? 0;
  const avgDealValue = dealStats?.avg_deal_value ?? 0;
  const conversionRate = dealStats?.conversion_rate ?? overview?.conversion_rate ?? 0;
  const avgTimeToClose = dealStats?.avg_time_to_close ?? 0;
  const revenueOverTime = normalizeList(dealStats?.revenue_over_time ?? dealStats?.chart_data, ["data"]);

  const lastOutbound = overview?.last_outbound_at ?? null;
  const minutesSinceOutbound = lastOutbound ? Math.floor((Date.now() - new Date(lastOutbound).getTime()) / 60000) : null;

  const opMode = mode?.operating_mode ?? mode?.mode ?? null;
  const isAutopilot = opMode === "autopilot";
  const isCopilot = opMode === "copilot";

  const agentName = chatbotBehavior?.persona_style ?? chatbotBehavior?.agent_name ?? "AI Agent";
  const goal = chatbotBehavior?.conversation_goal ?? chatbotBehavior?.goal ?? "Qualify & book calls";
  const activeQuoteFields = quoteFields.filter((f: any) => f.enabled !== false).length;
  const manychatConnected = !!(manychat?.manychat_api_key || manychat?.connected);
  const calendarConnected = overview?.calendar_connected ?? false;

  const pipelineSummary = pipelineStats?.stages ?? pipelineStats?.summary ?? null;

  // Empty state check: no leads, no conversations, no deals
  const isEmpty = !hotLeads.length && !topLeads.length && !appointments.length && newLeadsToday === 0 && activeConversations === 0 && revenueThisMonth === 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Section 1 — Welcome Bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {companyName || "there"}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/fields")} className="dark-btn-secondary text-sm">
            ⚙️ Configure AI
          </button>
          <button onClick={() => setDealModalOpen(true)} className="dark-btn text-sm bg-primary text-primary-foreground hover:bg-primary/90">
            💵 Log a Deal
          </button>
        </div>
      </div>

      {/* Empty state for brand new clients */}
      {isEmpty && overview && (
        <div className="dark-card p-12 text-center space-y-4">
          <div className="text-5xl mb-2">👋</div>
          <h2 className="text-lg font-bold text-foreground">Welcome to your workspace!</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You're all set up. Now connect ManyChat to start receiving leads from Instagram.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => navigate("/settings")} className="dark-btn-primary text-sm">Connect ManyChat →</button>
            <button onClick={() => {
              navigate("/leads");
              setTimeout(() => navigate("/pipeline"), 1500);
              setTimeout(() => navigate("/analytics"), 3000);
              setTimeout(() => navigate("/dashboard"), 4500);
            }} className="dark-btn-secondary text-sm">Take the tour →</button>
          </div>
        </div>
      )}

      {/* AI Status */}
      <div className="dark-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isAutopilot && (
            <>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
              </span>
              <span className="text-sm text-foreground font-medium">AI Autopilot Active — responding automatically</span>
            </>
          )}
          {isCopilot && (
            <>
              <span className="h-3 w-3 rounded-full bg-info" />
              <span className="text-sm text-foreground font-medium">Co-Pilot Mode — suggestions enabled</span>
            </>
          )}
          {!isAutopilot && !isCopilot && (
            <>
              <span className="h-3 w-3 rounded-full bg-muted-foreground" />
              <span className="text-sm text-muted-foreground">Mode not configured</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {/* Voice Status */}
          <div className="flex items-center gap-1.5">
            {voiceSettings?.voice_enabled ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                <span>Voice Replies: {voiceSettings.voice_mode === "always" ? "Always" : voiceSettings.voice_mode === "match" ? "Match Mode" : "Text Only"}</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                <span>Voice Replies: Off</span>
                <button onClick={() => navigate("/fields")} className="text-primary hover:underline ml-1">Enable</button>
              </>
            )}
          </div>
          <span className="text-border">|</span>
          {minutesSinceOutbound !== null && minutesSinceOutbound <= 120 && (
            <span>Last message handled: {minutesSinceOutbound < 1 ? "just now" : `${minutesSinceOutbound}m ago`}</span>
          )}
          {minutesSinceOutbound !== null && minutesSinceOutbound > 120 && (
            <span className="text-warning">⚠️ No recent activity — check your ManyChat connection</span>
          )}
          {minutesSinceOutbound === null && (
            <span className="text-muted-foreground">No outbound messages yet</span>
          )}
        </div>
      </div>

      {/* Section 2 — Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* New Leads Today */}
        <div className="rounded-xl p-5 bg-[hsl(0_0%_10%)] border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">New Leads Today</span>
            <UserPlus size={16} className="text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold text-primary">{newLeadsToday}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            vs {newLeadsYesterday} yesterday
            {newLeadsToday > newLeadsYesterday && <TrendingUp size={12} className="text-success" />}
            {newLeadsToday < newLeadsYesterday && <TrendingUp size={12} className="text-destructive rotate-180" />}
          </div>
        </div>

        {/* Active Conversations */}
        <div className="rounded-xl p-5 bg-[hsl(0_0%_10%)] border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Active Conversations</span>
            <MessageSquare size={16} className="text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold text-info">{activeConversations}</div>
          <div className="text-xs text-muted-foreground mt-1">{needsReply} need reply</div>
        </div>

        {/* Hot Leads */}
        <div className={`rounded-xl p-5 bg-[hsl(0_0%_10%)] border ${hotCount > 0 ? "border-primary shadow-[0_0_12px_hsl(48_92%_53%/0.15)]" : "border-border"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Hot Leads 🔥</span>
            <Flame size={16} className="text-destructive" />
          </div>
          <div className="text-3xl font-bold text-destructive">{hotCount}</div>
          <div className="text-xs text-muted-foreground mt-1">{hotNewToday} new today</div>
        </div>

        {/* Revenue */}
        <div className="rounded-xl p-5 bg-[hsl(0_0%_10%)] border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Revenue This Month</span>
            <TrendingUp size={16} className="text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold text-primary">€{Number(revenueThisMonth).toLocaleString()}</div>
          {momGrowth !== null && (
            <div className={`text-xs mt-1 ${momGrowth >= 0 ? "text-success" : "text-destructive"}`}>
              {momGrowth >= 0 ? "+" : ""}{momGrowth}% MoM
            </div>
          )}
        </div>
      </div>

      {/* Section 3 — Three Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 — Hot Leads + Top Leads */}
        <div className="space-y-6">
          {/* Hot Leads Panel */}
          <div className="dark-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">🔥 Needs Attention</h2>
              {hotCount > 0 && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-semibold">{hotCount}</span>}
            </div>
            {hotLeads.length > 0 ? (
              <div className="space-y-3">
                {hotLeads.slice(0, 5).map((hl: any, i: number) => {
                  const lead = hl.lead || hl;
                  const name = lead.name || lead.lead_name || "Lead";
                  const leadId = lead.lead_id || lead.id || hl.lead_id;
                  const score = lead.intent_score ?? lead.score ?? 0;
                  const lastMsg = lead.last_message || hl.last_message || "";
                  const budget = lead.budget_detected || hl.budget_detected;
                  const lastAt = lead.last_message_at || hl.created_at;
                  return (
                    <div key={i} className="rounded-lg bg-secondary p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{name}</span>
                        <button onClick={() => navigate(`/leads/${leadId}/conversation`)} className="text-xs text-primary hover:underline">Open</button>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${intentColor(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
                      </div>
                      {lastMsg && <p className="text-xs text-muted-foreground truncate">{lastMsg.slice(0, 60)}</p>}
                      <div className="flex items-center justify-between">
                        {budget && <span className="text-xs text-success">💰 {budget}</span>}
                        {lastAt && <span className="text-[10px] text-muted-foreground">{timeAgo(lastAt)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bot size={24} className="mx-auto text-primary mb-2" />
                <p className="text-xs text-muted-foreground">No hot leads right now — your AI is on it 🤖</p>
              </div>
            )}
          </div>

          {/* Top Leads by Score */}
          <div className="dark-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-4">🎯 Top Leads by Score</h2>
            {topLeads.length > 0 ? (
              <div className="space-y-3">
                {topLeads.map((lead: any, i: number) => {
                  const score = lead.intent_score ?? lead.score ?? 0;
                  const name = lead.name || lead.external_id || "Lead";
                  const leadId = lead.id;
                  const budget = lead.budget_detected;
                  const lastAt = lead.last_message_at || lead.updated_at;
                  return (
                    <div key={i} className="rounded-lg bg-secondary p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{name}</span>
                        <button onClick={() => navigate(`/leads/${leadId}/conversation`)} className="text-xs text-primary hover:underline">Open</button>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${intentColor(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        {budget && <span className="text-xs text-success">💰 {budget}</span>}
                        {lastAt && <span className="text-[10px] text-muted-foreground">{timeAgo(lastAt)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No leads yet</p>
            )}
          </div>
        </div>

        {/* Column 2 — Appointments + Pipeline Summary */}
        <div className="space-y-6">
          <div className="dark-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-4">📅 Upcoming Calls</h2>
            {appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map((appt: any, i: number) => {
                  const dt = new Date(appt.start_at || appt.date);
                  const isToday = dt.toDateString() === new Date().toDateString();
                  const minsUntil = Math.floor((dt.getTime() - Date.now()) / 60000);
                  const isSoon = minsUntil > 0 && minsUntil <= 60;
                  const status = appt.status || "pending";
                  const statusColor = status === "scheduled" || status === "confirmed" ? "text-success bg-success/15" : status === "cancelled" ? "text-destructive bg-destructive/15" : "text-primary bg-primary/15";
                  return (
                    <div key={i} className={`rounded-lg bg-secondary p-3 ${isToday ? "border-l-2 border-l-primary" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-foreground">
                          {dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <div className="flex items-center gap-2">
                          {isSoon && (
                            <span className="relative flex items-center gap-1 text-[10px] text-destructive font-semibold">
                              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" /></span>
                              Soon
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statusColor}`}>{status}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{appt.lead_name || appt.title || "Appointment"}</span>
                        <button onClick={() => navigate(`/leads/${appt.lead_id}`)} className="text-xs text-primary hover:underline">View</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarDays size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">No calls scheduled</p>
              </div>
            )}
          </div>

          {/* Google Calendar Widget */}
          <div className="dark-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">📅 From Google Calendar</h2>
            {gcalStatus?.connected ? (
              gcalEvents.length > 0 ? (
                <div className="space-y-2">
                  {gcalEvents.map((ev: any, i: number) => {
                    const start = ev.start?.dateTime || ev.start?.date || ev.start_at || "";
                    const dt = start ? new Date(start) : null;
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary p-2.5">
                        <CalendarDays size={14} className="text-info shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{ev.summary || ev.title || "Event"}</p>
                          {dt && (
                            <p className="text-[10px] text-muted-foreground">
                              {dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No upcoming Google Calendar events</p>
              )
            ) : (
              <div className="rounded-lg bg-secondary p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Connect Google Calendar to see all your events here</span>
                <button onClick={() => navigate("/settings")} className="text-xs text-primary hover:underline shrink-0 ml-2">Connect</button>
              </div>
            )}
          </div>

          {/* Pipeline Summary */}
          {pipelineSummary && (
            <div className="dark-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-3">📊 Pipeline</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {Object.entries(pipelineSummary).map(([stage, count]: [string, any]) => (
                  <span key={stage} className="text-muted-foreground">
                    {stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:{" "}
                    <span className="text-foreground font-semibold">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {!pipelineSummary && pipelineStats && (
            <div className="dark-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-3">📊 Pipeline</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <span className="text-muted-foreground">Pipeline Value: <span className="text-primary font-semibold">€{Number(pipelineStats.pipeline_value ?? 0).toLocaleString()}</span></span>
                <span className="text-muted-foreground">Won: <span className="text-success font-semibold">€{Number(pipelineStats.won_value ?? 0).toLocaleString()}</span></span>
                <span className="text-muted-foreground">Conversion: <span className="text-primary font-semibold">{pipelineStats.conversion_rate ?? 0}%</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Column 3 — Performance + Quick Config */}
        <div className="space-y-6">
          {/* Performance */}
          <div className="dark-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">📊 This Month</h2>
            {revenueOverTime.length > 0 && (
              <div className="h-20 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueOverTime}>
                    <Line type="monotone" dataKey="revenue" stroke="hsl(48 92% 53%)" strokeWidth={2} dot={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                      labelStyle={{ color: "hsl(0 0% 63%)" }}
                      formatter={(val: any) => [`€${Number(val).toLocaleString()}`, "Revenue"]}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Deals closed</span><span className="text-foreground font-medium">{dealsClosedCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Avg value</span><span className="text-foreground font-medium">€{Number(avgDealValue).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Conversion rate</span><span className="text-foreground font-medium">{conversionRate}%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Avg time to close</span><span className="text-foreground font-medium">{avgTimeToClose} days</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Quick Config */}
          <div className="dark-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">⚡ Quick Config</h2>
            <div className="space-y-1">
              <button onClick={() => navigate("/fields")} className="w-full flex items-center justify-between rounded-lg bg-secondary p-3 hover:border-l-2 hover:border-l-primary transition-all group">
                <div>
                  <div className="text-sm text-foreground">🤖 Agent: <span className="font-medium">{agentName}</span></div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
              </button>
              <button onClick={() => navigate("/fields")} className="w-full flex items-center justify-between rounded-lg bg-secondary p-3 hover:border-l-2 hover:border-l-primary transition-all group">
                <div>
                  <div className="text-sm text-foreground">🎯 Goal: <span className="font-medium">{goal}</span></div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
              </button>
              <button onClick={() => navigate("/fields")} className="w-full flex items-center justify-between rounded-lg bg-secondary p-3 hover:border-l-2 hover:border-l-primary transition-all group">
                <div>
                  <div className="text-sm text-foreground">📋 Quote Fields: <span className="font-medium">{activeQuoteFields} active</span></div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
              </button>
              <button onClick={() => navigate("/fields")} className="w-full flex items-center justify-between rounded-lg bg-secondary p-3 hover:border-l-2 hover:border-l-primary transition-all group">
                <div>
                  <div className="text-sm text-foreground">🎙️ Voice: <span className="font-medium">{voiceSettings?.selected_voice_name || "Not configured"}</span></div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Connections */}
          <div className="dark-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">🔗 Connections</h2>
            <div className="space-y-2">
              <button onClick={() => navigate("/settings")} className="w-full flex items-center gap-3 rounded-lg bg-secondary p-3 hover:border-l-2 hover:border-l-primary transition-all">
                <span className={`h-2.5 w-2.5 rounded-full ${manychatConnected ? "bg-success" : "bg-destructive"}`} />
                <span className="text-sm text-foreground">ManyChat: <span className={manychatConnected ? "text-success" : "text-destructive"}>{manychatConnected ? "Connected" : "Not connected"}</span></span>
              </button>
              <button onClick={() => navigate("/settings")} className="w-full flex items-center gap-3 rounded-lg bg-secondary p-3 hover:border-l-2 hover:border-l-primary transition-all">
                <span className={`h-2.5 w-2.5 rounded-full ${gcalStatus?.connected ? "bg-success" : "bg-warning"}`} />
                <span className="text-sm text-foreground">Google Calendar: <span className={gcalStatus?.connected ? "text-success" : "text-warning"}>{gcalStatus?.connected ? "Connected" : "Not connected"}</span></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Modal */}
      <LogDealModal
        open={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        leadId=""
        onSuccess={() => fetchAll()}
      />
    </div>
  );
};

export default Dashboard;
