import Image from "next/image"
import Link from "next/link"

import { Button } from "@repo/ui/components/ui/button"
import { loadStaffSession } from "@/lib/staff-session"
import { GITHUB_URL } from "@/lib/site"

const BRAND = {
  name: "Fernleaf Kitchen",
  href: "/",
  icon: "/icons/icon.png",
} as const

const GITHUB_LINK = {
  label: "GitHub",
  href: GITHUB_URL,
} as const

const LOGIN_LINK = { label: "Login", href: "/login" } as const

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export default async function Navbar() {
  const session = await loadStaffSession()
  const label = session?.roleName ?? LOGIN_LINK.label
  const href = session?.landingPath ?? LOGIN_LINK.href
  return (
    <header className="top-0 z-50 w-full">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Left: brand */}
        <Link
          href={BRAND.href}
          className="flex w-fit items-center gap-2 text-sm font-medium text-foreground"
        >
          <Image
            src={BRAND.icon}
            alt=""
            width={30}
            height={30}
            className="h-auto w-auto"
            priority
          />
          <span>{BRAND.name}</span>
        </Link>

        {/* Right: external link + auth */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <a
              href={GITHUB_LINK.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <GithubIcon className="size-4 shrink-0" />
              <span>{GITHUB_LINK.label}</span>
            </a>
          </Button>
          <Button
            variant="outline"
            className="rounded-lg ring-1 ring-primary/30 ring-offset-1 hover:ring-offset-1"
            size="sm"
          >
            <Link href={href}>{label}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
