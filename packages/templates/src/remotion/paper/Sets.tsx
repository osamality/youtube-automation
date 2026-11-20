import { FLOOR, type Light, SCENE_H as H, type SetId, SCENE_W as W } from "../../paper";
import { HEALTH_SET_ART } from "./HealthSets";
import { fit, Hand, hash, INK, PAPER, STROKE } from "./ink";

/** Drawn locations, 1920 × 1080. `Back` goes behind the figures, `Front` (if any) in front of them. */
export interface SetProps {
  frame: number;
  /** Text on the set's sign, screen or board. */
  screen?: string;
  trend?: "up" | "down";
  /** The scene's lighting, for sets that change with it (the bedroom window). */
  light?: Light;
}

interface SetArt {
  Back: React.FC<SetProps>;
  Front?: React.FC<SetProps>;
}

const line = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** A row of buildings between x0 and x1 standing on `base`. */
const Skyline: React.FC<{
  x0: number;
  x1: number;
  base: number;
  min: number;
  max: number;
  fill: string;
  lit?: string;
  seed: number;
  frame?: number;
  outline?: boolean;
}> = ({ x0, x1, base, min, max, fill, lit, seed, frame = 0, outline }) => {
  const out: React.ReactNode[] = [];
  let x = x0;
  let i = 0;
  while (x < x1) {
    const w = Math.min(70 + hash(seed + i) * 90, x1 - x);
    const h = min + hash(seed + i * 3.1) * (max - min);
    out.push(
      <rect key={`b${i}`} x={x} y={base - h} width={w + 1} height={h} fill={fill} stroke={outline ? INK : undefined} strokeWidth={outline ? 3 : undefined} />,
    );
    if (lit) {
      for (let wy = base - h + 16; wy < base - 20; wy += 30) {
        for (let wx = x + 12; wx < x + w - 16; wx += 24) {
          const k = hash(seed + wx * 0.37 + wy * 1.91);
          if (k < 0.45) continue;
          const flicker = k > 0.93 && Math.floor(frame / 40 + k * 10) % 3 === 0 ? 0.3 : 1;
          out.push(<rect key={`w${i}-${wx}-${wy}`} x={wx} y={wy} width={11} height={14} fill={lit} opacity={flicker} />);
        }
      }
    }
    x += w;
    i++;
  }
  return <g>{out}</g>;
};

const Floor: React.FC<{ y: number; fill: string }> = ({ y, fill }) => (
  <g>
    <rect x={0} y={y - 26} width={W} height={H - y + 26} fill={fill} />
    <line x1={0} y1={y - 26} x2={W} y2={y - 26} {...line} />
  </g>
);

const Plain: SetArt = {
  Back: () => (
    <g>
      <rect width={W} height={H} fill={PAPER} />
      <Floor y={FLOOR.plain} fill="#E2D5BB" />
    </g>
  ),
};

const Office: SetArt = {
  Back: ({ frame, screen }) => (
    <g>
      <rect width={W} height={H} fill="#D9E4E1" />
      <rect x={1150} y={150} width={600} height={420} fill="#A9D8EE" {...line} />
      <g>
        <Skyline x0={1152} x1={1748} base={568} min={90} max={300} fill="#7FA5B8" seed={4} />
      </g>
      <line x1={1450} y1={150} x2={1450} y2={570} {...line} />
      <line x1={1150} y1={360} x2={1750} y2={360} {...line} />
      <rect x={1130} y={570} width={640} height={22} fill="#F7F3EA" {...line} />
      <rect x={170} y={190} width={screen ? 520 : 250} height={screen ? 250 : 180} fill="#FBF6E9" {...line} />
      {screen ? (
        <Hand x={430} y={315} size={fit(screen, 460, 84)}>
          {screen}
        </Hand>
      ) : (
        <path d="M 195 340 L 250 270 L 300 310 L 345 230 L 395 340 Z" fill="#9CC59A" {...line} />
      )}
      <Floor y={FLOOR.office} fill="#C9A679" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={i * 380 - 60} y1={H} x2={i * 340 + 80} y2={FLOOR.office - 26} stroke={INK} strokeWidth={2} opacity={0.25} />
      ))}
      <g transform={`translate(1820 ${FLOOR.office - 26})`}>
        <path d={`M -34 0 L -26 -70 L 26 -70 L 34 0 Z`} fill="#B8623A" {...line} />
        {[-28, 0, 28].map((a, i) => (
          <path key={a} d={`M 0 -70 Q ${a * 2} ${-150 - i * 12} ${a * 2.4 + Math.sin(frame / 30 + i) * 4} -210`} fill="none" stroke="#3F8A4B" strokeWidth={16} strokeLinecap="round" />
        ))}
      </g>
    </g>
  ),
};

