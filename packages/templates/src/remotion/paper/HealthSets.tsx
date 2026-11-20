import { FLOOR, type Light, SCENE_H as H, SCENE_W as W } from "../../paper";
import { fit, Hand, INK, STROKE, wrap } from "./ink";

/**
 * Health channel locations in the paper look, 1920 × 1080: a park, a kitchen and a bedroom.
 * Same contract as Sets.tsx: `Back` goes behind the figures.
 */

export interface HealthSetProps {
  frame: number;
  /** Park: a sign. Kitchen: a note on the fridge. Bedroom: the alarm clock's display. */
  screen?: string;
  trend?: "up" | "down";
  light?: Light;
}

interface SetArt {
  Back: React.FC<HealthSetProps>;
  Front?: React.FC<HealthSetProps>;
}

const line = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const Ground: React.FC<{ y: number; fill: string }> = ({ y, fill }) => (
  <g>
    <rect x={0} y={y - 26} width={W} height={H - y + 26} fill={fill} />
    <line x1={0} y1={y - 26} x2={W} y2={y - 26} {...line} />
  </g>
);

/** Overlapping circles with one outline round the outside (outlines first, fills on top). */
const Blob: React.FC<{ parts: [number, number, number][]; fill: string; shade?: string }> = ({ parts, fill, shade }) => (
  <g>
    {parts.map(([cx, cy, r]) => (
      <circle key={`o${cx},${cy}`} cx={cx} cy={cy} r={r} fill={fill} {...line} />
    ))}
    {parts.map(([cx, cy, r], i) => (
      <circle key={`f${cx},${cy}`} cx={cx} cy={cy} r={r - STROKE / 2} fill={shade && i % 2 ? shade : fill} />
    ))}
  </g>
);

const Tree: React.FC<{ x: number; base: number; s: number; frame: number }> = ({ x, base, s, frame }) => (
  <g transform={`translate(${x} ${base}) scale(${s})`}>
    <path d="M -20 0 L -12 -180 L 12 -180 L 20 0 Z" fill="#8A5A3C" {...line} />
    <path d="M -2 -120 L -46 -170 M 4 -140 L 40 -186" fill="none" {...line} />
    <g transform={`rotate(${Math.sin(frame / 45 + x) * 1.6} 0 -180)`}>
      <Blob
        parts={[
          [-78, -210, 72],
          [70, -215, 76],
          [0, -300, 92],
          [-50, -150, 56],
          [52, -150, 56],
          [0, -200, 80],
        ]}
        fill="#55B35A"
        shade="#68C46A"
      />
    </g>
  </g>
);

const Cloud: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <Blob
      parts={[
        [-60, 0, 40],
        [0, -20, 55],
        [60, 0, 42],
      ]}
      fill="#FFFFFF"
    />
  </g>
);

const Sun: React.FC<{ x: number; y: number; r: number; frame: number }> = ({ x, y, r, frame }) => (
  <g transform={`translate(${x} ${y})`}>
    <g transform={`rotate(${frame * 0.4})`}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed rays
            key={i}
            x1={Math.cos(a) * (r + 16)}
            y1={Math.sin(a) * (r + 16)}
            x2={Math.cos(a) * (r + 44)}
            y2={Math.sin(a) * (r + 44)}
            stroke="#F2A20C"
            strokeWidth={9}
            strokeLinecap="round"
          />
        );
      })}
    </g>
    <circle r={r} fill="#FFD84A" {...line} />
  </g>
);

