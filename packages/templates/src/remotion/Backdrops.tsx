import type { Place } from "../schema";
import { mulberry32 } from "../timeline";

/**
 * Illustrated locations, drawn in a 1600 × 900 box. The wall runs to y = 810 (FLOOR_Y), the floor below.
 * Keep the important bits in the middle third: portrait crops the sides.
 */
export const VIEW_W = 1600;
export const VIEW_H = 900;
export const FLOOR_Y = 810;

export interface BackdropProps {
  frame: number;
  screen?: string;
  trend?: "up" | "down";
}

interface PlaceArt {
  back: React.FC<BackdropProps>;
  /** Drawn over the characters (e.g. the audience at a keynote). */
  front?: React.FC<BackdropProps>;
  /** Fills below the drawing when the frame is taller than the art. */
  floor: string;
  /** The furniture the characters sit behind. */
  desk: { color: string; edge: string };
}

const MARKER = "'Marker Felt', 'Comic Sans MS', 'Chalkboard SE', cursive";

// ── diner ─────────────────────────────────────────────────────────────────

const Diner: React.FC<BackdropProps> = ({ frame }) => {
  const rand = mulberry32(11);
  const windows: [number, number][] = [
    [150, 560],
    [620, 980],
    [1040, 1450],
  ];
  const flicker = frame % 97 < 3 || frame % 211 < 2 ? 0.35 : 0.92 + 0.08 * Math.sin(frame / 3);
  return (
    <g>
      <defs>
        <linearGradient id="dinerSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13234A" />
          <stop offset="1" stopColor="#24477A" />
        </linearGradient>
        <linearGradient id="dinerLamp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE7A0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFE7A0" stopOpacity="0" />
        </linearGradient>
        <filter id="neon" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="checker" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="#F2EEE6" />
          <rect width="30" height="30" fill="#2A2A35" />
          <rect x="30" y="30" width="30" height="30" fill="#2A2A35" />
        </pattern>
      </defs>
      <rect width={VIEW_W} height={FLOOR_Y} fill="#F3E2C0" />
      <rect width={VIEW_W} height={44} fill="#E2C995" />
      {windows.map(([x0, x1], w) => {
        const buildings: React.ReactNode[] = [];
        for (let x = x0 + 12; x < x1 - 12; ) {
          const bw = 40 + rand() * 50;
          const bh = 70 + rand() * 170;
          const right = Math.min(x + bw, x1 - 12);
          buildings.push(<rect key={`b${x}`} x={x} y={450 - 12 - bh} width={right - x} height={bh} fill="#10163A" />);
          for (let wy = 450 - bh; wy < 430; wy += 22) {
            for (let wx = x + 8; wx < right - 10; wx += 16) {
              if (rand() < 0.45) {
                const on = Math.sin(frame / 40 + wx * 0.37 + wy) > -0.6;
                buildings.push(<rect key={`w${wx}-${wy}`} x={wx} y={wy} width={7} height={10} fill="#FFD36B" opacity={on ? 0.85 : 0.15} />);
              }
            }
          }
          x = right + 4;
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed windows
          <g key={w}>
            <rect x={x0} y={100} width={x1 - x0} height={360} rx={18} fill="#C7CCD6" />
            <rect x={x0 + 12} y={112} width={x1 - x0 - 24} height={336} rx={10} fill="url(#dinerSky)" />
            {w === 0 && <circle cx={x0 + 90} cy={175} r={26} fill="#FFF3C4" />}
            {buildings}
            <rect x={(x0 + x1) / 2 - 5} y={112} width={10} height={336} fill="#C7CCD6" />
          </g>
        );
      })}
      <text
        x={800}
        y={215}
        textAnchor="middle"
        fontSize={70}
        fontWeight={900}
        fontFamily="Arial Black, sans-serif"
        fill="none"
        stroke="#FF4F9A"
        strokeWidth={5}
        filter="url(#neon)"
        opacity={flicker}
        letterSpacing={6}
      >
        OPEN
      </text>
      <rect x={0} y={470} width={VIEW_W} height={340} fill="#C9473E" />
      {Array.from({ length: 17 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed panels
        <rect key={i} x={i * 100 - 2} y={480} width={4} height={330} fill="#B23A33" />
      ))}
      <rect x={0} y={462} width={VIEW_W} height={14} fill="#D7DBE2" />
      <rect x={200} y={540} width={1200} height={300} rx={40} fill="#B8332D" />
      <rect x={190} y={520} width={1220} height={44} rx={22} fill="#D1443C" />
      {Array.from({ length: 12 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed tufts
        <rect key={i} x={260 + i * 98} y={575} width={6} height={230} rx={3} fill="#9E2B26" />
      ))}
      {[400, 800, 1200].map((x) => (
        <g key={x}>
          <polygon points={`${x - 40},134 ${x + 40},134 ${x + 170},560 ${x - 170},560`} fill="url(#dinerLamp)" opacity={0.6} />
          <rect x={x - 1.5} y={0} width={3} height={72} fill="#3A3A44" />
          <path d={`M ${x - 30} 72 L ${x + 30} 72 L ${x + 58} 132 L ${x - 58} 132 Z`} fill="#2E7D6B" />
          <circle cx={x} cy={136} r={12} fill="#FFE7A0" />
        </g>
      ))}
      <rect y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="url(#checker)" />
    </g>
  );
};