const Boardroom: SetArt = {
  Back: ({ frame }) => (
    <g>
      <rect width={W} height={H} fill="#343C56" />
      <rect x={120} y={120} width={1680} height={520} fill="#141A33" {...line} />
      <circle cx={1560} cy={220} r={44} fill="#F5EBC8" />
      <Skyline x0={122} x1={1798} base={638} min={120} max={420} fill="#232B4D" lit="#FFD873" seed={11} frame={frame} />
      {[540, 960, 1380].map((x) => (
        <line key={x} x1={x} y1={120} x2={x} y2={640} {...line} />
      ))}
      {[420, 960, 1500].map((x) => (
        <g key={x}>
          <line x1={x} y1={0} x2={x} y2={70} {...line} />
          <path d={`M ${x - 56} 110 Q ${x} 40 ${x + 56} 110 Z`} fill="#D9534A" {...line} />
          <path d={`M ${x - 50} 112 L ${x - 150} 640 L ${x + 150} 640 L ${x + 50} 112 Z`} fill="#FFE9A8" opacity={0.07} />
        </g>
      ))}
      <Floor y={FLOOR.boardroom} fill="#4A3B36" />
    </g>
  ),
  Front: () => (
    <g>
      <path d={`M 140 ${H} L 250 950 L 1670 950 L 1780 ${H} Z`} fill="#8A5A3C" {...line} />
      <rect x={236} y={932} width={1448} height={26} rx={10} fill="#A26D49" {...line} />
    </g>
  ),
};

const Trading: SetArt = {
  Back: ({ frame, trend, screen }) => {
    const down = trend !== "up";
    const c = down ? "#F0513E" : "#39C46A";
    return (
      <g>
        <rect width={W} height={H} fill="#1D2737" />
        <rect x={0} y={60} width={W} height={64} fill="#0E141F" {...line} />
        <g>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Hand key={i} x={((i * 300 - frame * 3) % 2400 + 2400) % 2400 - 240} y={92} size={34} fill={i % 3 === 0 && !down ? "#39C46A" : c}>
              {/* Symbols and arrows only: invented percentages would read as real market data. */}
              {`${["NVDA", "AMZN", "GOOG", "MSFT", "AAPL", "META", "AMD", "TSM"][i]} ${down ? "▼" : "▲"}`}
            </Hand>
          ))}
        </g>
        {[0, 1, 2, 3].map((i) => {
          const x = 110 + i * 440;
          const pts = Array.from({ length: 9 }, (_, k) => {
            const drift = (down ? 1 : -1) * k * 14;
            return `${x + 24 + k * 40},${330 + drift + (hash(i * 9 + k) - 0.5) * 70}`;
          }).join(" ");
          return (
            <g key={i}>
              <rect x={x} y={180} width={370} height={300} rx={10} fill="#0E141F" {...line} />
              {i === 1 && screen ? (
                <Hand x={x + 185} y={330} size={fit(screen, 320, 90)} fill={c}>
                  {screen}
                </Hand>
              ) : (
                <polyline points={pts} fill="none" stroke={c} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
              )}
            </g>
          );
        })}
        <Floor y={FLOOR.trading} fill="#2C3A4F" />
        {[130, 700, 1270].map((x) => (
          <g key={x}>
            <rect x={x} y={640} width={480} height={26} rx={8} fill="#5B4636" {...line} />
            <rect x={x + 30} y={666} width={420} height={190} fill="#433328" {...line} />
            <rect x={x + 60} y={560} width={130} height={84} rx={6} fill="#0E141F" {...line} />
            <rect x={x + 280} y={560} width={130} height={84} rx={6} fill="#0E141F" {...line} />
            <polyline points={`${x + 72},${down ? 580 : 628} ${x + 110},${604} ${x + 140},${down ? 598 : 610} ${x + 178},${down ? 630 : 578}`} fill="none" stroke={c} strokeWidth={5} />
          </g>
        ))}
      </g>
    );
  },
};

