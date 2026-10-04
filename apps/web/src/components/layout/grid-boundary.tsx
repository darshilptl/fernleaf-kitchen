import { cn } from "@/lib/utils"

type GridBoundaryProps = {
  className?: string
}

function GridMarker({ edge }: { edge: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute top-0 size-1.5 -translate-y-1/2 bg-foreground-strong",
        edge === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
      )}
    />
  )
}

/**
 * Section boundary: one full-bleed 1px hairline plus a 6px filled
 * square centered on each rail crossing. Zero-height row, so it
 * adds no vertical space — the hairline sits exactly on the
 * boundary edge and each marker centers on its crossing.
 */
export function GridBoundary({ className }: GridBoundaryProps) {
  return (
    <div aria-hidden className={cn("relative h-0", className)}>
      <div className="absolute -top-px left-1/2 h-px w-screen -translate-x-1/2 bg-border" />
      <GridMarker edge="left" />
      <GridMarker edge="right" />
    </div>
  )
}