// ── office ────────────────────────────────────────────────────────────────

const Office: React.FC<BackdropProps> = ({ frame, screen }) => {
  const drift = (frame * 0.25) % 500;
  return (
    <g>
      <defs>
        <linearGradient id="officeSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FD0FF" />
          <stop offset="1" stopColor="#DDF3FF" />
        </linearGradient>
        <clipPath id="officeWin">
          <rect x={136} y={126} width={408} height={418} />
        </clipPath>
      </defs>
      <rect width={VIEW_W} height={FLOOR_Y} fill="#E9EFF6" />
      <rect y={FLOOR_Y - 22} width={VIEW_W} height={22} fill="#C8D2DE" />
      <g transform="translate(-70 0)">
      <rect x={120} y={110} width={440} height={450} rx={8} fill="#FFFFFF" />
      <rect x={136} y={126} width={408} height={418} fill="url(#officeSky)" />
      <g clipPath="url(#officeWin)">
        {[0, 1, 2].map((i) => {
          const x = 136 + ((i * 210 + drift) % 620) - 100;
          return (
            <g key={i} fill="#FFFFFF" opacity={0.9}>
              <ellipse cx={x} cy={220 + i * 90} rx={60} ry={22} />
              <ellipse cx={x + 40} cy={205 + i * 90} rx={40} ry={24} />
            </g>
          );
        })}
        <rect x={136} y={420} width={408} height={124} fill="#9DB3C8" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={150 + i * 66} y={380 - (i % 3) * 40} width={52} height={170} fill="#7F96AD" />
        ))}
      </g>
      {Array.from({ length: 6 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blind slats
        <rect key={i} x={136} y={126 + i * 18} width={408} height={12} fill="#F4F6F8" />
      ))}
      <rect x={340} y={126} width={6} height={418} fill="#FFFFFF" />

      </g>
      {/* The board is centred: portrait frames only show the middle of the art. */}
      <g transform="translate(-210 0)">
      <rect x={650} y={110} width={720} height={370} rx={12} fill="#B8C2CE" />
      <rect x={664} y={124} width={692} height={342} rx={6} fill="#FFFFFF" />
      {screen ? (
        // Written high on the board: a character's head covers the lower half.
        <g>
          <text x={1010} y={250} textAnchor="middle" fontSize={screen.length > 22 ? 44 : 56} fontFamily={MARKER} fontWeight={700} fill="#1D2140">
            {screen}
          </text>
          <path d="M 800 280 C 880 268, 1140 268, 1220 282" fill="none" stroke="#E5484D" strokeWidth={6} strokeLinecap="round" />
          <rect x={700} y={150} width={46} height={46} rx={6} fill="none" stroke="#2D6CDF" strokeWidth={5} />
          <path d="M 1280 160 L 1320 160 M 1300 140 L 1320 160 L 1300 180" fill="none" stroke="#14A37F" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x={720} y={170} width={110} height={110} rx={8} stroke="#2D6CDF" strokeWidth={6} />
          {[0, 1, 2, 3].map((k) => (
            <g key={k} stroke="#2D6CDF" strokeWidth={5}>
              <path d={`M ${738 + k * 25} 170 L ${738 + k * 25} 150`} />
              <path d={`M ${738 + k * 25} 280 L ${738 + k * 25} 300`} />
            </g>
          ))}
          <path d="M 860 225 L 950 225 M 930 205 L 952 225 L 930 245" stroke="#1D2140" strokeWidth={6} />
          <path d="M 990 290 L 990 190 M 990 290 L 1300 290" stroke="#1D2140" strokeWidth={5} />
          <rect x={1020} y={240} width={40} height={50} stroke="#E5484D" strokeWidth={6} />
          <rect x={1090} y={210} width={40} height={80} stroke="#FFB21E" strokeWidth={6} />
          <rect x={1160} y={170} width={40} height={120} stroke="#14A37F" strokeWidth={6} />
          <path d="M 1230 160 C 1250 150, 1270 150, 1290 135" stroke="#14A37F" strokeWidth={6} />
        </g>
      )}
      <rect x={900} y={466} width={220} height={12} rx={4} fill="#9AA5B4" />
      </g>

      <circle cx={1480} cy={150} r={52} fill="#FFFFFF" stroke="#1D2140" strokeWidth={8} />
      <path d={`M 1480 150 L ${1480 + 30 * Math.sin(frame / 90)} ${150 - 30 * Math.cos(frame / 90)}`} stroke="#1D2140" strokeWidth={6} strokeLinecap="round" />
      <path d={`M 1480 150 L ${1480 + 40 * Math.sin(frame / 8)} ${150 - 40 * Math.cos(frame / 8)}`} stroke="#E5484D" strokeWidth={3} strokeLinecap="round" />

      <rect x={1410} y={250} width={160} height={540} fill="#9C7A55" />
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <rect x={1410} y={250 + r * 135 + 120} width={160} height={14} fill="#7D5F40" />
          {[0, 1, 2, 3, 4].map((b) => (
            <rect
              key={b}
              x={1422 + b * 28}
              y={250 + r * 135 + 30 + (b % 2) * 10}
              width={22}
              height={90 - (b % 2) * 10}
              rx={3}
              fill={["#3D6BFF", "#F2542D", "#FFC23C", "#14A37F", "#A66CFF"][(b + r) % 5]}
            />
          ))}
        </g>
      ))}

      <g transform="translate(600 560)">
        <rect x={-40} y={150} width={80} height={80} rx={10} fill="#E07A5F" />
        {[-50, -20, 10, 40].map((a, i) => (
          <ellipse key={a} cx={Math.sin((a * Math.PI) / 180) * 60} cy={110 - i * 18} rx={20} ry={56} fill={i % 2 ? "#3FA34D" : "#2F8F3E"} transform={`rotate(${a + Math.sin(frame / 40 + i) * 3} ${Math.sin((a * Math.PI) / 180) * 60} ${150})`} />
        ))}
      </g>
      <rect y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="#C7A982" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 200} y={FLOOR_Y} width={3} height={VIEW_H - FLOOR_Y} fill="#AE8F67" />
      ))}
    </g>
  );
};

