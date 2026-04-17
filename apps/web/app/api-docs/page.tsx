import { Code2, Key, Shield, Terminal, Zap } from 'lucide-react';
import Link from 'next/link';
import { DotBackground } from '@/components/fx/grid-background';

export const metadata = { title: 'API Dokümanı' };

const BASE_URL = 'https://fonoloji.com/v1';

const ENDPOINTS: Array<{
  method: string;
  path: string;
  desc: string;
  example: string;
}> = [
  { method: 'GET', path: '/funds', desc: 'Tüm fonları sıralı listeler (filter/sort destekli)', example: 'curl -H "X-API-Key: $KEY" "BASE/funds?sort=return_1y&limit=50"' },
  { method: 'GET', path: '/funds/:code', desc: 'Tek fonun tüm metrikleri + son portföy snapshot', example: 'curl -H "X-API-Key: $KEY" "BASE/funds/TTE"' },
  { method: 'GET', path: '/funds/:code/history', desc: 'Fiyat geçmişi (period=1w|1m|3m|6m|1y|5y|all)', example: 'curl -H "X-API-Key: $KEY" "BASE/funds/TTE/history?period=1y"' },
  { method: 'GET', path: '/search', desc: 'Fon arama (kod veya ad üzerinde)', example: 'curl -H "X-API-Key: $KEY" "BASE/search?q=hisse"' },
  { method: 'GET', path: '/summary/today', desc: 'Bugünün piyasa özeti (gainers/losers/agg)', example: 'curl -H "X-API-Key: $KEY" "BASE/summary/today"' },
  { method: 'GET', path: '/categories', desc: 'Kategori istatistikleri (1y ortalama getiri sıralı)', example: 'curl -H "X-API-Key: $KEY" "BASE/categories"' },
  { method: 'GET', path: '/categories/:name', desc: 'Kategori detayı + içindeki fonlar', example: 'curl -H "X-API-Key: $KEY" "BASE/categories/Hisse%20Senedi%20Fonu"' },
  { method: 'GET', path: '/insights/movers', desc: 'En çok kazanan/kaybedenler (period=1d|1w|1m|3m|1y|ytd)', example: 'curl -H "X-API-Key: $KEY" "BASE/insights/movers?period=1w"' },
  { method: 'GET', path: '/insights/flow', desc: 'Para akışı liderleri (inflow/outflow)', example: 'curl -H "X-API-Key: $KEY" "BASE/insights/flow?period=1m"' },
  { method: 'GET', path: '/insights/risk-return', desc: 'Risk-getiri scatter — (volatility, return_1y) tüm fonlar', example: 'curl -H "X-API-Key: $KEY" "BASE/insights/risk-return"' },
  { method: 'GET', path: '/insights/heatmap/:code', desc: 'Fonun günlük getiri ısı haritası verisi', example: 'curl -H "X-API-Key: $KEY" "BASE/insights/heatmap/TTE"' },
  { method: 'GET', path: '/insights/correlation', desc: 'Pearson korelasyon matrisi (codes=TTE,AFT,…)', example: 'curl -H "X-API-Key: $KEY" "BASE/insights/correlation?codes=TTE,AFT,TAU"' },
  { method: 'GET', path: '/insights/trend', desc: 'MA 30/200 kesişim sinyalleri (rising/falling)', example: 'curl -H "X-API-Key: $KEY" "BASE/insights/trend"' },
];