const Datacenter: SetArt = {
  Back: ({ frame }) => (
    <g>
      <rect width={W} height={H} fill="#182130" />
      {[200, 760, 1320].map((x) => (
        <rect key={x} x={x} y={70} width={400} height={18} rx={9} fill="#BFE9FF" opacity={0.85} />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 40 + i * 268;
        return (
          <g key={i}>
            <rect x={x} y={190} width={236} height={670} rx={8} fill="#2A3548" {...line} />
            {Array.from({ length: 9 }, (_, r) => (
              <g key={r}>
                <rect x={x + 18} y={214 + r * 70} width={200} height={52} rx={5} fill="#1B2332" stroke={INK} strokeWidth={2.5} />
                {[0, 1, 2, 3].map((k) => {
                  const on = Math.floor(frame / 9 + hash(i * 31 + r * 7 + k) * 20) % (3 + k) !== 0;
                  return <circle key={k} cx={x + 40 + k * 22} cy={240 + r * 70} r={5.5} fill={k === 3 ? "#FFB020" : "#3CE07A"} opacity={on ? 1 : 0.2} />;
                })}
                <line x1={x + 132} y1={240 + r * 70} x2={x + 200} y2={240 + r * 70} stroke="#46556E" strokeWidth={5} />
              </g>
            ))}
          </g>
        );
      })}
      <Floor y={FLOOR.datacenter} fill="#26334A" />
    </g>
  ),
};

const Street: SetArt = {
  Back: ({ screen }) => {
    const sign = screen ?? "BANK";
    const blocks: [number, number, number, string][] = [
      [0, 330, 520, "#E7B98B"],
      [330, 520, 620, "#C9D7E8"],
      [850, 360, 470, "#E9D9A6"],
      [1210, 400, 560, "#D9A6A0"],
      [1610, 340, 500, "#BFD8B8"],
    ];
    return (
      <g>
        <rect width={W} height={H} fill="#BFE3F2" />
        <ellipse cx={300} cy={150} rx={150} ry={46} fill="#FFFFFF" opacity={0.9} />
        <ellipse cx={1400} cy={110} rx={190} ry={50} fill="#FFFFFF" opacity={0.9} />
        {blocks.map(([x, w, h, fill], i) => (
          <g key={x}>
            <rect x={x} y={844 - h} width={w} height={h} fill={fill} {...line} />
            {Array.from({ length: Math.floor((h - 250) / 110) }, (_, r) =>
              Array.from({ length: Math.floor(w / 110) }, (_, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
                <rect key={`${r}-${c}`} x={x + 34 + c * 110} y={844 - h + 40 + r * 110} width={56} height={70} fill="#8FB9CF" stroke={INK} strokeWidth={3} />
              )),
            )}
            {i === 1 ? (
              <g>
                <rect x={x + 30} y={640} width={w - 60} height={74} fill="#2F4A75" {...line} />
                <Hand x={x + w / 2} y={678} size={fit(sign, w - 100, 56)} fill="#FFFFFF">
                  {sign}
                </Hand>
                <rect x={x + w / 2 - 60} y={730} width={120} height={114} fill="#6B4A36" {...line} />
              </g>
            ) : (
              <g>
                <path d={`M ${x + 24} 690 L ${x + w - 24} 690 L ${x + w - 4} 730 L ${x + 4} 730 Z`} fill={i % 2 ? "#D9534A" : "#3F8A4B"} {...line} />
                <rect x={x + 40} y={744} width={w - 150} height={86} fill="#CFE8F2" {...line} />
                <rect x={x + w - 96} y={744} width={62} height={100} fill="#6B4A36" {...line} />
              </g>
            )}
          </g>
        ))}
        <Floor y={FLOOR.street} fill="#D9D2C5" />
        <rect x={0} y={960} width={W} height={120} fill="#77757A" />
        <line x1={0} y1={960} x2={W} y2={960} {...line} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={80 + i * 340} y={1012} width={150} height={12} fill="#F3EFE4" />
        ))}
        <line x1={1560} y1={844} x2={1560} y2={470} stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <path d="M 1560 470 Q 1560 430 1610 430" fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <ellipse cx={1622} cy={440} rx={26} ry={14} fill="#FFE9A8" {...line} />
      </g>
    );
  },
};

