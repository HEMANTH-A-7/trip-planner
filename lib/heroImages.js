// The bundled hero set, doing two jobs.
//
// On the landing there is no destination yet, so the images have nothing to
// contradict - they rotate, and the rotation is the pitch: anywhere you want.
//
// On a trip's hero exactly one is chosen, by theme, and it is on screen
// immediately. The Pexels lookup that finds a real photo of the destination
// then crossfades in over the top of it. That ordering is the whole trick:
// the hero is never blank, never waiting, and never wrong-by-default, and if
// the lookup is slow or fails or the destination is too vague to search well,
// nothing happens and nobody notices.
//
// Credits are recorded per image. The Pexels and Unsplash licences don't
// require attribution for images you've downloaded, but the Pexels *API*
// guidelines do require it for photos served through the API - so the remote
// hero always credits, and these credit too because it costs one line.

export const HERO_IMAGES = {
  metropolis: {
    src: "/hero/metropolis.jpg",
    // Where the frame's subject sits, for the crop. These are wide photos
    // shown in a short band, so the default centre crop would behead the
    // skyline on some and cut the horizon on others.
    position: "50% 60%",
    credit: { photographer: "Iban Lopez Luna", source: "Pexels" },
  },
  historic: {
    src: "/hero/historic.jpg",
    position: "50% 55%",
    credit: { photographer: "Kirandeep Singh", source: "Pexels" },
  },
  alpine: {
    src: "/hero/alpine.jpg",
    position: "50% 55%",
    credit: { photographer: "Arina Dmitrieva", source: "Pexels" },
  },
  lakes: {
    src: "/hero/lakes.jpg",
    position: "50% 50%",
    credit: { photographer: "Pietro De Grandi", source: "Unsplash" },
  },
  wildlife: {
    src: "/hero/wildlife.jpg",
    position: "50% 60%",
    credit: { photographer: "laukevtravel", source: "Pexels" },
  },
  coastal: {
    src: "/hero/coastal.jpg",
    position: "50% 50%",
    credit: null,
  },
};

// The enum the model picks from. Ordered so the landing rotation opens on the
// city and alternates between built and wild rather than showing three
// mountains in a row.
export const HERO_THEMES = [
  "metropolis",
  "coastal",
  "alpine",
  "historic",
  "lakes",
  "wildlife",
];

// What the landing cycles through - all six, ordered so it alternates between
// built and wild rather than showing three landscapes in a row.
export const LANDING_SEQUENCE = [
  "metropolis",
  "lakes",
  "historic",
  "alpine",
  "coastal",
  "wildlife",
].map((theme) => ({ theme, ...HERO_IMAGES[theme] }));

// A trip always has a hero, even if the model skipped the field or the trip
// was saved by a build of the app that predates it.
export function heroFallback(theme) {
  return HERO_IMAGES[theme] ?? HERO_IMAGES.coastal;
}
