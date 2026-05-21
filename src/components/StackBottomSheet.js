/**
 * StackBottomSheet — Trova's custom implementation of the expo-stack-bottom-sheet pattern.
 *
 * Architecture mirrors rit3zh/expo-stack-bottom-sheet:
 *   - BottomSheetProvider  — React context that owns the sheet stack
 *   - useBottomSheet()     — hook to show / dismiss sheets
 *   - BottomSheetPortal    — drop-in <View> that renders the sheet stack on top of everything
 *
 * No extra native deps: uses react-native-reanimated + Animated (already installed).
 *
 * Usage:
 *   // In App.js, wrap everything with <BottomSheetProvider>
 *   // At the bottom of App.js root view add <BottomSheetPortal />
 *
 *   // Anywhere:
 *   const { show, dismiss, dismissAll } = useBottomSheet();
 *   const id = show(<MyContent />, { title: 'Actor', size: 'medium' });
 */

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Easing, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREEN_HEIGHT = Dimensions.get('window').height;

const SIZE_POSITION = {
  small: SCREEN_HEIGHT * 0.62,
  medium: SCREEN_HEIGHT * 0.45,
  large: SCREEN_HEIGHT * 0.18,
  full: SCREEN_HEIGHT * 0.05,
};
const SIZE_HEIGHT = {
  small: SCREEN_HEIGHT * 0.38,
  medium: SCREEN_HEIGHT * 0.55,
  large: SCREEN_HEIGHT * 0.72,
  full: SCREEN_HEIGHT * 0.88,
};

const STACK_OFFSET = 20;   // px each stacked sheet shifts up
const STACK_SCALE  = 0.085; // scale reduction per depth level

// ─── Context ──────────────────────────────────────────────────────────────────
const BottomSheetCtx = createContext(undefined);

