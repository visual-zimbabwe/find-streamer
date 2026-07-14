/**
 * Workaround for Android under-measuring custom-font text (Inter/Manrope, PR #60).
 *
 * RN-Android measures a <Text>'s intrinsic width a little narrower than it
 * paints — the shortfall grows with glyph count (roughly half a pixel each), so
 * the final glyph is dropped: "VOICE" renders as "VOIC". The text is clipped to
 * its Layout width, which Yoga takes from that short measurement, so trailing
 * `padding` does not help (it is added outside the Layout) and the effect is
 * independent of `letterSpacing` and `fontWeight` — all three were ruled out on
 * a release build on device.
 *
 * The durable fix is to give the label a definite width (`alignSelf:'stretch'`
 * for block labels, `flex:1` for a label inside a wide row). Use this helper
 * only for labels inside a container that must hug its content — a pill or chip
 * — where no width can be imposed. Padding with a non-breaking space on both
 * sides inflates the measured width while keeping the glyphs visually centred;
 * a regular space cannot be used because Android trims trailing whitespace.
 */
const NBSP = ' ';

export function hugLabel(text) {
  if (text == null || text === '') return text;
  return `${NBSP}${text}${NBSP}`;
}
