export default function Loading() {
  return (
    <div className="container py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-400" />
          Veriler yükleniyor…
        </div>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="panel h-32 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
