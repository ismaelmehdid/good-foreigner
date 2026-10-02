// Shared drawing for the generated app icons (private folder: not a route).
// Teal square with a white shield and a teal check, rendered by next/og (no binary assets).
import { ImageResponse } from "next/og";

const TEAL = "#0f766e"; // Tailwind teal-700

export function renderIcon(size: number, { rounded }: { rounded: boolean }): ImageResponse {
  const glyph = Math.round(size * 0.62);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: TEAL,
          borderRadius: rounded ? Math.round(size * 0.22) : 0,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <path d="M12 2 4 5v6c0 5.1 3.4 9.5 8 11 4.6-1.5 8-5.9 8-11V5l-8-3Z" fill="#ffffff" />
          <path
            d="m8.4 12.2 2.5 2.5 4.9-5.1"
            fill="none"
            stroke={TEAL}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
