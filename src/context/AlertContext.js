import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AlertContext = createContext(null);

let globalAlertDispatcher = null;

export function registerAlertDispatcher(dispatcher) {
  globalAlertDispatcher = dispatcher;
  return () => {
    if (globalAlertDispatcher === dispatcher) {
      globalAlertDispatcher = null;
    }
  };
}

/**
 * Imperative global alert API with the same signature as React Native's Alert.alert.
 *
 * @param {string} title
 * @param {string} [message]
 * @param {Array<{ text: string, onPress?: () => void, style?: 'default' | 'cancel' | 'destructive' }>} [buttons]
 * @param {object} [options]
 */
export function trovaAlert(title, message, buttons, options = {}) {
  if (globalAlertDispatcher) {
    globalAlertDispatcher({ title, message, buttons, options });
  } else {
    // Fallback if provider is not yet mounted
    const { Alert } = require('react-native');
    Alert.alert(title, message, buttons, options);
  }
}

export function AlertProvider({ children }) {
  const [currentAlert, setCurrentAlert] = useState(null);

  const dismissAlert = useCallback(() => {
    setCurrentAlert((prev) => (prev ? { ...prev, visible: false } : null));
  }, []);

  const dispatchAlert = useCallback(
    ({ title, message, buttons, options = {} }) => {
      const normalizedButtons =
        buttons && buttons.length > 0
          ? buttons
          : [{ text: 'OK', style: 'default' }];

      setCurrentAlert({
        id: Date.now().toString(),
        visible: true,
        title,
        message,
        buttons: normalizedButtons,
        options,
      });
    },
    [],
  );

  useEffect(() => {
    return registerAlertDispatcher(dispatchAlert);
  }, [dispatchAlert]);

  return React.createElement(
    AlertContext.Provider,
    { value: { currentAlert, dismissAlert, dispatchAlert } },
    children,
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return {
    ...ctx,
    showAlert: (title, message, buttons, options) =>
      ctx.dispatchAlert({ title, message, buttons, options }),
  };
}
