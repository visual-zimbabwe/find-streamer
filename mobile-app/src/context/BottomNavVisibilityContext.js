import React, { createContext, useContext, useState, useRef } from 'react';

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
    const diff = currentOffset - lastOffset.current;

    const contentSize = event.nativeEvent.contentSize;
    const layoutMeasurement = event.nativeEvent.layoutMeasurement;

    if (contentSize && layoutMeasurement) {
      const contentHeight = contentSize.height;
      const layoutHeight = layoutMeasurement.height;
      const maxOffset = contentHeight - layoutHeight;

      if (currentOffset <= 50) {
        // Near top of screen, always show
        setVisible(true);
      } else if (!isNaN(maxOffset) && currentOffset >= maxOffset - 50) {
        // Near bottom of screen, always show so they can navigate
        setVisible(true);
      } else if (Math.abs(diff) > 12) {
        // Significant scroll event
        if (diff > 0) {
          // Scrolling down -> Hide
          setVisible(false);
        } else {
          // Scrolling up -> Show
          setVisible(true);
        }
      }
    } else {
      // Fallback if layout measurements are not available yet
      if (currentOffset <= 50) {
        setVisible(true);
      } else if (Math.abs(diff) > 12) {
        if (diff > 0) {
          setVisible(false);
        } else {
          setVisible(true);
        }
      }
    }

    lastOffset.current = currentOffset;

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
