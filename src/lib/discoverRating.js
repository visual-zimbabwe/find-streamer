export const RATING_VALIDATION_MESSAGE =
  'Rating must be between 0 and 10 with at most one decimal place, and the minimum cannot exceed the maximum.';

/** Strip non-numeric characters; allow at most one decimal digit. */
export function sanitizeRatingInput(raw) {
  if (raw == null || raw === '') return '';
  const cleaned = String(raw).replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex === -1) return cleaned;

  const intPart = cleaned.slice(0, dotIndex);
  const decPart = cleaned
    .slice(dotIndex + 1)
    .replace(/\./g, '')
    .slice(0, 1);
  if (decPart.length === 0) return `${intPart}.`;
  return `${intPart}.${decPart}`;
}

/**
 * Parse a rating field for API use. Returns null when empty or zero-equivalent.
 * Returns NaN when the value is invalid.
 */
export function normalizeAppliedRating(value) {
  if (value == null || String(value).trim() === '') return null;

  let s = String(value).trim();
  if (s.endsWith('.')) s = `${s}0`;
  if (s === '0' || s === '0.0') return null;
  if (!/^\d+(\.\d)?$/.test(s)) return NaN;

  const parsed = parseFloat(s);
  if (isNaN(parsed) || parsed < 0 || parsed > 10) return NaN;
  return parsed;
}

export function validateRatingRange(minRating, maxRating) {
  const min = normalizeAppliedRating(minRating);
  const max = normalizeAppliedRating(maxRating);

  if (Number.isNaN(min) || Number.isNaN(max)) return RATING_VALIDATION_MESSAGE;
  if (min != null && max != null && min > max) return RATING_VALIDATION_MESSAGE;
  return null;
}
