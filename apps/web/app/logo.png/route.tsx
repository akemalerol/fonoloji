import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1024,
          height: 1024,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 40%, #2DD4BF 100%)',
          padding: 40,
        }}
      >
        <div
          style={{
            width: 944,
            height: 944,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#0a0a0f',
          }}
        >
          <span
            style={{
              fontSize: 520,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: '#f5f5f7',
              marginTop: -30,
            }}
          >
            f
          </span>
        </div>
      </div>
    ),
    { width: 1024, height: 1024 },
  );
}
