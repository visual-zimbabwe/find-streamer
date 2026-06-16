import { useCallback } from 'react';
import { toastiva } from 'toastiva';

/**
 * Thin wrapper around toastiva that maps the app's icon vocabulary onto the
 * appropriate toast severity. Returns a stable `showToast(message, options)`.
 */
export function useToast() {
  const showToast = useCallback((message, options = {}) => {
    const icon = options.icon || 'alert-circle-outline';
    const opts = { description: options.title };
    if (
      icon === 'trash-outline' ||
      icon === 'checkmark-circle-outline' ||
      icon === 'bookmark-outline'
    ) {
      toastiva.success(message, opts);
    } else if (icon === 'alert-circle-outline') {
      toastiva.error(message, opts);
    } else if (icon === 'mic-off-outline') {
      toastiva.warning(message, opts);
    } else {
      toastiva.info(message, opts);
    }
  }, []);

  return { showToast };
}
