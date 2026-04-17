import type { Metadata, Viewport } from 'next';
import { Fraunces, JetBrains_Mono } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import Script from 'next/script';
import { DisclaimerBanner } from '@/components/site/disclaimer-banner';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import '@/app/globals.css';

const GA_ID = 'G-SQXZ5GHZS1';

// Display font — only weight 400 (regular + italic). Preloaded because hero uses it.
const serif = Fraunces({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  preload: true,
});

// Body text — Geist Sans (Vercel). Distinctive, editorial-clean, variable font.
const sans = { variable: GeistSans.variable, className: GeistSans.className };

// Mono — tabular nums only. Not preloaded, small impact below fold.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fonoloji.com'),
  title: {
    default: 'Fonoloji — TEFAS fonlarının akılcı analizi',
    template: '%s · Fonoloji',
  },
  description:
    'TEFAS fonlarını Sharpe, Sortino, reel getiri, korelasyon ve portföy dağılımıyla analiz edin. 2500+ yatırım fonu, emeklilik ve BYF. Yatırım tavsiyesi değildir.',
  keywords: [
    'tefas',
    'tefas fon',
    'tefas fon analizi',
    'yatırım fonu',
    'emeklilik fonu',
    'borsa yatırım fonu',
    'BYF',
    'sharpe oranı',
    'reel getiri',
    'fon karşılaştırma',
    'fon sıralama',
    'fonoloji',
    'portföy yönetim şirketi',
    'BIST fonu',
  ],
  authors: [{ name: 'Fonoloji', url: 'https://fonoloji.com' }],
  creator: 'Fonoloji',
  publisher: 'Fonoloji',
  alternates: {
    canonical: 'https://fonoloji.com',
    types: {
      'application/rss+xml': [{ url: '/rss.xml', title: 'Fon değişiklikleri' }],
    },
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://fonoloji.com',
    title: 'Fonoloji — TEFAS fonlarının akılcı analizi',
    description:
      'Sharpe, reel getiri, korelasyon, portföy DNA\'sı. 2500+ TEFAS fonu tek yerde.',
    siteName: 'Fonoloji',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Fonoloji — TEFAS fon analizi',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@fonoloji_',
    creator: '@fonoloji_',
    title: 'Fonoloji',
    description: 'TEFAS fonlarının akılcı analizi · Sharpe · Reel getiri · Korelasyon',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'finance',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${GeistSans.className}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans antialiased selection:bg-brand-500/30">
        <script
          id="ld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Fonoloji',
              url: 'https://fonoloji.com',
              logo: 'https://fonoloji.com/og.png',
              description: 'TEFAS fonlarının akılcı analizi',
              sameAs: ['https://x.com/fonoloji_'],
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'hello@fonoloji.com',
                contactType: 'customer support',
                areaServed: 'TR',
                availableLanguage: ['Turkish'],
              },
            }),
          }}
        />
        <script
          id="ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Fonoloji',
              url: 'https://fonoloji.com',
              inLanguage: 'tr-TR',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://fonoloji.com/fonlar?q={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <DisclaimerBanner />
        <SiteHeader />
        <main className="animate-fade-in">{children}</main>
        <SiteFooter />
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true });
          `}
        </Script>
      </body>
    </html>
  );
}
