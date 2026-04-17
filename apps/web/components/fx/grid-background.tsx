import { cn } from '@/lib/utils';

export function GridBackground({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 grid-pattern [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
      <div className="absolute right-10 top-32 -z-10 h-[300px] w-[400px] rounded-full bg-verdigris-500/10 blur-[80px]" />
    </div>
  );
}

export function DotBackground({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 dot-pattern [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
    </div>
  );
}
