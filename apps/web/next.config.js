/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion', 'date-fns'],
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // AI/scraper caydırıcı işaretler. Google, Bing bunlara saygı duyar;
          // scraper'ları engellemez ama yasal argüman + politika sinyalidir.
          { key: 'X-Robots-Tag', value: 'noarchive, noimageindex' },
        ],
      },
      // Fon veri sayfaları — scraper için en değerli hedef. Ekstra sinyaller.
      {
        source: '/fon/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noarchive, noimageindex, nosnippet, max-snippet:160' },
        ],
      },
      {
        source: '/embed/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/kategori', destination: '/kategoriler', permanent: true },
    ];
  },
  async rewrites() {
    const base = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${base}/api/:path*` },
      { source: '/auth/:path*', destination: `${base}/auth/:path*` },
      { source: '/admin-api/:path*', destination: `${base}/admin-api/:path*` },
      { source: '/v1/:path*', destination: `${base}/v1/:path*` },
      { source: '/plans', destination: `${base}/plans` },
    ];
  },
};

export default nextConfig;
