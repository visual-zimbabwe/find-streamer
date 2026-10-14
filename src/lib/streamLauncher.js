import { Linking, NativeModules, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ScreenOrientation from 'expo-screen-orientation';
import { toastiva } from 'toastiva';

const { TorrentStreamerModule } = NativeModules;

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
export async function launchStream({ magnetUrl, title, fileIdx }) {
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

    // Lock orientation to LANDSCAPE prior to launching the player
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (orientErr) {
      console.log('[launchStream] Orientation lock error:', orientErr);
    }

    toastiva.info('Streaming in mpv (Landscape)...');

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
      return true;
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
        return true;
      } catch (genericError) {
        console.log('[launchStream] Generic video player launch failed:', genericError);
        try {
          IntentLauncher.openApplication('is.xyz.mpv');
          return true;
        } catch {
          // Fall through to system magnet handler
        }
      }
    } finally {
      // Stop background stream service upon player exit
      if (TorrentStreamerModule?.stopService) {
        try {
          await TorrentStreamerModule.stopService();
        } catch {
          // Ignored
        }
      }

      // Restore portrait orientation upon returning to Trova
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {
        // Ignored
      }
    }
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
