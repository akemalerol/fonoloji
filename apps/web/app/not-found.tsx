import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl font-semibold tracking-tight gradient-text">404</div>
      <h1 className="mt-4 text-2xl font-semibold">Fon veya sayfa bulunamadı</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aradığın kod belki de hiç yayınlanmadı ya da TEFAS'tan kaldırıldı.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/">Anasayfa</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/fonlar">Tüm fonlar</Link>
        </Button>
      </div>
    </div>
  );
}
