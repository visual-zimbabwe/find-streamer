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
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
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

const TMDB_LOGO_PATH =
  'M51.06,66.7h0A17.67,17.67,0,0,1,68.73,49h-.1A17.67,17.67,0,0,1,86.3,66.7h0A17.67,17.67,0,0,1,68.63,84.37h.1A17.67,17.67,0,0,1,51.06,66.7Zm82.67-31.33h32.9A17.67,17.67,0,0,0,184.3,17.7h0A17.67,17.67,0,0,0,166.63,0h-32.9A17.67,17.67,0,0,0,116.06,17.7h0A17.67,17.67,0,0,0,133.73,35.37Zm-113,98h63.9A17.67,17.67,0,0,0,102.3,115.7h0A17.67,17.67,0,0,0,84.63,98H20.73A17.67,17.67,0,0,0,3.06,115.7h0A17.67,17.67,0,0,0,20.73,133.37Zm83.92-49h6.25L125.5,49h-8.35l-8.9,23.2h-.1L99.4,49H90.5Zm32.45,0h7.8V49h-7.8Zm22.2,0h24.95V77.2H167.1V70h15.35V62.8H167.1V56.2h16.25V49h-24ZM10.1,35.4h7.8V6.9H28V0H0V6.9H10.1ZM39,35.4h7.8V20.1H61.9V35.4h7.8V0H61.9V13.2H46.75V0H39Zm41.25,0h25V28.2H88V21h15.35V13.8H88V7.2h16.25V0h-24Zm-79,49H9V57.25h.1l9,27.15H24l9.3-27.15h.1V84.4h7.8V49H29.45l-8.2,23.1h-.1L13,49H1.2Zm112.09,49H126a24.59,24.59,0,0,0,7.56-1.15,19.52,19.52,0,0,0,6.35-3.37,16.37,16.37,0,0,0,4.37-5.5A16.91,16.91,0,0,0,146,115.8a18.5,18.5,0,0,0-1.68-8.25,15.1,15.1,0,0,0-4.52-5.53A18.55,18.55,0,0,0,133.07,99,33.54,33.54,0,0,0,125,98H113.29Zm7.81-28.2h4.6a17.43,17.43,0,0,1,4.67.62,11.68,11.68,0,0,1,3.88,1.88,9,9,0,0,1,2.62,3.18,9.87,9.87,0,0,1,1,4.52,11.92,11.92,0,0,1-1,5.08,8.69,8.69,0,0,1-2.67,3.34,10.87,10.87,0,0,1-4,1.83,21.57,21.57,0,0,1-5,.55H121.1Zm36.14,28.2h14.5a23.11,23.11,0,0,0,4.73-.5,13.38,13.38,0,0,0,4.27-1.65,9.42,9.42,0,0,0,3.1-3,8.52,8.52,0,0,0,1.2-4.68,9.16,9.16,0,0,0-.55-3.2,7.79,7.79,0,0,0-1.57-2.62,8.38,8.38,0,0,0-2.45-1.85,10,10,0,0,0-3.18-1v-.1a9.28,9.28,0,0,0,4.43-2.82,7.42,7.42,0,0,0,1.67-5,8.34,8.34,0,0,0-1.15-4.65,7.88,7.88,0,0,0-3-2.73,12.9,12.9,0,0,0-4.17-1.3,34.42,34.42,0,0,0-4.63-.32h-13.2Zm7.8-28.8h5.3a10.79,10.79,0,0,1,1.85.17,5.77,5.77,0,0,1,1.7.58,3.33,3.33,0,0,1,1.23,1.13,3.22,3.22,0,0,1,.47,1.82,3.63,3.63,0,0,1-.42,1.8,3.34,3.34,0,0,1-1.13,1.2,4.78,4.78,0,0,1-1.57.65,8.16,8.16,0,0,1-1.78.2H165Zm0,14.15h5.9a15.12,15.12,0,0,1,2.05.15,7.83,7.83,0,0,1,2,.55,4,4,0,0,1,1.58,1.17,3.13,3.13,0,0,1,.62,2,3.71,3.71,0,0,1-.47,1.95,4,4,0,0,1-1.23,1.3,4.78,4.78,0,0,1-1.67.7,8.91,8.91,0,0,1-1.83.2h-7Z';

function TmdbLogo({ width = 44 }) {
  const height = (width * 133.4) / 185.04;
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 185.04 133.4"
      accessibilityRole="image"
      accessibilityLabel="The Movie Database logo"
    >
      <Defs>
        <SvgLinearGradient
          id="tmdbGradient"
          x1="0"
          y1="66.7"
          x2="185.04"
          y2="66.7"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#90cea1" />
          <Stop offset="0.56" stopColor="#3cbec9" />
          <Stop offset="1" stopColor="#00b3e5" />
        </SvgLinearGradient>
      </Defs>
      <Path fill="url(#tmdbGradient)" d={TMDB_LOGO_PATH} />
    </Svg>
  );
}

function CreditBlock({ title, body, colors, typography, isLast, children }) {
  return (
    <View>
      <View style={styles.creditBlock}>
        {children}
        {title ? (
          <Text style={[styles.creditTitle, { color: colors.onSurface, ...typography.bodyMd }]}>
            {title}
          </Text>
        ) : null}
        <Text
          style={[styles.creditBody, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
        >
          {body}
        </Text>
      </View>
      {!isLast ? <PanelDivider /> : null}
    </View>
  );
}

function CreditsPanel({ colors, typography, glassSurface, radii }) {
  return (
    <GlassPanel glassSurface={glassSurface} radii={radii}>
      <CreditBlock
        body="This product uses the TMDB API but is not endorsed or certified by TMDB."
        colors={colors}
        typography={typography}
      >
        <View style={styles.tmdbLogoWrap}>
          <TmdbLogo width={44} />
        </View>
      </CreditBlock>
      <CreditBlock
        title="Streaming availability"
        body="Where-to-watch data is provided by JustWatch."
        colors={colors}
        typography={typography}
      />
      <CreditBlock
        title="Additional data"
        body="Ratings and metadata are sourced from Trakt and OMDb."
        colors={colors}
        typography={typography}
        isLast
      />
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

        <SectionHairline />

        <SectionBlockHeader
          eyebrow="About"
          title="Credits"
          hint="Trova is an independent, non-commercial app built on these data providers."
          colors={colors}
          typography={typography}
        />
        <CreditsPanel
          colors={colors}
          typography={typography}
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
  creditBlock: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
  },
  tmdbLogoWrap: {
    marginBottom: scale(10),
  },
  creditTitle: {
    fontWeight: '700',
    marginBottom: scale(4),
  },
  creditBody: {
    lineHeight: 18,
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
