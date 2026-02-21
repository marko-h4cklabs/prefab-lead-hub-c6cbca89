import { useState } from "react";
import CrmActivityTab from "./CrmActivityTab";
import CrmNotesTab from "./CrmNotesTab";
import CrmTasksTab from "./CrmTasksTab";

const CRM_TABS = ["Activity", "Notes", "Tasks"] as const;
type CrmTab = (typeof CRM_TABS)[number];

interface Props {
  leadId: string;
}

export default function CrmSection({ leadId }: Props) {
  const [activeTab, setActiveTab] = useState<CrmTab>("Activity");

  return (
    <div className="industrial-card p-6 mt-6">
      <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground mb-4">CRM</h2>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {CRM_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors -mb-px ${
              activeTab === tab
                ? "border-b-2 border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Activity" && <CrmActivityTab leadId={leadId} />}
      {activeTab === "Notes" && <CrmNotesTab leadId={leadId} />}
      {activeTab === "Tasks" && <CrmTasksTab leadId={leadId} />}
    </div>
  );
}
