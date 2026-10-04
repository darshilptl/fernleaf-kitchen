import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { loadStaffSession } from "@/lib/staff-session"
import { QueryProvider } from "@/providers/query-provider"

/**
 * Server guard for every (staff) page. Unauthenticated →
 * /login. Authenticated staff get the shared dashboard sidebar;
 * per-page landingPath redirects stay in the pages. No custom
 * frame: the sidebar layout sits directly in the page grid.
 */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const session = await loadStaffSession()
  if (session === null) {
    redirect("/login")
  }
  return (
    <QueryProvider>
      <DashboardSidebar session={session}>{children}</DashboardSidebar>
    </QueryProvider>
  )
}