// ── bedroom ───────────────────────────────────────────────────────────────

const Bedroom: React.FC<BackdropProps> = ({ frame }) => {
  const rand = mulberry32(5);
  const bulbs = Array.from({ length: 22 }, (_, i) => {
    const x = 30 + i * 72;
    const t = (x - 800) / 800;
    return { x, y: 46 + 40 * (1 - t * t) * 0.6 + Math.sin(i * 1.3) * 6, i };
  });
  const colors = ["#FFD36B", "#FF7AA8", "#7FD8FF", "#B3FF7F"];
  const stars = Array.from({ length: 18 }, () => ({ x: 1140 + rand() * 300, y: 130 + rand() * 280, p: rand() * 6 }));
  const spin = frame * 9;
  return (
    <g>
      <defs>
        <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B0E2C" />
          <stop offset="1" stopColor="#2A2160" />
        </linearGradient>
        <radialGradient id="lampWarm">
          <stop offset="0" stopColor="#FFC97A" stopOpacity="0.42" />
          <stop offset="1" stopColor="#FFC97A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fanGlow">
          <stop offset="0" stopColor="#2EE6A6" stopOpacity="0.8" />
          <stop offset="1" stopColor="#2EE6A6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={VIEW_W} height={FLOOR_Y} fill="#2B2850" />
      <rect y={FLOOR_Y - 20} width={VIEW_W} height={20} fill="#211E40" />
      <path d={`M 0 40 ${bulbs.map((b) => `L ${b.x} ${b.y}`).join(" ")} L 1600 40`} fill="none" stroke="#151331" strokeWidth={3} />
      {bulbs.map((b) => (
        <circle key={b.i} cx={b.x} cy={b.y + 8} r={8} fill={colors[b.i % 4]} opacity={0.5 + 0.5 * Math.max(0, Math.sin(frame / 12 + b.i * 1.7))} />
      ))}

      <rect x={1110} y={110} width={360} height={340} rx={8} fill="#4A4580" />
      <rect x={1126} y={126} width={328} height={308} fill="url(#nightSky)" />
      {stars.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed stars
        <circle key={i} cx={s.x} cy={s.y} r={2.4} fill="#FFFFFF" opacity={0.4 + 0.6 * Math.abs(Math.sin(frame / 20 + s.p))} />
      ))}
      <circle cx={1370} cy={190} r={34} fill="#FFF3C4" />
      <circle cx={1386} cy={180} r={30} fill="#1A1748" />
      <rect x={1286} y={126} width={8} height={308} fill="#4A4580" />

      <g transform="rotate(-3 310 270)">
        <rect x={180} y={120} width={260} height={300} rx={6} fill="#F4F1E8" />
        <rect x={180} y={120} width={260} height={46} rx={6} fill="#6C5CFF" />
        {[0, 1, 2].flatMap((c) =>
          [0, 1, 2, 3].slice(0, c === 1 ? 4 : 3).map((r) => {
            const x = 230 + c * 80;
            const y = 210 + r * (c === 1 ? 50 : 66) + (c === 1 ? 0 : 10);
            return { x, y, c, r };
          }),
        ).map((node, _, all) => (
          <g key={`${node.c}-${node.r}`}>
            {all
              .filter((o) => o.c === node.c + 1)
              .map((o) => (
                <line key={`${o.c}-${o.r}`} x1={node.x} y1={node.y} x2={o.x} y2={o.y} stroke="#9A8FFF" strokeWidth={2} />
              ))}
            <circle cx={node.x} cy={node.y} r={11} fill={["#FF7AA8", "#6C5CFF", "#2EE6A6"][node.c]} />
          </g>
        ))}
      </g>
      <g transform="rotate(4 590 260)">
        <rect x={500} y={160} width={180} height={210} rx={6} fill="#FF7A59" />
        <circle cx={590} cy={260} r={46} fill="#FFD36B" />
        <ellipse cx={590} cy={260} rx={78} ry={16} fill="none" stroke="#FFF3C4" strokeWidth={6} />
      </g>

      <rect x={760} y={330} width={290} height={14} fill="#5A4636" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
        <rect key={b} x={772 + b * 33} y={330 - 70 - (b % 3) * 12} width={26} height={70 + (b % 3) * 12} rx={3} fill={["#FF7AA8", "#7FD8FF", "#FFD36B", "#B3FF7F", "#A66CFF"][b % 5]} opacity={0.85} />
      ))}

      <circle cx={1180} cy={640} r={260} fill="url(#lampWarm)" />

      <rect x={1390} y={500} width={160} height={310} rx={10} fill="#16162A" stroke="#34345A" strokeWidth={4} />
      <rect x={1406} y={520} width={128} height={200} rx={6} fill="#0B0B18" />
      {[580, 670].map((cy) => (
        <g key={cy}>
          <circle cx={1470} cy={cy} r={42} fill="url(#fanGlow)" />
          <circle cx={1470} cy={cy} r={30} fill="none" stroke="#2EE6A6" strokeWidth={4} />
          {[0, 120, 240].map((a) => (
            <path key={a} d="M 1470 0 L 1470 -24" transform={`translate(0 ${cy}) rotate(${a + spin} 1470 0)`} stroke="#2EE6A6" strokeWidth={6} strokeLinecap="round" />
          ))}
        </g>
      ))}
      <rect x={1406} y={736} width={128} height={16} rx={4} fill="#76B900" opacity={0.85} />
      <rect y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="#3B2F2B" />
    </g>
  );
};

