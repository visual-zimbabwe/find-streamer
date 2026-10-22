import { useCallback } from 'react';
import { trovaToast } from '../context/ToastContext';

/**
 * Maps the app's icon and severity vocabulary onto Trova's spring capsule toast system.
 * Returns a stable `showToast(message, options)`.
 */
export function useToast() {
  const showToast = useCallback((message, options = {}) => {
    const icon = options.icon || 'alert-circle-outline';
    const opts = { title: options.title, icon, haptic: options.haptic };

    if (
      icon === 'trash-outline' ||
      icon === 'checkmark-circle-outline' ||
      icon === 'bookmark-outline'
    ) {
      trovaToast.success(message, opts);
    } else if (icon === 'alert-circle-outline') {
      trovaToast.error(message, opts);
    } else if (icon === 'mic-off-outline' || icon === 'warning-outline') {
      trovaToast.warning(message, opts);
    } else {
      trovaToast.info(message, opts);
    }
  }, []);

  return { showToast };
}

export { trovaToast };
