'use client';

interface Cell {
  date: string;
  return: number;
}

export function CalendarHeatmap({ cells }: { cells: Cell[] }) {
  const map = new Map<string, number>();
  for (const c of cells) map.set(c.date, c.return);

  if (cells.length === 0) return null;
  const sorted = [...cells].sort((a, b) => (a.date < b.date ? -1 : 1));
  const firstDate = new Date(sorted[0]!.date);
  const lastDate = new Date(sorted[sorted.length - 1]!.date);

  const days: Array<{ date: string; return: number | null; month: number; dow: number }> = [];
  const cursor = new Date(firstDate);
  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
  while (cursor <= lastDate) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push({
      date: iso,
      return: map.has(iso) ? map.get(iso)! : null,
      month: cursor.getUTCMonth(),
      dow: cursor.getUTCDay(),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const maxAbs = Math.max(...cells.map((c) => Math.abs(c.return)), 0.01);
  const colorFor = (r: number | null) => {
    if (r === null) return 'rgba(255,255,255,0.04)';
    const intensity = Math.min(Math.abs(r) / maxAbs, 1);
    return r > 0
      ? `rgba(16, 185, 129, ${0.1 + intensity * 0.7})`
      : `rgba(244, 63, 94, ${0.1 + intensity * 0.7})`;
  };

  const monthLabels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const dowLabels = ['P', '', 'S', '', 'P', '', 'C'];

  return (
    <div className="flex gap-1">
      <div className="flex flex-col justify-between py-1 text-[9px] text-muted-foreground">
        {dowLabels.map((d, i) => (
          <span key={i} className="h-3 leading-3">
            {d}
          </span>
        ))}
      </div>
      <div className="flex gap-[2px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {week.map((day) => (
              <div
                key={day.date}
                className="h-3 w-3 rounded-sm"
                style={{ background: colorFor(day.return) }}
                title={`${day.date}: ${day.return !== null ? (day.return * 100).toFixed(2) + '%' : '—'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
