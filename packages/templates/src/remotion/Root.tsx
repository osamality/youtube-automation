import { Composition } from "remotion";
import { FORMATS, FPS } from "../constants";
import { sampleInput } from "../sample";
import type { RenderInput } from "../schema";
import { buildTimeline, forFormat } from "../timeline";
import { MAX_THUMBNAILS, THUMBNAIL, Thumbnail } from "./Thumbnail";
import { Video } from "./Video";

/** Each format keeps only its own scenes (scene.short), then sizes itself to the voice. */
const metadataFor =
  (format: "long" | "short") =>
  ({ props }: { props: RenderInput }) => {
    const own = forFormat(props, format);
    return { durationInFrames: buildTimeline(own).durationInFrames, props: own };
  };

/** One composition per thumbnail slot (thumbnail-1 … thumbnail-3), so each can be rendered or viewed on its own. */
const THUMBNAILS = Array.from({ length: MAX_THUMBNAILS }, (_, thumb) => {
  const Slot: React.FC<RenderInput> = (input) => <Thumbnail input={input} thumb={thumb} />;
  return Slot;
});

export const Root: React.FC = () => {
  const defaults = sampleInput();
  return (
    <>
      <Composition
        id="long"
        component={Video}
        width={FORMATS.long.width}
        height={FORMATS.long.height}
        fps={FPS}
        durationInFrames={300}
        defaultProps={defaults}
        calculateMetadata={metadataFor("long")}
      />
      <Composition
        id="short"
        component={Video}
        width={FORMATS.short.width}
        height={FORMATS.short.height}
        fps={FPS}
        durationInFrames={300}
        defaultProps={defaults}
        calculateMetadata={metadataFor("short")}
      />
      {THUMBNAILS.map((Slot, i) => (
        <Composition
          key={`thumbnail-${i + 1}`}
          id={`thumbnail-${i + 1}`}
          component={Slot}
          width={THUMBNAIL.width}
          height={THUMBNAIL.height}
          fps={FPS}
          durationInFrames={1}
          defaultProps={defaults}
        />
      ))}
    </>
  );
};
