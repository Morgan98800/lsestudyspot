import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const alt = 'LSE Spots — Find a free study seat';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const bricolageBold = fs.readFileSync(
    path.join(process.cwd(), 'src/assets/fonts/BricolageGrotesque-Bold.ttf')
  );
  const instrumentRegular = fs.readFileSync(
    path.join(process.cwd(), 'src/assets/fonts/InstrumentSans-Regular.ttf')
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#E4002B',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '64px 80px',
          fontFamily: '"Instrument Sans", sans-serif',
        }}
      >
        {/* Left Column: Heading and Brand */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            maxWidth: '560px',
            paddingTop: '20px',
            paddingBottom: '20px',
          }}
        >
          {/* Brand Wordmark & Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                fontSize: 38,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
              }}
            >
              LSE Spots
            </span>
            <span
              style={{
                border: '2px solid rgba(255, 255, 255, 0.85)',
                borderRadius: '9999px',
                padding: '4px 14px',
                fontSize: 16,
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '0.02em',
              }}
            >
              Unofficial
            </span>
          </div>

          {/* Headline & Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h1
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                fontSize: 66,
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              Find a free study seat
            </h1>
            <p
              style={{
                fontSize: 22,
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              See where there are free study seats at LSE right now. Unofficial, student-built.
            </p>
          </div>

          <div
            style={{
              fontSize: 16,
              color: 'rgba(255, 255, 255, 0.75)',
            }}
          >
            lsestudyspot.vercel.app
          </div>
        </div>

        {/* Right Column: White Rounded Preview Card */}
        <div
          style={{
            width: '430px',
            backgroundColor: '#FFFFFF',
            borderRadius: '28px',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.22)',
          }}
        >
          {/* Header in card */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '10px',
              borderBottom: '1px solid #EBE9E6',
            }}
          >
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                fontSize: 19,
                fontWeight: 700,
                color: '#1B1B1D',
              }}
            >
              Live campus seats
            </span>
            <span style={{ fontSize: 13, color: '#55555B' }}>Just now</span>
          </div>

          {/* Row 1: Plenty of seats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '16px',
              backgroundColor: '#FAFAF9',
              border: '1px solid #EBE9E6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#DAF2E7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B6B49" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1B1B1D' }}>
                Library, floor 1
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#0B6B49',
                backgroundColor: '#DAF2E7',
                padding: '4px 10px',
                borderRadius: '8px',
              }}
            >
              Plenty of seats
            </span>
          </div>

          {/* Row 2: Filling up */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '16px',
              backgroundColor: '#FAFAF9',
              border: '1px solid #EBE9E6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#FFE7CA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="#FFE7CA" stroke="#9C4700" strokeWidth="2.5" />
                  <path d="M12 2 A10 10 0 0 1 12 22 Z" fill="#9C4700" />
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1B1B1D' }}>
                Centre Building, floor 2
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#9C4700',
                backgroundColor: '#FFE7CA',
                padding: '4px 10px',
                borderRadius: '8px',
              }}
            >
              Filling up
            </span>
          </div>

          {/* Row 3: Full */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '16px',
              backgroundColor: '#FAFAF9',
              border: '1px solid #EBE9E6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#E1DFDB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3A3A3F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1B1B1D' }}>
                Marshall atrium
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#3A3A3F',
                backgroundColor: '#E1DFDB',
                padding: '4px 10px',
                borderRadius: '8px',
              }}
            >
              Full
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Bricolage Grotesque',
          data: bricolageBold,
          style: 'normal',
          weight: 700,
        },
        {
          name: 'Instrument Sans',
          data: instrumentRegular,
          style: 'normal',
          weight: 400,
        },
      ],
    }
  );
}
