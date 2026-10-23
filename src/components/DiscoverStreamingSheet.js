import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { fetchWatchProviderRegions } from '../lib/tmdb';
import {
  FALLBACK_WATCH_REGIONS,
} from '../lib/whereToWatch';
import { codesForCountryPreset } from '../lib/countryPresets';
import {
  SERVICE_DEFAULT_REGION,
  isServiceAvailableInRegion,
} from '../lib/providerAvailability';

const GOLD_ACCENT = '#D4AF37';

const CONTINENT_OPTIONS = [
  { id: 'all', label: 'All Continents' },
  { id: 'africa', label: 'Africa' },
  { id: 'asia', label: 'Asia' },
  { id: 'europe', label: 'Europe' },
  { id: 'north_america', label: 'North America' },
  { id: 'south_america', label: 'South America' },
  { id: 'oceania', label: 'Australia / Oceania' },
];

const DISCOVER_SERVICES = [
  { key: 'netflix', label: 'Netflix' },
  { key: 'amazon_prime_video', label: 'Prime Video' },
  { key: 'max', label: 'Max' },
  { key: 'paramount_plus', label: 'Paramount+', lockedCode: 'US', lockedLabel: 'United States' },
  { key: 'cbc_gem', label: 'CBC Gem', lockedCode: 'CA', lockedLabel: 'Canada' },
  { key: 'bbc_iplayer', label: 'BBC iPlayer', lockedCode: 'GB', lockedLabel: 'United Kingdom' },
  { key: 'channel_4', label: 'Channel 4', lockedCode: 'GB', lockedLabel: 'United Kingdom' },
  { key: 'itvx', label: 'ITVX', lockedCode: 'GB', lockedLabel: 'United Kingdom' },
  { key: 'sbs_on_demand', label: 'SBS On Demand', lockedCode: 'AU', lockedLabel: 'Australia' },
  { key: 'abc_iview', label: 'ABC iview', lockedCode: 'AU', lockedLabel: 'Australia' },
];