const Startup: SetArt = {
  Back: ({ screen, frame }) => (
    <g>
      <rect width={W} height={H} fill="#C68868" />
      {Array.from({ length: 14 }, (_, r) => (
        <g key={r} opacity={0.3}>
          <line x1={0} y1={r * 62} x2={W} y2={r * 62} stroke={INK} strokeWidth={2.5} />
          {Array.from({ length: 14 }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
            <line key={c} x1={c * 150 + (r % 2) * 75} y1={r * 62} x2={c * 150 + (r % 2) * 75} y2={r * 62 + 62} stroke={INK} strokeWidth={2.5} />
          ))}
        </g>
      ))}
      <rect x={160} y={170} width={500} height={300} fill="#FBF6E9" {...line} />
      {screen ? (
        <Hand x={410} y={320} size={fit(screen, 440, 80)}>
          {screen}
        </Hand>
      ) : (
        <path d="M 210 400 L 300 330 L 380 370 L 470 260 L 610 230" fill="none" stroke="#E0402F" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <rect x={1240} y={300} width={520} height={18} fill="#6B4A36" {...line} />
      {[1270, 1360, 1470, 1600].map((x, i) => (
        <rect key={x} x={x} y={300 - 60 - i * 12} width={70 + i * 10} height={60 + i * 12} fill={["#3D6BB3", "#E0A030", "#3F8A4B", "#B8554A"][i]} {...line} />
      ))}
      <line x1={960} y1={0} x2={960} y2={120} {...line} />
      <circle cx={960} cy={146} r={28} fill="#FFE9A8" {...line} opacity={0.85 + Math.sin(frame / 6) * 0.08} />
      <Floor y={FLOOR.startup} fill="#B5ADA2" />
      <rect x={1560} y={724} width={150} height={120} fill="#C99A5B" {...line} />
      <rect x={1640} y={624} width={130} height={100} fill="#C99A5B" {...line} />
    </g>
  ),
};

const Stage: SetArt = {
  Back: ({ screen, frame }) => (
    <g>
      <rect width={W} height={H} fill="#1A1626" />
      <rect x={430} y={110} width={1060} height={520} rx={10} fill="#0F1B33" {...line} />
      <rect x={452} y={132} width={1016} height={476} fill="#16284A" />
      {screen && (
        <Hand x={960} y={370} size={fit(screen, 920, 150)} fill="#FFFFFF">
          {screen}
        </Hand>
      )}
      {[0, W].map((x) => (
        <path key={x} d={`M ${x} 0 L ${x} 800 L ${x === 0 ? 250 : W - 250} 800 Q ${x === 0 ? 300 : W - 300} 400 ${x === 0 ? 210 : W - 210} 0 Z`} fill="#9C2B2B" {...line} />
      ))}
      {[300, 960, 1620].map((x, i) => (
        <path key={x} d={`M ${x} 0 L ${x - 220 + Math.sin(frame / 50 + i) * 30} 800 L ${x + 220 + Math.sin(frame / 50 + i) * 30} 800 Z`} fill="#FFF3C4" opacity={0.07} />
      ))}
      <rect x={0} y={FLOOR.stage - 26} width={W} height={H} fill="#8A5A3C" />
      <line x1={0} y1={FLOOR.stage - 26} x2={W} y2={FLOOR.stage - 26} {...line} />
      <rect x={0} y={900} width={W} height={180} fill="#120F1A" />
    </g>
  ),
  Front: ({ frame }) => (
    <g>
      {Array.from({ length: 17 }, (_, i) => {
        const x = 40 + i * 116;
        const y = 1010 + (i % 2) * 26 + Math.sin(frame / 14 + i) * 3;
        return (
          <g key={i} fill="#0A0810">
            <circle cx={x} cy={y} r={46} />
            <rect x={x - 62} y={y + 30} width={124} height={120} rx={50} />
          </g>
        );
      })}
    </g>
  ),
};

const Capitol: SetArt = {
  Back: ({ frame }) => (
    <g>
      <rect width={W} height={H} fill="#C7E5F4" />
      <ellipse cx={330} cy={170} rx={170} ry={48} fill="#FFFFFF" opacity={0.9} />
      <ellipse cx={1560} cy={230} rx={150} ry={42} fill="#FFFFFF" opacity={0.9} />
      <path d="M 790 330 A 170 190 0 0 1 1130 330 Z" fill="#F4EEDF" {...line} />
      <rect x={930} y={96} width={60} height={50} fill="#F4EEDF" {...line} />
      <line x1={960} y1={96} x2={960} y2={30} {...line} />
      <path d={`M 960 30 L ${1030 + Math.sin(frame / 8) * 6} 44 L 960 66 Z`} fill="#D9534A" {...line} />
      <rect x={740} y={330} width={440} height={70} fill="#EDE5D2" {...line} />
      <path d="M 330 470 L 960 380 L 1590 470 Z" fill="#F4EEDF" {...line} />
      <rect x={360} y={470} width={1200} height={50} fill="#EDE5D2" {...line} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={400 + i * 122} y={520} width={46} height={250} fill="#FBF7EC" {...line} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={330 - i * 40} y={770 + i * 28} width={1260 + i * 80} height={28} fill={i % 2 ? "#E4DCC8" : "#EFE8D6"} {...line} />
      ))}
      <Floor y={FLOOR.capitol} fill="#9CC59A" />
    </g>
  ),
};

