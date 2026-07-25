const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';

function isEntityUri(val) {
  return typeof val === 'string' && val.startsWith(ENTITY_URI_PREFIX);
}

/**
 * Wikidata's label service returns a bare QID ("Q123137009") when an entity has
 * no label in the requested languages — not an entity URI, so the URI guard
 * misses it and a database key reaches the UI as if it were a name.
 */
export function isBareQid(value) {
  return /^Q\d+$/.test(String(value ?? '').trim());
}

/**
 * A label the service failed to resolve — entity URI or bare QID — is not a
 * name. Returns null so callers decide whether to drop the row or label it.
 */
export function labelOrNull(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text || isEntityUri(text) || isBareQid(text)) return null;
  return text;
}

/** Shown for a release Wikidata can play but cannot name. */
export const UNTITLED_RELEASE = 'Untitled release';

export function yearFromWikidataDate(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^\+?(-?\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/** Normalize a Wikidata media value (filename or Commons URL) to a bare filename. */
export function commonsFilenameFromValue(value) {
  if (!value) return null;

  let text = String(value).trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    const thumbMatch = text.match(/\/thumb\/[^/]+\/[^/]+\/([^/]+)\/\d+px-/i);
    if (thumbMatch) {
      text = decodeURIComponent(thumbMatch[1].replace(/_/g, ' '));
    } else {
      const filePathMatch = text.match(/Special:FilePath\/([^?#]+)/i);
      if (filePathMatch) {
        text = decodeURIComponent(filePathMatch[1].replace(/_/g, ' '));
      } else {
        const uploadMatch = text.match(/\/([^/?#]+\.(?:svg|png|jpe?g|webp|gif))(?:$|[?#])/i);
        if (uploadMatch) {
          text = decodeURIComponent(
            uploadMatch[1].replace(/^(\d+px-)?/i, '').replace(/\.png$/i, ''),
          );
        }
      }
    }
  }

  return text.replace(/^File:/i, '').trim() || null;
}

const COMMONS_USER_AGENT = 'Trova/1.0 (juwimana.database@gmail.com)';

/** Build a stable Commons image URL from a Wikidata P18/P154 filename or Commons URL. */
export function commonsCoverUrl(filename) {
  const clean = commonsFilenameFromValue(filename);
  if (!clean) return null;

  const encoded = encodeURIComponent(clean.replace(/ /g, '_'));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}`;
}

/** Resolve Wikidata media values to direct upload.wikimedia.org thumbnail URLs. */
export async function resolveCommonsThumbUrls(values, width = 250) {
  const filenames = new Set();
  for (const value of values) {
    const clean = commonsFilenameFromValue(value);
    if (clean) filenames.add(clean.replace(/ /g, '_'));
  }

  if (filenames.size === 0) return new Map();

  const titles = Array.from(filenames)
    .map((name) => `File:${name}`)
    .join('|');
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&iiurlwidth=${width}&format=json`;

  try {
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': COMMONS_USER_AGENT },
    });
    if (!response.ok) return new Map();

    const json = await response.json();
    const out = new Map();

    for (const page of Object.values(json.query?.pages || {})) {
      if (page.missing != null) continue;
      const imageinfo = page.imageinfo?.[0];
      const thumburl = imageinfo?.thumburl || imageinfo?.url;
      const title = page.title?.replace(/^File:/i, '');
      if (!thumburl || !title) continue;
      out.set(title, thumburl);
      out.set(title.replace(/_/g, ' '), thumburl);
      out.set(title.replace(/ /g, '_'), thumburl);
    }

    return out;
  } catch {
    return new Map();
  }
}

export function lookupCommonsThumb(value, thumbMap) {
  if (!thumbMap || !value) return null;
  const clean = commonsFilenameFromValue(value);
  if (!clean) return null;
  return (
    thumbMap.get(clean.replace(/ /g, '_')) ||
    thumbMap.get(clean) ||
    thumbMap.get(clean.replace(/_/g, ' ')) ||
    null
  );
}

export function sortSoundtracks(soundtracks) {
  return [...soundtracks].sort((a, b) => {
    const yearA = a.year ?? Number.POSITIVE_INFINITY;
    const yearB = b.year ?? Number.POSITIVE_INFINITY;
    if (yearA !== yearB) return yearA - yearB;
    // Unnamed releases sort last so a named album always leads the sheet.
    if (!a.title || !b.title) return (a.title ? 0 : 1) - (b.title ? 0 : 1);
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

const LEADING_SEPARATORS = /^[\s:|/\-–—]+/;

/**
 * Drop the film's own name from the front of an album title. Inside the film's
 * detail screen it is pure redundancy, and it buries the part that actually
 * tells two releases apart ("Frankenweenie Unleashed! – Music Inspired by…"
 * and "Frankenweenie – Original Motion Picture Soundtrack" differ only after
 * the shared prefix). When nothing survives the strip — an album named exactly
 * after its film — the full name is kept.
 */
export function stripLeadingTitle(albumTitle, filmTitle) {
  const album = String(albumTitle || '').trim();
  const film = String(filmTitle || '').trim();
  if (!album || !film) return album;

  if (album.toLowerCase().startsWith(film.toLowerCase())) {
    const rest = album.slice(film.length).replace(LEADING_SEPARATORS, '').trim();
    if (rest) return rest;
  }

  return album;
}

/**
 * Presentation rows for the picker sheet: a name that leads with the
 * distinguishing part, and a year shown only when it distinguishes anything.
 * Most multi-release sheets share one release year across every row, where the
 * year is noise dressed as metadata.
 *
 * Titles run through labelOrNull again here rather than trusting the parser:
 * watchlist entries enriched before the QID guard landed still carry a bare
 * QID in storage, and they reach this function without being re-parsed.
 */
export function buildSoundtrackRows(soundtracks, filmTitle) {
  const list = Array.isArray(soundtracks) ? soundtracks : [];
  const years = new Set(list.map((item) => item.year ?? null));
  const yearIsUniform = list.length > 1 && years.size === 1;

  return list.map((item) => {
    const name = labelOrNull(item.title);
    return {
      ...item,
      displayTitle: name ? stripLeadingTitle(name, filmTitle) : UNTITLED_RELEASE,
      showYear: Boolean(item.year) && !yearIsUniform,
    };
  });
}

/**
 * Extract playable soundtracks (with Spotify album IDs) from Wikidata SPARQL bindings.
 * Dedupes by wikidataId and sorts by year, then title.
 *
 * A release Wikidata can play but cannot name keeps its place with `title: null`
 * — the Spotify id is what makes it useful, and dropping it would cost roughly
 * one in six titles their soundtrack over a missing label.
 */
export function parseSoundtracksFromBindings(bindings, wikidataIdFromUri) {
  const map = new Map();

  for (const binding of bindings) {
    const soundtrackUri = binding.soundtrack?.value;
    if (!isEntityUri(soundtrackUri)) continue;

    const wikidataId = wikidataIdFromUri(soundtrackUri);
    if (!wikidataId || map.has(wikidataId)) continue;

    const spotifyAlbumId = binding.spotifyAlbumId?.value?.trim();
    if (!spotifyAlbumId) continue;

    const coverValue = binding.cover?.value || null;

    map.set(wikidataId, {
      wikidataId,
      title: labelOrNull(binding.soundtrackLabel?.value),
      year: yearFromWikidataDate(binding.releaseDate?.value),
      coverValue,
      coverUrl: commonsCoverUrl(coverValue),
      spotifyAlbumId,
    });
  }

  return sortSoundtracks(Array.from(map.values()));
}

/**
 * Swap the full-resolution Commons originals `commonsCoverUrl` produces for
 * 250px thumbnails, the way the awards path already does. Almost no release
 * carries cover art at all, so this is usually a no-op that costs no request —
 * `resolveCommonsThumbUrls` returns early on an empty filename set.
 */
export async function resolveSoundtrackCovers(soundtracks) {
  const list = Array.isArray(soundtracks) ? soundtracks : [];
  const coverValues = list.map((item) => item.coverValue).filter(Boolean);
  if (coverValues.length === 0) return list;

  const thumbMap = await resolveCommonsThumbUrls(coverValues);

  return list.map((item) =>
    item.coverValue
      ? { ...item, coverUrl: lookupCommonsThumb(item.coverValue, thumbMap) || item.coverUrl }
      : item,
  );
}
