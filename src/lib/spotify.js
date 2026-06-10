import { Linking, Platform } from 'react-native';

/**
 * Open a Spotify album on Android — native app when available, otherwise the web player.
 */
export async function openSpotifyAlbum(albumId) {
  const id = String(albumId || '').trim();
  if (!id) return;

  const webUrl = `https://open.spotify.com/album/${id}`;
  const appUrl = `spotify:album:${id}`;

  if (Platform.OS === 'android') {
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      // Fall through to web URL (also handles App Links when Spotify is installed).
    }
  }

  await Linking.openURL(webUrl);
}
