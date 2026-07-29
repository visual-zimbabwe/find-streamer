// @ts-check
//
// Official streaming-service logos for the Home service chip — the flag's
// counterpart. TMDb's provider list is the source, but it never changes between
// launches, so we hydrate instantly from AsyncStorage and refresh in the
// background. A module-level memo keeps it to one load per app session no matter
// how many screens ask.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchServiceLogos } from '../lib/tmdb';

const STORAGE_KEY = 'trova.serviceLogos.v1';

/** @type {Record<string, string> | null} */
let sharedLogos = null;

/**
 * @returns {Record<string, string>} service key → logo URL (empty until loaded)
 */
export function useServiceLogos() {
  const [logos, setLogos] = useState(sharedLogos || {});

  useEffect(() => {
    if (sharedLogos) return undefined;
    let alive = true;

    (async () => {
      // Cached copy paints the chip immediately on a warm start.
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && alive) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            sharedLogos = parsed;
            setLogos(parsed);
          }
        }
      } catch {
        // A miss just means we wait for the network copy below.
      }

      // Refresh from TMDb — fills a cold cache and closes any gaps.
      try {
        const fresh = await fetchServiceLogos();
        if (alive && fresh && Object.keys(fresh).length) {
          sharedLogos = fresh;
          setLogos(fresh);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => {});
        }
      } catch {
        // Offline / rate-limited: the chip just shows no icon this session.
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return logos;
}
