// Finds a real photograph of the destination, so a trip about Tokyo doesn't
// sit under a stock beach. Everything here is best-effort: the page already
// has a themed image on screen before this is called, so every failure path
// returns "no photo" and the caller simply keeps what it has.

const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

// A city doesn't change what it looks like. Caching on the outbound fetch
// means the Data Cache keys by URL, so everyone planning Tokyo shares one
// upstream call instead of spending a request each - which is what keeps this
// inside a free tier at any real traffic.
const CACHE_SECONDS = 60 * 60 * 24 * 30;

// Long enough for a slow answer, short enough that it can't hold a request
// open. Nothing is waiting on this, so it can afford to give up.
const TIMEOUT_MS = 4000;

const MAX_QUERY = 80;

const empty = () => Response.json({ photo: null });

export async function GET(request) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return empty();

  const destination = request.nextUrl.searchParams
    .get("destination")
    ?.trim()
    .slice(0, MAX_QUERY);
  if (!destination) return empty();

  // The destination on its own, with no "travel"/"landscape" helper words
  // bolted on. Measured against the live API, those words make the results
  // markedly worse: Pexels widens rather than narrows on extra terms, so
  // "Reykjavik, Iceland" returns Reykjavik, while "Reykjavik, Iceland travel
  // landscape" starts returning generic Icelandic plains. The model has
  // already normalised the destination into a clean place name, which is a
  // far better query than anything the user typed.
  const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(
    destination,
  )}&per_page=12&orientation=landscape&size=large`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return empty();

    const data = await response.json();
    const photo = pickPhoto(data?.photos, destination);
    if (!photo) return empty();

    return Response.json({
      photo: {
        src: photo.src.large2x,
        // Pexels ships an average colour per photo. It seeds the backdrop
        // underneath while the image decodes, so the crossfade starts from
        // something in the right key rather than from black.
        averageColor: photo.avg_color ?? null,
        alt: photo.alt || `${destination}`,
        credit: {
          photographer: photo.photographer,
          photographerUrl: photo.photographer_url,
          url: photo.url,
          source: "Pexels",
        },
      },
    });
  } catch {
    // Timeout, network, malformed JSON - all the same outcome to the caller.
    return empty();
  }
}

// Words too generic to prove a photo is of the right place. "Japan" is
// deliberately not here - a photo captioned only "Japan" is still a better
// hero for a Tokyo trip than a bundled stand-in.
const WEAK_TOKENS = new Set([
  "city",
  "town",
  "village",
  "island",
  "islands",
  "north",
  "south",
  "east",
  "west",
  "region",
  "area",
  "coast",
  "state",
  "county",
  "province",
]);

function tokenize(destination) {
  return destination
    .toLowerCase()
    .split(/[^a-zÀ-ɏ]+/i)
    .filter((word) => word.length >= 4 && !WEAK_TOKENS.has(word));
}

// A result count is not evidence of a match: Pexels answers everything.
// "zzqqxyvv nowhereland" comes back with 347 photos of Ferris wheels and a
// "Neverland" sign, so trusting a non-empty response would put a funfair
// behind a trip to somewhere it couldn't identify.
//
// So a photo has to name the place to be used. Pexels' alt text is
// descriptive and usually does ("Stunning aerial view of Reykjavik..."), and
// the photo's own URL slug carries it too. Nothing matches, nothing is
// returned, and the caller keeps the themed image - which is generic but
// never wrong, the safe direction to fail in.
function pickPhoto(photos, destination) {
  if (!Array.isArray(photos) || photos.length === 0) return null;

  const usable = photos.filter((p) => p?.src?.large2x && p.width && p.height);
  if (usable.length === 0) return null;

  const tokens = tokenize(destination);
  if (tokens.length === 0) return null;

  const names = (photo) => {
    const haystack = `${photo.alt ?? ""} ${photo.url ?? ""}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  };

  const relevant = usable.filter(names);
  if (relevant.length === 0) return null;

  // Widest first among what's left. The hero is a short, full-bleed band, so
  // a squarer frame loses most of its subject to the crop.
  const wide = relevant.filter((p) => p.width / p.height >= 1.5);
  return (wide.length > 0 ? wide : relevant)[0];
}
