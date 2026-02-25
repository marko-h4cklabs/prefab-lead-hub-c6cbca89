import InboxLayout from "@/components/InboxLayout";

/**
 * Wraps the existing InboxLayout for catalog routing.
 * InboxLayout already uses <Outlet /> internally for child routes,
 * but here we render it directly as a standalone page.
 */
const InboxPage = () => (
  <div className="h-full overflow-hidden">
    <InboxLayout />
  </div>
);

export default InboxPage;
