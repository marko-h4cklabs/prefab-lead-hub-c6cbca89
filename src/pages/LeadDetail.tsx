import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, MessageSquare, Loader2, CalendarPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toDisplayText, safeArray, getErrorMessage } from "@/lib/errorUtils";
import PicturesThumbnails from "@/components/PicturesThumbnails";
import CrmSection from "@/components/crm/CrmSection";
import LeadAppointments from "@/components/appointments/LeadAppointments";
import AppointmentModal, { AppointmentFormData } from "@/components/appointments/AppointmentModal";

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

const statusClass = (name: string) => {
  const s = name?.toLowerCase();
  if (s === "new") return "status-new";
  if (s === "qualified") return "status-qualified";
  if (s === "disqualified") return "status-disqualified";
  return "status-pending";
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
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [apptRefreshKey, setApptRefreshKey] = useState(0);
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

  // Load statuses
  useEffect(() => {
    api.getLeadStatuses()
      .then((res) => setStatuses(normalizeList(res, ["statuses", "items", "data"])))
      .catch(() => {});
  }, []);

  // Polling
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
    // Allow only letters, spaces, unicode
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

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!lead) return <div className="text-destructive">Lead not found</div>;

  const leadName = lead.name || lead.external_id || "—";
  const statusId = lead.status_id || "";
  const statusName = lead.status_name || "New";
  const collectedInfos: any[] = safeArray(lead.collected_infos ?? lead.collected, "collectedInfos");

  const apptPrefill: Partial<AppointmentFormData> = {
    lead_id: leadId!,
    lead_name: leadName,
    title: `Call with ${leadName !== "—" ? leadName : "Lead"}`,
    notes: collectedInfos.length > 0
      ? collectedInfos.map((i: any) => `${i.field_name || i.name}: ${i.value}`).join("\n")
      : "",
  };

  return (
    <div>
      <button onClick={() => navigate("/leads")} className="industrial-btn-ghost mb-4">
        <ArrowLeft size={16} /> Back to Inbox
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Lead Detail</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setApptModalOpen(true)}
            className="industrial-btn-accent"
          >
            <CalendarPlus size={16} /> Add to Calendar
          </button>
          <button
            onClick={() => navigate(`/leads/${leadId}/conversation`)}
            className="industrial-btn-primary"
          >
            <MessageSquare size={16} /> View Conversation
          </button>
        </div>
      </div>

      <div className="industrial-card p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {/* Channel */}
          <div>
            <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Channel</dt>
            <dd className="text-sm font-medium">{lead.channel || "—"}</dd>
          </div>

          {/* Name (editable) */}
          <div>
            <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Name</dt>
            <dd className="text-sm font-medium">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    className="industrial-input py-1 px-2 text-sm w-full max-w-[200px]"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); }}
                    disabled={savingName}
                    autoFocus
                  />
                  {savingName && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
              ) : (
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => { setEditingName(true); setNameValue(leadName); }}
                >
                  {leadName}
                </span>
              )}
            </dd>
          </div>

          {/* Status (dropdown) */}
          <div>
            <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Status</dt>
            <dd className="text-sm font-medium">
              <div className="flex items-center gap-1.5">
                <select
                  value={statusId}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={savingStatus}
                  className={`industrial-input py-1 px-2 text-xs font-mono w-auto min-w-[100px] ${statusClass(statusName)}`}
                >
                  {statuses.length > 0 ? (
                    statuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  ) : (
                    <option value="">{statusName}</option>
                  )}
                </select>
                {savingStatus && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
            </dd>
          </div>

          {/* Created at */}
          <div>
            <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Created at</dt>
            <dd className="text-sm font-medium font-mono">
              {(lead.created_at || lead.createdAt) ? new Date(lead.created_at || lead.createdAt).toLocaleString() : "—"}
            </dd>
          </div>

          {/* Updated at */}
          <div>
            <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Updated at</dt>
            <dd className="text-sm font-medium font-mono">
              {(lead.updated_at || lead.updatedAt) ? new Date(lead.updated_at || lead.updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Collected info section */}
      <div className="industrial-card p-6 mt-6">
        <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Collected info
        </h2>
        {collectedInfos.length > 0 ? (
          <dl className="space-y-2">
            {collectedInfos.map((info: any, i: number) => {
              const fieldName = (info.field_name || info.name || "").toLowerCase();
              if (fieldName === "pictures") {
                const rawValue = info.value;
                // Never treat pictures as boolean – only accept string URL arrays
                const picUrls: string[] = Array.isArray(rawValue) ? rawValue.filter((v: any) => typeof v === "string") : [];
                const picLinks: { label: string; url: string }[] =
                  Array.isArray((info as any).links)
                    ? (info as any).links
                    : picUrls.map((url, j) => ({ label: `Picture ${j + 1}`, url }));
                return (
                  <div key={i} className="flex flex-col gap-1 text-sm">
                    <dt className="font-mono text-muted-foreground">Pictures received:</dt>
                    <dd>
                      {picLinks.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
                          {picLinks.map((link, j) => (
                            <a key={j} href={link.url} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent/80 text-sm">
                              {link.label}
                            </a>
                          ))}
                        </div>
                      )}
                      <PicturesThumbnails urls={picUrls} />
                    </dd>
                  </div>
                );
              }
              return (
                <div key={i} className="flex gap-2 text-sm">
                  <dt className="font-mono text-muted-foreground min-w-[140px]">
                    {info.field_name || info.name || `Field ${i + 1}`}:
                  </dt>
                  <dd className="font-medium">
                    {toDisplayText(info.value)}
                    {info.units ? ` (${toDisplayText(info.units)})` : ""}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">None yet</p>
        )}
      </div>

      {/* Appointments Section */}
      {leadId && (
        <LeadAppointments
          key={apptRefreshKey}
          leadId={leadId}
          leadName={leadName}
          collectedSummary={collectedInfos.map((i: any) => `${i.field_name || i.name}: ${i.value}`).join(", ")}
        />
      )}

      {/* CRM Section */}
      {leadId && <CrmSection leadId={leadId} />}

      {/* Appointment Modal from header button */}
      <AppointmentModal
        open={apptModalOpen}
        onClose={() => setApptModalOpen(false)}
        onSaved={() => setApptRefreshKey((k) => k + 1)}
        prefill={apptPrefill}
        lockLead
      />
    </div>
  );
};

export default LeadDetail;