export function useBottomSheet() {
  const ctx = useContext(BottomSheetCtx);
  if (!ctx) throw new Error('useBottomSheet must be used inside <BottomSheetProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function BottomSheetProvider({ children }) {
  const [sheets, setSheets] = useState([]);

  const show = useCallback((content, options = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    setSheets(prev => [...prev, {
      id,
      content: typeof content === 'function' ? content(id) : content,
      options: {
        size: 'medium',
        title: '',
        showCloseButton: true,
        dismissOnBackdrop: true,
        scrollable: false,
        ...options,
      },
    }]);
    return id;
  }, []);

  const update = useCallback((id, content) => {
    setSheets(prev => {
      let found = false;
      const next = prev.map(sheet => {
        if (sheet.id !== id) return sheet;
        found = true;
        return { ...sheet, content };
      });
      return found ? next : prev;
    });
  }, []);

  const dismiss = useCallback((id) => {
    // Actual removal is triggered by the sheet's own animation callback
    setSheets(prev => prev.filter(s => s.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setSheets([]);
  }, []);

  return (
    <BottomSheetCtx.Provider value={{ sheets, show, update, dismiss, dismissAll }}>
      {children}
    </BottomSheetCtx.Provider>
  );
}

// ─── Individual Sheet ─────────────────────────────────────────────────────────
function Sheet({ sheet, index, totalSheets, backdropOpacity, onDismiss }) {
  const translateY  = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim   = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const size = sheet.options.size || 'medium';
  const sheetHeight = SIZE_HEIGHT[size] || SIZE_HEIGHT.medium;

  const getTargetY = (depth = index) => {
    const base = SIZE_POSITION[size] || SIZE_POSITION.medium;
    return base - Math.min(depth * STACK_OFFSET, STACK_OFFSET * 3);
  };

  const getTargetScale = (depth = index) =>
    Math.max(1 - depth * STACK_SCALE, 0.7);

  // Entrance animation (staggered)
  useEffect(() => {
    const delay = index * 70;
    const timer = setTimeout(() => {
      if (index === 0 && backdropOpacity) {
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 320, useNativeDriver: true,
        }).start();
      }
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(translateY, { toValue: getTargetY(), damping: 28, stiffness: 220, mass: 0.8, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: getTargetScale(), damping: 28, stiffness: 220, mass: 0.8, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-stack when a new sheet is pushed on top
  const prevIndex = useRef(index);
  useEffect(() => {
    if (prevIndex.current !== index) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: getTargetY(), damping: 30, stiffness: 250, mass: 0.6, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: getTargetScale(), damping: 30, stiffness: 250, mass: 0.6, useNativeDriver: true }),
      ]).start();
      prevIndex.current = index;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const dismissWithAnimation = useCallback(() => {
    const isTop = index === 0;
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT + 60, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ...(isTop && totalSheets === 1 && backdropOpacity ? [
        Animated.timing(backdropOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ] : []),
    ]).start(() => {
      onDismiss(sheet.id);
      sheet.options.onClose?.();
    });
  }, [index, totalSheets, sheet, backdropOpacity, onDismiss, opacityAnim, translateY, scaleAnim]);

  // Gesture drag-to-dismiss (top sheet only)
  const gestureStartY = useRef(0);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      index === 0 && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderGrant: () => {
      gestureStartY.current = getTargetY();
    },
    onPanResponderMove: (_, g) => {
      if (index !== 0 || g.dy <= 0) return;
      translateY.setValue(gestureStartY.current + g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (index !== 0) return;
      if (g.dy > 100 || g.vy > 1.2) {
        dismissWithAnimation();
      } else {
        Animated.spring(translateY, {
          toValue: getTargetY(), damping: 25, stiffness: 400, mass: 0.6, useNativeDriver: true,
        }).start();
      }
    },
  })).current;

  const animStyle = {
    opacity: opacityAnim,
    transform: [{ translateY }, { scale: scaleAnim }],
    zIndex: 2000 - index,
  };

  const isScrollable = size === 'large' || size === 'full' || sheet.options.scrollable;

  return (
    <Animated.View style={[sheetStyles.sheet, animStyle, { height: sheetHeight }]} {...pan.panHandlers}>
      {/* Handle */}
      <View style={sheetStyles.handle} />

      {/* Header */}
      {(sheet.options.title || sheet.options.showCloseButton) && (
        <View style={sheetStyles.header}>
          <Text style={sheetStyles.title} numberOfLines={1}>
            {sheet.options.title || ''}
          </Text>
          {sheet.options.showCloseButton !== false && (
            <TouchableOpacity
              onPress={dismissWithAnimation}
              style={sheetStyles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      <View style={sheetStyles.contentWrap}>
        {isScrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {typeof sheet.content === 'string'
              ? <Text style={sheetStyles.text}>{sheet.content}</Text>
              : sheet.content}
          </ScrollView>
        ) : (
          typeof sheet.content === 'string'
            ? <Text style={sheetStyles.text}>{sheet.content}</Text>
            : sheet.content
        )}
      </View>
    </Animated.View>
  );
}

// ─── Portal (renders all sheets + shared backdrop) ────────────────────────────
export function BottomSheetPortal() {
  const { sheets, dismiss } = useBottomSheet();
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Keep backdrop in sync when all sheets close externally (e.g. dismissAll)
  useEffect(() => {
    if (sheets.length === 0) {
      Animated.timing(backdropOpacity, {
        toValue: 0, duration: 280, useNativeDriver: true,
      }).start();
    }
  }, [sheets.length, backdropOpacity]);

  if (sheets.length === 0) return null;

  const handleDismissTop = () => {
    if (sheets.length > 0) {
      // Trigger dismiss for the topmost (index 0 = front) sheet
      // The sheet handles its own animation; we remove it after
      dismiss(sheets[sheets.length - 1].id);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dimmed backdrop — tapping it dismisses the front sheet */}
      <Animated.View
        style={[sheetStyles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={sheets.length > 0 ? 'auto' : 'none'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            const top = sheets[sheets.length - 1];
            if (top?.options?.dismissOnBackdrop !== false) {
              handleDismissTop();
            }
          }}
        />
      </Animated.View>

      {/* Sheets rendered bottom-to-top; first item is deepest (lowest zIndex) */}
      {sheets.map((sheet, i) => (
        <Sheet
          key={sheet.id}
          sheet={sheet}
          // index 0 = frontmost sheet (receives gestures)
          // As new sheets are pushed, older sheets get a higher index = deeper stack
          index={sheets.length - 1 - i}
          totalSheets={sheets.length}
          backdropOpacity={i === 0 ? backdropOpacity : undefined}
          onDismiss={dismiss}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    zIndex: 1999,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  text: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
});
