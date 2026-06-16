import { useState, useCallback } from 'react';
import { classifyAppError } from '../lib/errors';

/**
 * Owns the app's request-error surface: the full-screen `error`/`errorInfo`
 * pair plus the transient `offlineBanner`. `handleRequestError` classifies a
 * thrown error and routes it to either the full-screen view or a toast.
 *
 * @param {{ showToast: (message: string, options?: object) => void }} deps
 */
export function useRequestError({ showToast }) {
  const [error, setError] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [offlineBanner, setOfflineBanner] = useState(null);

  const handleRequestError = useCallback(
    (err, fallbackMessage, options = {}) => {
      const classified = classifyAppError(err);
      const message =
        classified.message || fallbackMessage || 'Something went wrong. Please try again.';
      if (classified.severity === 'offline') {
        setOfflineBanner({
          message: "You're offline. Some features may be unavailable.",
          title: 'Offline',
        });
      }
      if (options.fullScreen) {
        setError(message);
        setErrorInfo(classified);
      } else {
        showToast(message, {
          title: classified.title,
          icon:
            classified.severity === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline',
        });
      }
      return classified;
    },
    [showToast],
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorInfo(null);
  }, []);

  return {
    error,
    errorInfo,
    setError,
    setErrorInfo,
    offlineBanner,
    setOfflineBanner,
    handleRequestError,
    clearError,
  };
}
