/**
 * Presentation helpers for the detail screen's title metadata.
 *
 * Two jobs, both pulled out of ResultView so they can be unit-tested:
 *
 *  - `spokenRuntime` turns the compact "2h 28m" pill into something a screen
 *    reader says as words. The pills are decorative `View`s, so without an
 *    explicit label TalkBack reads the raw glyphs.
 *  - `buildTitleDetailRows` shapes the Wikidata origin fields into label/value
 *    rows. These used to be the last two pills in the hero's horizontal
 *    scroller, where measurement put the country pill fully off-screen on 58%
 *    of titles; down-page they get a full-width line each.
 */

/** "2h 28m" is fine to read but terrible to hear — say it in words instead. */
export function spokenRuntime(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return null;

  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

/** Non-empty, de-duplicated, order-preserving. Wikidata repeats values freely. */
function cleanList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Rows for the Details section. Returns [] when there's nothing to say, which
 * is the caller's signal to render no section at all rather than an empty one.
 */
export function buildTitleDetailRows(wikiData) {
  const languages = cleanList(wikiData?.languages);
  const countries = cleanList(wikiData?.countries);

  const rows = [];
  if (languages.length) {
    rows.push({
      key: 'language',
      label: languages.length === 1 ? 'Language' : 'Languages',
      value: languages.join(', '),
    });
  }
  if (countries.length) {
    rows.push({
      key: 'country',
      label: countries.length === 1 ? 'Country' : 'Countries',
      value: countries.join(', '),
    });
  }
  return rows;
}
