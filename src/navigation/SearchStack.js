import React from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchPanel } from '../components/SearchPanel';
import { MatchResults } from '../components/MatchResults';
import { EmptyState } from '../components/EmptyState';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { FullCastScreen } from '../components/FullCastScreen';
import {
  useSearch,
  useDetail,
  useWatchlist,
  useSurprise,
  useNav,
  usePeople,
} from '../context/domainContexts';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useTheme } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';
import { GOLD_ACCENT, GOLD_DIM, SCROLL_BOTTOM_PAD } from '../theme/programme';

const Stack = createNativeStackNavigator();

function SearchMainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, resolvedMode } = useTheme();
  const { colors } = theme;
  const bottomNavScroll = useBottomNavScroll();
  const {
    query,
    handleQueryChange,
    handleSearch,
    recentSearches,
    results,
    filteredResults,
    filter,
    setFilter,
    typeResults,
    typeLoading,
    handleTypeSelect,
    toggleVoiceSearch,
    voiceListening,
    handleSelectMatch,
    clearSearchResults,
  } = useSearch();
  const { loading, recentViewed } = useDetail();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();
  const { surpriseLoading, setSurprisePickerVisible } = useSurprise();
  const { handleTabPress } = useNav();

  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];
  const surpriseSurface = colors.glass;

  return (
    <View style={[searchStyles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={atmosphereColors}
        style={searchStyles.atmosphereTop}
        pointerEvents="none"
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          searchStyles.scrollContent,
          { paddingTop: insets.top + scale(8), paddingBottom: insets.bottom + SCROLL_BOTTOM_PAD },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        {...bottomNavScroll}
      >
        <SearchPanel
          value={query}
          onChangeText={handleQueryChange}
          onSubmit={() => handleSearch(query, navigation)}
          loading={loading}
          recentSearches={recentSearches}
          recentViewed={recentViewed}
          onPickSuggestion={(suggestion) => handleSearch(suggestion, navigation)}
          onPickRecentViewed={(match) => handleSelectMatch(match, navigation)}
          hideHistory={results.length > 0}
          typeResults={typeResults}
          typeLoading={typeLoading}
          onTypeSelect={(match) => handleTypeSelect(match, navigation)}
          onVoicePress={toggleVoiceSearch}
          voiceListening={voiceListening}
        />
        {results.length > 0 && (
          <>
            <MatchResults
              matches={filteredResults}
              onSelect={(match) => handleSelectMatch(match, navigation)}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={savedWatchlistKeys}
            />
            {filteredResults.length === 0 && (
              <EmptyState
                variant="empty"
                title="No matches found"
                description={
                  filter
                    ? `We couldn't find any ${filter === 'movie' ? 'movies' : 'TV shows'} for "${query}".`
                    : `We couldn't find any matches for "${query}".`
                }
                primaryAction={
                  filter
                    ? {
                        label: 'Clear Filters',
                        icon: 'close-circle-outline',
                        onPress: () => setFilter(null),
                        accessibilityLabel: 'Clear result filters',
                      }
                    : {
                        label: 'Check Spelling',
                        icon: 'create-outline',
                        onPress: clearSearchResults,
                        accessibilityLabel: 'Edit search text',
                      }
                }
                secondaryAction={{
                  label: 'Discover',
                  onPress: () => handleTabPress('discover'),
                  accessibilityLabel: 'Go to Discover',
                }}
                compact
              />
            )}
          </>
        )}
      </ScrollView>

      <View
        style={[
          searchStyles.surpriseDock,
          { bottom: insets.bottom + 88, paddingHorizontal: scale(22) },
        ]}
      >
        <TouchableOpacity
          style={[
            searchStyles.surpriseButton,
            { backgroundColor: surpriseSurface, borderColor: GOLD_DIM },
          ]}
          onPress={() => setSurprisePickerVisible(true)}
          disabled={surpriseLoading}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel="Surprise Me – pick a random movie or show"
          accessibilityState={{ busy: Boolean(surpriseLoading) }}
        >
          <LinearGradient
            colors={['rgba(212,168,83,0.28)', 'rgba(212,168,83,0.08)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={searchStyles.surpriseFabGradient}
          >
            {surpriseLoading ? (
              <ActivityIndicator color={GOLD_ACCENT} size="small" />
            ) : (
              <Ionicons name="sparkles" size={18} color={GOLD_ACCENT} />
            )}
            <View style={searchStyles.surpriseCopy}>
              <Text style={[searchStyles.surpriseEyebrow, { color: GOLD_ACCENT }]}>
                {surpriseLoading ? 'Shuffling' : 'Programme Roulette'}
              </Text>
              <Text style={[searchStyles.surpriseFabLabel, { color: colors.onSurface }]}>
                {surpriseLoading ? 'Finding your pick…' : 'Surprise Me'}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={GOLD_ACCENT}
              style={{ opacity: 0.8 }}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SearchDetailScreen() {
  const navigation = useNavigation();
  const { selectedResult } = useDetail();
  const {
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
    savedWatchlistKeys,
  } = useWatchlist();
  const { handleSelectMatch } = useSearch();
  const { handlePersonPress, handleCompanyPress } = usePeople();

  return (
    <ResultView
      result={selectedResult}
      onBack={() => navigation.goBack()}
      onToggleWatchlist={handleToggleWatchlist}
      onEnrichWatchlistItem={handleEnrichWatchlistItem}
      isInWatchlist={savedWatchlistKeys.includes(watchlistEntryKey(selectedResult))}
      onSelectSimilar={(match) => handleSelectMatch(match, navigation)}
      onPersonPress={(personId, personName, role) =>
        handlePersonPress(personId, personName, role, navigation)
      }
      onCompanyPress={(companyId, companyName, logoUrl) =>
        handleCompanyPress(companyId, companyName, logoUrl, navigation)
      }
      onSeeAllPeople={(params) => navigation.push('FullCast', params)}
    />
  );
}

function SearchFullCastScreen({ route }) {
  const navigation = useNavigation();
  const { handlePersonPress } = usePeople();
  const { title, cast, crew } = route.params || {};

  return (
    <FullCastScreen
      title={title}
      cast={cast}
      crew={crew}
      onPersonPress={(personId, personName, role) =>
        handlePersonPress(personId, personName, role, navigation)
      }
    />
  );
}

function SearchFilmographyScreen() {
  const navigation = useNavigation();
  const { filmographyPerson, filmographyResults, filmographyLoading, handleSelectFilmographyItem } =
    usePeople();

  if (!filmographyPerson) return null;

  return (
    <FilmographyScreen
      personName={filmographyPerson.name}
      role={filmographyPerson.role}
      profileUrl={filmographyPerson.profileUrl}
      total={filmographyPerson.total}
      results={filmographyResults}
      onSelectItem={(item) => handleSelectFilmographyItem(item, navigation)}
      loading={filmographyLoading}
    />
  );
}

export function SearchStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Search" component={SearchMainScreen} />
      <Stack.Screen name="Detail" component={SearchDetailScreen} />
      <Stack.Screen name="FullCast" component={SearchFullCastScreen} />
      <Stack.Screen name="Filmography" component={SearchFilmographyScreen} />
    </Stack.Navigator>
  );
}

const searchStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  atmosphereTop: {
    height: verticalScale(280),
    left: 0,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrollContent: {
    paddingTop: scale(4),
  },
  surpriseDock: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  surpriseButton: {
    borderRadius: scale(16),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  surpriseFabGradient: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(10),
    minHeight: 52,
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  surpriseCopy: {
    flex: 1,
    minWidth: 0,
  },
  surpriseEyebrow: {
    fontSize: scale(9),
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 2,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  surpriseFabLabel: {
    fontSize: scale(14),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
