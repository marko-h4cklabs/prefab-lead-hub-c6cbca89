import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, MessageSquare, Loader2, CalendarPlus, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toDisplayText, safeArray, getErrorMessage } from "@/lib/errorUtils";
import PicturesThumbnails from "@/components/PicturesThumbnails";
import CrmSection from "@/components/crm/CrmSection";
import LeadIntelligence from "@/components/LeadIntelligence";
import LeadAppointments from "@/components/appointments/LeadAppointments";
import LeadSchedulingRequests from "@/components/scheduling/LeadSchedulingRequests";
import LeadDetailAppointments from "@/components/appointments/LeadDetailAppointments";
import AppointmentModal, { AppointmentFormData } from "@/components/appointments/AppointmentModal";
import { NormalizedSchedulingRequest } from "@/lib/schedulingRequestUtils";
import { REQUEST_TYPE_LABELS } from "@/lib/schedulingRequestUtils";
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

interface LeadStatus {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

const HIDDEN_FIELDS = new Set([
  "id", "__v", "company_id", "score", "status_id", "status_obj",
  "status_name", "assigned_sales", "name", "external_id", "channel",
  "created_at", "updated_at", "collected_infos", "required_infos_missing",
]);

const POLL_INTERVAL = 7_000;

const statusBadgeClass = (name: string) => {
  const s = name?.toLowerCase();
  if (s === "new") return "bg-primary/15 text-primary";
  if (s === "qualified") return "bg-success/15 text-success";
  if (s === "disqualified") return "bg-secondary text-muted-foreground";
  return "bg-info/15 text-info";
};

const LeadDetail = () => {
  const { leadId } = useParams();
  const companyId = requireCompanyId();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [savingStatus, setSavingStatus] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [apptRefreshKey, setApptRefreshKey] = useState(0);
  const [schedReqRefreshKey, setSchedReqRefreshKey] = useState(0);
  const [apptPrefillOverride, setApptPrefillOverride] = useState<Partial<AppointmentFormData> | null>(null);
  const [convertingRequestId, setConvertingRequestId] = useState<string | null>(null);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLead = useCallback(() => {
    if (!leadId) return Promise.resolve();
    return api.getLead(companyId, leadId)
      .then((data) => {
        setLead(data);
        setNameValue(data?.name || data?.external_id || "");
      })
      .catch(() => {});
  }, [companyId, leadId]);

  useEffect(() => {
    fetchLead().finally(() => setLoading(false));
  }, [fetchLead]);

  useEffect(() => {
    api.getLeadStatuses()
      .then((res) => setStatuses(normalizeList(res, ["statuses", "items", "data"])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!leadId) return;
      api.getLead(companyId, leadId)
        .then((data) => {
          setLead(data);
          if (!editingName) setNameValue(data?.name || data?.external_id || "");
        })
        .catch(() => {});
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [companyId, leadId, editingName]);

  const handleStatusChange = async (newStatusId: string) => {
    if (!leadId) return;
    const prev = { status_id: lead.status_id, status_name: lead.status_name };
    const newObj = statuses.find((s) => s.id === newStatusId);
    if (!newObj) return;
    setLead((l: any) => ({ ...l, status_id: newObj.id, status_name: newObj.name, updated_at: new Date().toISOString() }));
    setSavingStatus(true);
    try {
      await api.updateLeadStatus(leadId, newStatusId);
    } catch {
      setLead((l: any) => ({ ...l, ...prev }));
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleNameSave = async () => {
    if (!leadId) return;
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(lead?.name || lead?.external_id || "");
      setEditingName(false);
      return;
    }
    if (!/^[\p{L}\s]+$/u.test(trimmed)) {
      toast({ title: "Invalid name", description: "Name can only contain letters and spaces.", variant: "destructive" });
      return;
    }
    setSavingName(true);
    try {
      await api.updateLeadName(leadId, trimmed);
      setLead((l: any) => ({ ...l, name: trimmed, updated_at: new Date().toISOString() }));
      setEditingName(false);
    } catch (err: unknown) {
      toast({ title: "Failed to update name", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (!lead) return <div className="p-8 text-destructive">Lead not found</div>;

  const leadName = lead.name || lead.external_id || "—";
  const statusId = lead.status_id || "";
  const statusName = lead.status_name || "New";
  const collectedInfos: any[] = safeArray(lead.collected_infos ?? lead.collected, "collectedInfos");

  const defaultApptPrefill: Partial<AppointmentFormData> = {
    lead_id: leadId!,
    lead_name: leadName,
    title: `Call with ${leadName !== "—" ? leadName : "Lead"}`,
    notes: collectedInfos.length > 0
      ? collectedInfos.map((i: any) => `${i.field_name || i.name}: ${i.value}`).join("\n")
      : "",
  };

  const apptPrefill = apptPrefillOverride || defaultApptPrefill;

  const handleConvertRequest = (req: NormalizedSchedulingRequest) => {
    const typeName = REQUEST_TYPE_LABELS[req.requestType] || req.requestType;
    setApptPrefillOverride({
      lead_id: leadId!,
      lead_name: leadName,
      title: `${typeName} with ${leadName !== "—" ? leadName : "Lead"}`,
      type: req.requestType,
      date: req.preferredDate || undefined,
      start_time: req.preferredTime || undefined,
      notes: req.notes || "",
    });
    setConvertingRequestId(req.id);
    setApptModalOpen(true);
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input className="dark-input py-1 px-2 text-lg font-bold w-48" value={nameValue} onChange={(e) => setNameValue(e.target.value)} onBlur={handleNameSave} onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); }} disabled={savingName} autoFocus />
                {savingName && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              </div>
            ) : (
              <h1 className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => { setEditingName(true); setNameValue(leadName); }}>
                {leadName}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`status-badge text-xs ${statusBadgeClass(statusName)}`}>{statusName}</span>
              {lead.channel && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{lead.channel}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDealModalOpen(true)} className="dark-btn text-sm bg-primary text-primary-foreground hover:bg-primary/90">
            💵 Log Deal
          </button>
          <button onClick={() => setApptModalOpen(true)} className="dark-btn-primary text-sm">
            <CalendarPlus size={14} /> Add to Calendar
          </button>
          <button onClick={() => navigate(`/dashboard/leads/inbox/${leadId}/conversation`)} className="dark-btn-secondary text-sm">
            <MessageSquare size={14} /> Conversation
          </button>
        </div>
      </div>

      {/* Lead metadata card */}
      <div className="dark-card p-5">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Lead ID</dt>
            <dd className="text-sm font-mono flex items-center gap-1.5">
              <span className="truncate max-w-[180px]">{leadId}</span>
              <button onClick={() => { navigator.clipboard.writeText(leadId || ""); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" title={copiedId ? "Copied!" : "Copy Lead ID"}>
                {copiedId ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              </button>
              {copiedId && <span className="text-[10px] text-success">Copied!</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Status</dt>
            <dd>
              <div className="flex items-center gap-1.5">
                <select value={statusId} onChange={(e) => handleStatusChange(e.target.value)} disabled={savingStatus} className="dark-input py-1 px-2 text-xs w-auto min-w-[100px]">
                  {statuses.length > 0 ? statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>) : <option value="">{statusName}</option>}
                </select>
                {savingStatus && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Created</dt>
            <dd className="text-sm font-mono">{(lead.created_at || lead.createdAt) ? new Date(lead.created_at || lead.createdAt).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Updated</dt>
            <dd className="text-sm font-mono">{(lead.updated_at || lead.updatedAt) ? new Date(lead.updated_at || lead.updatedAt).toLocaleString() : "—"}</dd>
          </div>
        </dl>
      </div>

      {/* Score */}
      {(lead.score !== undefined && lead.score !== null) && (() => {
        const score = Number(lead.score) || 0;
        let barColor = "bg-destructive";
        let textColor = "text-destructive";
        if (score > 60) { barColor = "bg-success"; textColor = "text-success"; }
        else if (score > 30) { barColor = "bg-warning"; textColor = "text-warning"; }
        return (
          <div className="dark-card p-5">
            <div className="flex items-center gap-4 mb-3">
              <div className={`text-3xl font-bold font-mono ${textColor}`}>{score}</div>
              <div>
                <div className="text-xs text-muted-foreground">Lead Score</div>
                {lead.score_updated_at && <div className="text-[10px] text-muted-foreground mt-0.5">Updated {new Date(lead.score_updated_at).toLocaleString()}</div>}
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, score)}%` }} />
            </div>
            {lead.score_reason && <p className="mt-2 text-sm italic text-muted-foreground">{lead.score_reason}</p>}
          </div>
        );
      })()}

      {/* Collected info */}
      <div className="dark-card p-5">
        <h2 className="text-sm font-semibold text-primary mb-3">Collected Info</h2>
        {collectedInfos.length > 0 ? (
          <dl className="space-y-2">
            {collectedInfos.map((info: any, i: number) => {
              const fieldName = (info.field_name || info.name || "").toLowerCase();
              if (fieldName === "pictures") {
                const rawValue = info.value;
                const picUrls: string[] = Array.isArray(rawValue) ? rawValue.filter((v: any) => typeof v === "string") : [];
                const picLinks: { label: string; url: string }[] = Array.isArray((info as any).links) ? (info as any).links : picUrls.map((url, j) => ({ label: `Picture ${j + 1}`, url }));
                return (
                  <div key={i} className="flex flex-col gap-1 text-sm">
                    <dt className="text-muted-foreground">Pictures received:</dt>
                    <dd>
                      {picLinks.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
                          {picLinks.map((link, j) => <a key={j} href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 text-sm">{link.label}</a>)}
                        </div>
                      )}
                      <PicturesThumbnails urls={picUrls} />
                    </dd>
                  </div>
                );
              }
              return (
                <div key={i} className="flex gap-2 text-sm">
                  <dt className="text-muted-foreground min-w-[140px]">{info.field_name || info.name || `Field ${i + 1}`}:</dt>
                  <dd className="font-medium">{toDisplayText(info.value)}{info.units ? ` (${toDisplayText(info.units)})` : ""}</dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">None yet</p>
        )}
      </div>

      {/* Intelligence */}
      {leadId && <LeadIntelligence leadId={leadId} />}

      {/* Appointments */}
      <LeadDetailAppointments appointments={Array.isArray(lead?.appointments) ? lead.appointments : []} />
      {leadId && <LeadAppointments key={apptRefreshKey} leadId={leadId} leadName={leadName} collectedSummary={collectedInfos.map((i: any) => `${i.field_name || i.name}: ${i.value}`).join(", ")} />}
      {leadId && <LeadSchedulingRequests key={`sched-${schedReqRefreshKey}`} leadId={leadId} leadName={leadName} onConvertToAppointment={handleConvertRequest} />}

      {/* CRM */}
      {leadId && <CrmSection leadId={leadId} />}

      {/* Appointment Modal */}
      <AppointmentModal
        open={apptModalOpen}
        onClose={() => { setApptModalOpen(false); setApptPrefillOverride(null); setConvertingRequestId(null); }}
        onSaved={async () => {
          setApptRefreshKey((k) => k + 1);
          if (convertingRequestId) {
            try { await api.updateSchedulingRequest(convertingRequestId, { status: "converted" }); } catch {}
            setConvertingRequestId(null);
            setSchedReqRefreshKey((k) => k + 1);
          }
        }}
        prefill={apptPrefill}
        lockLead
        schedulingRequestInfo={convertingRequestId ? "Created from scheduling request" : undefined}
      />

      {/* Deal Modal */}
      <LogDealModal
        open={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        leadId={leadId!}
        leadName={leadName}
        onSuccess={() => fetchLead()}
      />
    </div>
  );
};

export default LeadDetail;
