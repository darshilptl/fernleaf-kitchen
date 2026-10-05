"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar"
import { useSession } from "@/hooks/use-session"
import { visibleNavGroups } from "@/lib/nav"
import type { Session } from "@/lib/session"

/**
 * Single shared dashboard shell for every role. The server
 * (staff) layout guards auth and passes the session; nav groups
 * filter by permission keys, so admin, kitchen, dispatch and
 * driver each see only their links with zero per-role code.
 * Routing is Next nested layouts: Link clicks render the new
 * page inside SidebarInset while the sidebar stays mounted.
 */
export function DashboardSidebar({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}): React.JSX.Element {
  const pathname = usePathname()
  const { logout } = useSession()
  const groups = visibleNavGroups(session.permissions)
  const activeLabel = groups
    .flatMap((group) => group.items)
    .find((item) => isNavActive(pathname, item.href))?.label

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="sticky top-0 h-svh shrink-0">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex min-w-0 flex-col gap-0.5 px-2 py-1 text-left">
                <span className="text-body-sm truncate font-medium">
                  {session.name}
                </span>
                <span className="text-caption truncate text-foreground-muted">
                  {session.email}
                </span>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="flex flex-col gap-6 py-4">
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                      tooltip={item.label}
                      isActive={isNavActive(pathname, item.href)}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Logout"
                onClick={() => {
                  void logout()
                }}
              >
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-6">
            <SidebarTrigger className="-ml-1" />
            {activeLabel !== undefined && (
              <span className="text-caption text-foreground-muted">
                {activeLabel}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** Exact match plus child-route prefix (e.g. /admin/orders/123). */
function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
