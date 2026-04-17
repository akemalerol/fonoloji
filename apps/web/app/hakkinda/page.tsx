import { GridBackground } from '@/components/fx/grid-background';

export const metadata = { title: 'Hakkında' };

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/50">
        <GridBackground />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">hakkında</div>
            <h1 className="display text-balance text-5xl leading-[1.02] md:text-7xl">
              Fon verisini <span className="display-italic text-brand-400">anlaşılır</span> kılıyoruz.
            </h1>
            <p className="mt-6 max-w-xl text-muted-foreground">
              Fonoloji, TEFAS'ın halka açık fon verisini alır, risk ve getiri analizlerine
              dönüştürür, açık kaynak olarak sunar.
            </p>
          </div>
        </div>
      </section>

      <section className="container max-w-2xl space-y-6 py-12 text-base leading-relaxed text-muted-foreground">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Veri kaynağı</h2>
          <p className="mt-2">
            Tüm fiyat, yatırımcı sayısı ve portföy dağılımı verisi TEFAS'ın resmî sayfasından alınır.
            Fonoloji hiçbir özel endpoint veya ücretli feed kullanmaz — tamamen public veri.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Metrikler</h2>
          <p className="mt-2">
            Yüzdesel getiriler (1G, 1A, 3A, 6A, 1Y, YBI), hareketli ortalamalar, volatilite, Sharpe oranı,
            max drawdown ve korelasyon matrisi TEFAS'tan gelen ham fiyatlar üzerinden{' '}
            <strong className="text-foreground">Fonoloji tarafından yeniden hesaplanır</strong>.
            TEFAS'ın getiri rakamları kullanılmaz.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Güncelleme</h2>
          <p className="mt-2">
            Her sabah 09:00 ve 10:00'da (Türkiye saati) cron job çalışır. Bazı fonlar T+1'den sonra
            geç yayınlandığı için iki farklı pencere var. Analizler her çekim sonrası yeniden üretilir.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Uyarı</h2>
          <p className="mt-2">
            Hiçbir içerik yatırım tavsiyesi değildir. Kendi araştırmanı yap, lisanslı finansal danışmanla
            konuş. Fonoloji hiçbir fon, yönetim şirketi veya komisyoncu ile ortaklık içinde değildir.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Kaynak kod</h2>
          <p className="mt-2">
            Açık kaynak, MIT lisansı. TEFAS scraping'i, analytics hesaplamaları ve bu web arayüzü GitHub'da.
          </p>
        </div>
      </section>
    </>
  );
}
