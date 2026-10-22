import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(null);

let globalToastDispatcher = null;

export function registerToastDispatcher(dispatcher) {
  globalToastDispatcher = dispatcher;
  return () => {
    if (globalToastDispatcher === dispatcher) {
      globalToastDispatcher = null;
    }
  };
}

/**
 * Imperative global toast API callable from anywhere (components, hooks, or vanilla utilities).
 */
export const trovaToast = {
  show(message, options = {}) {
    if (globalToastDispatcher) {
      globalToastDispatcher({ message, ...options });
    }
  },
  success(message, options = {}) {
    this.show(message, { type: 'success', icon: 'checkmark-circle-outline', ...options });
  },
  error(message, options = {}) {
    this.show(message, { type: 'error', icon: 'alert-circle-outline', ...options });
  },
  warning(message, options = {}) {
    this.show(message, { type: 'warning', icon: 'warning-outline', ...options });
  },
  info(message, options = {}) {
    this.show(message, { type: 'info', icon: 'information-circle-outline', ...options });
  },
  dismiss() {
    if (globalToastDispatcher) {
      globalToastDispatcher(null);
    }
  },
};

export function ToastProvider({ children }) {
  const [currentToast, setCurrentToast] = useState(null);
  const timeoutRef = useRef(null);

  const dismissToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCurrentToast((prev) => (prev ? { ...prev, visible: false } : null));
  }, []);

  const dispatchToast = useCallback(
    (toastData) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!toastData) {
        dismissToast();
        return;
      }

      const id = Date.now().toString();
      const type = toastData.type || 'info';
      const duration = toastData.duration || 3200;

      setCurrentToast({
        id,
        visible: true,
        message: typeof toastData === 'string' ? toastData : toastData.message,
        title: toastData.title || toastData.description,
        type,
        icon: toastData.icon,
        duration,
        haptic: toastData.haptic,
      });

      timeoutRef.current = setTimeout(() => {
        dismissToast();
      }, duration);
    },
    [dismissToast],
  );

  useEffect(() => {
    return registerToastDispatcher(dispatchToast);
  }, [dispatchToast]);

  return React.createElement(
    ToastContext.Provider,
    { value: { currentToast, dismissToast, dispatchToast } },
    children,
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return ctx;
}
