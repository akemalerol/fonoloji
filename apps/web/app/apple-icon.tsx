import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 40%, #2DD4BF 100%)',
          padding: 8,
        }}
      >
        <div
          style={{
            width: 164,
            height: 164,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 33,
            background: '#0a0a0f',
          }}
        >
          <span
            style={{
              fontSize: 90,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: '#f5f5f7',
              marginTop: -4,
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