const Vault: SetArt = {
  Back: ({ frame }) => (
    <g>
      <rect width={W} height={H} fill="#98A1AB" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={i * 480} y1={0} x2={i * 480} y2={FLOOR.vault - 26} stroke={INK} strokeWidth={3} opacity={0.4} />
          {[60, 420, 780].map((y) => (
            <circle key={y} cx={i * 480 + 24} cy={y} r={7} fill="#6F7781" stroke={INK} strokeWidth={2} />
          ))}
        </g>
      ))}
      <g transform="translate(1400 470)">
        <circle r={300} fill="#7C858F" {...line} />
        <circle r={250} fill="#B4BCC4" {...line} />
        <circle r={200} fill="#9AA3AD" {...line} />
        <g transform={`rotate(${frame * 0.4})`}>
          {[0, 60, 120].map((a) => (
            <line key={a} x1={-130} y1={0} x2={130} y2={0} transform={`rotate(${a})`} stroke={INK} strokeWidth={20} strokeLinecap="round" />
          ))}
          <circle r={46} fill="#E0A030" {...line} />
        </g>
      </g>
      <Floor y={FLOOR.vault} fill="#6C747E" />
    </g>
  ),
};

const Sky: SetArt = {
  Back: ({ frame }) => (
    <g>
      <defs>
        <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CC6EC" />
          <stop offset="1" stopColor="#E3F4FB" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky-g)" />
      <circle cx={1640} cy={190} r={86} fill="#FFE27A" {...line} />
      {[
        [200, 240, 1],
        [900, 150, 0.8],
        [1300, 380, 1.15],
      ].map(([x, y, s], i) => {
        const cx = ((((x as number) + frame * 0.35 * (1 + i * 0.3)) % (W + 500)) + W + 500) % (W + 500) - 250;
        return (
          <g key={x} transform={`translate(${cx} ${y}) scale(${s})`} fill="#FFFFFF" stroke={INK} strokeWidth={STROKE}>
            <path d="M -130 30 Q -150 -20 -90 -24 Q -70 -80 0 -60 Q 50 -100 100 -50 Q 160 -50 150 10 Q 150 40 110 40 L -100 40 Q -130 40 -130 30 Z" />
          </g>
        );
      })}
      <path d={`M 0 ${FLOOR.sky - 60} Q 480 ${FLOOR.sky - 170} 960 ${FLOOR.sky - 70} T ${W} ${FLOOR.sky - 90} L ${W} ${H} L 0 ${H} Z`} fill="#8CC084" {...line} />
    </g>
  ),
};