export function DiscoverStreamingSheet({
  selectedServiceKey = null,
  selectedRegionCode = null,
  selectedRegionLabel = null,
  onSelect,
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // Step 1 = Service selection, Step 2 = Country selection
  const [step, setStep] = useState(1);
  const [pendingService, setPendingService] = useState(selectedServiceKey);

  // Region picker states
  const [regions, setRegions] = useState(null);
  const [selectedContinent, setSelectedContinent] = useState('all');
  const [countryQuery, setCountryQuery] = useState('');

  useEffect(() => {
    let alive = true;
    fetchWatchProviderRegions()
      .then((fetched) => {
        if (alive && fetched && fetched.length) {
          setRegions(fetched);
        }
      })
      .catch(() => {
        // Fallback list handles failures
      });
    return () => {
      alive = false;
    };
  }, []);

  const allRegions = useMemo(() => {
    return regions || FALLBACK_WATCH_REGIONS;
  }, [regions]);

  const visibleRegions = useMemo(() => {
    let list = allRegions;

    // Filter by continent drill-down if active
    if (selectedContinent !== 'all') {
      const allowedCodes = new Set(codesForCountryPreset(selectedContinent));
      list = list.filter((r) => allowedCodes.has(r.code));
    }

    // Filter by country name search query
    const q = countryQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.label.toLowerCase().includes(q) || r.code.toLowerCase() === q,
      );
    }

    return list;
  }, [allRegions, selectedContinent, countryQuery]);

  const handleSelectService = useCallback(
    (service) => {
      if (!service) {
        // Clear filter
        onSelect({ serviceKey: null, regionCode: null, regionLabel: null });
        return;
      }

      // Check if service is region-locked (Paramount+ US, CBC Gem CA, etc.)
      const defaultRegion = SERVICE_DEFAULT_REGION[service.key];
      if (defaultRegion) {
        // Immediately lock and complete without prompting
        onSelect({
          serviceKey: service.key,
          regionCode: defaultRegion.code,
          regionLabel: defaultRegion.label,
        });
        return;
      }

      // Multi-region service (Netflix, Prime Video, Max) -> advance to country selection
      setPendingService(service.key);
      setStep(2);
    },
    [onSelect],
  );

  const handleSelectCountry = useCallback(
    (region) => {
      onSelect({
        serviceKey: pendingService,
        regionCode: region.code,
        regionLabel: region.label,
      });
    },
    [pendingService, onSelect],
  );

  if (step === 2) {
    const serviceObj = DISCOVER_SERVICES.find((s) => s.key === pendingService);
    const serviceTitle = serviceObj ? serviceObj.label : 'Streaming';

    return (
      <View style={styles.sheetContent}>
        <View style={styles.stepHeaderRow}>
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to service selection"
          >
            <Text style={[styles.backButtonText, { color: GOLD_ACCENT, ...typography.labelMd }]}>
              Back
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.stepTitle, { color: colors.onSurface, ...typography.titleSmall }]}
            numberOfLines={1}
          >
            Select Country for {serviceTitle}
          </Text>
        </View>

        {/* Continents Drill-down Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.continentsBar}
        >
          {CONTINENT_OPTIONS.map((continent) => {
            const isSelected = selectedContinent === continent.id;
            return (
              <TouchableOpacity
                key={continent.id}
                onPress={() => setSelectedContinent(continent.id)}
                style={[
                  styles.continentTab,
                  isSelected && styles.continentTabActive,
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filter by continent: ${continent.label}`}
              >
                <Text
                  style={[
                    styles.continentTabText,
                    {
                      color: isSelected ? GOLD_ACCENT : colors.onSurfaceVariant,
                      ...typography.labelSm,
                    },
                  ]}
                >
                  {continent.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Countries */}
        <View style={[styles.searchBox, { borderColor: colors.outlineVariant || '#333333' }]}>
          <TextInput
            value={countryQuery}
            onChangeText={setCountryQuery}
            placeholder="Search full country name"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[styles.searchInput, { color: colors.onSurface, ...typography.bodyMd }]}
            autoCorrect={false}
            accessibilityLabel="Search full country name"
          />
          {countryQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setCountryQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear country search"
            >
              <Text style={{ color: colors.onSurfaceVariant, ...typography.labelSm, paddingHorizontal: 6 }}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Countries List */}
        <ScrollView style={styles.countryList} keyboardShouldPersistTaps="handled">
          {visibleRegions.map((region) => {
            const isSelected = region.code === selectedRegionCode;
            return (
              <TouchableOpacity
                key={region.code}
                onPress={() => handleSelectCountry(region)}
                style={styles.countryRow}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select ${region.label}`}
              >
                <Text
                  style={[
                    styles.countryLabel,
                    {
                      color: isSelected ? GOLD_ACCENT : colors.onSurface,
                      fontWeight: isSelected ? '700' : '500',
                      ...typography.bodyMd,
                    },
                  ]}
                >
                  {region.label}
                </Text>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={GOLD_ACCENT} />
                ) : null}
              </TouchableOpacity>
            );
          })}
          {visibleRegions.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
              No countries found.
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // Step 1: Services List
  return (
    <View style={styles.sheetContent}>
      {/* Clear / All Services */}
      <TouchableOpacity
        onPress={() => handleSelectService(null)}
        style={styles.serviceRow}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Show all streaming services"
      >
        <View style={styles.serviceCopy}>
          <Text
            style={[
              styles.serviceLabel,
              {
                color: !selectedServiceKey ? GOLD_ACCENT : colors.onSurface,
                fontWeight: !selectedServiceKey ? '700' : '500',
                ...typography.bodyLg,
              },
            ]}
          >
            All Services
          </Text>
          <Text style={[styles.serviceSublabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
            Browse full catalog without streaming provider filter
          </Text>
        </View>
        {!selectedServiceKey ? (
          <Ionicons name="checkmark" size={20} color={GOLD_ACCENT} />
        ) : null}
      </TouchableOpacity>

      {/* 10 Services */}
      {DISCOVER_SERVICES.map((service) => {
        const isSelected = service.key === selectedServiceKey;

        // Check availability if a service and region are already actively chosen
        const availableInActiveRegion = (selectedServiceKey && selectedRegionCode)
          ? isServiceAvailableInRegion(service.key, selectedRegionCode)
          : true;

        let subtext = null;
        if (service.lockedLabel) {
          subtext = `Available in ${service.lockedLabel} only`;
        }

        return (
          <TouchableOpacity
            key={service.key}
            onPress={() => {
              if (availableInActiveRegion) {
                handleSelectService(service);
              }
            }}
            disabled={!availableInActiveRegion}
            style={[
              styles.serviceRow,
              !availableInActiveRegion && { opacity: 0.35 },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${service.label}${subtext ? `, ${subtext}` : ''}`}
          >
            <View style={styles.serviceCopy}>
              <Text
                style={[
                  styles.serviceLabel,
                  {
                    color: isSelected ? GOLD_ACCENT : colors.onSurface,
                    fontWeight: isSelected ? '700' : '500',
                    ...typography.bodyLg,
                  },
                ]}
              >
                {service.label}
              </Text>
              {subtext ? (
                <Text style={[styles.serviceSublabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                  {subtext}
                </Text>
              ) : null}
            </View>
            {isSelected ? (
              <Ionicons name="checkmark" size={20} color={GOLD_ACCENT} />
            ) : null}
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.footnote, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
        Only includes titles streaming on subscription or free tiers. Rent and buy options are excluded.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 14,
  },
  backButtonText: {
    letterSpacing: 0.3,
  },
  stepTitle: {
    flex: 1,
    letterSpacing: 0.2,
  },
  continentsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 10,
    gap: 8,
  },
  continentTab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  continentTabActive: {},
  continentTabText: {
    letterSpacing: 0.2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 4,
  },
  countryList: {
    maxHeight: 320,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  countryLabel: {
    letterSpacing: 0.2,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  serviceCopy: {
    flex: 1,
    marginRight: 12,
  },
  serviceLabel: {
    letterSpacing: 0.2,
  },
  serviceSublabel: {
    marginTop: 2,
    letterSpacing: 0.1,
  },
  footnote: {
    marginTop: 18,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
  },
});
