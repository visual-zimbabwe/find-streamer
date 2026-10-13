/**
 * Pure domain model helpers for Section Headers and Eyebrow Labels with Action Links.
 *
 * Decoupled from React Native runtime so this module can be tested in Node test runner.
 */

export const GOLD_ACCENT = '#D4A853';
export const GOLD_DIM = 'rgba(212,168,83,0.35)';

/**
 * Normalizes an eyebrow text and optional count.
 *
 * @param {object} params
 * @param {string} [params.eyebrow]
 * @param {number|string} [params.count]
 * @returns {{ displayEyebrow: string, countText: string|null, fullEyebrowText: string }}
 */
export function resolveSectionEyebrow({ eyebrow = '', count = null } = {}) {
  const cleanEyebrow = typeof eyebrow === 'string' ? eyebrow.trim() : '';
  const countText =
    count != null && count !== '' && !Number.isNaN(Number(count))
      ? String(count)
      : typeof count === 'string' && count.trim().length > 0
        ? count.trim()
        : null;

  const fullEyebrowText =
    cleanEyebrow && countText
      ? `${cleanEyebrow} · ${countText}`
      : cleanEyebrow || countText || '';

  return {
    displayEyebrow: cleanEyebrow,
    countText,
    fullEyebrowText,
  };
}

/**
 * Normalizes action link properties.
 *
 * @param {object} params
 * @param {string} [params.actionLabel]
 * @param {Function} [params.onAction]
 * @param {boolean} [params.actionDisabled]
 * @returns {{ hasAction: boolean, isClickable: boolean, actionLabel: string }}
 */
export function resolveSectionActionState({
  actionLabel = '',
  onAction = null,
  actionDisabled = false,
} = {}) {
  const cleanLabel =
    typeof actionLabel === 'string'
      ? actionLabel.trim()
      : actionLabel != null
        ? String(actionLabel)
        : '';

  const hasAction = Boolean(cleanLabel || onAction);
  const isClickable = Boolean(onAction && !actionDisabled);

  return {
    hasAction,
    isClickable,
    actionLabel: cleanLabel,
  };
}

/**
 * Formats an accessible screen-reader announcement for a header action link.
 *
 * @param {object} params
 * @param {string} [params.actionLabel]
 * @param {string} [params.actionAccessibilityLabel]
 * @param {string} [params.eyebrow]
 * @param {string} [params.title]
 * @param {number|string} [params.count]
 * @returns {string}
 */
export function formatSectionActionAccessibilityLabel({
  actionLabel = '',
  actionAccessibilityLabel = '',
  eyebrow = '',
  title = '',
  count = null,
} = {}) {
  if (actionAccessibilityLabel && typeof actionAccessibilityLabel === 'string') {
    return actionAccessibilityLabel.trim();
  }

  const cleanAction = typeof actionLabel === 'string' ? actionLabel.trim() : 'Action';
  const subject = title || eyebrow || '';
  const cleanSubject = typeof subject === 'string' ? subject.trim() : '';

  if (!cleanSubject) {
    return cleanAction;
  }

  const lowerAction = cleanAction.toLowerCase();
  const lowerSubject = cleanSubject.toLowerCase();

  // If the action label already incorporates the subject (e.g. "See All Cast"), avoid duplicate speech.
  if (lowerAction.includes(lowerSubject)) {
    return cleanAction;
  }

  if (count != null && !lowerAction.includes(String(count))) {
    return `${cleanAction} for ${cleanSubject} (${count})`;
  }

  return `${cleanAction} for ${cleanSubject}`;
}

/**
 * Formats accessibility state for header action links.
 *
 * @param {object} params
 * @param {boolean} [params.disabled]
 * @param {boolean} [params.busy]
 * @returns {object}
 */
export function formatSectionActionAccessibilityState({
  disabled = false,
  busy = false,
} = {}) {
  const state = {};
  if (disabled) state.disabled = true;
  if (busy) state.busy = true;
  return state;
}
