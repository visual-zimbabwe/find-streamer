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
    const currentOffset = event.nativeEvent.contentOffset.y;
    const diff = currentOffset - lastOffset.current;

    // Avoid updates on bounce/rubber-banding at top or bottom boundaries
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const maxOffset = contentHeight - layoutHeight;

    if (currentOffset <= 50) {
      // Near top of screen, always show
      setVisible(true);
    } else if (currentOffset >= maxOffset - 50) {
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

    lastOffset.current = currentOffset;

    if (customOnScroll) {
      customOnScroll(event);
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
