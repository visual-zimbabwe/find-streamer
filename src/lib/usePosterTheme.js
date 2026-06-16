/**
 * usePosterTheme
 *
 * Extracts a dominant color palette from a movie / TV-show poster and
 * derives a complete, contrast-safe UI palette that can be used to override
 * the global theme inside the ResultView detail screen.
 *
 * Returns `null` while the palette is loading / unavailable so callers can
 * gracefully fall back to the base theme colors.
 */

import { useState, useEffect, useRef } from 'react';
import { getColors } from 'react-native-image-colors';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse a CSS hex color (#rrggbb or #rgb) into { r, g, b }. */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

/** Relative luminance per WCAG 2.1 */
function luminance({ r, g, b }) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two luminance values. */
function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns '#ffffff' or '#000000' — whichever is more readable on `bgHex`. */
function bestTextColor(bgHex) {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#ffffff';
  const l = luminance(rgb);
  const onWhite = contrastRatio(1, l);
  const onBlack = contrastRatio(0, l);
  return onWhite >= onBlack ? '#ffffff' : '#000000';
}

/** Darken a hex color by `amount` (0–1). */
function darken(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - Math.max(0, Math.min(1, amount));
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Lighten a hex color by `amount` (0–1). */
function lighten(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.round(rgb.r + (255 - rgb.r) * amount);
  const g = Math.round(rgb.g + (255 - rgb.g) * amount);
  const b = Math.round(rgb.b + (255 - rgb.b) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Add alpha to a hex color — returns rgba string. */
function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/**
 * Given raw color results from react-native-image-colors, pick the best
 * "accent" color to use as the primary brand color for the detail screen.
 */
function pickAccent(colorResult) {
  if (!colorResult) return null;

  // Android returns: dominant, vibrant, darkVibrant, lightVibrant, muted, darkMuted, lightMuted
  // iOS returns: background, primary, secondary, detail
  // Web returns: vibrant, darkVibrant, lightVibrant, dominant, muted, darkMuted, lightMuted

  const candidates = [
    colorResult.vibrant,
    colorResult.lightVibrant,
    colorResult.dominant,
    colorResult.primary, // iOS
    colorResult.muted,
    colorResult.darkVibrant,
  ].filter(Boolean);

  // Prefer vivid colors (higher saturation proxy: large max-min channel diff)
  const scored = candidates.map((hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return { hex, score: 0 };
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const lum = luminance(rgb);
    // Prefer mid-luminance vivid colors (not too dark, not too light)
    const vividness = (max - min) / 255;
    const luminancePenalty = Math.abs(lum - 0.35); // ideal ≈ 0.35
    return { hex, score: vividness - luminancePenalty };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.hex || null;
}

function pickMeshColors(accentHex, colorResult) {
  const candidates = [
    accentHex,
    colorResult?.vibrant,
    colorResult?.lightVibrant,
    colorResult?.muted,
    colorResult?.darkVibrant,
    colorResult?.lightMuted,
    colorResult?.secondary,
    colorResult?.detail,
  ].filter(Boolean);

  const unique = [];
  candidates.forEach((hex) => {
    if (!unique.includes(hex)) unique.push(hex);
  });

  const fallback = [accentHex, lighten(accentHex, 0.18), darken(accentHex, 0.36), '#111827'];

  return [...unique, ...fallback].slice(0, 4);
}

/**
 * Build the full posterTheme palette from an accent hex color.
 * Always targets dark-mode UI (the detail hero is dark-overlaid).
 */
function buildPalette(accentHex, colorResult) {
  if (!accentHex) return null;

  // Use the darkMuted / dominant as the background base
  const baseDark =
    colorResult?.darkMuted ||
    colorResult?.background || // iOS
    colorResult?.darkVibrant ||
    darken(accentHex, 0.7);

  const bg = darken(baseDark, 0.25); // very dark
  const surface = darken(baseDark, 0.1); // slightly lighter
  const surfaceHigh = lighten(baseDark, 0.05);

  // Ensure the accent passes 3:1 against the bg (relaxed, hero is behind imagery)
  let primary = accentHex;
  const bgRgb = hexToRgb(bg);
  const accentRgb = hexToRgb(primary);
  if (bgRgb && accentRgb) {
    let ratio = contrastRatio(luminance(bgRgb), luminance(accentRgb));
    let lightened = primary;
    let iterations = 0;
    while (ratio < 3 && iterations < 10) {
      lightened = lighten(lightened, 0.08);
      const lRgb = hexToRgb(lightened);
      ratio = lRgb ? contrastRatio(luminance(bgRgb), luminance(lRgb)) : ratio;
      iterations++;
    }
    primary = lightened;
  }

  const onPrimary = bestTextColor(primary);
  const onSurface = bestTextColor(bg) === '#ffffff' ? '#f1f3fc' : '#181b21';
  const onSurfaceVariant = withAlpha(onSurface, 0.6);
  const outlineVariant = withAlpha(onSurface, 0.15);
  const glass = withAlpha(bg, 0.85);
  const meshColors = pickMeshColors(primary, colorResult);

  return {
    background: bg,
    surface,
    surfaceContainerLow: surface,
    surfaceContainer: lighten(surface, 0.04),
    surfaceContainerHigh: surfaceHigh,
    surfaceContainerHighest: lighten(surfaceHigh, 0.06),
    primary,
    primaryDim: darken(primary, 0.1),
    primaryContainer: withAlpha(primary, 0.15),
    onPrimary,
    onSurface,
    onSurfaceVariant,
    outlineVariant,
    error: '#ff6e84',
    white: '#ffffff',
    black: '#000000',
    glass,
    meshColors,
    // Keep original accent for hero scrim reference
    _accentHex: accentHex,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

const cache = new Map(); // simple in-process palette cache keyed by URL

export function usePosterTheme(posterUrl) {
  const [palette, setPalette] = useState(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!posterUrl) {
      setPalette(null);
      return;
    }

    // Cache hit
    if (cache.has(posterUrl)) {
      setPalette(cache.get(posterUrl));
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setPalette(null);

    (async () => {
      try {
        const result = await getColors(posterUrl, {
          fallback: '#1a1a2e',
          cache: true,
          key: posterUrl,
          quality: 'low', // faster on Android
          pixelSpacing: 5,
        });

        if (abortRef.current) return;

        const accent = pickAccent(result);
        const built = buildPalette(accent, result);

        if (built) {
          cache.set(posterUrl, built);
          setPalette(built);
        }
      } catch {
        // Silently fall back to base theme
      } finally {
        if (!abortRef.current) setLoading(false);
      }
    })();

    return () => {
      abortRef.current = true;
    };
  }, [posterUrl]);

  return { palette, loading };
}
