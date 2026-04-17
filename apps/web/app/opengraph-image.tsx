import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Fonoloji — TEFAS fonlarının akılcı analizi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background:
            'radial-gradient(circle at 30% 20%, #2a1065 0%, transparent 50%), radial-gradient(circle at 70% 80%, #164e63 0%, transparent 50%), #0a0a0f',
          color: 'white',
          fontFamily: 'system-ui',
          padding: 80,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, #F59E0B, #06B6D4)',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              color: '#0a0a0f',
              fontWeight: 700,
            }}
          >
            f
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 36,
              fontWeight: 400,
              letterSpacing: '-0.02em',
            }}
          >
            Fonoloji
          </div>
        </div>

        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          TEFAS fonlarının
          <br />
          <span
            style={{
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, #FDE68A 0%, #FCD34D 40%, #67E8F9 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            akılcı analizi
          </span>
        </div>

        <div
          style={{
            marginTop: 50,
            display: 'flex',
            gap: 32,
            fontSize: 20,
            color: '#a8a8b3',
          }}
        >
          <span>2.500+ fon</span>
          <span>·</span>
          <span>Sharpe · Sortino · Reel getiri</span>
          <span>·</span>
          <span>Günde 8× sync</span>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 60,
            fontSize: 16,
            color: '#61616c',
            fontFamily: 'monospace',
          }}
        >
          fonoloji.com
        </div>
      </div>
    ),
    { ...size },
  );
}
