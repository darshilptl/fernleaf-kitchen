import { cn } from '@/lib/utils';

type PageGridProps = {
  children: React.ReactNode;
  className?: string;
};

function PageGridRails() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-border"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-0 w-px bg-border"
      />
    </>
  );
}

/**
 * Full-height page frame. A centered max-w-6xl column carries two
 * 1px rails (left/right edges, top edge to bottom edge); content
 * renders above them. Horizontal boundaries and their crossing
 * markers come from GridBoundary; the dashboard frame from
 * DashboardFrame. Logic follows the Oravity page grid; the solid
 * token-line visual follows the shared reference image.
 */
export function PageGrid({ children, className }: PageGridProps) {
  return (
    <div className="relative overflow-x-clip">
      <div className={cn('relative mx-auto w-full max-w-6xl', className)}>
        <PageGridRails />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