// ── stage ─────────────────────────────────────────────────────────────────

const Stage: React.FC<BackdropProps> = ({ frame, screen }) => {
  const sweep = ((frame * 6) % 1800) - 300;
  return (
    <g>
      <defs>
        <linearGradient id="stageWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E2350" />
          <stop offset="1" stopColor="#1C3A72" />
        </linearGradient>
        <linearGradient id="stageScreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#123A7A" />
          <stop offset="1" stopColor="#0B6C82" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pillar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C8BF2" />
          <stop offset="0.5" stopColor="#2EE6A6" />
          <stop offset="1" stopColor="#1C8BF2" />
        </linearGradient>
        <clipPath id="screenClip">
          <rect x={240} y={70} width={1120} height={450} rx={18} />
        </clipPath>
      </defs>
      <rect width={VIEW_W} height={FLOOR_Y} fill="url(#stageWall)" />
      <rect x={240} y={70} width={1120} height={450} rx={18} fill="url(#stageScreen)" />
      <g clipPath="url(#screenClip)">
        {Array.from({ length: 12 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: grid lines
          <line key={i} x1={240 + i * 100} y1={70} x2={240 + i * 100} y2={520} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={2} />
        ))}
        <polygon points={`${sweep},70 ${sweep + 160},70 ${sweep - 40},520 ${sweep - 200},520`} fill="#FFFFFF" opacity={0.07} />
      </g>
      <rect x={240} y={70} width={1120} height={450} rx={18} fill="none" stroke="#7F9BFF" strokeOpacity={0.5} strokeWidth={4} />
      {screen && (
        <text x={800} y={325} textAnchor="middle" fontSize={screen.length > 18 ? 66 : 92} fontWeight={900} fill="#FFFFFF" letterSpacing={2} fontFamily="Inter, Arial, sans-serif">
          {screen}
        </text>
      )}
      {[300, 800, 1300].map((x, i) => {
        const sway = Math.sin(frame / 50 + i * 2) * 60;
        return <polygon key={x} points={`${x - 25},0 ${x + 25},0 ${x + 230 + sway},${FLOOR_Y} ${x - 230 + sway},${FLOOR_Y}`} fill="url(#beam)" />;
      })}
      {[80, 1460].map((x, i) => (
        <rect key={x} x={x} y={70} width={60} height={740} rx={12} fill="url(#pillar)" opacity={0.35 + 0.25 * Math.sin(frame / 15 + i * 3)} />
      ))}
      <rect y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="#1A2E5A" />
      <rect y={FLOOR_Y} width={VIEW_W} height={5} fill="#4A6AB0" />
    </g>
  );
};

