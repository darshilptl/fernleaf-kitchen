import Link from "next/link"
import { Button } from "@repo/ui/components/ui/button"
import { getApiHealth } from "@/lib/api-health"
import { loadStaffSession } from "@/lib/staff-session"

/**
 * Public system status. API reachability via the shared footer
 * helper (no new endpoint); role shortcut when signed in,
 * login call-to-action otherwise. No figures, no numbers.
 */
export default async function StatusPage(): Promise<React.JSX.Element> {
  const [apiHealth, session] = await Promise.all([getApiHealth(), loadStaffSession()])
  const online = apiHealth !== null
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="heading-sm mb-6">System status</h1>
      <div className="rounded-lg bg-background-panel p-6 shadow-card">
        <p className="flex items-center gap-2 text-body-sm text-foreground">
          <span
            aria-hidden
            className={
              online
                ? "size-1.5 rounded-pill bg-success"
                : "size-1.5 rounded-pill bg-foreground-ghost"
            }
          />
          {online ? "API online" : "API degraded"}
        </p>
        <p className="description-sm mt-4">
          {session !== null
            ? `Signed in as ${session.roleName}.`
            : "You are not signed in."}
        </p>
        <div className="mt-6">
          {session !== null ? (
            <Button
              nativeButton={false}
              render={<Link href={session.landingPath}>{session.roleName}</Link>}
            />
          ) : (
            <Button nativeButton={false} render={<Link href="/login">Login</Link>} />
          )}
        </div>
      </div>
    </div>
  )
}
