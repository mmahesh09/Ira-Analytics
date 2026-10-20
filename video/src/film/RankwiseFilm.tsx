import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FPS } from "../theme";
import { Atmosphere, Grade, Grain, clamp } from "./fx";
import { Build, Features, Finale, Opening, Reveal, Showcase } from "./scenes";

// Shot list (frames @30 fps). Every cut from REVEAL on sits on the music's bar grid
// (124 BPM, the drop of Syn Cole – Melodia placed on frame 240).
export const SHOTS = {
  opening: [0, 124],
  build: [124, 240],
  reveal: [240, 356],
  showcase: [356, 530],
  features: [530, 704],
  finale: [704, 900],
} as const;
export const FILM_DURATION = 900;

const shot = (k: keyof typeof SHOTS) => ({ from: SHOTS[k][0], durationInFrames: SHOTS[k][1] - SHOTS[k][0] });

/** One sound effect at an absolute frame. */
const Sfx: React.FC<{ at: number; file: string; volume: number; frames?: number }> = ({ at, file, volume, frames }) => (
  <Sequence from={at} durationInFrames={frames} layout="none">
    <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
  </Sequence>
);

const TICKS = Array.from({ length: 9 }, (_, i) => 362 + i * 4); // score ring counting up
const ROWS = Array.from({ length: 7 }, (_, i) => 414 + i * 4); // issue rows landing
const WHIPS = [345, 519, 564, 607, 651]; // whoosh peaks land on the cuts at 356, 530, 574, 617, 661

const SoundDesign: React.FC = () => (
  <>
    {/* opening: dark drone + sub hits on each type beat, riser into the pre-drop silence */}
    <Sfx at={0} file="drone" volume={0.5} frames={226} />
    {[32, 68].map((at) => (
      <Sfx key={at} at={at} file="impact-soft" volume={0.6} />
    ))}
    {[124, 146, 168, 182, 197].map((at) => (
      <Sfx key={at} at={at} file="impact-soft" volume={0.5} />
    ))}
    <Sfx at={150} file="riser" volume={0.5} frames={76} />

    {/* the drop: Melodia from 0:54.2, plus a sub boom under it */}
    <Sequence from={239} layout="none">
      <Audio
        src={staticFile("music.mp3")}
        trimBefore={Math.round(54.17 * FPS)}
        volume={(f) => interpolate(f, [0, 463, 475, 600, 655], [0.7, 0.7, 0.28, 0.28, 0], clamp)}
      />
    </Sequence>
    <Sfx at={240} file="impact" volume={0.5} />

    {/* product: whooshes on every whip/zoom cut, clicks on UI motion */}
    {WHIPS.map((at) => (
      <Sfx key={at} at={at} file="whoosh" volume={0.38} />
    ))}
    {TICKS.map((at) => (
      <Sfx key={at} at={at} file="click" volume={0.12} />
    ))}
    {ROWS.map((at) => (
      <Sfx key={at} at={at} file="click" volume={0.1} />
    ))}
    {[538, 582, 625, 669].map((at) => (
      <Sfx key={at} at={at} file="click" volume={0.16} />
    ))}

    {/* finale: hit into darkness, shimmer under the logo */}
    <Sfx at={704} file="impact" volume={0.5} />
    <Sfx at={716} file="shimmer" volume={0.3} />
  </>
);

export const RankwiseFilm: React.FC = () => {
  const frame = useCurrentFrame();
  // keep the plate out of the two blackouts (pre-drop silence, finale darkness)
  const plate = interpolate(frame, [224, 227, 238, 240, 702, 705, 716, 730], [1, 0, 0, 1, 1, 0, 0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: "contrast(1.06) saturate(1.06)" }}>
        <Sequence {...shot("opening")}>
          <Opening />
        </Sequence>
        <Sequence {...shot("build")}>
          <Build />
        </Sequence>
        <Sequence {...shot("reveal")}>
          <Reveal />
        </Sequence>
        <Sequence {...shot("showcase")}>
          <Showcase />
        </Sequence>
        <Sequence {...shot("features")}>
          <Features />
        </Sequence>
        <Sequence {...shot("finale")}>
          <Finale />
        </Sequence>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: plate }}>
        <Atmosphere />
      </AbsoluteFill>
      <Grade />
      <Grain />
      <SoundDesign />
    </AbsoluteFill>
  );
};
