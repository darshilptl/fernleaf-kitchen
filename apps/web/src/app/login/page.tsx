import { Suspense } from "react"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/sections/login-form"
import { loadStaffSession } from "@/lib/staff-session"
import { QueryProvider } from "@/providers/query-provider"

/** Signed-in staff skip login and land on their role dashboard. */
export default async function LoginPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession()
  if (session !== null) {
    redirect(session.landingPath)
  }
  return (
    <div className="flex flex-1 items-center justify-center gap-6 bg-background p-6 md:p-18">
      <div className="w-full max-w-sm">
        <QueryProvider initialSession={null}>
          <Suspense>
            <LoginForm />
          </Suspense>
        </QueryProvider>
      </div>
    </div>
  )
}
