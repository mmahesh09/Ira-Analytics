import { Composition } from "remotion";
import { FILM_DURATION, RankwiseFilm } from "./film/RankwiseFilm";
import { DURATION, RankwiseLaunch, type LaunchProps } from "./RankwiseLaunch";
import { FPS } from "./theme";

const defaults: LaunchProps = { voiceover: false, music: false };

export const Root: React.FC = () => (
  <>
    {/* the cinematic launch film (Remotion edit + HyperFrames atmosphere plates from fx/) */}
    <Composition id="RankwiseFilm" component={RankwiseFilm} durationInFrames={FILM_DURATION} fps={FPS} width={1920} height={1080} />
    {/* the original promo it was built from */}
    <Composition
      id="RankwiseLaunch"
      component={RankwiseLaunch}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaults}
    />
  </>
);
