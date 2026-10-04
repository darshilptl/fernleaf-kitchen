import { cn } from '@/lib/utils';

type DashedGridVariant = 'hero-top' | 'panel-left' | 'panel-right';

type DashedGridProps = {
  variant: DashedGridVariant;
  className?: string;
};

const DASH_MASK = [
  'repeating-linear-gradient(to right, black 0px, black 3px, transparent 3px, transparent 8px)',
  'repeating-linear-gradient(to bottom, black 0px, black 3px, transparent 3px, transparent 8px)',
].join(', ');

const FADE_MASK: Record<DashedGridVariant, string> = {
  'hero-top': 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)',
  'panel-left': 'radial-gradient(ellipse 120% 80% at 100% 50%, #000 40%, transparent 100%)',
  'panel-right': 'radial-gradient(ellipse 120% 80% at 0% 50%, #000 40%, transparent 100%)',
};

export function DashedGrid({ variant, className }: DashedGridProps) {
  const mask = `${DASH_MASK}, ${FADE_MASK[variant]}`;
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-0', className)}
      style={{
        backgroundImage: `linear-gradient(to right, var(--grid-line-color) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line-color) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 0',
        maskImage: mask,
        WebkitMaskImage: mask,
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
      }}
    />
  );
}
