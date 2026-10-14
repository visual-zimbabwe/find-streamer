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
  Keyboard,
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
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { GlassIconButton } from './GlassIconButton';

const SIZE_HEIGHT_RATIO = {
  small: 0.40,
  medium: 0.62,
  large: 0.78,
  full: 0.90,
};

const STACK_OFFSET = 14;
const SHEET_SIDE_GUTTER = 0;
const CONTENT_BOTTOM_GAP = scale(20);
const H_PAD = scale(20);

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
          centerTitle: undefined,
          showCloseButton: undefined,
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
    Keyboard.dismiss();
    setSheets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    Keyboard.dismiss();
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
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const effectiveBottomInset = Math.max(
    insets.bottom || 0,
    Platform.OS === 'android' ? 48 : 24,
  );

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const animatedKeyboardHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      const kh = Math.round(e?.endCoordinates?.height || 0);
      setKeyboardHeight(kh);
      Animated.timing(animatedKeyboardHeight, {
        toValue: kh,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 200,
        easing: EASE_OUT,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e) => {
      setKeyboardHeight(0);
      Animated.timing(animatedKeyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 200) : 180,
        easing: EASE_OUT,
        useNativeDriver: false,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [animatedKeyboardHeight]);

  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const sheetSurface = colors.surfaceContainerHighest || '#1E1E22';

  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const size = sheet.options.size || 'medium';
  const isAuto = size === 'auto';
  const heightRatio = SIZE_HEIGHT_RATIO[size] || SIZE_HEIGHT_RATIO.medium;
  const topClearance = Math.max(insets.top + 12, size === 'full' ? 24 : 48);

  const calculatedHeight =
    isAuto && measuredContentHeight > 0
      ? Math.min(
          windowHeight - topClearance,
          Math.max(scale(220), measuredContentHeight + effectiveBottomInset + scale(24)),
        )
      : Math.min(
          windowHeight - topClearance,
          Math.round(windowHeight * heightRatio) + effectiveBottomInset,
        );

  const isKeyboardVisible = keyboardHeight > 0;
  const sheetHeight = isKeyboardVisible
    ? windowHeight - topClearance
    : calculatedHeight;

  const handleContentLayout = useCallback(
    (e) => {
      if (isAuto) {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && Math.abs(h - measuredContentHeight) > 6) {
          setMeasuredContentHeight(h);
        }
      }
    },
    [isAuto, measuredContentHeight],
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
      Animated.parallel(
        [
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
        ],
        // See the note on the exit group below: these two values are also driven
        // by the stack/resize effects and the drag gesture, so the group must not
        // be allowed to stop animations it did not start.
        { stopTogether: false },
      ).start();
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
  }, [index, windowHeight, sheetHeight, effectiveBottomInset]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: getTargetY(),
      duration: STACK_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowHeight, sheetHeight, effectiveBottomInset]);

  // The close button, the drag gesture and the backdrop can all ask for the same
  // dismissal. Without this latch a second request builds a second `parallel`
  // over the same values; starting its first child stops the first group's, and
  // that group's callback still fires — unmounting the sheet mid-slide and
  // detaching the values out from under the animation that replaced it.
  const isDismissing = useRef(false);

  const dismissWithAnimation = useCallback(() => {
    Keyboard.dismiss();
    if (isDismissing.current) return;
    isDismissing.current = true;

    const isTop = index === 0;
    Animated.parallel(
      [
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
      ],
      // `backdropOpacity` is shared with whichever sheet is on top, so another
      // sheet's entrance can stop this group's fade-out. Under the default
      // `stopTogether: true` that stop cascades into this sheet's own slide and
      // fade, ending the exit instantly. Each timing here is independent; let
      // them end on their own and only run the callback once all three have.
      { stopTogether: false },
    ).start(() => {
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
        index === 0 &&
        !isDismissing.current &&
        g.dy > 6 &&
        Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderGrant: () => {
        gestureStartY.current = getTargetY();
      },
      onPanResponderMove: (_, g) => {
        if (index !== 0 || g.dy <= 0) return;
        translateY.setValue(gestureStartY.current + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (index !== 0) return;
        if (g.dy > 70 || g.vy > 0.8) {
          dismissWithAnimation();
        } else {
          Animated.timing(translateY, {
            toValue: getTargetY(),
            duration: 220,
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
  const { eyebrow, title, subtitle } = sheet.options;
  const centerTitle =
    sheet.options.centerTitle ?? (!eyebrow && !subtitle && !!title);
  const showCloseButton =
    sheet.options.showCloseButton ?? !centerTitle;
  const showHeader = eyebrow || title || subtitle || showCloseButton;

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
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
        },
      ]}
      {...pan.panHandlers}
    >
      <View style={sheetStyles.handleRow}>
        <View style={sheetStyles.handle} />
      </View>

      {showHeader && centerTitle ? (
        <View style={sheetStyles.centeredHeaderWrap}>
          <Text
            style={[
              sheetStyles.centeredTitle,
              { color: colors.onSurface, ...typography.titleMedium, fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View
            style={[
              sheetStyles.headerRule,
              { backgroundColor: colors.outlineVariant + '33' },
            ]}
          />
        </View>
      ) : showHeader ? (
        <>
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
            {showCloseButton && (
              <GlassIconButton
                icon="close"
                size={36}
                iconSize={20}
                variant="surface"
                onPress={dismissWithAnimation}
                accessibilityLabel="Close sheet"
              />
            )}
          </View>
          <View
            style={[
              sheetStyles.headerRule,
              { backgroundColor: colors.outlineVariant + '33', marginHorizontal: H_PAD },
            ]}
          />
        </>
      ) : null}

      <Animated.View
        style={[
          sheetStyles.contentWrap,
          {
            paddingHorizontal: H_PAD,
            paddingBottom: isScrollable
              ? animatedKeyboardHeight
              : animatedKeyboardHeight.interpolate({
                  inputRange: [0, 1000],
                  outputRange: [effectiveBottomInset + CONTENT_BOTTOM_GAP, 1000 + scale(16)],
                }),
          },
        ]}
        onLayout={isAuto ? handleContentLayout : undefined}
      >
        {isScrollable ? (
          <ScrollView
            style={sheetStyles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              sheetStyles.scrollContent,
              {
                paddingBottom: isKeyboardVisible
                  ? scale(20)
                  : effectiveBottomInset + CONTENT_BOTTOM_GAP + scale(20),
              },
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
      </Animated.View>
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
            Keyboard.dismiss();
            const top = sheets[sheets.length - 1];
            if (top?.options?.dismissOnBackdrop !== false) {
              handleDismissTop();
            }
          }}
        />
      </Animated.View>

      {sheets.map((sheet, i) => {
        // `depth` is 0 for the sheet on top. Both the entrance fade-in and the
        // exit fade-out gate on `index === 0`, so the backdrop has to belong to
        // the same sheet those gates name — handing it to the bottom-most sheet
        // instead meant a sheet that mounts while the last one is fading out
        // could never fade the backdrop back in.
        const depth = sheets.length - 1 - i;
        return (
          <Sheet
            key={sheet.id}
            sheet={sheet}
            index={depth}
            totalSheets={sheets.length}
            backdropOpacity={depth === 0 ? backdropOpacity : undefined}
            onDismiss={dismiss}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 1999,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: scale(10),
    paddingBottom: scale(10),
    flexShrink: 0,
  },
  handle: {
    width: scale(36),
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5E5E5E',
  },
  centeredHeaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scale(2),
    flexShrink: 0,
  },
  centeredTitle: {
    textAlign: 'center',
    paddingHorizontal: scale(20),
    marginBottom: scale(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(14),
    paddingTop: scale(4),
    paddingBottom: scale(12),
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
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(8),
    flexShrink: 0,
    width: '100%',
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
