import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (based on a standard iPhone 11/12/13/14 sizing)
const guidelineBaseWidth = 390;
const guidelineBaseHeight = 844;

/**
 * scale (width-based)
 * Use for width, margin horizontal, padding horizontal, etc.
 */
export const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * verticalScale (height-based)
 * Use for height, margin vertical, padding vertical, etc.
 */
export const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * moderateScale (width-based but less aggressive)
 * Use for fonts and elements that shouldn't scale too drastically on iPads/large screens
 * The factor controls how much it scales. factor=0 means no scaling, factor=1 means full scale()
 */
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Font scaling based on pixel density
 */
export const scaleFont = (size) => {
  const newSize = size * (SCREEN_WIDTH / guidelineBaseWidth);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
};

/**
 * Detect if device is a tablet based on aspect ratio and width
 */
export const isTablet = () => {
  let pixelDensity = PixelRatio.get();
  const adjustedWidth = SCREEN_WIDTH * pixelDensity;
  const adjustedHeight = SCREEN_HEIGHT * pixelDensity;
  if (pixelDensity < 2 && (adjustedWidth >= 1000 || adjustedHeight >= 1000)) {
    return true;
  } else if (pixelDensity === 2 && (adjustedWidth >= 1920 || adjustedHeight >= 1920)) {
    return true;
  } else {
    return false;
  }
};

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;
