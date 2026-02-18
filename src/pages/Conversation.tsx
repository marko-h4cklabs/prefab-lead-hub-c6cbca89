import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, requireCompanyId } from "@/lib/apiClient";
import { ArrowLeft } from "lucide-react";

const Conversation = () => {
  const { leadId } = useParams();
  const companyId = requireCompanyId();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;
    api.getConversation(companyId, leadId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  const messages = data?.messages || data?.conversation?.messages || [];
  const parsedFields = data?.parsed_fields || data?.conversation?.parsed_fields || {};

  return (
    <div>
      <button onClick={() => navigate(`/leads/${leadId}`)} className="industrial-btn-ghost mb-4">
        <ArrowLeft size={16} /> Back to Lead
      </button>

      <h1 className="text-xl font-bold mb-6">Conversation</h1>

      {/* Parsed Fields */}
      {Object.keys(parsedFields).length > 0 && (
        <div className="industrial-card p-4 mb-6">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Parsed Fields
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(parsedFields).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-mono text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium">{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="industrial-card p-8 text-center text-muted-foreground">
            No messages yet
          </div>
        ) : (
          messages.map((msg: any, i: number) => (
            <div
              key={i}
              className={`industrial-card p-4 ${
                msg.role === "assistant" || msg.sender === "bot"
                  ? "border-l-2 border-l-accent"
                  : "border-l-2 border-l-primary"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {msg.role || msg.sender || "user"}
                </span>
                {msg.timestamp && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-sm">{msg.content || msg.text || msg.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Conversation;
