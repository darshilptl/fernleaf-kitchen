'use client';

export type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'ghost';

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  ghost: 'bg-foreground-ghost',
};

/**
 * Status badge: a small dot plus a text label. Colour is never
 * the only signal — the label always names the status.
 */
export function StatusBadge(props: { tone: StatusTone; label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2 py-0.5">
      <span className={`inline-block size-1.5 rounded-pill ${DOT[props.tone]}`} aria-hidden="true" />
      <span className="text-caption text-foreground-muted">{props.label}</span>
    </span>
  );
}
