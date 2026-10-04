import Link from "next/link"
import Image from "next/image"
import { Button } from "@repo/ui/components/ui/button"
import { DashedGrid } from "@/components/blocks/dashed-grid"
import { loadStaffSession } from "@/lib/staff-session"

const HERO_BACKGROUND: "grid" | "image" = "image"

function GridBackground() {
  return <DashedGrid variant="hero-top" className="h-85" />
}

function ImageBackground() {
  const fade = `linear-gradient(
        to bottom,
        black        0%,
        black        25%,
        rgba(0,0,0,0.97) 33%,
        rgba(0,0,0,0.90) 42%,
        rgba(0,0,0,0.75) 52%,
        rgba(0,0,0,0.52) 62%,
        rgba(0,0,0,0.28) 72%,
        rgba(0,0,0,0.10) 82%,
        rgba(0,0,0,0.02) 90%,
        transparent  100%
      )`
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-70"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
    >
      <Image
        src="/images/bg-img.jpg"
        alt="Home Background"
        fill
        priority
        sizes="100vw"
        className="rounded-t-[6px] object-cover object-top"
      />
    </div>
  )
}

export async function HomeSection() {
  const session = await loadStaffSession()
  const label = session?.roleName ?? "Login"
  const href = session?.landingPath ?? "/login"
  return (
    <section className="relative mb-2 flex min-h-150 flex-col items-center justify-center">
      {HERO_BACKGROUND === "grid" ? <GridBackground /> : <ImageBackground />}

      <div className="relative mx-auto max-w-3xl px-4 pt-36 text-center sm:px-8">
        <div className="mx-auto text-center">
          <h1 className="text-forground text-xl leading-8 font-semibold sm:leading-9 md:text-2xl lg:text-4xl lg:leading-14">
            Welcome to Fernleaf Kitchen
            <br />
            <span className="rounded-xs bg-emerald-500 text-primary-foreground">
              Corporate meals, run with precision
            </span>
          </h1>
        </div>
        <p className="mx-auto mt-6 max-w-lg text-sm text-muted-foreground lg:text-base">
          The operations panel for Fernleaf Kitchen's corporate meal programs.
          Sign in with your staff account to continue to your dashboard
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            nativeButton={false}
            render={<Link href={href}>{label}</Link>}
            className="h-10 rounded-lg px-6 text-center ring-1 ring-primary/30 ring-offset-1 hover:ring-offset-1"
          />
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="https://github.com/darshilptl/fernleaf-kitchen">
                README.MD
              </Link>
            }
            className="h-10 rounded-lg px-6 ring-1 ring-primary/30 ring-offset-1 hover:ring-offset-1"
          />
        </div>
      </div>
    </section>
  )
}