const Audience: React.FC<BackdropProps> = ({ frame }) => (
  <g>
    {Array.from({ length: 19 }, (_, i) => {
      const x = 20 + i * 88 + (i % 2) * 12;
      const bob = Math.sin(frame / 20 + i) * 3;
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed row
        <g key={i} fill="#03050C">
          <circle cx={x} cy={866 + bob} r={32} />
          <ellipse cx={x} cy={930 + bob} rx={58} ry={44} />
          {i % 5 === 2 && <rect x={x + 22} y={800 + bob} width={22} height={36} rx={4} fill="#9FB4FF" opacity={0.9} />}
        </g>
      );
    })}
  </g>
);

// ── data centre ───────────────────────────────────────────────────────────

const DataCenter: React.FC<BackdropProps> = ({ frame }) => {
  const rand = mulberry32(3);
  const racks = Array.from({ length: 7 }, (_, i) => 110 + i * 200);
  const ledColors = ["#2EE6A6", "#2EE6A6", "#4C9BFF", "#FFC23C"];
  return (
    <g>
      <defs>
        <linearGradient id="coldLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FD8FF" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7FD8FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dcFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9D3E0" />
          <stop offset="1" stopColor="#AEB9C9" />
        </linearGradient>
      </defs>
      <rect width={VIEW_W} height={FLOOR_Y} fill="#E6ECF3" />
      <rect y={0} width={VIEW_W} height={240} fill="url(#coldLight)" />
      <rect y={88} width={VIEW_W} height={16} fill="#B8C4D4" />
      {[200, 600, 1000, 1400].map((x) => (
        <rect key={x} x={x} y={30} width={200} height={10} rx={5} fill="#BFE9FF" opacity={0.8} />
      ))}
      {racks.map((x) => (
        <g key={x}>
          <rect x={x} y={130} width={170} height={FLOOR_Y - 130} rx={6} fill="#131B33" stroke="#26355E" strokeWidth={4} />
          <rect x={x + 8} y={140} width={154} height={18} rx={3} fill="#1D2A50" />
          {Array.from({ length: 27 }, (_, r) => {
            const y = 172 + r * 23;
            return (
              <g key={r}>
                <rect x={x + 10} y={y} width={150} height={18} rx={2} fill="#18223F" />
                {[0, 1, 2].map((k) => {
                  const phase = rand() * 6.28;
                  const speed = 0.08 + rand() * 0.25;
                  const color = ledColors[Math.floor(rand() * ledColors.length)];
                  const on = Math.sin(frame * speed + phase) > -0.2;
                  return <rect key={k} x={x + 18 + k * 12} y={y + 6} width={7} height={6} rx={1} fill={color} opacity={on ? 0.95 : 0.15} />;
                })}
                <rect x={x + 70} y={y + 7} width={80} height={4} rx={2} fill="#22305A" />
              </g>
            );
          })}
        </g>
      ))}
      <rect y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="url(#dcFloor)" />
      {Array.from({ length: 9 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: floor tiles
        <line key={i} x1={i * 200} y1={FLOOR_Y} x2={i * 200 - 80} y2={VIEW_H} stroke="#9FAABB" strokeWidth={3} />
      ))}
    </g>
  );
};

