import type { PropKind, Tone } from "../../paper";
import { clamp01 } from "../anim";
import { useLogo } from "../stage";
import { HEALTH_PROP_KINDS, HealthPropArt } from "./HealthProps";
import { fit, Hand, hash, INK, STROKE, tone as toneOf, wrap } from "./ink";

/**
 * Things in a scene. Each is drawn with its bottom centre at (0, 0), roughly 150–400 units wide;
 * the scene places and scales it. `age` is frames since it appeared, for its own little motion.
 */
export interface PropSpec {
  kind: PropKind;
  text?: string;
  text2?: string;
  tone?: Tone;
  value?: number;
  values?: number[];
  logo?: string;
}

const line = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const ease = (age: number, length: number) => {
  const t = clamp01(age / length);
  return 1 - (1 - t) ** 3;
};

const LogoMark: React.FC<{ slug: string; size: number }> = ({ slug, size }) => {
  const logo = useLogo(slug);
  if (!logo.path)
    return (
      <Hand y={-size / 2} size={fit(logo.title, size * 0.9, size * 0.4)}>
        {logo.title}
      </Hand>
    );
  const dark = logo.hex && /^#?(0{6}|1[0-9a-f]{5}|2[0-9a-f]{5})$/i.test(logo.hex) ? INK : (logo.hex ?? INK);
  return (
    <g transform={`translate(${-size / 2} ${-size}) scale(${size / 24})`}>
      <path d={logo.path} fill={dark} />
    </g>
  );
};

const Bill: React.FC<{ y: number; x?: number }> = ({ y, x = 0 }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-80} y={-40} width={160} height={40} rx={4} fill="#8FCB8A" {...line} />
    <circle cx={0} cy={-20} r={12} fill="#CFEFC4" stroke={INK} strokeWidth={2.5} />
    <Hand y={-20} size={18}>
      $
    </Hand>
  </g>
);

