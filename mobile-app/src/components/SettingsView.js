import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import {
  mergeWatchlistsNoDuplicates,
  normalizeImportedWatchlistItems,
  parseWatchlistImportJson,
  stringifyWatchlistExport,
} from '../lib/watchlistBackup';
import {
  formatQuotaLine,
  formatResetHint,
  getRateQuotaSnapshot,
  subscribeRateQuota,
} from '../lib/apiRateQuota';

function ApiQuotaPanel({ colors, typography, spacing, radii }) {
  const [quota, setQuota] = useState(getRateQuotaSnapshot);

  useEffect(() => subscribeRateQuota(setQuota), []);

  const { tmdb, trakt, omdb } = quota;

  const row = (key, title, bodyLines) => (
    <View key={key}>
      <View style={{ paddingVertical: spacing[4], paddingHorizontal: spacing[5] }}>
        <Text style={[typography.bodyLg, { color: colors.onSurface, fontWeight: '600' }]}>{title}</Text>
        {bodyLines.map((line, i) => (
          <Text
            key={i}
            style={[
              i === 0 ? typography.bodyMd : typography.labelSm,
              {
                color: line.tone === 'error' ? colors.error : colors.onSurfaceVariant,
                marginTop: i === 0 ? spacing[2] : spacing[1],
                lineHeight: i === 0 ? 20 : 16,
              },
            ]}
          >
            {line.text}
          </Text>
        ))}
      </View>
    </View>
  );

  const linesFor = (state) => {
    const out = [];
    if (state.rateLimitedAt) {
      const wait =
        state.retryAfterSec != null && Number.isFinite(state.retryAfterSec)
          ? ` The service asked to wait about ${state.retryAfterSec}s before trying again.`
          : '';
      out.push({ text: `A rate limit (HTTP 429) was hit recently.${wait}`, tone: 'error' });
    }
    const q = formatQuotaLine(state);
    if (q) out.push({ text: q, tone: 'default' });
    else if (!state.rateLimitedAt && state.lastUpdated && state.sessionRequests === undefined) {
      out.push({
        text: 'The last successful call did not include quota headers; limits may still apply on the provider side.',
        tone: 'default',
      });
    } else if (!state.rateLimitedAt && !state.lastUpdated) {
      out.push({
        text: 'No data yet. Search or open titles and values will update from API responses.',
        tone: 'default',
      });
    }
    const resetHint = formatResetHint(state.resetEpochSec);
    if (resetHint && !state.rateLimitedAt) out.push({ text: resetHint, tone: 'default' });
    if (out.length === 0) {
      out.push({ text: 'No quota details available for the last response.', tone: 'default' });
    }
    return out;
  };

  const omdbLines = () => {
    const out = [];
    if (omdb.rateLimitedAt) {
      const wait =
        omdb.retryAfterSec != null && Number.isFinite(omdb.retryAfterSec)
          ? ` Retry after about ${omdb.retryAfterSec}s.`
          : '';
      out.push({ text: `A rate limit (HTTP 429) was hit recently.${wait}`, tone: 'error' });
    }
    const q = formatQuotaLine(omdb);
    if (q) out.push({ text: q, tone: 'default' });
    out.push({
      text: `This session: ${omdb.sessionRequests ?? 0} request(s) (unique titles are cached).`,
      tone: 'default',
    });
    out.push({
      text: `Typical free tier: about ${omdb.documentedDailyMax ?? 1000} calls per day. ${omdb.documentedNote || ''}`,
      tone: 'default',
    });
    return out;
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
      {row('tmdb', 'The Movie Database (TMDB)', linesFor(tmdb))}
      <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
      {row('trakt', 'Trakt', linesFor(trakt))}
      <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
      {row('omdb', 'OMDb', omdbLines())}
    </View>
  );
}