// ── trading floor ─────────────────────────────────────────────────────────

const Trading: React.FC<BackdropProps> = ({ frame, screen, trend = "up" }) => {
  const color = trend === "up" ? "#22C55E" : "#EF4444";
  const screens: [number, number][] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) screens.push([170 + c * 320, 150 + r * 182]);
  const drawn = Math.min(1, frame / 45);
  const tickerText = `${screen ?? (trend === "up" ? "▲" : "▼")}     •     `.repeat(8);
  const tickerShift = (frame * 4) % 1200;
  return (
    <g>
      <defs>
        <clipPath id="ticker">
          <rect x={0} y={74} width={VIEW_W} height={56} />
        </clipPath>
      </defs>
      <rect width={VIEW_W} height={FLOOR_Y} fill="#DCE3EC" />
      {screens.map(([x, y], i) => {
        const rand = mulberry32(31 + i);
        let v = trend === "up" ? 140 : 40;
        const pts: [number, number][] = [];
        for (let k = 0; k < 24; k++) {
          v += (trend === "up" ? -5 : 5) + (rand() - 0.5) * 22;
          v = Math.max(20, Math.min(160, v));
          pts.push([x + 16 + k * 11.6, y + 24 + v * 0.76 + Math.sin(frame / 9 + k + i) * (k === 23 ? 3 : 0)]);
        }
        const shown = pts.slice(0, Math.max(2, Math.ceil(pts.length * drawn)));
        const line = shown.map(([px, py], k) => `${k ? "L" : "M"} ${px} ${py}`).join(" ");
        const last = shown[shown.length - 1] as [number, number];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed screens
          <g key={i}>
            <rect x={x} y={y} width={300} height={165} rx={10} fill="#1F2540" />
            <rect x={x + 8} y={y + 8} width={284} height={149} rx={6} fill="#0A0E1C" />
            <rect x={x + 18} y={y + 16} width={60} height={8} rx={4} fill="#3A4470" />
            <rect x={x + 86} y={y + 16} width={30} height={8} rx={4} fill={color} opacity={0.8} />
            <path d={`${line} L ${last[0]} ${y + 155} L ${x + 16} ${y + 155} Z`} fill={color} opacity={0.12} />
            <path d={line} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
            <circle cx={last[0]} cy={last[1]} r={6} fill={color} opacity={0.6 + 0.4 * Math.sin(frame / 4)} />
          </g>
        );
      })}
      <rect x={0} y={74} width={VIEW_W} height={56} fill="#141B36" />
      <g clipPath="url(#ticker)">
        <text x={-tickerShift} y={114} fontSize={32} fontWeight={800} fill={color} fontFamily="Inter, Arial, sans-serif" letterSpacing={1}>
          {tickerText}
        </text>
      </g>
      {Array.from({ length: 10 }, (_, i) => {
        const x = 60 + i * 152;
        const up = Math.sin(frame / 11 + i * 1.9) > 0;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed desk monitors
          <g key={`m${i}`}>
            <rect x={x + 56} y={636} width={12} height={34} fill="#5B6676" />
            <rect x={x} y={556} width={124} height={84} rx={8} fill="#1F2540" />
            <rect x={x + 6} y={562} width={112} height={72} rx={5} fill="#0A0E1C" />
            {[0, 1, 2].map((r) => (
              <rect key={r} x={x + 16} y={574 + r * 18} width={40 + ((i * 7 + r * 13) % 50)} height={8} rx={4} fill={r === 0 ? color : "#3A4470"} opacity={r === 0 ? 0.85 : 1} />
            ))}
            <text x={x + 104} y={600} textAnchor="end" fontSize={20} fontWeight={900} fill={up === (trend === "up") ? color : "#9AA5B4"} fontFamily="Inter, Arial, sans-serif">
              {trend === "up" ? "▲" : "▼"}
            </text>
          </g>
        );
      })}
      <rect x={0} y={668} width={VIEW_W} height={22} rx={4} fill="#8D99AB" />
      <rect x={0} y={690} width={VIEW_W} height={FLOOR_Y - 690} fill="#A7B2C2" />
      {Array.from({ length: 8 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: desk panels
        <rect key={`p${i}`} x={i * 200 + 8} y={704} width={184} height={92} rx={6} fill="#B5BFCD" />
      ))}
      <rect y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="#B9C3D1" />
    </g>
  );
};

export const PLACE_ART: Record<Place, PlaceArt> = {
  diner: { back: Diner, floor: "#2A2A35", desk: { color: "#F1E6D2", edge: "#B8322F" } },
  office: { back: Office, floor: "#C7A982", desk: { color: "#DDBE94", edge: "#9C7650" } },
  bedroom: { back: Bedroom, floor: "#3B2F2B", desk: { color: "#B48A62", edge: "#7A5A3C" } },
  stage: { back: Stage, front: Audience, floor: "#1A2E5A", desk: { color: "#34508A", edge: "#1A2E5A" } },
  datacenter: { back: DataCenter, floor: "#AEB9C9", desk: { color: "#D5DCE6", edge: "#8D99AB" } },
  trading: { back: Trading, floor: "#B9C3D1", desk: { color: "#D5DCE6", edge: "#8D99AB" } },
};
