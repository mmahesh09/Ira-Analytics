import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Cta } from "./scenes/Cta";
import { Demo } from "./scenes/Demo";
import { Features } from "./scenes/Features";
import { Hook } from "./scenes/Hook";
import { Problem } from "./scenes/Problem";
import { Reveal } from "./scenes/Reveal";
import { FPS } from "./theme";

export type LaunchProps = {
  /** play public/voiceover.mp3 */
  voiceover: boolean;
  /** play public/music.mp3 (ducked under the voice) */
  music: boolean;
};

// "Melodia" (Syn Cole, NCS): its main drop hits at 54.19 s in the track.
// Starting the track at 46.2 s lands that drop on the logo reveal at DROP_FRAME (8.0 s).
const TRACK_START_FRAME = Math.round(46.2 * FPS);

const T = 15; // transition length; each overlaps the neighbouring scenes
const timing = linearTiming({ durationInFrames: T });

// Each incoming scene is fully on screen at a bar line counted from the drop:
// cuts at frames 124, 240 (drop), 356, 530, 704 — i.e. 8.0 s ± n × 1.935 s.
const SCENES = { hook: 124, problem: 131, reveal: 131, demo: 189, features: 189, cta: 211 };
export const DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0) - 5 * T;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const RankwiseLaunch: React.FC<LaunchProps> = ({ voiceover, music }) => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES.hook}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={SCENES.problem}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={SCENES.reveal}>
        <Reveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={SCENES.demo}>
        <Demo />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={SCENES.features}>
        <Features />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={SCENES.cta}>
        <Cta />
      </TransitionSeries.Sequence>
    </TransitionSeries>

    {voiceover ? <Audio src={staticFile("voiceover.mp3")} /> : null}
    {music ? (
      <Audio
        src={staticFile("music.mp3")}
        trimBefore={TRACK_START_FRAME}
        volume={(f) => interpolate(f, [DURATION - 45, DURATION], [1, 0], clamp) * (voiceover ? 0.15 : 0.8)}
      />
    ) : null}
  </AbsoluteFill>
);
