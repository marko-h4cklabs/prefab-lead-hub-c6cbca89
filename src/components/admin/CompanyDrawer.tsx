import { useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Users, UserPlus } from "lucide-react";

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));

export default function CompanyDrawer({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.adminGetCompany(companyId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md border-l shadow-lg flex flex-col overflow-auto" style={{ background: "#111111", borderColor: "#2A2A2A" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#2A2A2A" }}>
          <h3 className="font-bold text-sm">Company Details</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors"><X size={16} /></button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : !data ? (
            <p className="text-muted-foreground text-sm">No data</p>
          ) : (
            <div className="space-y-5">
              <Field label="Company Name" value={str(data.company_name) || str(data.name)} />
              <Field label="Company ID" value={str(data.id) || companyId} mono />
              <Field label="Created" value={str(data.created_at) ? new Date(data.created_at).toLocaleString() : undefined} mono />
              <Field label="Operating Mode" value={str(data.operating_mode) || str(data.mode)} />
              <Field label="ManyChat Connected" value={data.manychat_connected ? "Yes" : "No"} />

              {(data.stats || data.lead_count !== undefined) && (
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Leads" value={data.stats?.lead_count ?? data.lead_count} icon={Users} />
                  <MiniStat label="Users" value={data.stats?.user_count ?? data.user_count} icon={UserPlus} />
                </div>
              )}

              {data.recent_leads && data.recent_leads.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Last 5 Leads</div>
                  <div className="space-y-1">
                    {data.recent_leads.slice(0, 5).map((lead: any, i: number) => (
                      <div key={lead.id || i} className="text-sm px-2 py-1.5 rounded" style={{ background: "#1A1A1A" }}>
                        {str(lead.name) || "Unnamed"} <span className="text-muted-foreground text-xs ml-1">{str(lead.created_at) ? new Date(lead.created_at).toLocaleDateString() : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: any; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border p-3 flex items-center gap-3" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
      <Icon size={16} className="text-muted-foreground" />
      <div>
        <div className="text-lg font-bold">{value ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
