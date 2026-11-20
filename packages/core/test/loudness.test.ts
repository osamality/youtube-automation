import { describe, expect, it } from "vitest";
import { parseLoudnorm } from "../src/loudness";

const STDERR = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'short.mp4':
  Duration: 00:00:34.10, start: 0.000000, bitrate: 3020 kb/s
[Parsed_loudnorm_0 @ 0x600001b0c000]
{
	"input_i" : "-21.25",
	"input_tp" : "-4.10",
	"input_lra" : "5.30",
	"input_thresh" : "-31.40",
	"output_i" : "-14.05",
	"output_tp" : "-1.50",
	"output_lra" : "4.90",
	"output_thresh" : "-24.20",
	"normalization_type" : "linear",
	"target_offset" : "-0.05"
}
`;

describe("parseLoudnorm", () => {
  it("reads loudnorm's JSON block from ffmpeg's log", () => {
    const stats = parseLoudnorm(STDERR);
    expect(stats.input_i).toBe("-21.25");
    expect(stats.target_offset).toBe("-0.05");
    expect(Number(stats.output_i)).toBeCloseTo(-14.05);
  });

  it("fails clearly when ffmpeg printed no measurements", () => {
    expect(() => parseLoudnorm("Error opening input")).toThrow("no loudnorm measurements");
  });
});