const Park: SetArt = {
  Back: ({ frame, screen }) => {
    const base = FLOOR.park - 26;
    const drift = (frame * 0.35) % (W + 600);
    return (
      <g>
        <rect width={W} height={H} fill="#BDE3F5" />
        <Sun x={1690} y={160} r={66} frame={frame} />
        <Cloud x={((260 + drift) % (W + 600)) - 300} y={150} s={1.1} />
        <Cloud x={((1100 + drift * 0.7) % (W + 600)) - 300} y={250} s={0.8} />
        <path
          d={`M 0 ${base - 190} Q 380 ${base - 330} 760 ${base - 210} Q 1150 ${base - 90} 1500 ${base - 230} Q 1760 ${base - 320} ${W} ${base - 220} L ${W} ${base} L 0 ${base} Z`}
          fill="#A9DA8E"
          {...line}
        />
        <Tree x={210} base={base + 4} s={1.3} frame={frame} />
        <Tree x={1560} base={base + 4} s={0.95} frame={frame} />
        <Tree x={1830} base={base + 4} s={1.15} frame={frame} />
        {/* Bench: a sitting figure's hips rest on the seat at about x 1080–1300. */}
        <g>
          <rect x={1040} y={700} width={300} height={22} rx={6} fill="#C98A4E" {...line} />
          <rect x={1040} y={740} width={300} height={22} rx={6} fill="#C98A4E" {...line} />
          <rect x={1060} y={700} width={16} height={130} fill="#8A5A3C" {...line} />
          <rect x={1304} y={700} width={16} height={130} fill="#8A5A3C" {...line} />
          <rect x={1020} y={812} width={340} height={22} rx={6} fill="#C98A4E" {...line} />
          <rect x={1046} y={834} width={16} height={60} fill="#5E4A3A" {...line} />
          <rect x={1318} y={834} width={16} height={60} fill="#5E4A3A" {...line} />
        </g>
        <Ground y={FLOOR.park} fill="#86C66A" />
        <path d={`M 0 ${base + 70} Q 960 ${base + 40} ${W} ${base + 80} L ${W} ${base + 150} Q 960 ${base + 110} 0 ${base + 140} Z`} fill="#EADCB8" {...line} />
        {[120, 520, 880, 1420, 1740].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={base + 196} x2={x + 6} y2={base + 170} stroke="#3F8A4B" strokeWidth={4} strokeLinecap="round" />
            <circle cx={x + 6} cy={base + 164} r={9} fill={i % 2 ? "#FFD84A" : "#FF8FA3"} stroke={INK} strokeWidth={2.5} />
          </g>
        ))}
        {screen && (
          <g transform="translate(700 0)">
            <rect x={-7} y={base - 190} width={14} height={190} fill="#8A5A3C" {...line} />
            <rect x={-150} y={base - 270} width={300} height={90} rx={8} fill="#3F8A4B" {...line} />
            <Hand y={base - 225} size={fit(screen, 260, 52)} fill="#FFFFFF">
              {screen}
            </Hand>
          </g>
        )}
      </g>
    );
  },
};

