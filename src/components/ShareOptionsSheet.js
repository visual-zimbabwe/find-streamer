import React, { useState, useCallback, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import {
  SERVICE_COLORS,
  SERVICE_ICONS,
  getAvailableCountriesForService,
  buildDefaultSelectedCountries,
  shortName,
} from '../lib/shareUtils';

/**
 * Bottom sheet that lets the user pick up to 2 countries per streaming
 * service before generating the share card image.
 *
 * Props:
 *   visible          – boolean
 *   result           – full resolved result from resolveMatch()
 *   onClose()        – dismiss without sharing
 *   onShare(selected) – called with { serviceKey: [code, ...] }
 */
/**
 * ShareOptionsSheetContent — inner content for the share-options bottom sheet.
 * Designed to be pushed via useBottomSheet().show() rather than a Modal.
 *
 * Props:
 *   result           – full resolved result from resolveMatch()
 *   onClose()        – dismiss the sheet
 *   onShare(selected) – called with { serviceKey: [code, ...] }
 */
export function ShareOptionsSheetContent({ result, onClose, onShare }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  const [selected, setSelected] = useState({});

  // Reset selections whenever the result changes.
  useEffect(() => {
    if (result) {
      setSelected(buildDefaultSelectedCountries(result.providerSummary, result.rows));
    }
  }, [result?.tmdbId]);

  const toggleCountry = useCallback((serviceKey, code) => {
    setSelected((prev) => {
      const cur = prev[serviceKey] || [];
      if (cur.includes(code)) {
        return { ...prev, [serviceKey]: cur.filter((c) => c !== code) };
      }
      if (cur.length < 2) {
        return { ...prev, [serviceKey]: [...cur, code] };
      }
      // At max: swap out the second slot
      return { ...prev, [serviceKey]: [cur[0], code] };
    });
  }, []);

  const availableProviders = (result?.providerSummary || []).filter((p) => p.count > 0);

  return (
    <View style={styles.contentRoot}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary, ...typography.labelSm }]}>
            SHARE CARD
          </Text>
          <Text style={[styles.title, { color: colors.onSurface, ...typography.titleLg }]}>
            Choose Countries
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
            Up to 2 per service
          </Text>
        </View>
      </View>

      {/* ── Service sections ────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {availableProviders.map((provider, idx) => {
          const countries = getAvailableCountriesForService(result.rows, provider.key);
          const sel = selected[provider.key] || [];
          const color = SERVICE_COLORS[provider.key];
          const isLast = idx === availableProviders.length - 1;

          return (
            <View
              key={provider.key}
              style={[
                styles.serviceSection,
                !isLast && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.outlineVariant + '26',
                },
              ]}
            >
              {/* Service row */}
              <View style={styles.serviceHeader}>
                <View
                  style={[
                    styles.serviceIconWrap,
                    { backgroundColor: color + '22', borderRadius: radii.md },
                  ]}
                >
                  {provider.logoUrl ? (
                    <Image
                      source={{ uri: provider.logoUrl }}
                      style={styles.serviceLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name={SERVICE_ICONS[provider.key] || 'play-circle'}
                      size={16}
                      color={color}
                    />
                  )}
                </View>
                <Text
                  style={[styles.serviceName, { color: colors.onSurface, ...typography.bodyLg }]}
                >
                  {provider.label}
                </Text>
                <Text
                  style={[
                    styles.selCount,
                    {
                      color: sel.length === 2 ? color : colors.onSurfaceVariant,
                      ...typography.labelSm,
                    },
                  ]}
                >
                  {sel.length}/2
                </Text>
              </View>

              {/* Country chips */}
              <View style={styles.chipsWrap}>
                {countries.map((code) => {
                  const isSel = sel.includes(code);
                  return (
                    <TouchableOpacity
                      key={code}
                      onPress={() => toggleCountry(provider.key, code)}
                      activeOpacity={0.75}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSel ? color + '22' : colors.surfaceContainerHigh,
                          borderColor: isSel ? color : colors.outlineVariant + '44',
                          borderRadius: radii.md,
                        },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSel }}
                      accessibilityLabel={`${shortName(code)} on ${provider.label}`}
                    >
                      {isSel && <Ionicons name="checkmark" size={11} color={color} />}
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSel ? color : colors.onSurfaceVariant },
                        ]}
                      >
                        {shortName(code)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.shareBtn, { backgroundColor: colors.primary, borderRadius: radii.lg }]}
        onPress={() => onShare(selected)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Generate and share card"
      >
        <Ionicons name="share-social-outline" size={18} color={colors.onPrimary} />
        <Text style={[styles.shareBtnText, { color: colors.onPrimary, ...typography.labelSm }]}>
          GENERATE & SHARE
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Legacy wrapper kept for compatibility — wraps ShareOptionsSheetContent in a Modal.
 * New code should push ShareOptionsSheetContent via useBottomSheet().show() instead.
 */
export function ShareOptionsSheet({ visible, result, onClose, onShare }) {
  const { theme } = useTheme();
  const { colors, radii } = theme;
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant + '4D',
              borderRadius: radii.xl,
              paddingBottom: Math.max(insets.bottom, 12) + 20,
            },
          ]}
        >
          <ShareOptionsSheetContent result={result} onClose={onClose} onShare={onShare} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    margin: 16,
    padding: 20,
    borderWidth: 1,
    maxHeight: '82%',
  },
  contentRoot: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
    flexShrink: 0,
  },
  eyebrow: {
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontWeight: '900',
    marginBottom: 2,
  },
  subtitle: {
    lineHeight: 18,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    gap: 0,
    paddingBottom: 4,
  },
  serviceSection: {
    paddingVertical: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  serviceName: {
    flex: 1,
    fontWeight: '700',
  },
  selCount: {
    fontWeight: '900',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shareBtn: {
    marginTop: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexShrink: 0,
  },
  shareBtnText: {
    fontWeight: '900',
    letterSpacing: 1,
  },
});