export const PropArt: React.FC<{ p: PropSpec; frame: number; age: number }> = ({ p, frame, age }) => {
  if (HEALTH_PROP_KINDS.has(p.kind)) return <HealthPropArt p={p} frame={frame} age={age} />;
  const tn = toneOf(p.tone);
  const text = p.text ?? "";
  switch (p.kind) {
    case "crate":
      return (
        <g>
          <rect x={-85} y={-130} width={170} height={130} fill="#C99A5B" {...line} />
          <line x1={-85} y1={-88} x2={85} y2={-88} stroke={INK} strokeWidth={2.5} />
          <line x1={-85} y1={-42} x2={85} y2={-42} stroke={INK} strokeWidth={2.5} />
          {text && (
            <g>
              <rect x={-66} y={-96} width={132} height={56} fill="#FBF6E9" stroke={INK} strokeWidth={2.5} />
              <Hand y={-68} size={fit(text, 120, 36)}>
                {text}
              </Hand>
            </g>
          )}
        </g>
      );
    case "sign": {
      const rows = wrap(text, 14).slice(0, 3);
      const size = Math.min(46, 250 / (Math.max(...rows.map((r) => r.length), 4) * 0.52));
      const h = rows.length * size * 1.1 + 34;
      return (
        <g>
          <rect x={-7} y={-190} width={14} height={190} fill="#8A5A3C" {...line} />
          <g transform={`rotate(${-3 + Math.sin(age / 9) * Math.max(0, 6 - age / 6)} 0 -190)`}>
            <rect x={-150} y={-190 - h} width={300} height={h} rx={6} fill={tn.fill} {...line} />
            <Hand y={-190 - h / 2} size={size} fill={tn.text} lines={rows} />
          </g>
        </g>
      );
    }
    case "banner": {
      const size = fit(text, 360, 54);
      const w = Math.max(160, text.length * size * 0.54 + 50);
      return (
        <g transform={`rotate(${-4 + Math.sin(frame / 20) * 1.2})`}>
          <rect x={-w / 2} y={-size * 1.7} width={w} height={size * 1.7} rx={5} fill={p.tone ? tn.fill : "#FFD84A"} {...line} />
          <Hand y={-size * 0.85} size={size} fill={p.tone ? tn.text : INK}>
            {text}
          </Hand>
        </g>
      );
    }
    case "chip": {
      const glow = 0.7 + 0.3 * Math.sin(frame / 7);
      return (
        <g transform="translate(0 -90)">
          <circle r={130} fill="#7CFF6B" opacity={0.16 * glow} />
          {[-54, -18, 18, 54].map((o) => (
            <g key={o} fill="#D9B24C" stroke={INK} strokeWidth={2.5}>
              <rect x={o - 6} y={-98} width={12} height={20} />
              <rect x={o - 6} y={78} width={12} height={20} />
              <rect x={-98} y={o - 6} width={20} height={12} />
              <rect x={78} y={o - 6} width={20} height={12} />
            </g>
          ))}
          <rect x={-80} y={-80} width={160} height={160} rx={10} fill="#1F3A2A" {...line} />
          <rect x={-54} y={-54} width={108} height={108} rx={4} fill="#5BE04F" opacity={glow} {...line} />
          {text ? (
            <Hand size={fit(text, 96, 34)}>{text}</Hand>
          ) : (
            [-18, 18].map((o) => (
              <g key={o} stroke="#1F3A2A" strokeWidth={3} opacity={0.6}>
                <line x1={o} y1={-54} x2={o} y2={54} />
                <line x1={-54} y1={o} x2={54} y2={o} />
              </g>
            ))
          )}
        </g>
      );
    }
    case "money": {
      const n = Math.max(1, Math.min(8, Math.round(p.value ?? 3)));
      return (
        <g>
          {Array.from({ length: n }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed stack
            <Bill key={i} y={-i * 18} x={(i % 2) * 6 - 3} />
          ))}
          {text && (
            <Hand y={-n * 18 - 62} size={fit(text, 220, 46)} fill={tn.text} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "coins": {
      const n = Math.max(1, Math.min(10, Math.round(p.value ?? 6)));
      return (
        <g>
          {Array.from({ length: n }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed stack
            <ellipse key={i} cx={(i % 2) * 4} cy={-12 - i * 16} rx={56} ry={15} fill="#FFD23F" {...line} />
          ))}
          {text && (
            <Hand y={-n * 16 - 56} size={fit(text, 220, 44)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "moneybag":
      return (
        <g>
          <path d="M -70 0 Q -110 -70 -40 -130 L -26 -160 L 26 -160 L 40 -130 Q 110 -70 70 0 Z" fill="#D9B77A" {...line} />
          <path d="M -34 -160 Q 0 -190 34 -160 Q 0 -146 -34 -160 Z" fill="#C49A55" {...line} />
          <rect x={-36} y={-140} width={72} height={12} rx={6} fill="#8A5A3C" stroke={INK} strokeWidth={2.5} />
          <Hand y={-62} size={text ? fit(text, 120, 56) : 76} fill="#3F6B2E">
            {text || "$"}
          </Hand>
        </g>
      );
    case "bell": {
      const swing = Math.sin(age / 2.6) * 22 * Math.max(0.25, 1 - age / 140);
      return (
        <g>
          <rect x={90} y={-330} width={18} height={330} fill="#8A5A3C" {...line} />
          <path d="M 108 -310 L -10 -310" stroke={INK} strokeWidth={14} strokeLinecap="round" />
          <g transform={`rotate(${swing} -10 -306)`}>
            <path d="M -10 -300 Q -76 -290 -84 -190 L -104 -160 L 84 -160 L 64 -190 Q 56 -290 -10 -300 Z" fill="#F2B632" {...line} />
            <circle cx={-10} cy={-148} r={16} fill="#B8811C" {...line} />
            <line x1={-10} y1={-132} x2={-10} y2={-60} stroke="#C9B48A" strokeWidth={6} />
          </g>
          {age < 140 &&
            [-1, 1].map((s) => (
              <path key={s} d={`M ${s * 130 - 10} -260 q ${s * 22} 34 0 68`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.3 + 0.7 * Math.abs(Math.sin(age / 2.6))} />
            ))}
        </g>
      );
    }
    case "balloon":
    case "bubble": {
      const grow = 0.55 + 0.45 * ease(age, 70) + (p.value ?? 0) * ease(age, 140);
      const r = 120 * grow;
      const sway = Math.sin(frame / 22) * 10;
      const soap = p.kind === "bubble";
      return (
        <g>
          {!soap && <path d={`M 0 0 Q ${sway * 2} ${-(300 - r) / 2} ${sway} ${-300 + r}`} fill="none" stroke={INK} strokeWidth={3} />}
          <g transform={`translate(${sway} ${soap ? -r - 10 : -300})`}>
            <ellipse rx={r * 0.94} ry={r} fill={soap ? "#BFE9FF" : p.tone ? tn.line : "#4FCB6B"} opacity={soap ? 0.45 : 1} {...line} />
            <path d={`M ${-r * 0.55} ${-r * 0.35} Q ${-r * 0.5} ${-r * 0.7} ${-r * 0.2} ${-r * 0.78}`} fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" opacity={0.8} />
            {!soap && <path d={`M -12 ${r} L 12 ${r} L 0 ${r - 14} Z`} fill={p.tone ? tn.line : "#4FCB6B"} {...line} />}
            {text && <Hand size={fit(text, r * 1.5, 54)} lines={wrap(text, 12).slice(0, 2)} fill={soap ? INK : "#FFFFFF"} outline={soap ? undefined : INK} outlineWidth={5} />}
          </g>
        </g>
      );
    }
    case "stopwatch": {
      const sweep = clamp01(age / 150) * 360;
      const a = ((sweep - 90) * Math.PI) / 180;
      return (
        <g transform="translate(0 -130)">
          <rect x={-16} y={-158} width={32} height={30} fill="#9AA3AD" {...line} />
          <circle r={124} fill="#DDE2E7" {...line} />
          <circle r={98} fill="#FBF6E9" {...line} />
          <path d={`M 0 0 L 0 -98 A 98 98 0 ${sweep > 180 ? 1 : 0} 1 ${Math.cos(a) * 98} ${Math.sin(a) * 98} Z`} fill="#F0513E" opacity={0.55} />
          <line x1={0} y1={0} x2={Math.cos(a) * 84} y2={Math.sin(a) * 84} stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <circle r={9} fill={INK} />
          {text && (
            <Hand y={176} size={fit(text, 260, 48)}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "calendar":
      return (
        <g>
          <rect x={-100} y={-220} width={200} height={220} rx={8} fill="#FBF6E9" {...line} />
          <rect x={-100} y={-220} width={200} height={62} rx={8} fill="#D9534A" {...line} />
          {[-50, 50].map((x) => (
            <rect key={x} x={x - 7} y={-240} width={14} height={38} rx={7} fill="#9AA3AD" stroke={INK} strokeWidth={3} />
          ))}
          <Hand y={-188} size={fit(text, 170, 40)} fill="#FFFFFF">
            {text}
          </Hand>
          <Hand y={-80} size={fit(p.text2 ?? "", 170, 110)}>
            {p.text2 ?? ""}
          </Hand>
        </g>
      );
    case "paper": {
      const rows = wrap(text, 13).slice(0, 2);
      return (
        <g transform="rotate(-3)">
          <rect x={-105} y={-280} width={210} height={280} fill="#FFFFFF" {...line} />
          <Hand y={-236} size={fit(rows[0] ?? "", 180, 34)} lines={rows} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={-78} y1={-176 + i * 30} x2={i === 4 ? 10 : 78} y2={-176 + i * 30} stroke="#B9B2A8" strokeWidth={6} strokeLinecap="round" />
          ))}
          {p.text2 && (
            <g transform={`translate(10 -70) rotate(-12) scale(${1 + Math.max(0, 1 - age / 8) * 0.8})`} opacity={clamp01(age / 6)}>
              <rect x={-96} y={-30} width={192} height={60} rx={6} fill="none" stroke={p.tone === "positive" ? "#2FA84F" : "#D9342B"} strokeWidth={6} />
              <Hand size={fit(p.text2, 170, 40)} fill={p.tone === "positive" ? "#2FA84F" : "#D9342B"}>
                {p.text2}
              </Hand>
            </g>
          )}
        </g>
      );
    }
    case "server":
      return (
        <g>
          <rect x={-70} y={-280} width={140} height={280} rx={8} fill="#2A3548" {...line} />
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <g key={r}>
              <rect x={-56} y={-266 + r * 44} width={112} height={32} rx={4} fill="#1B2332" stroke={INK} strokeWidth={2.5} />
              {[0, 1, 2].map((k) => (
                <circle key={k} cx={-42 + k * 16} cy={-250 + r * 44} r={4.5} fill={k === 2 ? "#FFB020" : "#3CE07A"} opacity={Math.floor(frame / 8 + hash(r * 5 + k) * 20) % (3 + k) ? 1 : 0.2} />
              ))}
            </g>
          ))}
          {text && (
            <Hand y={-310} size={fit(text, 200, 40)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    case "desk":
      return (
        <g>
          <rect x={-200} y={-150} width={400} height={24} rx={8} fill="#A26D49" {...line} />
          <rect x={-180} y={-126} width={22} height={126} fill="#8A5A3C" {...line} />
          <rect x={158} y={-126} width={22} height={126} fill="#8A5A3C" {...line} />
          <rect x={-150} y={-126} width={300} height={70} fill="#8A5A3C" {...line} />
          {text && (
            <g>
              <path d="M -70 -150 L -56 -196 L 56 -196 L 70 -150 Z" fill="#FBF6E9" {...line} />
              <Hand y={-173} size={fit(text, 110, 30)}>
                {text}
              </Hand>
            </g>
          )}
        </g>
      );
    case "podium":
      return (
        <g>
          <path d="M -80 0 L -64 -190 L 64 -190 L 80 0 Z" fill="#A26D49" {...line} />
          <rect x={-84} y={-206} width={168} height={22} rx={6} fill="#8A5A3C" {...line} />
          <path d="M 10 -206 Q 14 -250 40 -262" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <circle cx={44} cy={-266} r={11} fill="#2B2A33" />
          {text && (
            <g>
              <rect x={-58} y={-150} width={116} height={64} rx={6} fill="#FBF6E9" stroke={INK} strokeWidth={3} />
              <Hand y={-118} size={fit(text, 100, 36)}>
                {text}
              </Hand>
            </g>
          )}
        </g>
      );
    case "screen": {
      const down = p.tone === "negative";
      const c = down ? "#F0513E" : p.tone === "positive" ? "#39C46A" : "#FFFFFF";
      const rows = wrap(text, 16).slice(0, 3);
      return (
        <g>
          <rect x={-28} y={-40} width={56} height={40} fill="#3A3944" {...line} />
          <rect x={-90} y={-12} width={180} height={12} rx={6} fill="#3A3944" {...line} />
          <rect x={-200} y={-300} width={400} height={262} rx={12} fill="#22212A" {...line} />
          <rect x={-182} y={-282} width={364} height={226} fill="#16284A" />
          {text ? (
            <Hand y={-169} size={Math.min(64, 330 / (Math.max(...rows.map((r) => r.length), 4) * 0.52))} fill={c} lines={rows} />
          ) : (
            <polyline
              points={Array.from({ length: 8 }, (_, k) => `${-160 + k * 46},${-170 + (down ? 1 : -1) * (k - 3.5) * 22 + (hash(k) - 0.5) * 44}`).join(" ")}
              fill="none"
              stroke={c}
              strokeWidth={8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={900}
              strokeDashoffset={900 * (1 - ease(age, 40))}
            />
          )}
        </g>
      );
    }
    case "chart": {
      const down = p.tone === "negative";
      const vals = p.values?.length ? p.values : down ? [8, 9, 7.5, 8, 5.5, 6, 3, 2] : [2, 2.6, 2.3, 3.4, 4, 5.6, 6.2, 8.5];
      const max = Math.max(...vals);
      const min = Math.min(...vals, 0);
      const w = 460;
      const h = 290;
      const pts = vals.map((v, i) => [-w / 2 + 30 + (i * (w - 60)) / (vals.length - 1), -30 - ((v - min) / (max - min || 1)) * (h - 70)] as const);
      const k = ease(age, 60);
      const shown = Math.max(1, k * (pts.length - 1));
      const head = Math.min(pts.length - 1, Math.floor(shown));
      const frac = shown - head;
      const a = pts[head] as readonly [number, number];
      const b = pts[Math.min(pts.length - 1, head + 1)] as readonly [number, number];
      const tip: [number, number] = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
      const path = [...pts.slice(0, head + 1), tip].map((q) => q.join(",")).join(" ");
      const c = down ? "#E0402F" : p.tone === "positive" ? "#2FA84F" : tn.line;
      return (
        <g>
          <rect x={-w / 2} y={-h} width={w} height={h} rx={8} fill="#FBF6E9" {...line} />
          <line x1={-w / 2 + 24} y1={-24} x2={w / 2 - 20} y2={-24} stroke={INK} strokeWidth={3} />
          <line x1={-w / 2 + 24} y1={-24} x2={-w / 2 + 24} y2={-h + 54} stroke={INK} strokeWidth={3} />
          <polyline points={path} fill="none" stroke={c} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={tip[0]} cy={tip[1]} r={11} fill={c} stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={-h + 30} size={fit(text, w - 60, 38)}>
              {text}
            </Hand>
          )}
          {p.text2 && k > 0.9 && (
            <Hand x={Math.min(tip[0] - 10, w / 2 - 20 - p.text2.length * 11)} y={tip[1] - 46} size={40} fill={c} outline="#FBF6E9">
              {p.text2}
            </Hand>
          )}
        </g>
      );
    }
    case "bars": {
      const vals = p.values?.length ? p.values.slice(0, 6) : [1, 2, 4];
      const labels = text ? text.split("|").map((s) => s.trim()) : [];
      const max = Math.max(...vals) || 1;
      const bw = Math.min(110, 520 / vals.length - 24);
      const total = vals.length * (bw + 24) - 24;
      return (
        <g>
          <line x1={-total / 2 - 30} y1={0} x2={total / 2 + 30} y2={0} {...line} />
          {vals.map((v, i) => {
            const h = (v / max) * 300 * ease(age - i * 8, 30);
            const x = -total / 2 + i * (bw + 24);
            const last = i === vals.length - 1;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars
              <g key={i}>
                <rect x={x} y={-h} width={bw} height={h} fill={last ? (p.tone === "negative" ? "#E0402F" : "#2FA84F") : "#7FA5D8"} {...line} />
                {labels[i] && (
                  <Hand x={x + bw / 2} y={30} size={fit(labels[i] ?? "", bw + 16, 32)}>
                    {labels[i] ?? ""}
                  </Hand>
                )}
                {p.text2 && last && h > 200 && (
                  <Hand x={x + bw / 2} y={-h - 34} size={44} outline="#FBF6E9">
                    {p.text2}
                  </Hand>
                )}
              </g>
            );
          })}
        </g>
      );
    }
    case "phone":
      return (
        <g>
          <rect x={-70} y={-250} width={140} height={250} rx={18} fill="#22212A" {...line} />
          <rect x={-58} y={-232} width={116} height={200} rx={6} fill="#16284A" />
          {text && <Hand y={-132} size={Math.min(34, 100 / (Math.max(...wrap(text, 9).map((r) => r.length), 3) * 0.52))} fill="#FFFFFF" lines={wrap(text, 9).slice(0, 4)} />}
          <circle cx={0} cy={-16} r={8} fill="#55535F" />
        </g>
      );
    case "laptop":
      return (
        <g>
          <rect x={-120} y={-170} width={240} height={150} rx={8} fill="#3A3944" {...line} />
          <rect x={-106} y={-156} width={212} height={122} fill="#16284A" />
          {text && (
            <Hand y={-95} size={fit(text, 190, 44)} fill="#7CFF6B">
              {text}
            </Hand>
          )}
          <path d="M -150 0 L -120 -22 L 120 -22 L 150 0 Z" fill="#9AA3AD" {...line} />
        </g>
      );
    case "vault":
      return (
        <g>
          <rect x={-130} y={-260} width={260} height={260} rx={10} fill="#7C858F" {...line} />
          <circle cx={0} cy={-130} r={90} fill="#B4BCC4" {...line} />
          <g transform={`translate(0 -130) rotate(${frame * 0.6})`}>
            {[0, 60, 120].map((a) => (
              <line key={a} x1={-60} y1={0} x2={60} y2={0} transform={`rotate(${a})`} stroke={INK} strokeWidth={11} strokeLinecap="round" />
            ))}
            <circle r={20} fill="#E0A030" {...line} />
          </g>
          {text && (
            <Hand y={-292} size={fit(text, 260, 44)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    case "rocket": {
      const up = (p.value ?? 0) * ease(age, 90) * 600;
      return (
        <g transform={`translate(0 ${-up})`}>
          <path d={`M -26 -40 Q 0 ${40 + Math.sin(frame / 1.6) * 22} 26 -40 Z`} fill="#FFB020" {...line} />
          <path d="M -44 -40 L -76 0 L -44 -110 Z M 44 -40 L 76 0 L 44 -110 Z" fill="#D9534A" {...line} />
          <path d="M -46 -40 L -46 -200 Q 0 -310 46 -200 L 46 -40 Z" fill="#F4F1EA" {...line} />
          <circle cx={0} cy={-180} r={22} fill="#8FC8E8" {...line} />
          {text && (
            <Hand y={-96} size={fit(text, 76, 30)} rotate={-90}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "bomb":
      return (
        <g>
          <circle cx={0} cy={-90} r={90} fill="#2B2A33" {...line} />
          <rect x={-20} y={-196} width={40} height={26} fill="#55535F" {...line} />
          <path d="M 0 -196 Q 10 -240 50 -244" fill="none" stroke="#C9B48A" strokeWidth={6} strokeLinecap="round" />
          <g transform={`translate(54 -246) scale(${0.8 + 0.4 * Math.abs(Math.sin(frame / 2))})`}>
            <path d="M 0 -22 L 6 -6 L 22 0 L 6 6 L 0 22 L -6 6 L -22 0 L -6 -6 Z" fill="#FFB020" stroke={INK} strokeWidth={2.5} />
          </g>
          {text && (
            <Hand y={-90} size={fit(text, 150, 48)} fill="#FFFFFF">
              {text}
            </Hand>
          )}
        </g>
      );
    case "scale": {
      const tilt = (p.value ?? 0) * 14 * ease(age, 50);
      const pan = (s: number) => {
        const a = (tilt * Math.PI) / 180;
        const x = s * 170 * Math.cos(a);
        const y = -300 + s * 170 * Math.sin(a);
        return (
          <g key={s}>
            <line x1={x} y1={y} x2={x - 50} y2={y + 110} stroke={INK} strokeWidth={3} />
            <line x1={x} y1={y} x2={x + 50} y2={y + 110} stroke={INK} strokeWidth={3} />
            <path d={`M ${x - 70} ${y + 110} Q ${x} ${y + 150} ${x + 70} ${y + 110} Z`} fill="#E0A030" {...line} />
            <Hand x={x} y={y + 84} size={fit((s < 0 ? text : p.text2) ?? "", 150, 34)} outline="#FBF6E9">
              {(s < 0 ? text : p.text2) ?? ""}
            </Hand>
          </g>
        );
      };
      return (
        <g>
          <path d="M -60 0 L 0 -40 L 60 0 Z" fill="#8A5A3C" {...line} />
          <rect x={-8} y={-310} width={16} height={280} fill="#8A5A3C" {...line} />
          <line x1={-170} y1={-300} x2={170} y2={-300} transform={`rotate(${tilt} 0 -300)`} stroke={INK} strokeWidth={12} strokeLinecap="round" />
          {pan(-1)}
          {pan(1)}
        </g>
      );
    }
    case "building": {
      const fill = p.tone ? tn.fill : "#C9D7E8";
      return (
        <g>
          <rect x={-120} y={-440} width={240} height={440} fill={fill} {...line} />
          {Array.from({ length: 5 }, (_, r) =>
            [0, 1, 2].map((c) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
              <rect key={`${r}-${c}`} x={-92 + c * 68} y={-350 + r * 62} width={46} height={40} fill="#8FB9CF" stroke={INK} strokeWidth={2.5} />
            )),
          )}
          <rect x={-30} y={-58} width={60} height={58} fill="#6B4A36" {...line} />
          {p.logo ? (
            <g transform="translate(0 -372)">
              <rect x={-44} y={-52} width={88} height={64} rx={6} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
              <g transform="translate(0 6)">
                <LogoMark slug={p.logo} size={52} />
              </g>
            </g>
          ) : (
            text && (
              <g>
                <rect x={-104} y={-424} width={208} height={54} fill="#2F4A75" stroke={INK} strokeWidth={3} />
                <Hand y={-397} size={fit(text, 190, 38)} fill="#FFFFFF">
                  {text}
                </Hand>
              </g>
            )
          )}
        </g>
      );
    }
    case "datacenter":
      return (
        <g>
          <rect x={-230} y={-200} width={460} height={200} fill="#B9C3CE" {...line} />
          <rect x={-230} y={-222} width={460} height={24} fill="#8D97A3" {...line} />
          {[-160, -60, 40, 140].map((x, i) => (
            <g key={x} transform={`translate(${x + 10} -250)`}>
              <rect x={-30} y={-6} width={60} height={34} fill="#6F7781" {...line} />
              <g transform={`rotate(${frame * 9 + i * 40})`}>
                <line x1={-20} y1={0} x2={20} y2={0} stroke={INK} strokeWidth={5} />
                <line x1={0} y1={-20} x2={0} y2={20} stroke={INK} strokeWidth={5} />
              </g>
            </g>
          ))}
          {[-190, -110, -30, 50, 130].map((x) => (
            <rect key={x} x={x} y={-150} width={56} height={16} fill="#3CE07A" stroke={INK} strokeWidth={2.5} opacity={0.6 + 0.4 * Math.sin(frame / 6 + x)} />
          ))}
          <rect x={-150} y={-112} width={300} height={62} fill="#FBF6E9" stroke={INK} strokeWidth={3} />
          <Hand y={-81} size={fit(text || "DATA CENTER", 270, 40)}>
            {text || "DATA CENTER"}
          </Hand>
        </g>
      );
    case "truck":
      return (
        <g>
          <rect x={-190} y={-190} width={260} height={150} fill="#FBF6E9" {...line} />
          <path d="M 70 -150 L 150 -150 L 190 -96 L 190 -40 L 70 -40 Z" fill="#D9534A" {...line} />
          <rect x={92} y={-134} width={56} height={40} fill="#8FC8E8" stroke={INK} strokeWidth={3} />
          {[-120, 120].map((x) => (
            <g key={x} transform={`translate(${x} -34)`}>
              <circle r={34} fill="#2B2A33" {...line} />
              <circle r={12} fill="#9AA3AD" />
            </g>
          ))}
          <Hand x={-60} y={-116} size={fit(text, 230, 50)}>
            {text}
          </Hand>
        </g>
      );
    case "cloud":
      return (
        <g transform={`translate(${Math.sin(frame / 30) * 8} -110)`}>
          <path d="M -170 50 Q -200 -20 -120 -30 Q -100 -110 -10 -84 Q 50 -140 124 -70 Q 210 -70 196 20 Q 196 62 140 62 L -130 62 Q -170 62 -170 50 Z" fill={p.tone ? tn.fill : "#FFFFFF"} {...line} />
          <Hand y={0} size={fit(text, 300, 56)} fill={tn.text}>
            {text}
          </Hand>
        </g>
      );
    case "logo":
      return (
        <g>
          <rect x={-90} y={-180} width={180} height={180} rx={24} fill="#FFFFFF" {...line} />
          <g transform="translate(0 -36)">
            <LogoMark slug={p.logo ?? text.toLowerCase()} size={108} />
          </g>
          {text && p.logo && (
            <Hand y={30} size={fit(text, 240, 36)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    case "arrow": {
      const k = ease(age, 24);
      const c = p.tone ? tn.line : INK;
      const len = 260 * k;
      return (
        <g transform="translate(-130 -40)">
          <line x1={0} y1={0} x2={len} y2={0} stroke={c} strokeWidth={14} strokeLinecap="round" />
          <path d={`M ${len - 34} -30 L ${len + 8} 0 L ${len - 34} 30`} fill="none" stroke={c} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={k > 0.2 ? 1 : 0} />
          {text && (
            <Hand x={130} y={-50} size={fit(text, 260, 42)} fill={c === INK ? INK : tn.text} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "text": {
      const rows = wrap(text, 22).slice(0, 3);
      const size = Math.min(96, 760 / (Math.max(...rows.map((r) => r.length), 3) * 0.52));
      const fill = p.tone === "negative" ? "#E8402E" : p.tone === "positive" ? "#2FA84F" : p.tone === "accent" ? "#FFC928" : p.tone === "dark" ? INK : "#FFFFFF";
      return <Hand y={-(rows.length * size * 1.08) / 2} size={size} fill={fill} lines={rows} outline={p.tone === "dark" ? "#FBF6E9" : INK} outlineWidth={size * 0.2} />;
    }
    case "number": {
      const v = (p.value ?? 0) * ease(age, 45);
      const whole = Number.isInteger(p.value ?? 0);
      const body = whole ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);
      const fill = p.tone === "negative" ? "#E8402E" : p.tone === "positive" ? "#2FA84F" : p.tone === "accent" ? "#FFC928" : "#FFFFFF";
      return (
        <Hand y={-80} size={150} fill={fill} outline={INK} outlineWidth={26}>
          {`${text}${body}${p.text2 ?? ""}`}
        </Hand>
      );
    }
    case "door":
      return (
        <g>
          <rect x={-90} y={-330} width={180} height={330} fill="#8A5A3C" {...line} />
          <rect x={-70} y={-310} width={140} height={130} fill="#A26D49" stroke={INK} strokeWidth={3} />
          <rect x={-70} y={-160} width={140} height={140} fill="#A26D49" stroke={INK} strokeWidth={3} />
          <circle cx={56} cy={-166} r={10} fill="#FFD23F" stroke={INK} strokeWidth={3} />
          {text && (
            <g>
              <rect x={-64} y={-292} width={128} height={46} fill="#FBF6E9" stroke={INK} strokeWidth={3} />
              <Hand y={-269} size={fit(text, 116, 30)}>
                {text}
              </Hand>
            </g>
          )}
        </g>
      );
    case "briefcase":
      return (
        <g>
          <path d="M -34 -110 L -34 -136 L 34 -136 L 34 -110" fill="none" stroke={INK} strokeWidth={9} strokeLinejoin="round" />
          <rect x={-90} y={-112} width={180} height={112} rx={10} fill="#8A5A3C" {...line} />
          <rect x={-90} y={-70} width={180} height={12} fill="#6B4A36" stroke={INK} strokeWidth={2.5} />
          <rect x={-14} y={-78} width={28} height={28} rx={4} fill="#FFD23F" stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={-150} size={fit(text, 220, 40)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    case "trophy":
      return (
        <g>
          <rect x={-60} y={-30} width={120} height={30} fill="#8A5A3C" {...line} />
          <rect x={-14} y={-90} width={28} height={62} fill="#F2B632" {...line} />
          <path d="M -70 -230 L 70 -230 Q 70 -110 0 -90 Q -70 -110 -70 -230 Z" fill="#FFD23F" {...line} />
          <path d="M -70 -210 Q -124 -200 -100 -150 Q -84 -130 -58 -140 M 70 -210 Q 124 -200 100 -150 Q 84 -130 58 -140" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
          <Hand y={-170} size={fit(text || "#1", 90, 60)}>
            {text || "#1"}
          </Hand>
        </g>
      );
    case "fire":
      return (
        <g>
          {[
            [-70, 0.8, "#F0513E"],
            [60, 0.9, "#F0513E"],
            [0, 1.2, "#FF8A2A"],
            [-10, 0.6, "#FFD23F"],
          ].map(([x, s, c], i) => {
            const f = 1 + Math.sin(frame / 2.3 + i * 2) * 0.12;
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed flames
                key={i}
                transform={`translate(${x} 0) scale(${(s as number) * f} ${(s as number) * (2 - f)})`}
                d="M 0 0 Q -70 -30 -44 -110 Q -30 -80 -16 -96 Q -30 -170 20 -220 Q 14 -160 44 -130 Q 76 -80 40 -20 Q 26 0 0 0 Z"
                fill={c as string}
                stroke={INK}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            );
          })}
        </g>
      );
    case "brain": {
      const pulse = 1 + Math.sin(frame / 8) * 0.03;
      return (
        <g transform={`translate(0 -110) scale(${pulse})`}>
          <path d="M -20 -100 Q -90 -110 -100 -50 Q -140 -20 -110 30 Q -110 80 -50 90 Q -10 110 10 90 Q 70 100 90 50 Q 130 20 110 -30 Q 110 -90 50 -100 Q 10 -120 -20 -100 Z" fill="#F4A6B8" {...line} />
          <path d="M 0 -104 Q -14 -40 6 0 Q 20 50 4 94 M -70 -40 Q -40 -30 -34 0 M -90 30 Q -60 20 -40 44 M 50 -60 Q 40 -30 64 -10 M 96 20 Q 60 20 44 50" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          {text && (
            <Hand y={150} size={fit(text, 260, 42)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "robot": {
      const eye = 0.6 + 0.4 * Math.sin(frame / 6);
      const glad = p.tone === "positive";
      const glum = p.tone === "negative";
      return (
        <g transform={`translate(0 ${Math.sin(frame / 12) * 4}) rotate(${glad ? Math.sin(frame / 3.2) * 5 : 0} 0 -140)`}>
          <rect x={-70} y={-130} width={140} height={130} rx={22} fill="#D9E2EC" {...line} />
          <rect x={-34} y={-92} width={68} height={48} rx={8} fill="#FBF6E9" stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={-68} size={fit(text, 60, 28)}>
              {text}
            </Hand>
          )}
          <rect x={-86} y={-260} width={172} height={120} rx={30} fill="#F4F1EA" {...line} />
          <circle cx={-36} cy={-204} r={17} fill="#35C2F0" opacity={eye} stroke={INK} strokeWidth={3} />
          <circle cx={36} cy={-204} r={17} fill="#35C2F0" opacity={eye} stroke={INK} strokeWidth={3} />
          {glad ? (
            <path d="M -34 -172 Q 0 -138 34 -172 Z" fill="#7A2B2B" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          ) : (
            <path d={glum ? "M -26 -156 Q 0 -172 26 -156" : "M -26 -166 Q 0 -152 26 -166"} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          )}
          {glad && [-36, 36].map((cx) => <path key={cx} d={`M ${cx - 16} -226 Q ${cx} -240 ${cx + 16} -226`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />)}
          <line x1={0} y1={-260} x2={0} y2={-296} {...line} />
          <circle cx={0} cy={-304} r={12} fill="#F0513E" {...line} />
          <line x1={-70} y1={-90} x2={-108} y2={-50} stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <line x1={70} y1={-90} x2={108} y2={-50 - Math.abs(Math.sin(frame / 9)) * 30} stroke={INK} strokeWidth={9} strokeLinecap="round" />
        </g>
      );
    }
    case "pie": {
      const share = clamp01(p.value ?? 0.25) * ease(age, 45);
      const a = share * Math.PI * 2 - Math.PI / 2;
      const r = 130;
      return (
        <g transform="translate(0 -150)">
          <circle r={r} fill="#C9D7E8" {...line} />
          <path d={`M 0 0 L 0 ${-r} A ${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${Math.cos(a) * r} ${Math.sin(a) * r} Z`} fill={p.tone ? tn.line : "#F0513E"} {...line} />
          {text && (
            <Hand y={r + 44} size={fit(text, 320, 44)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
          {p.text2 && (
            <Hand x={54} y={-56} size={46} fill="#FFFFFF" outline={INK} outlineWidth={7}>
              {p.text2}
            </Hand>
          )}
        </g>
      );
    }
    case "bolt":
      return (
        <g transform={`scale(${1 + Math.max(0, 1 - age / 6) * 0.5})`}>
          <path d="M 20 -260 L -70 -110 L -10 -110 L -40 0 L 80 -160 L 14 -160 L 60 -260 Z" fill="#FFD23F" {...line} opacity={0.75 + 0.25 * Math.sin(frame / 3)} />
          {text && (
            <Hand y={40} size={fit(text, 260, 42)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    case "ticker": {
      const c = p.tone === "negative" ? "#F0513E" : "#39C46A";
      return (
        <g>
          <rect x={-240} y={-96} width={480} height={96} rx={8} fill="#111827" {...line} />
          <Hand y={-48} size={fit(text, 440, 60)} fill={c}>
            {text}
          </Hand>
        </g>
      );
    }
    case "chair":
      return (
        <g>
          <rect x={-56} y={-250} width={20} height={250} fill="#6B4A36" {...line} />
          <rect x={-56} y={-250} width={30} height={130} rx={10} fill="#8A5A3C" {...line} />
          <rect x={-56} y={-112} width={130} height={22} rx={8} fill="#8A5A3C" {...line} />
          <rect x={56} y={-90} width={16} height={90} fill="#6B4A36" {...line} />
        </g>
      );
    case "plant":
      return (
        <g>
          <path d="M -44 0 L -34 -84 L 34 -84 L 44 0 Z" fill="#B8623A" {...line} />
          {[-36, 0, 36].map((a, i) => (
            <path key={a} d={`M 0 -84 Q ${a * 2} ${-180 - i * 14} ${a * 2.6 + Math.sin(frame / 30 + i) * 5} -250`} fill="none" stroke="#3F8A4B" strokeWidth={20} strokeLinecap="round" />
          ))}
        </g>
      );
    case "gavel": {
      const hit = Math.max(0, Math.sin(age / 5)) * 26 * Math.max(0, 1 - age / 90);
      return (
        <g>
          <rect x={-90} y={-26} width={180} height={26} rx={8} fill="#6B4A36" {...line} />
          <g transform={`rotate(${-34 + hit} 90 -40)`}>
            <rect x={-70} y={-150} width={110} height={64} rx={10} fill="#A26D49" {...line} />
            <rect x={-22} y={-92} width={16} height={150} rx={6} fill="#8A5A3C" {...line} transform="rotate(-58 -14 -92)" />
          </g>
        </g>
      );
    }
    case "crowd": {
      const n = Math.max(2, Math.min(14, Math.round(p.value ?? 7)));
      const tops = ["#3D6BB3", "#D9534A", "#3F8A4B", "#E0A030", "#6B5BA8", "#2B2A33", "#C7632F"];
      const skins = ["#F2C9A7", "#C68A63", "#8C5A3C", "#EDBE98", "#E3AF88"];
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const x = (i - (n - 1) / 2) * 78;
            const back = i % 2;
            const y = -back * 46 + Math.sin(frame / 9 + i * 1.7) * 3 * (p.tone === "positive" ? 3 : 1);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed crowd
              <g key={i} transform={`translate(${x} ${y})`} opacity={back ? 0.92 : 1}>
                <rect x={-26} y={-100} width={52} height={100} rx={24} fill={tops[i % tops.length]} stroke={INK} strokeWidth={3} />
                <circle cx={0} cy={-128} r={34} fill={skins[i % skins.length]} stroke={INK} strokeWidth={3} />
                <circle cx={-10} cy={-132} r={3.6} fill={INK} />
                <circle cx={14} cy={-132} r={3.6} fill={INK} />
                {p.tone === "negative" ? (
                  <path d="M -8 -110 Q 2 -120 14 -110" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
                ) : (
                  <path d="M -8 -116 Q 2 -106 14 -116" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
                )}
              </g>
            );
          })}
          {text && (
            <Hand y={-220} size={fit(text, 520, 48)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "tokens": {
      // A sentence that breaks into coloured pieces. text: pieces joined by "|"; text2: an id under each piece.
      const parts = text.split("|");
      const ids = (p.text2 ?? "").split("|");
      const size = 54;
      const widths = parts.map((t) => Math.max(1, t.length) * size * 0.54 + 30);
      const gap = 16 * ease(age - 14, 16);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
      const chip = ["#FFD6A5", "#CAFFBF", "#9BF6FF", "#BDB2FF", "#FFC6FF", "#FDFFB6"];
      let x = -total / 2;
      return (
        <g>
          {parts.map((t, i) => {
            const w = widths[i] as number;
            const on = clamp01((age - 18 - i * 4) / 6);
            const hop = Math.sin(clamp01((age - 18 - i * 4) / 10) * Math.PI) * -22;
            const cx = x + w / 2;
            x += w + gap;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed pieces
              <g key={i} transform={`translate(${cx} ${-70 + hop})`}>
                <rect x={-w / 2} y={-44} width={w} height={88} rx={12} fill="#FBF6E9" {...line} />
                <rect x={-w / 2} y={-44} width={w} height={88} rx={12} fill={chip[i % chip.length]} opacity={on} {...line} />
                <Hand size={size}>{t}</Hand>
                {ids[i] && (
                  <g opacity={clamp01((age - 44 - i * 4) / 8)}>
                    <line x1={0} y1={48} x2={0} y2={74} stroke={INK} strokeWidth={3} />
                    <Hand y={100} size={36} fill="#E8402E" outline="#FBF6E9">
                      {ids[i] as string}
                    </Hand>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      );
    }
    case "vector": {
      // A column of numbers: what a word looks like to the model.
      const rows = 6;
      const settle = age > 26;
      return (
        <g>
          <rect x={-92} y={-344} width={184} height={348} rx={10} fill="#FBF6E9" {...line} />
          <path d="M -58 -330 L -78 -330 L -78 -10 L -58 -10 M 58 -330 L 78 -330 L 78 -10 L 58 -10" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          {Array.from({ length: rows }, (_, i) => {
            const seed = (p.value ?? 1) * 13 + i * 7 + (settle ? 0 : Math.floor(age / 2) * 3);
            const n = hash(seed) * 2 - 1;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
              <Hand key={i} y={-296 + i * 52} size={38} fill={n < 0 ? "#C8372D" : "#1F6FB5"}>
                {i === rows - 1 ? "..." : n.toFixed(2)}
              </Hand>
            );
          })}
          {text && (
            <Hand y={-372} size={fit(text, 220, 48)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "space": {
      // A map of meaning: related words sit close together. text: up to six labels joined by "|".
      const labels = text.split("|").slice(0, 6);
      const spots: [number, number][] = [
        [-130, -210],
        [-70, -260],
        [70, -120],
        [130, -170],
        [-150, -90],
        [-60, -56],
      ];
      const dot = ["#E8402E", "#E8402E", "#1F6FB5", "#1F6FB5", "#E0A030", "#E0A030"];
      return (
        <g>
          <rect x={-240} y={-340} width={480} height={340} rx={10} fill="#FBF6E9" {...line} />
          <path d="M -210 -30 L 210 -30 M -210 -30 L -210 -310" fill="none" stroke={INK} strokeWidth={3} />
          {labels.length > 1 && age > 30 && <line x1={-130} y1={-210} x2={-70} y2={-260} stroke="#E8402E" strokeWidth={4} strokeDasharray="8 8" />}
          {labels.length > 3 && age > 40 && <line x1={70} y1={-120} x2={130} y2={-170} stroke="#1F6FB5" strokeWidth={4} strokeDasharray="8 8" />}
          {labels.map((l, i) => {
            const [x, y] = spots[i] as [number, number];
            const s = ease(age - i * 6, 10);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed points
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                <circle r={13 + Math.sin(frame / 6 + i) * 2} fill={dot[i]} stroke={INK} strokeWidth={3} />
                <Hand y={-30} size={30} fill="#FFFFFF" outline={INK}>
                  {l}
                </Hand>
              </g>
            );
          })}
          {p.text2 && (
            <Hand y={-372} size={fit(p.text2, 460, 44)} fill="#FFFFFF" outline={INK}>
              {p.text2}
            </Hand>
          )}
        </g>
      );
    }
    case "attention": {
      // Words in a row; the last one looks back at the others. values: how strongly (0–1) for each earlier word.
      const parts = text.split("|");
      const size = 46;
      const widths = parts.map((t) => Math.max(1, t.length) * size * 0.54 + 28);
      const gap = 18;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
      const centres: number[] = [];
      let x = -total / 2;
      for (const w of widths) {
        centres.push(x + w / 2);
        x += w + gap;
      }
      const last = centres[centres.length - 1] as number;
      const weights = p.values ?? parts.map((_, i) => (i === parts.length - 2 ? 0.9 : 0.25));
      return (
        <g>
          {centres.slice(0, -1).map((cx, i) => {
            const wgt = clamp01(weights[i] ?? 0.2);
            const k = ease(age - 16 - i * 5, 18);
            const span = last - cx;
            const strong = wgt > 0.6;
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed arcs
                key={i}
                d={`M ${last} -116 Q ${(last + cx) / 2} ${-116 - span * 0.42 - 40} ${cx} -116`}
                fill="none"
                stroke={strong ? "#E8402E" : "#7FA5D8"}
                strokeWidth={4 + wgt * 16}
                strokeLinecap="round"
                opacity={(0.45 + 0.55 * wgt) * (strong ? 0.75 + 0.25 * Math.sin(frame / 4) : 1)}
                strokeDasharray={2000}
                strokeDashoffset={2000 * (1 - k)}
              />
            );
          })}
          {parts.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed pieces
            <g key={i} transform={`translate(${centres[i]} -70)`}>
              <rect x={-(widths[i] as number) / 2} y={-40} width={widths[i]} height={80} rx={12} fill={i === parts.length - 1 ? "#FFD84A" : "#FBF6E9"} {...line} />
              <Hand size={size}>{t}</Hand>
            </g>
          ))}
          {p.text2 && (
            <Hand y={28} size={fit(p.text2, total, 40)} fill="#FFFFFF" outline={INK}>
              {p.text2}
            </Hand>
          )}
        </g>
      );
    }
    case "layers": {
      // A stack of layers with a signal climbing through it. value: how many (default 6).
      const n = Math.max(2, Math.min(10, Math.round(p.value ?? 6)));
      const pulse = ((age / 3.2) % (n + 2)) - 1;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const y = -30 - i * 50;
            const glow = clamp01(1 - Math.abs(pulse - i));
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed stack
              <g key={i} transform={`translate(0 ${y})`} opacity={clamp01((age - i * 3) / 6)}>
                <path d="M -170 0 L -120 -34 L 170 -34 L 120 0 Z" fill="#3D6BB3" {...line} />
                <path d="M -170 0 L -120 -34 L 170 -34 L 120 0 Z" fill="#7CFF6B" opacity={glow * 0.9} />
                <path d="M -170 0 L 120 0 L 120 14 L -170 14 Z" fill="#27457A" {...line} />
              </g>
            );
          })}
          <circle cx={0} cy={-46 - Math.max(0, Math.min(n - 1, pulse)) * 50} r={13} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={-n * 50 - 60} size={fit(text, 380, 46)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "probs": {
      // The model's guesses for the next word. text: words joined by "|"; values: a percentage for each.
      const words = text.split("|").slice(0, 5);
      const vals = p.values ?? words.map((_, i) => [80, 10, 5, 3, 2][i] ?? 1);
      const rowH = 70;
      const h = words.length * rowH + 30;
      return (
        <g>
          <rect x={-290} y={-h} width={580} height={h} rx={12} fill="#FBF6E9" {...line} />
          {words.map((w, i) => {
            const v = vals[i] ?? 0;
            const k = ease(age - 8 - i * 6, 20);
            const y = -h + 50 + i * rowH;
            const top = i === 0;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
              <g key={i} opacity={clamp01((age - i * 6) / 6)}>
                <Hand x={-140} y={y} size={fit(w, 130, 40)} anchor="end">
                  {w}
                </Hand>
                <rect x={-124} y={y - 22} width={Math.max(8, (v / 100) * 290 * k)} height={44} rx={6} fill={top ? "#2FA84F" : "#9DB4D6"} {...line} />
                <Hand x={-110 + Math.max(8, (v / 100) * 290 * k)} y={y} size={34} anchor="start" fill={top ? "#14532D" : INK}>
                  {`${v < 1 ? v.toFixed(1) : Math.round(v * k)}%`}
                </Hand>
              </g>
            );
          })}
          {p.text2 && (
            <Hand y={-h - 36} size={fit(p.text2, 560, 44)} fill="#FFFFFF" outline={INK}>
              {p.text2}
            </Hand>
          )}
        </g>
      );
    }
    case "dice": {
      const rolling = age < 22;
      const face = rolling ? 1 + (Math.floor(age / 3) % 6) : Math.max(1, Math.min(6, Math.round(p.value ?? 5)));
      const pips: Record<number, [number, number][]> = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
      };
      const hop = rolling ? -Math.abs(Math.sin(age / 3.5)) * 90 : 0;
      return (
        <g transform={`translate(0 ${-80 + hop}) rotate(${rolling ? age * 24 : -8})`}>
          <rect x={-78} y={-78} width={156} height={156} rx={26} fill="#FFFFFF" {...line} />
          {(pips[face] as [number, number][]).map(([px, py], i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed pips
            <circle key={i} cx={px * 40} cy={py * 40} r={14} fill="#E8402E" />
          ))}
        </g>
      );
    }
    case "net": {
      // A small neural network with activity sweeping through it.
      const cols = [3, 5, 5, 3];
      const at = (c: number, r: number): [number, number] => [(c - 1.5) * 150, -190 + (r - ((cols[c] as number) - 1) / 2) * 66];
      const act = (c: number, r: number) => clamp01(0.25 + 0.75 * Math.sin(age / 5 - c * 1.3 + r * 0.9));
      return (
        <g>
          {cols.slice(0, -1).flatMap((n, c) =>
            Array.from({ length: n }, (_, r) =>
              Array.from({ length: cols[c + 1] as number }, (_, r2) => {
                const [x1, y1] = at(c, r);
                const [x2, y2] = at(c + 1, r2);
                return <line key={`${c}-${r}-${r2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.6} opacity={0.2 + 0.5 * act(c, r) * act(c + 1, r2)} />;
              }),
            ),
          )}
          {cols.flatMap((n, c) =>
            Array.from({ length: n }, (_, r) => {
              const [x, y] = at(c, r);
              return (
                <g key={`n${c}-${r}`}>
                  <circle cx={x} cy={y} r={22} fill="#FBF6E9" {...line} />
                  <circle cx={x} cy={y} r={22} fill="#FF9B2F" opacity={act(c, r)} stroke={INK} strokeWidth={STROKE} />
                </g>
              );
            }),
          )}
          {text && (
            <Hand y={-400} size={fit(text, 520, 46)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "chatbox": {
      // A chat window: the question (text), then the answer (text2) written piece by piece.
      const answer = (p.text2 ?? "").split(" ");
      const shown = Math.max(0, Math.floor((age - 14) / 4));
      const typed = answer.slice(0, shown).join(" ");
      const rows = wrap(typed || " ", 25).slice(0, 4);
      const done = shown >= answer.length;
      return (
        <g>
          <rect x={-290} y={-430} width={580} height={430} rx={26} fill="#FFFFFF" {...line} />
          <rect x={-290} y={-430} width={580} height={62} rx={26} fill="#E6E1D6" {...line} />
          {[-250, -218, -186].map((cx, i) => (
            <circle key={cx} cx={cx} cy={-399} r={10} fill={["#F0513E", "#FFC928", "#39C46A"][i]} stroke={INK} strokeWidth={2} />
          ))}
          <g transform="translate(250 -300)">
            <rect x={-Math.min(440, text.length * 20 + 44)} y={-36} width={Math.min(440, text.length * 20 + 44)} height={72} rx={22} fill="#3D6BB3" {...line} />
            <Hand x={-Math.min(440, text.length * 20 + 44) / 2} size={fit(text, 400, 34)} fill="#FFFFFF">
              {text}
            </Hand>
          </g>
          {p.text2 && age > 8 && (
            <g transform="translate(-260 -216)">
              <rect x={0} y={0} width={470} height={Math.max(72, rows.length * 44 + 28)} rx={22} fill="#F1ECE0" {...line} />
              <Hand x={22} y={(Math.max(72, rows.length * 44 + 28)) / 2} size={34} anchor="start" lines={rows} />
              {!done && frame % 10 < 6 && <rect x={30 + (rows[rows.length - 1] ?? "").length * 17.6} y={Math.max(72, rows.length * 44 + 28) / 2 + (rows.length - 1) * 18 - 18} width={14} height={36} fill={INK} />}
            </g>
          )}
        </g>
      );
    }
    case "plane":
      return (
        <g transform={`translate(${Math.sin(frame / 9) * 10} ${-120 + Math.sin(frame / 6) * 12}) rotate(${-8 + Math.sin(frame / 7) * 4})`}>
          {[0, 1, 2].map((i) => (
            <line key={i} x1={-150 - i * 46} y1={20 + i * 6} x2={-120 - i * 46} y2={18 + i * 6} stroke={INK} strokeWidth={6} strokeLinecap="round" opacity={0.7 - i * 0.2} />
          ))}
          <path d="M -90 10 L 110 -40 L -20 60 L -30 24 Z" fill="#FFFFFF" {...line} />
          <path d="M -30 24 L 110 -40 L -6 40 Z" fill="#D9D4C7" {...line} />
          {text && (
            <Hand y={110} size={fit(text, 300, 40)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    case "books": {
      const n = Math.max(2, Math.min(9, Math.round(p.value ?? 5)));
      const spine = ["#D9534A", "#3D6BB3", "#3F8A4B", "#E0A030", "#6B5BA8", "#C7632F"];
      return (
        <g>
          {Array.from({ length: n }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed stack
            <g key={i} transform={`translate(${(i % 2) * 14 - 7} ${-i * 38})`} opacity={clamp01((age - i * 3) / 5)}>
              <rect x={-100} y={-38} width={200} height={38} rx={5} fill={spine[i % spine.length]} {...line} />
              <rect x={-88} y={-30} width={22} height={22} fill="#FBF6E9" stroke={INK} strokeWidth={2} />
              <line x1={60} y1={-38} x2={60} y2={0} stroke={INK} strokeWidth={2.5} />
            </g>
          ))}
          {text && (
            <Hand y={-n * 38 - 46} size={fit(text, 320, 44)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "globe": {
      const turn = (frame / 50) % 1;
      return (
        <g transform="translate(0 -150)">
          <circle r={140} fill="#8FC8E8" {...line} />
          {[0, 0.25, 0.5, 0.75].map((o) => {
            const ph = (turn + o) % 1;
            return <ellipse key={o} rx={Math.abs(Math.cos(ph * Math.PI)) * 140} ry={140} fill="none" stroke={INK} strokeWidth={3} opacity={0.7} />;
          })}
          <line x1={-140} y1={0} x2={140} y2={0} stroke={INK} strokeWidth={3} />
          <path d="M -122 -68 Q 0 -100 122 -68 M -122 68 Q 0 100 122 68" fill="none" stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={186} size={fit(text, 320, 44)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "dial": {
      // A gauge from "safe" to "wild". value: 0–1.
      const v = clamp01(p.value ?? 0.5) * ease(age, 40);
      const a = Math.PI * (1 - v);
      return (
        <g transform="translate(0 -40)">
          <path d="M -180 0 A 180 180 0 0 1 180 0 Z" fill="#FBF6E9" {...line} />
          <path d="M -180 0 A 180 180 0 0 1 -90 -156 L 0 0 Z" fill="#9DB4D6" opacity={0.9} />
          <path d="M 90 -156 A 180 180 0 0 1 180 0 L 0 0 Z" fill="#F0513E" opacity={0.85} />
          <path d="M -180 0 A 180 180 0 0 1 180 0" fill="none" {...line} />
          <line x1={0} y1={0} x2={Math.cos(a) * 150} y2={-Math.sin(a) * 150} stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <circle r={16} fill={INK} />
          <Hand x={-150} y={40} size={34} fill="#FFFFFF" outline={INK}>
            {text || "safe"}
          </Hand>
          <Hand x={150} y={40} size={34} fill="#FFFFFF" outline={INK}>
            {p.text2 ?? "wild"}
          </Hand>
        </g>
      );
    }
    case "thumb": {
      // A thumbs-up (or thumbs-down with tone "negative"), with an optional count that climbs to `value`.
      const down = p.tone === "negative";
      const k = ease(age, 30);
      const bump = 1 + Math.max(0, 1 - age / 8) * 0.5 + Math.sin(frame / 7) * 0.03;
      return (
        <g>
          <g transform={`translate(0 -150) scale(${bump}) ${down ? "rotate(180)" : ""}`}>
            <rect x={-110} y={-10} width={56} height={120} rx={12} fill="#3D6BB3" {...line} />
            <path d="M -54 0 L -10 -90 Q 10 -130 40 -100 Q 54 -70 34 -20 L 100 -20 Q 130 -10 118 20 Q 132 44 112 62 Q 120 88 96 100 Q 92 124 60 122 L -54 110 Z" fill={down ? "#F0513E" : "#FFD23F"} {...line} />
          </g>
          {(text || p.value !== undefined) && (
            <Hand y={34} size={fit(`${text}${p.value ?? ""}`, 300, 56)} fill="#FFFFFF" outline={INK}>
              {`${p.value !== undefined ? Math.round(p.value * k).toLocaleString("en-US") : ""}${text ? ` ${text}` : ""}`.trim()}
            </Hand>
          )}
        </g>
      );
    }
    case "stars": {
      // A star rating out of five. value: how many are filled.
      const n = Math.max(0, Math.min(5, p.value ?? 5));
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const on = clamp01((age - i * 5) / 6) * (i < n ? 1 : 0);
            const pop = 1 + Math.max(0, 1 - Math.abs(age - i * 5 - 4) / 4) * 0.35;
            return (
              <g key={i} transform={`translate(${(i - 2) * 96} -60) scale(${pop})`}>
                <path d="M 0 -44 L 13 -14 L 46 -14 L 20 6 L 30 38 L 0 18 L -30 38 L -20 6 L -46 -14 L -13 -14 Z" fill="#FBF6E9" {...line} />
                <path d="M 0 -44 L 13 -14 L 46 -14 L 20 6 L 30 38 L 0 18 L -30 38 L -20 6 L -46 -14 L -13 -14 Z" fill="#FFD23F" opacity={on} {...line} />
              </g>
            );
          })}
          {text && (
            <Hand y={-140} size={fit(text, 460, 44)} fill="#FFFFFF" outline={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    }
    case "mirror":
      return (
        <g>
          <rect x={-12} y={-70} width={24} height={70} fill="#8A5A3C" {...line} />
          <ellipse cx={0} cy={-8} rx={90} ry={16} fill="#8A5A3C" {...line} />
          <ellipse cx={0} cy={-250} rx={150} ry={190} fill="#C9A24B" {...line} />
          <ellipse cx={0} cy={-250} rx={126} ry={166} fill="#CFE8F2" {...line} />
          <path d="M -80 -340 Q -50 -390 0 -398" fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" opacity={0.8} />
          {text && <Hand y={-250} size={Math.min(52, 220 / (Math.max(...wrap(text, 10).map((r) => r.length), 3) * 0.52))} lines={wrap(text, 10).slice(0, 3)} />}
        </g>
      );
    case "tag":
      return (
        <g transform={`rotate(${-8 + Math.sin(frame / 14) * 3} -150 -60)`}>
          <path d="M -170 -60 L -110 -120 L 170 -120 L 170 0 L -110 0 Z" fill={p.tone ? tn.fill : "#FFD84A"} {...line} />
          <circle cx={-126} cy={-60} r={13} fill="#FBF6E9" {...line} />
          <Hand x={40} y={-60} size={fit(text, 250, 70)} fill={p.tone ? tn.text : INK}>
            {text}
          </Hand>
        </g>
      );
  }
};