export default function ApiDocsPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/50">
        <DotBackground />
        <div className="container relative py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Terminal className="h-3 w-3 text-brand-400" />
              geliştiriciler için
            </div>
            <h1 className="display text-balance text-5xl leading-[1.02] md:text-7xl">
              REST API
              <br />
              <span className="display-italic text-brand-400">dokümanı</span>
            </h1>
            <p className="mt-6 max-w-xl text-muted-foreground">
              JSON response, kararlı URL şeması, nazik rate limit başlıkları. Kayıt olun,
              API anahtarınızı alın, 2 dakikada uygulamanıza bağlayın.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/kayit"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
              >
                Ücretsiz anahtar al
              </Link>
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-5 py-2.5 text-sm hover:bg-card/80"
              >
                Özel kullanım için iletişim
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Feature icon={Key} title="Basit auth" desc="X-API-Key başlığı. JWT / OAuth karmaşası yok." />
        <Feature icon={Zap} title="Düşük gecikme" desc="Türkiye'deki edge sunucumuzdan — p95 <50ms." />
        <Feature icon={Shield} title="Şeffaf rate limit" desc="Her yanıtta x-ratelimit-* başlıkları. Sürpriz yok." />
      </section>

      <section className="container mt-16">
        <h2 className="serif text-3xl">Hızlı başlangıç</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ortam değişkenini ayarla ve çağır.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <CodeCard
            title="cURL"
            code={`export KEY="fon_..."
curl -H "X-API-Key: $KEY" \\\n  "${BASE_URL}/funds/TTE"`}
          />
          <CodeCard
            title="Node (fetch)"
            code={`const res = await fetch(
  "${BASE_URL}/funds/TTE",
  { headers: { "X-API-Key": process.env.FONOLOJI_KEY } }
);
const fund = await res.json();`}
          />
          <CodeCard
            title="Python"
            code={`import os, requests
key = os.environ["FONOLOJI_KEY"]
r = requests.get(
  "${BASE_URL}/funds/TTE",
  headers={"X-API-Key": key},
)
print(r.json())`}
          />
        </div>
      </section>

      <section className="container mt-16">
        <h2 className="serif text-3xl">Endpoint'ler</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tüm endpoint'ler <code className="kbd">GET</code>, JSON döner. Base URL:{' '}
          <code className="kbd">{BASE_URL}</code>
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pl-5 text-left font-medium">Metod</th>
                <th className="py-3 text-left font-medium">Path</th>
                <th className="py-3 pr-5 text-left font-medium">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pl-5">
                    <span className="inline-flex items-center rounded bg-brand-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-400">
                      {e.method}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-xs">{e.path}</td>
                  <td className="py-3 pr-5 text-sm text-muted-foreground">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="container mt-16">
        <h2 className="serif text-3xl">Rate limit başlıkları</h2>
        <p className="mt-2 text-sm text-muted-foreground">Her yanıtta döneriz:</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <HeaderRow name="x-ratelimit-limit" desc="Dakika başına izin verilen istek sayısı (plana göre değişir)" />
          <HeaderRow name="x-ratelimit-remaining" desc="Bu pencerede kalan istek sayısı" />
          <HeaderRow name="x-ratelimit-reset" desc="Pencerenin sıfırlanmasına kaç saniye kaldığı" />
          <HeaderRow name="x-ratelimit-limit-monthly" desc="Aylık toplam kota" />
          <HeaderRow name="x-ratelimit-remaining-monthly" desc="Bu ay kalan istek sayısı" />
          <HeaderRow name="retry-after" desc="429 durumunda bekleme süresi (sn)" />
        </div>
      </section>

      <section className="container mt-16 pb-24">
        <h2 className="serif text-3xl">Hata kodları</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pl-5 text-left font-medium">Kod</th>
                <th className="py-3 pr-5 text-left font-medium">Anlamı</th>
              </tr>
            </thead>
            <tbody>
              <ErrorRow code="200" msg="Başarılı" />
              <ErrorRow code="400" msg="Eksik veya geçersiz parametre" />
              <ErrorRow code="401" msg="API anahtarı eksik/geçersiz" />
              <ErrorRow code="404" msg="Fon/kategori bulunamadı" />
              <ErrorRow code="429" msg="Dakika veya aylık kota aşımı — retry-after'a bakın" />
              <ErrorRow code="5xx" msg="Sunucu hatası — otomatik geri bildirilir, 5sn sonra tekrar deneyin" />
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CodeCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Code2 className="h-3 w-3 text-brand-400" />
        {title}
      </div>
      <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="panel p-5">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-background/60 ring-1 ring-border">
        <Icon className="h-4 w-4 text-brand-400" />
      </div>
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function HeaderRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="panel flex flex-col gap-1 p-4">
      <code className="font-mono text-xs text-brand-400">{name}</code>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </div>
  );
}

function ErrorRow({ code, msg }: { code: string; msg: string }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 pl-5 font-mono text-xs font-semibold">{code}</td>
      <td className="py-3 pr-5 text-sm text-muted-foreground">{msg}</td>
    </tr>
  );
}
