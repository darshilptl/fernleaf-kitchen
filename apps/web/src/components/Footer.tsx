import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

const FOOTER_COLUMNS = [
  {
    heading: "Helps",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/darshilptl/fernleaf-kitchen",
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
      { label: "Driver", href: "/driver/dashboard", external: false },
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
      <p className="text-subtle-foreground text-xs font-bold tracking-wider uppercase">
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
                className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
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

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-6 w-full">
      <div className="pt-block px-6 pb-6 sm:px-8">
        <div className="lg:gap-block flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-xs shrink-0">
            <FooterLogo />
            <p className="text-subtle-foreground mt-2 text-sm leading-relaxed font-medium">
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

      <div className="text-subtle-foreground gap-2 px-6 py-8 text-center text-xs font-medium hover:text-foreground sm:px-8">
        <p>© {year} Fernleaf Kitchen</p>
      </div>
    </footer>
  )
}