const City: SetArt = {
  Back: ({ frame }) => (
    <g>
      <defs>
        <linearGradient id="city-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10162E" />
          <stop offset="1" stopColor="#34407A" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#city-g)" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={hash(i) * W} cy={hash(i + 50) * 420} r={1.5 + hash(i + 9) * 2} fill="#FFFFFF" opacity={0.5 + 0.5 * Math.sin(frame / 12 + i)} />
      ))}
      <circle cx={300} cy={210} r={70} fill="#F5EBC8" />
      <Skyline x0={-20} x1={W} base={FLOOR.city - 26} min={220} max={560} fill="#1B2244" seed={3} />
      <Skyline x0={-60} x1={W} base={FLOOR.city - 26} min={120} max={400} fill="#262F5C" lit="#FFD873" seed={21} frame={frame} />
      <Floor y={FLOOR.city} fill="#1A1D2B" />
    </g>
  ),
};

const Grid: SetArt = {
  Back: () => (
    <g>
      <rect width={W} height={H} fill="#F5F0E3" />
      {Array.from({ length: 33 }, (_, i) => (
        <line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={H} stroke="#9DB9D1" strokeWidth={i % 4 ? 1.5 : 3} opacity={0.55} />
      ))}
      {Array.from({ length: 19 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 60} x2={W} y2={i * 60} stroke="#9DB9D1" strokeWidth={i % 4 ? 1.5 : 3} opacity={0.55} />
      ))}
    </g>
  ),
};

const Home: SetArt = {
  Back: ({ screen, frame }) => (
    <g>
      <rect width={W} height={H} fill="#E9D9C3" />
      <rect x={130} y={150} width={380} height={300} fill="#A9D8EE" {...line} />
      <line x1={320} y1={150} x2={320} y2={450} {...line} />
      <line x1={130} y1={300} x2={510} y2={300} {...line} />
      <Floor y={FLOOR.home} fill="#B98A62" />
      <ellipse cx={900} cy={960} rx={640} ry={70} fill="#C8554A" opacity={0.85} {...line} />
      <g>
        <rect x={1280} y={420} width={470} height={290} rx={12} fill="#22212A" {...line} />
        <rect x={1302} y={442} width={426} height={246} fill="#16284A" />
        {screen && (
          <Hand x={1515} y={565} size={fit(screen, 380, 76)} fill="#FFFFFF" opacity={0.92 + Math.sin(frame / 3) * 0.05}>
            {screen}
          </Hand>
        )}
        <rect x={1480} y={710} width={70} height={40} fill="#22212A" {...line} />
        <rect x={1220} y={750} width={590} height={94} fill="#6B4A36" {...line} />
      </g>
      <g>
        <line x1={640} y1={844} x2={640} y2={470} stroke={INK} strokeWidth={9} />
        <path d="M 580 470 L 700 470 L 676 380 L 604 380 Z" fill="#FFE9A8" {...line} />
      </g>
    </g>
  ),
};

