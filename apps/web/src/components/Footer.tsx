import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { GITHUB_URL } from "@/lib/site"
import { getApiHealth } from "@/lib/api-health"

const FOOTER_COLUMNS = [
  {
    heading: "Helps",
    links: [
      {
        label: "GitHub",
        href: GITHUB_URL,
        external: true,
      },
      {
        label: "Contact Us",
        href: "https://www.pateldarshil.me/",
        external: true,
      },
    ],
  },
  {
    heading: "Dashboards",
    links: [
      { label: "Admin", href: "/admin/dashboard", external: false },
      { label: "Kitchen", href: "/kitchen/dashboard", external: false },
      { label: "Dispatch", href: "/dispatch/dashboard", external: false },
      { label: "Driver", href: "/driver", external: false },
    ],
  },
] as const

function FooterLogo() {
  return (
    <Link
      href="/"
      className="flex w-fit items-center gap-2 text-sm font-medium text-foreground"
    >
      <Image
        src="/icons/icon.png"
        alt=""
        width={30}
        height={30}
        className="h-auto w-auto"
        priority
      />
      <span>Fernleaf Kitchen</span>
    </Link>
  )
}

type FooterColumnProps = {
  heading: string
  links: readonly { label: string; href: string; external: boolean }[]
}

function FooterColumn({ heading, links }: FooterColumnProps) {
  return (
    <div>
      <p className="text-caption font-semibold uppercase text-foreground-subtle">
        {heading}
      </p>
      <ul className="mt-2 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export async function Footer() {
  const year = new Date().getFullYear()
  const apiHealth = await getApiHealth()
  return (
    <footer className="mt-6 w-full">
      <div className="px-6 pt-16 pb-6 sm:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="max-w-xs shrink-0">
            <FooterLogo />
            <p className="mt-2 text-sm leading-relaxed font-medium text-foreground-subtle">
              Production-grade products built for startups and enterprises.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-12 gap-y-10 lg:gap-x-16"
          >
            {FOOTER_COLUMNS.map((column) => (
              <FooterColumn
                key={column.heading}
                heading={column.heading}
                links={column.links}
              />
            ))}
          </nav>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center sm:flex-row sm:justify-between sm:px-8">
        <p className="text-caption font-medium text-foreground-subtle">
          © {year} Fernleaf Kitchen
        </p>
        <p className="flex items-center gap-2 text-caption text-foreground-muted">
          <span
            aria-hidden
            className={
              apiHealth !== null
                ? "size-1.5 rounded-pill bg-success"
                : "size-1.5 rounded-pill bg-foreground-ghost"
            }
          />
          {apiHealth !== null ? "API online" : "API degraded"}
        </p>
      </div>
    </footer>
  )
}
