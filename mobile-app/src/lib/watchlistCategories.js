export const DEFAULT_WATCHLIST_CATEGORY_ID = 'watch_next';

export const WATCHLIST_CATEGORIES = [
  {
    id: 'watch_next',
    label: 'Watch Next',
    description: 'Titles queued up for the next free night.',
    icon: 'play-circle-outline',
  },
  {
    id: 'highly_recommend',
    label: 'Highly Recommend',
    description: 'Favorites worth sharing with someone else.',
    icon: 'sparkles-outline',
  },
  {
    id: 'watched',
    label: 'Watched',
    description: 'Finished titles you want to keep on record.',
    icon: 'checkmark-circle-outline',
  },
  {
    id: 'rewatch',
    label: 'Rewatch',
    description: 'Comfort picks and future repeat viewings.',
    icon: 'refresh-circle-outline',
  },
  {
    id: 'maybe_later',
    label: 'Maybe Later',
    description: 'Interesting finds without a firm plan yet.',
    icon: 'time-outline',
  },
];

export function getWatchlistCategory(categoryId) {
  return WATCHLIST_CATEGORIES.find((category) => category.id === categoryId) || WATCHLIST_CATEGORIES[0];
}
