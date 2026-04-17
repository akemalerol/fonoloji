import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 40%, #2DD4BF 100%)',
          padding: 3,
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#0a0a0f',
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: '#f5f5f7',
              marginTop: -2,
            }}
          >
            f
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