const Exchange: SetArt = {
  Back: ({ screen, frame, trend }) => {
    const c = trend === "down" ? "#F0513E" : "#39C46A";
    return (
      <g>
        <rect width={W} height={H} fill="#E8DFCB" />
        <rect x={0} y={0} width={W} height={90} fill="#C9BEA5" {...line} />
        {[120, 520, 1340, 1740].map((x) => (
          <g key={x}>
            <rect x={x - 34} y={90} width={68} height={754} fill="#F6F0E0" {...line} />
            <rect x={x - 50} y={90} width={100} height={30} fill="#DDD3BD" {...line} />
            <rect x={x - 50} y={814} width={100} height={30} fill="#DDD3BD" {...line} />
          </g>
        ))}
        <rect x={620} y={130} width={680} height={210} rx={8} fill="#111827" {...line} />
        <Hand x={960} y={235} size={fit(screen ?? "IPO DAY", 600, 130)} fill="#FFD23F">
          {screen ?? "IPO DAY"}
        </Hand>
        {[230, 1450].map((x, i) => (
          <g key={x}>
            <rect x={x} y={170} width={240} height={150} rx={8} fill="#111827" {...line} />
            <polyline
              points={Array.from({ length: 7 }, (_, k) => `${x + 22 + k * 33},${245 + (trend === "down" ? 1 : -1) * (k - 3) * 12 + (hash(i * 7 + k) - 0.5) * 34}`).join(" ")}
              fill="none"
              stroke={c}
              strokeWidth={6}
              strokeLinejoin="round"
            />
          </g>
        ))}
        {[700, 960, 1220].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={340} x2={x} y2={380} {...line} />
            <path d={`M ${x - 60} 380 L ${x + 60} 380 L ${x + 60} ${470 + Math.sin(frame / 10 + i) * 5} L ${x} 450 L ${x - 60} ${470 + Math.sin(frame / 10 + i) * 5} Z`} fill={["#3D6BB3", "#D9534A", "#3D6BB3"][i]} {...line} />
          </g>
        ))}
        <rect x={640} y={590} width={640} height={26} fill="#8A5A3C" {...line} />
        <rect x={660} y={616} width={600} height={90} fill="#A26D49" {...line} />
        {[700, 820, 940, 1060, 1180].map((x) => (
          <line key={x} x1={x} y1={616} x2={x} y2={706} stroke={INK} strokeWidth={3} />
        ))}
        <Floor y={FLOOR.exchange} fill="#D2C7B0" />
      </g>
    );
  },
};

/** Inside the machine: a dark board of circuit traces with signals running along them. */
const Inside: SetArt = {
  Back: ({ frame }) => (
    <g>
      <defs>
        <linearGradient id="inside-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1030" />
          <stop offset="1" stopColor="#1B2A5E" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#inside-g)" />
      {Array.from({ length: 17 }, (_, i) => (
        <line key={`v${i}`} x1={i * 120} y1={0} x2={i * 120} y2={H} stroke="#4C6FD6" strokeWidth={1.5} opacity={0.18} />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 120} x2={W} y2={i * 120} stroke="#4C6FD6" strokeWidth={1.5} opacity={0.18} />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const y = 90 + hash(i) * 660;
        const x1 = hash(i + 20) * 500;
        const mid = 600 + hash(i + 40) * 700;
        const y2 = y + (hash(i + 60) - 0.5) * 260;
        const d = `M ${x1} ${y} L ${mid} ${y} L ${mid + 120} ${y2} L ${W} ${y2}`;
        const t = ((frame * (5 + hash(i + 9) * 5) + hash(i + 3) * 2400) % 2400) / 2400;
        const px = x1 + (W - x1) * t;
        const py = px < mid ? y : px < mid + 120 ? y + ((y2 - y) * (px - mid)) / 120 : y2;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#5E86FF" strokeWidth={4} opacity={0.35} strokeLinejoin="round" />
            <circle cx={x1} cy={y} r={9} fill="#0B1030" stroke="#5E86FF" strokeWidth={4} opacity={0.7} />
            <circle cx={px} cy={py} r={8} fill="#9CF5FF" />
            <circle cx={px} cy={py} r={18} fill="#9CF5FF" opacity={0.25} />
          </g>
        );
      })}
      <rect x={0} y={FLOOR.inside - 26} width={W} height={H} fill="#0A0F2A" opacity={0.75} />
      <line x1={0} y1={FLOOR.inside - 26} x2={W} y2={FLOOR.inside - 26} stroke="#5E86FF" strokeWidth={5} opacity={0.8} />
    </g>
  ),
};

export const SET_ART: Record<SetId, SetArt> = {
  plain: Plain,
  office: Office,
  boardroom: Boardroom,
  trading: Trading,
  datacenter: Datacenter,
  street: Street,
  startup: Startup,
  stage: Stage,
  capitol: Capitol,
  vault: Vault,
  sky: Sky,
  city: City,
  grid: Grid,
  home: Home,
  exchange: Exchange,
  inside: Inside,
  ...HEALTH_SET_ART,
};