const Kitchen: SetArt = {
  Back: ({ screen, frame }) => {
    const base = FLOOR.kitchen - 26;
    const top = 690;
    return (
      <g>
        <rect width={W} height={H} fill="#F6EFE1" />
        {/* Tiles behind the counter */}
        <rect x={440} y={430} width={W - 440} height={top - 430} fill="#FFFFFF" {...line} />
        <g stroke="#BFD3E2" strokeWidth={3}>
          {Array.from({ length: 4 }, (_, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
            <line key={`r${r}`} x1={442} y1={430 + (r + 1) * 64} x2={W} y2={430 + (r + 1) * 64} />
          ))}
          {Array.from({ length: 24 }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
            <line key={`c${c}`} x1={440 + (c + 1) * 64} y1={432} x2={440 + (c + 1) * 64} y2={top} />
          ))}
        </g>
        {/* Window over the sink */}
        <rect x={820} y={130} width={420} height={250} fill="#BFE3F2" {...line} />
        <ellipse cx={940 + ((frame * 0.3) % 200)} cy={200} rx={60} ry={20} fill="#FFFFFF" opacity={0.9} />
        <path d="M 820 330 Q 960 280 1100 320 Q 1180 340 1240 320 L 1240 380 L 820 380 Z" fill="#A9DA8E" />
        <rect x={820} y={130} width={420} height={250} fill="none" {...line} />
        <line x1={1030} y1={130} x2={1030} y2={380} {...line} />
        <rect x={800} y={380} width={460} height={20} rx={6} fill="#FFFFFF" {...line} />
        {/* Shelf with jars */}
        <rect x={1420} y={300} width={420} height={18} rx={4} fill="#C99A5B" {...line} />
        {[
          [1470, 70, "#F2A65A"],
          [1570, 90, "#9AD4F5"],
          [1680, 60, "#E8504A"],
          [1780, 80, "#5DBB63"],
        ].map(([x, h, c]) => (
          <g key={x as number}>
            <rect x={(x as number) - 30} y={300 - (h as number)} width={60} height={h as number} rx={10} fill={c as string} {...line} />
            <rect x={(x as number) - 34} y={300 - (h as number) - 14} width={68} height={16} rx={4} fill="#FFFFFF" {...line} />
          </g>
        ))}
        {/* Counter and cupboards */}
        <rect x={430} y={top + 26} width={W - 430} height={base - top - 26} fill="#8FC1E3" {...line} />
        {Array.from({ length: 8 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed doors
          <g key={i}>
            <rect x={450 + i * 186} y={top + 44} width={166} height={base - top - 66} rx={6} fill="#A6CFEA" stroke={INK} strokeWidth={3} />
            <circle cx={450 + i * 186 + (i % 2 ? 22 : 144)} cy={top + 90} r={8} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
          </g>
        ))}
        <rect x={410} y={top} width={W - 400} height={28} rx={6} fill="#E3DACB" {...line} />
        <rect x={930} y={top + 4} width={200} height={10} rx={4} fill="#9AA3AD" stroke={INK} strokeWidth={3} />
        <path d={`M 1030 ${top} L 1030 ${top - 70} Q 1030 ${top - 100} 1070 ${top - 100} L 1080 ${top - 100} L 1080 ${top - 82}`} fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />
        <path d={`M 1030 ${top} L 1030 ${top - 70} Q 1030 ${top - 100} 1070 ${top - 100} L 1080 ${top - 100} L 1080 ${top - 82}`} fill="none" stroke="#C9CED6" strokeWidth={5} strokeLinecap="round" />
        {/* Fridge */}
        <rect x={80} y={210} width={330} height={base - 210} rx={18} fill="#F4F6F7" {...line} />
        <line x1={80} y1={440} x2={410} y2={440} {...line} />
        <rect x={360} y={280} width={16} height={110} rx={8} fill="#C9CED6" stroke={INK} strokeWidth={3} />
        <rect x={360} y={480} width={16} height={150} rx={8} fill="#C9CED6" stroke={INK} strokeWidth={3} />
        <circle cx={130} cy={260} r={14} fill="#E8504A" stroke={INK} strokeWidth={3} />
        <circle cx={300} cy={500} r={14} fill="#FFD84A" stroke={INK} strokeWidth={3} />
        {screen && (
          <g transform="rotate(-3 240 330)">
            <rect x={120} y={268} width={230} height={140} fill="#FFF7B8" stroke={INK} strokeWidth={3} />
            <Hand x={235} y={338} size={38} lines={wrap(screen, 11).slice(0, 3)} />
          </g>
        )}
        <Ground y={FLOOR.kitchen} fill="#E3D3B5" />
        <g stroke="#CDB892" strokeWidth={3}>
          {Array.from({ length: 12 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed tiles
            <line key={i} x1={i * 180 - 40} y1={base + 2} x2={i * 180 - 120} y2={H} />
          ))}
        </g>
      </g>
    );
  },
};

