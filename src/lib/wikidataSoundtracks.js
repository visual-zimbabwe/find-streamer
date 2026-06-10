const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';

function isEntityUri(val) {
  return typeof val === 'string' && val.startsWith(ENTITY_URI_PREFIX);
}

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
          text = decodeURIComponent(uploadMatch[1].replace(/^(\d+px-)?/i, '').replace(/\.png$/i, ''));
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

  const titles = Array.from(filenames).map((name) => `File:${name}`).join('|');
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
  return thumbMap.get(clean.replace(/ /g, '_'))
    || thumbMap.get(clean)
    || thumbMap.get(clean.replace(/_/g, ' '))
    || null;
}

export function sortSoundtracks(soundtracks) {
  return [...soundtracks].sort((a, b) => {
    const yearA = a.year ?? Number.POSITIVE_INFINITY;
    const yearB = b.year ?? Number.POSITIVE_INFINITY;
    if (yearA !== yearB) return yearA - yearB;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

/**
 * Extract playable soundtracks (with Spotify album IDs) from Wikidata SPARQL bindings.
 * Dedupes by wikidataId and sorts by year, then title.
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

    const title = binding.soundtrackLabel?.value;
    if (!title || isEntityUri(title)) continue;

    map.set(wikidataId, {
      wikidataId,
      title,
      year: yearFromWikidataDate(binding.releaseDate?.value),
      coverUrl: commonsCoverUrl(binding.cover?.value),
      spotifyAlbumId,
    });
  }

  return sortSoundtracks(Array.from(map.values()));
}
