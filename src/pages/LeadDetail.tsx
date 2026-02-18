import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft, MessageSquare } from "lucide-react";

const LeadDetail = () => {
  const { leadId } = useParams();
  const companyId = requireCompanyId();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;
    api.getLead(companyId, leadId)
      .then(setLead)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!lead) return <div className="text-destructive">Lead not found</div>;

  const fields = Object.entries(lead).filter(([k]) => !["id", "__v"].includes(k));

  return (
    <div>
      <button onClick={() => navigate("/leads")} className="industrial-btn-ghost mb-4">
        <ArrowLeft size={16} /> Back to Leads
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Lead Detail</h1>
        <button
          onClick={() => navigate(`/leads/${leadId}/conversation`)}
          className="industrial-btn-primary"
        >
          <MessageSquare size={16} /> View Conversation
        </button>
      </div>

      <div className="industrial-card p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{key}</dt>
              <dd className="text-sm font-medium">
                {typeof value === "object" ? (
                  <pre className="text-xs font-mono bg-muted p-2 rounded-sm overflow-auto max-h-40">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  String(value ?? "—")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};

export default LeadDetail;