const Bedroom: SetArt = {
  Back: ({ screen, frame, light }) => {
    const base = FLOOR.bedroom - 26;
    const night = light === "night" || light === "dim" || light === "spot";
    const mattress = 690;
    return (
      <g>
        <rect width={W} height={H} fill="#DCEAF4" />
        {/* Window: stars and a moon at night, sun and sky by day */}
        <rect x={290} y={160} width={340} height={290} fill={night ? "#1F3566" : "#BFE3F2"} {...line} />
        {night ? (
          <g>
            <circle cx={520} cy={250} r={44} fill="#FFE9A8" />
            <circle cx={542} cy={236} r={40} fill="#1F3566" />
            {[
              [350, 210],
              [420, 300],
              [590, 380],
              [380, 400],
              [610, 200],
            ].map(([x, y], i) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={4 + ((frame / 8 + i) % 3)} fill="#FFFFFF" opacity={0.8} />
            ))}
          </g>
        ) : (
          <g>
            <circle cx={540} cy={230} r={40} fill="#FFD84A" stroke={INK} strokeWidth={3} />
            <ellipse cx={390} cy={300} rx={60} ry={22} fill="#FFFFFF" />
          </g>
        )}
        <rect x={290} y={160} width={340} height={290} fill="none" {...line} />
        <line x1={460} y1={160} x2={460} y2={450} {...line} />
        <line x1={290} y1={305} x2={630} y2={305} {...line} />
        <path d="M 250 140 L 330 140 Q 300 300 320 470 L 250 470 Z" fill="#F4B860" {...line} />
        <path d="M 670 140 L 590 140 Q 620 300 600 470 L 670 470 Z" fill="#F4B860" {...line} />
        <rect x={230} y={124} width={460} height={18} rx={9} fill="#8A5A3C" {...line} />
        {/* Picture over the nightstand */}
        <rect x={830} y={250} width={170} height={130} fill="#FFFFFF" {...line} />
        <path d="M 845 365 L 895 300 L 930 340 L 955 315 L 985 365 Z" fill="#7FC7A0" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <Ground y={FLOOR.bedroom} fill="#C9A882" />
        <ellipse cx={620} cy={960} rx={420} ry={58} fill="#9CC7E8" {...line} />
        {/* Nightstand, lamp and alarm clock */}
        <rect x={860} y={mattress} width={170} height={base - mattress + 10} rx={6} fill="#C99A5B" {...line} />
        <line x1={860} y1={mattress + 70} x2={1030} y2={mattress + 70} stroke={INK} strokeWidth={3} />
        <circle cx={945} cy={mattress + 36} r={7} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
        {night && <circle cx={905} cy={560} r={120} fill="#FFE9A8" opacity={0.35} />}
        <rect x={898} y={575} width={14} height={mattress - 575} fill={INK} />
        <path d="M 860 590 L 950 590 L 930 520 L 880 520 Z" fill="#FFE9A8" {...line} />
        <rect x={950} y={mattress - 58} width={74} height={58} rx={10} fill="#2B2A33" {...line} />
        {screen && (
          <Hand x={987} y={mattress - 29} size={fit(screen, 60, 30)} fill="#FF6B5B">
            {screen}
          </Hand>
        )}
        {/* Bed: headboard on the left. A sleeping figure (act "sleep", flip: false) lies with its feet at x ≈ 78%, y = 64%. */}
        <rect x={1070} y={500} width={46} height={base - 500 + 10} rx={14} fill="#B07A4F" {...line} />
        <rect x={1790} y={620} width={36} height={base - 620 + 10} rx={10} fill="#B07A4F" {...line} />
        <rect x={1100} y={mattress + 50} width={700} height={70} fill="#B07A4F" {...line} />
        <rect x={1105} y={mattress} width={690} height={56} rx={14} fill="#FFFFFF" {...line} />
        <rect x={1250} y={mattress - 8} width={545} height={44} rx={12} fill="#F29E7E" {...line} />
        <rect x={1250} y={mattress - 8} width={56} height={44} rx={10} fill="#FFFFFF" {...line} />
        <ellipse cx={1182} cy={mattress - 18} rx={74} ry={26} fill="#FFFFFF" {...line} />
      </g>
    );
  },
};

export const HEALTH_SET_ART = { park: Park, kitchen: Kitchen, bedroom: Bedroom } as const;
