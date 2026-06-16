import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme/ThemeProvider';
import {
  mergeWatchlistsNoDuplicates,
  mergeCollectionsNoDuplicates,
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
import { scale, verticalScale } from '../utils/responsive';

const GRID_PAD = scale(22);
const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';

function ProgrammeSectionHeader({ eyebrow, title, subtitle, colors, typography }) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? (
        <Text style={[styles.sectionEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[styles.pageTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.pageSubtitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SectionHairline() {
  return <View style={[styles.sectionDivider, { backgroundColor: GOLD_DIM }]} />;
}

function SectionBlockHeader({ eyebrow, title, hint, colors, typography }) {
  return (
    <View style={styles.blockHeader}>
      {eyebrow ? (
        <Text style={[styles.blockEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[styles.blockTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {hint ? (
        <Text style={[styles.blockHint, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function GlassPanel({ children, glassSurface, radii, style }) {
  return (
    <View
      style={[
        styles.glassPanel,
        {
          backgroundColor: glassSurface,
          borderColor: GOLD_DIM,
          borderRadius: radii.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function PanelDivider() {
  return <View style={[styles.panelDivider, { backgroundColor: GOLD_DIM }]} />;
}

function AppearanceRow({ icon, label, selected, onPress, colors, typography }) {
  return (
    <TouchableOpacity
      style={[styles.appearanceRow, selected && styles.appearanceRowSelected]}
      onPress={() => {
        if (!selected) {
          Haptics.selectionAsync();
          onPress();
        }
      }}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View style={styles.appearanceLeft}>
        <View
          style={[styles.appearanceIconWrap, { borderColor: selected ? GOLD_ACCENT : GOLD_DIM }]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={selected ? GOLD_ACCENT : colors.onSurfaceVariant}
          />
        </View>
        <Text
          style={[
            styles.appearanceLabel,
            { color: selected ? colors.onSurface : colors.onSurfaceVariant, ...typography.bodyMd },
            selected && styles.appearanceLabelActive,
          ]}
        >
          {label}
        </Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark" size={18} color={GOLD_ACCENT} />
      ) : (
        <View style={styles.appearanceSpacer} />
      )}
    </TouchableOpacity>
  );
}

function ActionRow({ icon, label, onPress, disabled, busy, colors, typography }) {
  return (
    <TouchableOpacity
      style={styles.actionRow}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <View style={styles.actionLeft}>
        <Ionicons name={icon} size={18} color={GOLD_ACCENT} style={styles.actionIcon} />
        <Text style={[styles.actionLabel, { color: colors.onSurface, ...typography.bodyMd }]}>
          {label}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator
          size="small"
          color={GOLD_ACCENT}
          accessibilityLabel={`${label} in progress`}
        />
      ) : (
        <Ionicons name="chevron-forward" size={15} color={GOLD_ACCENT} style={{ opacity: 0.72 }} />
      )}
    </TouchableOpacity>
  );
}

function QuotaProviderBlock({ title, bodyLines, colors, typography, spacing, isLast }) {
  return (
    <View>
      <View style={styles.quotaBlock}>
        <Text style={[styles.quotaProvider, { color: colors.onSurface, ...typography.bodyMd }]}>
          {title}
        </Text>
        {bodyLines.map((line, i) => (
          <Text
            key={i}
            style={[
              i === 0 ? styles.quotaPrimary : styles.quotaSecondary,
              {
                color: line.tone === 'error' ? colors.error : colors.onSurfaceVariant,
                ...typography.labelSm,
                marginTop: i === 0 ? spacing[2] : spacing[1],
              },
            ]}
          >
            {line.text}
          </Text>
        ))}
      </View>
      {!isLast ? <PanelDivider /> : null}
    </View>
  );
}

function ApiQuotaPanel({ colors, typography, spacing, glassSurface, radii }) {
  const [quota, setQuota] = useState(getRateQuotaSnapshot);

  useEffect(() => subscribeRateQuota(setQuota), []);

  const { tmdb, trakt, omdb } = quota;

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

  const providers = [
    { key: 'tmdb', title: 'The Movie Database (TMDB)', lines: linesFor(tmdb) },
    { key: 'trakt', title: 'Trakt', lines: linesFor(trakt) },
    { key: 'omdb', title: 'OMDb', lines: omdbLines() },
  ];

  return (
    <GlassPanel glassSurface={glassSurface} radii={radii}>
      {providers.map((provider, index) => (
        <QuotaProviderBlock
          key={provider.key}
          title={provider.title}
          bodyLines={provider.lines}
          colors={colors}
          typography={typography}
          spacing={spacing}
          isLast={index === providers.length - 1}
        />
      ))}
    </GlassPanel>
  );
}

export function SettingsView({
  watchlist = [],
  collections = [],
  persistWatchlistChange,
  persistCollectionsChange,
}) {
  const { theme, preference, setPreference, resolvedMode } = useTheme();
  const { colors, spacing, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const [backupBusy, setBackupBusy] = useState(false);
  const bottomNavScroll = useBottomNavScroll();

  const glassSurface = useMemo(
    () => (resolvedMode === 'dark' ? 'rgba(12, 12, 14, 0.96)' : 'rgba(247, 247, 242, 0.96)'),
    [resolvedMode],
  );
  const atmosphereColors = useMemo(
    () => [
      resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
      colors.background,
    ],
    [resolvedMode, colors],
  );

  const handleExportWatchlist = async () => {
    const baseDir = FileSystem.cacheDirectory;
    if (!baseDir) {
      Alert.alert('Export unavailable', 'File storage is not available on this device.');
      return;
    }

    setBackupBusy(true);
    try {
      const json = stringifyWatchlistExport(watchlist, collections);
      const safeDate = new Date().toISOString().slice(0, 10);
      const fileUri = `${baseDir}trova-watchlist-${safeDate}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

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

  const applyImportedItems = async (items, mode, importedCollections = []) => {
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
      if (persistCollectionsChange && importedCollections.length > 0) {
        await persistCollectionsChange(importedCollections, collections);
      }
      return;
    }

    const merged = mergeWatchlistsNoDuplicates(watchlist, items);
    const mergedCollections = mergeCollectionsNoDuplicates(collections, importedCollections);
    const normalizedCurrent = normalizeImportedWatchlistItems(watchlist);
    const added = merged.length - normalizedCurrent.length;
    const msg =
      added === 0
        ? 'Nothing new was added. Entries from this file were already on your watchlist.'
        : `Added ${added} title${added === 1 ? '' : 's'} from the file. Your watchlist now has ${merged.length} entr${merged.length === 1 ? 'y' : 'ies'}.`;
    await persistWatchlistChange(merged, watchlist, msg, 'bookmark-outline');
    if (persistCollectionsChange) {
      await persistCollectionsChange(mergedCollections, collections);
    }
  };

  const promptImportMode = (items, importedCollections = []) => {
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
          void applyImportedItems(items, 'merge', importedCollections);
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
                  void applyImportedItems(items, 'replace', importedCollections);
                },
              },
            ],
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

      promptImportMode(parsed.items, parsed.collections || []);
    } catch (err) {
      Alert.alert('Import failed', err?.message || 'Could not read the selected file.');
    } finally {
      setBackupBusy(false);
    }
  };

  const appearanceOptions = [
    {
      key: 'light',
      label: 'Light Mode',
      icon: 'sunny-outline',
      accessibilityLabel: 'Use light mode',
    },
    { key: 'dark', label: 'Dark Mode', icon: 'moon-outline', accessibilityLabel: 'Use dark mode' },
    {
      key: 'system',
      label: 'System Default',
      icon: 'phone-portrait-outline',
      accessibilityLabel: 'Use system default appearance',
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        {...bottomNavScroll}
      >
        <ProgrammeSectionHeader
          eyebrow="Preferences"
          title="Settings"
          subtitle="Your Programme Specification"
          colors={colors}
          typography={typography}
        />

        <SectionHairline />

        <SectionBlockHeader
          eyebrow="Display"
          title="Appearance"
          colors={colors}
          typography={typography}
        />
        <GlassPanel glassSurface={glassSurface} radii={radii} style={styles.blockPanel}>
          {appearanceOptions.map((option, index) => (
            <View key={option.key}>
              <AppearanceRow
                icon={option.icon}
                label={option.label}
                selected={preference === option.key}
                onPress={() => setPreference(option.key)}
                colors={colors}
                typography={typography}
              />
              {index < appearanceOptions.length - 1 ? <PanelDivider /> : null}
            </View>
          ))}
        </GlassPanel>

        <SectionHairline />

        <SectionBlockHeader
          eyebrow="Library"
          title="Watchlist Backup"
          hint="Export a JSON backup to move your list to another device, or import a file you exported earlier. Merge adds only titles you do not already have (same movie or show)."
          colors={colors}
          typography={typography}
        />
        <GlassPanel glassSurface={glassSurface} radii={radii} style={styles.blockPanel}>
          <ActionRow
            icon="share-outline"
            label="Export watchlist"
            onPress={handleExportWatchlist}
            disabled={backupBusy}
            busy={backupBusy}
            colors={colors}
            typography={typography}
          />
          <PanelDivider />
          <ActionRow
            icon="download-outline"
            label="Import watchlist"
            onPress={handleImportWatchlist}
            disabled={backupBusy}
            busy={backupBusy}
            colors={colors}
            typography={typography}
          />
        </GlassPanel>

        <SectionHairline />

        <SectionBlockHeader
          eyebrow="Connectivity"
          title="API Rate Limits"
          hint="Live figures come from each provider's response headers when they expose them. If you see a 429 message, wait for the suggested time before refreshing."
          colors={colors}
          typography={typography}
        />
        <ApiQuotaPanel
          colors={colors}
          typography={typography}
          spacing={spacing}
          glassSurface={glassSurface}
          radii={radii}
        />

        <View style={styles.footer}>
          <Text style={[styles.version, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
            Trova v2.4.1 (Build 882)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  atmosphereTop: {
    height: verticalScale(220),
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GRID_PAD,
    paddingTop: scale(28),
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: scale(8),
  },
  sectionEyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: scale(22),
    opacity: 0.65,
  },
  blockHeader: {
    gap: 6,
    marginBottom: scale(14),
  },
  blockEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  blockTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  blockHint: {
    lineHeight: 20,
    marginTop: 2,
  },
  blockPanel: {
    marginBottom: scale(4),
  },
  glassPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 0 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: scale(16),
    opacity: 0.65,
  },
  appearanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  appearanceRowSelected: {
    backgroundColor: 'rgba(212, 168, 83, 0.06)',
  },
  appearanceLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: scale(12),
  },
  appearanceIconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  appearanceLabel: {
    fontWeight: '500',
  },
  appearanceLabelActive: {
    fontWeight: '700',
  },
  appearanceSpacer: {
    width: 18,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  actionLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  actionIcon: {
    marginRight: scale(12),
  },
  actionLabel: {
    fontWeight: '600',
  },
  quotaBlock: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
  },
  quotaProvider: {
    fontWeight: '700',
  },
  quotaPrimary: {
    lineHeight: 20,
  },
  quotaSecondary: {
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: scale(28),
    paddingBottom: scale(12),
  },
  version: {
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.5,
    textTransform: 'uppercase',
  },
});
