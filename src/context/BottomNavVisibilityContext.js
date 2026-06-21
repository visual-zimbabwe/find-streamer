import React, { createContext, useContext, useState, useRef } from 'react';

/** Scroll thresholds for bottom nav auto-hide (Phase 3). */
export const BOTTOM_NAV_NEAR_TOP = 40;
export const BOTTOM_NAV_NEAR_BOTTOM = 50;
export const BOTTOM_NAV_MIN_DELTA = 8;

const BottomNavVisibilityContext = createContext({
  visible: true,
  setVisible: () => {},
});

export function BottomNavVisibilityProvider({ children }) {
  const [visible, setVisible] = useState(true);

  return (
    <BottomNavVisibilityContext.Provider value={{ visible, setVisible }}>
      {children}
    </BottomNavVisibilityContext.Provider>
  );
}

export function useBottomNavVisibility() {
  return useContext(BottomNavVisibilityContext);
}

/**
 * Updates bottom nav visibility from a scroll event.
 * Nav hides after ~40px scroll down; reappears on scroll up or near edges.
 * Returns the new last offset for the caller to store.
 */
export function applyBottomNavScrollVisibility({
  currentOffset,
  lastOffset,
  contentSize,
  layoutMeasurement,
  setVisible,
}) {
  const diff = currentOffset - lastOffset;

  if (contentSize && layoutMeasurement) {
    const contentHeight = contentSize.height;
    const layoutHeight = layoutMeasurement.height;
    const maxOffset = contentHeight - layoutHeight;

    if (currentOffset <= BOTTOM_NAV_NEAR_TOP) {
      setVisible(true);
    } else if (!isNaN(maxOffset) && currentOffset >= maxOffset - BOTTOM_NAV_NEAR_BOTTOM) {
      setVisible(true);
    } else if (currentOffset > BOTTOM_NAV_NEAR_TOP && Math.abs(diff) > BOTTOM_NAV_MIN_DELTA) {
      setVisible(diff < 0);
    }
  } else if (currentOffset <= BOTTOM_NAV_NEAR_TOP) {
    setVisible(true);
  } else if (currentOffset > BOTTOM_NAV_NEAR_TOP && Math.abs(diff) > BOTTOM_NAV_MIN_DELTA) {
    setVisible(diff < 0);
  }

  return currentOffset;
}

/**
 * Custom hook to easily bind scroll handlers to a ScrollView or FlatList.
 * Automatically manages BottomNav visibility based on scroll direction.
 */
export function useBottomNavScroll(customOnScroll) {
  const { setVisible } = useBottomNavVisibility();
  const lastOffset = useRef(0);
  const isScrollingRef = useRef(false);

  const onScroll = (event) => {
    if (!event || !event.nativeEvent) {
      if (customOnScroll) {
        try {
          customOnScroll(event);
        } catch (e) {
          // Ignore custom scroll handler errors
        }
      }
      return;
    }

    const contentOffset = event.nativeEvent.contentOffset;
    if (!contentOffset) {
      if (customOnScroll) {
        try {
          customOnScroll(event);
        } catch (e) {
          // Ignore
        }
      }
      return;
    }

    const currentOffset = contentOffset.y;
    lastOffset.current = applyBottomNavScrollVisibility({
      currentOffset,
      lastOffset: lastOffset.current,
      contentSize: event.nativeEvent.contentSize,
      layoutMeasurement: event.nativeEvent.layoutMeasurement,
      setVisible,
    });

    if (customOnScroll) {
      try {
        customOnScroll(event);
      } catch (e) {
        // Ignore
      }
    }
  };

  const onScrollBeginDrag = () => {
    isScrollingRef.current = true;
  };

  const onScrollEndDrag = () => {
    isScrollingRef.current = false;
  };

  return {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    scrollEventThrottle: 16,
  };
}
