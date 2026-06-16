/**
 * StackBottomSheet — Trova's custom implementation of the expo-stack-bottom-sheet pattern.
 *
 * Programme design system: theme-aware glass surfaces, gold hairlines, editorial
 * eyebrow + title headers, restrained timing-based motion (no spring bounce).
 *
 * Architecture mirrors rit3zh/expo-stack-bottom-sheet:
 *   - BottomSheetProvider  — React context that owns the sheet stack
 *   - useBottomSheet()     — hook to show / dismiss sheets
 *   - BottomSheetPortal    — drop-in <View> that renders the sheet stack on top of everything
 *
 * Usage:
 *   // In App.js, wrap everything with <BottomSheetProvider>
 *   // At the bottom of App.js root view add <BottomSheetPortal />
 *
 *   // Anywhere:
 *   const { show, dismiss, dismissAll } = useBottomSheet();
 *   const id = show(<MyContent />, {
 *     eyebrow: 'CAST',
 *     title: 'Actor Name',
 *     subtitle: 'Filmography',
 *     size: 'medium',
 *   });
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';

const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';

const SIZE_HEIGHT_RATIO = {
  small: 0.38,
  medium: 0.55,
  large: 0.72,
  full: 0.88,
};

const STACK_OFFSET = 14;
const SHEET_SIDE_GUTTER = 0;
const CONTENT_BOTTOM_GAP = scale(20);
const H_PAD = scale(22);

const ENTRANCE_MS = 320;
const EXIT_MS = 300;
const STACK_MS = 280;

const EASE_OUT = Easing.out(Easing.cubic);

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
    setSheets((prev) => [
      ...prev,
      {
        id,
        content: typeof content === 'function' ? content(id) : content,
        options: {
          size: 'medium',
          title: '',
          eyebrow: '',
          subtitle: '',
          showCloseButton: true,
          dismissOnBackdrop: true,
          scrollable: false,
          ...options,
        },
      },
    ]);
    return id;
  }, []);

  const update = useCallback((id, content) => {
    setSheets((prev) => {
      let found = false;
      const next = prev.map((sheet) => {
        if (sheet.id !== id) return sheet;
        found = true;
        return { ...sheet, content };
      });
      return found ? next : prev;
    });
  }, []);

  const dismiss = useCallback((id) => {
    setSheets((prev) => prev.filter((s) => s.id !== id));
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
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 12);

  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const sheetSurface = useMemo(
    () => (resolvedMode === 'dark' ? 'rgba(12, 12, 14, 0.96)' : 'rgba(247, 247, 242, 0.96)'),
    [resolvedMode],
  );

  const size = sheet.options.size || 'medium';
  const heightRatio = SIZE_HEIGHT_RATIO[size] || SIZE_HEIGHT_RATIO.medium;
  const topClearance = Math.max(insets.top + 12, size === 'full' ? 24 : 48);
  const sheetHeight = Math.min(
    windowHeight - topClearance,
    Math.round(windowHeight * heightRatio) + bottomInset,
  );

  const getTargetY = (depth = index) => -Math.min(depth * STACK_OFFSET, STACK_OFFSET * 3);

  useEffect(() => {
    const delay = index * 60;
    const timer = setTimeout(() => {
      if (index === 0 && backdropOpacity) {
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ENTRANCE_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }).start();
      }
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ENTRANCE_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: getTargetY(),
          duration: ENTRANCE_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevIndex = useRef(index);
  useEffect(() => {
    if (prevIndex.current !== index) {
      Animated.timing(translateY, {
        toValue: getTargetY(),
        duration: STACK_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }).start();
      prevIndex.current = index;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, windowHeight, sheetHeight, bottomInset]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: getTargetY(),
      duration: STACK_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowHeight, sheetHeight, bottomInset]);

  const dismissWithAnimation = useCallback(() => {
    const isTop = index === 0;
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: EXIT_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: windowHeight + sheetHeight,
        duration: ENTRANCE_MS + 40,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      ...(isTop && totalSheets === 1 && backdropOpacity
        ? [
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: EXIT_MS,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]).start(() => {
      onDismiss(sheet.id);
      sheet.options.onClose?.();
    });
  }, [
    index,
    totalSheets,
    sheet,
    backdropOpacity,
    onDismiss,
    opacityAnim,
    translateY,
    windowHeight,
    sheetHeight,
  ]);

  const gestureStartY = useRef(0);
  const pan = useRef(
    PanResponder.create({
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
          Animated.timing(translateY, {
            toValue: getTargetY(),
            duration: 240,
            easing: EASE_OUT,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const animStyle = {
    opacity: opacityAnim,
    transform: [{ translateY }],
    zIndex: 2000 - index,
  };

  const isScrollable = sheet.options.scrollable === true;
  const { eyebrow, title, subtitle, showCloseButton } = sheet.options;
  const showHeader = eyebrow || title || subtitle || showCloseButton !== false;

  return (
    <Animated.View
      style={[
        sheetStyles.sheet,
        animStyle,
        {
          height: sheetHeight,
          left: SHEET_SIDE_GUTTER,
          right: SHEET_SIDE_GUTTER,
          backgroundColor: sheetSurface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          borderColor: GOLD_DIM,
        },
      ]}
      {...pan.panHandlers}
    >
      <View style={sheetStyles.handleRow}>
        <View style={[sheetStyles.handle, { backgroundColor: GOLD_DIM }]} />
      </View>

      {showHeader && (
        <View style={[sheetStyles.header, { paddingHorizontal: H_PAD }]}>
          <View style={sheetStyles.headerTextBlock}>
            {!!eyebrow && (
              <Text
                style={[sheetStyles.eyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}
                numberOfLines={1}
              >
                {eyebrow}
              </Text>
            )}
            {!!title && (
              <Text
                style={[sheetStyles.title, { color: colors.onSurface, ...typography.titleLg }]}
                numberOfLines={2}
              >
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text
                style={[
                  sheetStyles.subtitle,
                  { color: colors.onSurfaceVariant, ...typography.bodyMd },
                ]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {showCloseButton !== false && (
            <TouchableOpacity
              onPress={dismissWithAnimation}
              style={[sheetStyles.closeBtn, { backgroundColor: colors.surfaceContainerHighest }]}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {showHeader && (
        <View
          style={[sheetStyles.headerRule, { backgroundColor: GOLD_DIM, marginHorizontal: H_PAD }]}
        />
      )}

      <View
        style={[
          sheetStyles.contentWrap,
          { paddingHorizontal: H_PAD, paddingBottom: bottomInset + CONTENT_BOTTOM_GAP },
        ]}
      >
        {isScrollable ? (
          <ScrollView
            style={sheetStyles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              sheetStyles.scrollContent,
              { paddingBottom: bottomInset + CONTENT_BOTTOM_GAP },
            ]}
          >
            {typeof sheet.content === 'string' ? (
              <Text
                style={[sheetStyles.text, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
              >
                {sheet.content}
              </Text>
            ) : (
              sheet.content
            )}
          </ScrollView>
        ) : typeof sheet.content === 'string' ? (
          <Text
            style={[sheetStyles.text, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          >
            {sheet.content}
          </Text>
        ) : (
          sheet.content
        )}
      </View>
    </Animated.View>
  );
}

// ─── Portal (renders all sheets + shared backdrop) ────────────────────────────
export function BottomSheetPortal() {
  const { sheets, dismiss } = useBottomSheet();
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sheets.length === 0) {
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [sheets.length, backdropOpacity]);

  if (sheets.length === 0) return null;

  const handleDismissTop = () => {
    if (sheets.length > 0) {
      dismiss(sheets[sheets.length - 1].id);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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

      {sheets.map((sheet, i) => (
        <Sheet
          key={sheet.id}
          sheet={sheet}
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
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    zIndex: 1999,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: scale(10),
    paddingBottom: scale(6),
    flexShrink: 0,
  },
  handle: {
    width: scale(40),
    height: 3,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(14),
    paddingTop: scale(4),
    paddingBottom: scale(14),
    flexShrink: 0,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(8),
    flexShrink: 0,
  },
  contentWrap: {
    flex: 1,
    minHeight: 0,
    paddingTop: scale(4),
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  text: {
    lineHeight: 22,
  },
});
