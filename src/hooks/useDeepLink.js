import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { parseTitleUrl } from '../lib/shareLinks';
import { getTitleMatchById } from '../lib/tmdb';

/**
 * Answers `trova://title/:mediaType/:tmdbId`.
 *
 * `app.json` has registered the `trova` scheme since day one, but nothing ever
 * consumed it — the app opened and dropped the path on the floor. Detail is
 * driven by context rather than route params, so this resolves the title
 * through the same `openResolvedDetail` flow search and discover use, instead
 * of a react-navigation `linking` config that could only push an empty screen.
 *
 * @param {{
 *   openResolvedDetail: (title: string, match: object, navigation: null) => Promise<void>,
 *   navigationReady: boolean,
 * }} deps
 */
export function useDeepLink({ openResolvedDetail, navigationReady }) {
  const consumedInitialRef = useRef(false);

  /**
   * Held in a ref so the subscription effect depends on `navigationReady`
   * alone. `openResolvedDetail`'s identity changes once `recentViewed` loads
   * from storage, and as a dependency that re-ran this effect *during* the
   * TMDb fetch — tearing down the in-flight handler and dropping cold-start
   * links maybe one launch in three.
   */
  const openRef = useRef(openResolvedDetail);
  useEffect(() => {
    openRef.current = openResolvedDetail;
  }, [openResolvedDetail]);

  useEffect(() => {
    // pushOnCurrentTab() no-ops until the container is ready, which would make
    // a cold-start link silently do nothing.
    if (!navigationReady) return undefined;

    const handle = async (url) => {
      const target = parseTitleUrl(url);
      if (!target) return;
      try {
        const match = await getTitleMatchById(target.mediaType, Number(target.tmdbId));
        openRef.current?.(match.title, match, null, 'Unable to open that link.');
      } catch {
        // A bad or deleted id shouldn't crash the launch; the app just opens home.
      }
    };

    if (!consumedInitialRef.current) {
      consumedInitialRef.current = true;
      Linking.getInitialURL()
        .then(handle)
        .catch(() => {});
    }

    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));

    return () => subscription.remove();
  }, [navigationReady]);
}