export function SettingsView({ watchlist = [], persistWatchlistChange }) {
  const { theme, preference, setPreference } = useTheme();
  const { colors, spacing, typography, radii } = theme;
  const [backupBusy, setBackupBusy] = useState(false);

  const handleExportWatchlist = async () => {
    const baseDir = FileSystem.cacheDirectory;
    if (!baseDir) {
      Alert.alert('Export unavailable', 'File storage is not available on this device.');
      return;
    }

    setBackupBusy(true);
    try {
      const json = stringifyWatchlistExport(watchlist);
      const safeDate = new Date().toISOString().slice(0, 10);
      const fileUri = `${baseDir}trova-watchlist-${safeDate}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'This device cannot open the system share sheet.');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export watchlist',
        UTI: 'public.json',
      });
    } catch (err) {
      Alert.alert('Export failed', err?.message || 'Could not export your watchlist.');
    } finally {
      setBackupBusy(false);
    }
  };

  const applyImportedItems = async (items, mode) => {
    if (!persistWatchlistChange) return;

    if (mode === 'merge' && (!items || items.length === 0)) {
      Alert.alert('Nothing to merge', 'This file contains no titles to add.');
      return;
    }

    if (mode === 'replace') {
      const next = normalizeImportedWatchlistItems(items);
      const msg =
        next.length === 0
          ? 'Watchlist cleared.'
          : `Watchlist replaced with ${next.length} title${next.length === 1 ? '' : 's'}.`;
      await persistWatchlistChange(next, watchlist, msg, 'bookmark-outline');
      return;
    }

    const merged = mergeWatchlistsNoDuplicates(watchlist, items);
    const normalizedCurrent = normalizeImportedWatchlistItems(watchlist);
    const added = merged.length - normalizedCurrent.length;
    const msg =
      added === 0
        ? 'Nothing new was added. Entries from this file were already on your watchlist.'
        : `Added ${added} title${added === 1 ? '' : 's'} from the file. Your watchlist now has ${merged.length} entr${merged.length === 1 ? 'y' : 'ies'}.`;
    await persistWatchlistChange(merged, watchlist, msg, 'bookmark-outline');
  };

  const promptImportMode = (items) => {
    const n = items.length;
    const summary =
      n === 0
        ? 'This file contains no titles. You can still replace your watchlist to clear it.'
        : `This file contains ${n} title${n === 1 ? '' : 's'}.`;

    Alert.alert('Import watchlist', `${summary}\n\nHow should it be applied?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: () => {
          void applyImportedItems(items, 'merge');
        },
      },
      {
        text: 'Replace',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Replace entire watchlist?',
            'This removes all titles currently on this device and replaces them with the file.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Replace',
                style: 'destructive',
                onPress: () => {
                  void applyImportedItems(items, 'replace');
                },
              },
            ]
          );
        },
      },
    ]);
  };

  const handleImportWatchlist = async () => {
    setBackupBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const uri = result.assets[0].uri;
      const text = await FileSystem.readAsStringAsync(uri);
      const parsed = parseWatchlistImportJson(text);

      if (!parsed.ok) {
        Alert.alert('Could not import', parsed.error || 'Invalid file.');
        return;
      }

      promptImportMode(parsed.items);
    } catch (err) {
      Alert.alert('Import failed', err?.message || 'Could not read the selected file.');
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
          <TouchableOpacity
            style={[styles.row, preference === 'light' && { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={() => setPreference('light')}
            accessibilityRole="button"
            accessibilityLabel="Use light mode"
            accessibilityState={{ selected: preference === 'light' }}
          >
            <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>☀️ Light Mode</Text>
            {preference === 'light' && <Text style={{ color: colors.primary }}>✓</Text>}
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
          <TouchableOpacity
            style={[styles.row, preference === 'dark' && { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={() => setPreference('dark')}
            accessibilityRole="button"
            accessibilityLabel="Use dark mode"
            accessibilityState={{ selected: preference === 'dark' }}
          >
            <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>🌙 Dark Mode</Text>
            {preference === 'dark' && <Text style={{ color: colors.primary }}>✓</Text>}
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
          <TouchableOpacity
            style={[styles.row, preference === 'system' && { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={() => setPreference('system')}
            accessibilityRole="button"
            accessibilityLabel="Use system default appearance"
            accessibilityState={{ selected: preference === 'system' }}
          >
            <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>🖥️ System Default</Text>
            {preference === 'system' && <Text style={{ color: colors.primary }}>✓</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Watchlist</Text>
        <Text
          style={[styles.sectionHint, { color: colors.onSurfaceVariant, ...typography.bodyMd, marginBottom: spacing[4] }]}
        >
          Export a JSON backup to move your list to another device, or import a file you exported earlier. Merge adds
          only titles you do not already have (same movie or show).
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
          <TouchableOpacity
            style={[styles.row, styles.rowWithIcon]}
            onPress={handleExportWatchlist}
            disabled={backupBusy}
            accessibilityRole="button"
            accessibilityLabel="Export watchlist to a file"
            accessibilityState={{ disabled: backupBusy }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="share-outline" size={22} color={colors.primary} style={styles.rowIcon} />
              <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>Export watchlist</Text>
            </View>
            {backupBusy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
            )}
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
          <TouchableOpacity
            style={[styles.row, styles.rowWithIcon]}
            onPress={handleImportWatchlist}
            disabled={backupBusy}
            accessibilityRole="button"
            accessibilityLabel="Import watchlist from a file"
            accessibilityState={{ disabled: backupBusy }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="download-outline" size={22} color={colors.primary} style={styles.rowIcon} />
              <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>Import watchlist</Text>
            </View>
            {backupBusy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>API rate limits</Text>
        <Text
          style={[styles.sectionHint, { color: colors.onSurfaceVariant, ...typography.bodyMd, marginBottom: spacing[4] }]}
        >
          Live figures come from each provider's response headers when they expose them. If you see a 429 message,
          wait for the suggested time before refreshing.
        </Text>
        <ApiQuotaPanel colors={colors} typography={typography} spacing={spacing} radii={radii} />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Trova v2.4.1 (Build 882)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  sectionHint: {
    lineHeight: 20,
    marginTop: -8,
  },
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  rowWithIcon: {
    paddingVertical: 18,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowIcon: {
    marginRight: 14,
  },
  rowText: {
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 60,
  },
  version: {
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.5,
  },
});
