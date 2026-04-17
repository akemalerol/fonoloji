import { cn } from '@/lib/utils';

export function RetroGrid({ className, angle = 65 }: { className?: string; angle?: number }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden opacity-60 [perspective:200px]',
        className,
      )}
      style={{ '--grid-angle': `${angle}deg`, '--cell-size': '60px' } as React.CSSProperties}
    >
      <div className="absolute inset-0 [transform:rotateX(var(--grid-angle))]">
        <div
          className={cn(
            'animate-retro-grid',
            'ml-[-200%] h-[300vh] w-[600%]',
            '[background-image:linear-gradient(to_right,rgba(139,92,246,0.35)_1px,transparent_0),linear-gradient(to_bottom,rgba(139,92,246,0.35)_1px,transparent_0)]',
            '[background-size:var(--cell-size)_var(--cell-size)]',
            '[background-repeat:repeat]',
          )}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent to-90%" />
    </div>
  );
}
