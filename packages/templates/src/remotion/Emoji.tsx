import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { emojiFile } from "../emoji";

/** A Fluent 3D emoji from media/emoji/ (downloaded by core before rendering). */
export const Emoji: React.FC<{ name: string; size: number; style?: CSSProperties }> = ({
  name,
  size,
  style,
}) => (
  <Img
    src={staticFile(emojiFile(name))}
    style={{ width: size, height: size, objectFit: "contain", flex: "none", ...style }}
  />
);
