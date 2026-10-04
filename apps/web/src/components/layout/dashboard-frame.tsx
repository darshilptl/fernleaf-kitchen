import { cn } from '@/lib/utils';

/** Single configuration point for the dashboard frame height. */
export const DASHBOARD_FRAME_HEIGHT_CLASS = 'h-150';

type DashboardFrameProps = {
  children: React.ReactNode;
  className?: string;
  heightClassName?: string;
};

function FrameMarker({
  edge,
  side,
}: {
  edge: 'left' | 'right';
  side: 'top' | 'bottom';
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute z-10 size-1.5 bg-foreground-strong',
        edge === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
        side === 'top' ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2',
      )}
    />
  );
}

/**
 * Shared frame for every dashboard page: fixed-height section
 * with top and bottom borders spanning the full grid width. The
 * page grid's rails run behind it, so its border×rail crossings
 * get the same 6px markers as section boundaries. Page content
 * is designed to fit the fixed height (overflow clips).
 */
export function DashboardFrame({
  children,
  className,
  heightClassName = DASHBOARD_FRAME_HEIGHT_CLASS,
}: DashboardFrameProps) {
  return (
    <section
      className={cn(
        'relative border-y border-border bg-background',
        heightClassName,
        'overflow-hidden',
        className,
      )}
    >
      <FrameMarker edge="left" side="top" />
      <FrameMarker edge="right" side="top" />
      <FrameMarker edge="left" side="bottom" />
      <FrameMarker edge="right" side="bottom" />
      {children}
    </section>
  );
}
