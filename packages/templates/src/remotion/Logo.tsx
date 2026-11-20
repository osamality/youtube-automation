import type { CSSProperties } from "react";
import { useLogo } from "./stage";
import { alpha, mix } from "./theme";

const INK = "#1D2140";

/** Brand colours that would vanish on white get darkened. */
function onWhite(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.78 ? mix(hex, "#000000", 0.45) : hex;
}

/**
 * A company logo on a white tile (like an app icon). Logos Simple Icons doesn't carry
 * show the company name instead, so the plan never breaks.
 */
export const Logo: React.FC<{ slug: string; size: number; style?: CSSProperties; shadow?: boolean }> = ({
  slug,
  size,
  style,
  shadow = true,
}) => {
  const logo = useLogo(slug);
  const color = logo.hex ? onWhite(logo.hex) : INK;
  const words = logo.title.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: size * 0.24,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: shadow ? `0 ${size * 0.06}px ${size * 0.18}px ${alpha(INK, 0.22)}` : undefined,
        overflow: "hidden",
        ...style,
      }}
    >
      {logo.path ? (
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-label={logo.title}>
          <path d={logo.path} fill={color} />
        </svg>
      ) : (
        <div
          style={{
            fontSize: size * Math.min(0.3, 1.45 / Math.max(words, 1)),
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: INK,
            textAlign: "center",
            lineHeight: 1,
            padding: size * 0.06,
          }}
        >
          {logo.title}
        </div>
      )}
    </div>
  );
};
