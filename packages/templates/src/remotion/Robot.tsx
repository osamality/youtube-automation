import { mix, useTheme } from "./theme";

export interface RobotPose {
  /** 0 = closed, 1 = wide open. */
  mouth: number;
  /** 0 = open eyes, 1 = closed. */
  blink: number;
  /** Right-arm angle in degrees; 0 hangs down, 120 waves. */
  arm: number;
  /** Antenna light brightness 0–1. */
  glow: number;
}

/** The channel mascot, drawn in SVG from the theme colours. viewBox 200×250. */
export const Robot: React.FC<{ size: number; pose: RobotPose }> = ({ size, pose }) => {
  const { palette } = useTheme();
  const body = palette.accent;
  const shade = mix(palette.accent, "#000000", 0.28);
  const screen = mix(palette.bg, "#000000", 0.25);
  const eye = "#FFFFFF";
  const mouthH = 4 + pose.mouth * 22;
  const eyeH = Math.max(2.5, 24 * (1 - pose.blink));

  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 200 250" style={{ overflow: "visible" }}>
      <title>Mascot</title>
      {/* antenna */}
      <line x1={100} y1={44} x2={100} y2={20} stroke={shade} strokeWidth={6} strokeLinecap="round" />
      <circle cx={100} cy={15} r={18} fill={palette.accent2} opacity={0.18 + 0.25 * pose.glow} />
      <circle cx={100} cy={15} r={9} fill={palette.accent2} />

      {/* left arm (static) */}
      <rect x={34} y={168} width={18} height={48} rx={9} fill={shade} transform="rotate(14 43 172)" />
      {/* right arm (gestures) */}
      <g transform={`rotate(${-pose.arm} 157 172)`}>
        <rect x={148} y={168} width={18} height={48} rx={9} fill={shade} />
        <circle cx={157} cy={218} r={11} fill={body} />
      </g>

      {/* body */}
      <rect x={54} y={156} width={92} height={72} rx={24} fill={body} />
      <rect x={76} y={176} width={48} height={30} rx={10} fill={shade} />
      <circle cx={100} cy={191} r={7} fill={palette.accent2} opacity={0.6 + 0.4 * pose.glow} />

      {/* ears */}
      <rect x={14} y={80} width={22} height={42} rx={10} fill={shade} />
      <rect x={164} y={80} width={22} height={42} rx={10} fill={shade} />

      {/* head */}
      <rect x={28} y={42} width={144} height={118} rx={38} fill={body} />
      <rect x={46} y={60} width={108} height={80} rx={24} fill={screen} />

      {/* eyes */}
      <rect x={70} y={88 - eyeH / 2} width={18} height={eyeH} rx={9} fill={eye} />
      <rect x={112} y={88 - eyeH / 2} width={18} height={eyeH} rx={9} fill={eye} />

      {/* cheeks */}
      <circle cx={62} cy={112} r={7} fill={palette.accent2} opacity={0.45} />
      <circle cx={138} cy={112} r={7} fill={palette.accent2} opacity={0.45} />

      {/* mouth */}
      <rect
        x={86}
        y={118 - mouthH / 2}
        width={28}
        height={mouthH}
        rx={Math.min(9, mouthH / 2)}
        fill={eye}
      />
    </svg>
  );
};

/** Blink about every 3.3 seconds, offset so two robots never blink together. */
export function blinkAt(frame: number, offset = 0): number {
  const phase = (frame + offset) % 100;
  return phase < 6 ? Math.sin((phase / 6) * Math.PI) : 0;
}
