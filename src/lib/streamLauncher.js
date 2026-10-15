import { AppState, Linking, NativeModules, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ScreenOrientation from 'expo-screen-orientation';
import { toastiva } from 'toastiva';

const { TorrentStreamerModule } = NativeModules;

let activePlayerCleanup = null;

/**
 * Auto-launches a stream in mpv-android locked to landscape orientation,
 * restoring portrait upon exit.
 *
 * @param {{
 *   magnetUrl: string;
 *   title?: string;
 * }} options
 * @returns {Promise<boolean>}
 */
export async function launchStream({ magnetUrl, title, fileIdx, imdbId, season, episode }) {
  if (!magnetUrl) return false;

  if (Platform.OS === 'android') {
    let streamUrl = `http://127.0.0.1:8899/stream?magnet=${encodeURIComponent(magnetUrl)}`;
    if (typeof fileIdx === 'number') {
      streamUrl += `&fileIdx=${fileIdx}`;
    }

    // Keep background stream server active with an Android ForegroundService
    if (TorrentStreamerModule?.startService) {
      try {
        await TorrentStreamerModule.startService(title || 'Trova Stream');
      } catch (serviceErr) {
        console.log('[launchStream] Foreground service start error:', serviceErr);
      }
    }

    // Prime swarm metadata in background
    try {
      fetch(`http://127.0.0.1:8899/preload?magnet=${encodeURIComponent(magnetUrl)}`).catch(() => {});
    } catch {
      // Preload is opportunistic
    }

    // Pre-fetch English subtitles if no English subs in release name
    let subtitleUrl = null;
    const hasEnglishSubs = /\b(esub|esubs|eng\.sub|english\.sub|en\.sub)\b/i.test(title || '');
    if (!hasEnglishSubs && imdbId) {
      try {
        const cleanImdb = String(imdbId).trim();
        let query = `http://127.0.0.1:8899/fetch-subtitle?imdb=${encodeURIComponent(cleanImdb)}`;
        if (season != null) query += `&season=${season}`;
        if (episode != null) query += `&episode=${episode}`;
        if (title) query += `&title=${encodeURIComponent(title)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const subRes = await fetch(query, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeoutId);

        if (subRes && subRes.ok) {
          const data = await subRes.json().catch(() => null);
          if (data?.status && data?.url) {
            subtitleUrl = data.url;
            console.log(`[launchStream] Loaded English subtitles from ${data.source}: ${data.url}`);
          }
        }
      } catch (subErr) {
        console.log('[launchStream] Subtitle fetch error:', subErr);
      }
    }

    // Clean up any lingering listener from a previous stream
    if (activePlayerCleanup) {
      await activePlayerCleanup();
    }

    // Lock orientation to LANDSCAPE prior to launching the player
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (orientErr) {
      console.log('[launchStream] Orientation lock error:', orientErr);
    }

    toastiva.info('Playing in mpv (Landscape)...');

    // Setup listener to restore portrait orientation and stop background stream service
    // as soon as the user finishes/exits mpv and Trova returns to the foreground.
    let hasLeftTrova = AppState.currentState !== 'active';
    let cleanupDone = false;
    let appStateSub = null;

    const cleanup = async () => {
      if (cleanupDone) return;
      cleanupDone = true;
      if (appStateSub) {
        appStateSub.remove();
        appStateSub = null;
      }
      if (activePlayerCleanup === cleanup) {
        activePlayerCleanup = null;
      }
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (orientErr) {
        console.log('[launchStream] Orientation restore error:', orientErr);
      }
      if (TorrentStreamerModule?.stopService) {
        try {
          await TorrentStreamerModule.stopService();
        } catch {
          // Ignored
        }
      }
    };

    activePlayerCleanup = cleanup;

    appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        hasLeftTrova = true;
      } else if (nextState === 'active' && hasLeftTrova) {
        cleanup();
      }
    });

    let playerLaunched = false;

    // Attempt direct native launch with subtitle extras
    if (TorrentStreamerModule?.launchPlayer) {
      try {
        await TorrentStreamerModule.launchPlayer(streamUrl, title || 'Trova Stream', subtitleUrl);
        playerLaunched = true;
      } catch (launchErr) {
        console.log('[launchStream] Native player launch failed, falling back to IntentLauncher:', launchErr);
      }
    }

    if (!playerLaunched) {
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: streamUrl,
          type: 'video/*',
          packageName: 'is.xyz.mpv',
          className: 'is.xyz.mpv.MPVActivity',
          extra: {
            title: title || 'Trova Stream',
          },
        });
        playerLaunched = true;
      } catch (mpvError) {
        console.log('[launchStream] MPVActivity direct launch failed, attempting generic video viewer:', mpvError);
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: streamUrl,
            type: 'video/*',
            extra: {
              title: title || 'Trova Stream',
            },
          });
          playerLaunched = true;
        } catch (genericError) {
          console.log('[launchStream] Generic video player launch failed:', genericError);
          try {
            await IntentLauncher.openApplication('is.xyz.mpv');
            playerLaunched = true;
          } catch {
            // Fall through to system magnet handler
          }
        }
      }
    }

    if (playerLaunched) {
      return true;
    }

    // If all player launch attempts failed, immediately restore portrait and cleanup
    await cleanup();
  }

  // Fallback: try default system magnet handler
  try {
    const supported = await Linking.canOpenURL(magnetUrl);
    if (supported) {
      await Linking.openURL(magnetUrl);
      return true;
    }
  } catch {
    // Ignored
  }

  toastiva.info('Unable to launch video player');
  return false;
}
