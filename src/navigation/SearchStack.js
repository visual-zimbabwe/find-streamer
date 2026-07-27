import React, { useRef } from 'react';
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
import { MatchResults, SearchResultsLoading } from '../components/MatchResults';
import { EmptyState } from '../components/EmptyState';
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
import { DetailScreenRoute } from './DetailScreenRoute';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useTheme } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';
import { GOLD_ACCENT, GOLD_DIM, SCROLL_BOTTOM_PAD } from '../theme/programme';

const Stack = createNativeStackNavigator();

/**
 * The Surprise Me dock floats over the scroll view, so scroll content has to end
 * above it. `SCROLL_BOTTOM_PAD` only clears the bottom nav, which left the dock
 * sitting on top of the "Also Matched" header and the first row of result
 * posters (and, on an empty search, on the rail headers below it).
 */
const SURPRISE_DOCK_OFFSET = 88;
const SURPRISE_DOCK_HEIGHT = 76; // 52 minHeight + 12 padding top/bottom
const SEARCH_SCROLL_BOTTOM_PAD = Math.max(
  SCROLL_BOTTOM_PAD,
  SURPRISE_DOCK_OFFSET + SURPRISE_DOCK_HEIGHT + 16,
);

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
    searchPhase,
    searchError,
    submittedQuery,
    typeResults,
    typeLoading,
    handleTypeSelect,
    toggleVoiceSearch,
    voiceListening,
    handleSelectMatch,
    clearSearch,
    loading,
  } = useSearch();
  const { recentViewed } = useDetail();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();
  const { surpriseLoading, setSurprisePickerVisible } = useSurprise();
  const { handleTabPress } = useNav();
  const searchInputRef = useRef(null);

  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];
  const surpriseSurface = colors.glass;
  const showLoadingState = searchPhase === 'loading';
  const showResults = searchPhase === 'results' && results.length > 0;
  const showEmptyState = searchPhase === 'empty';
  const showErrorState = searchPhase === 'error';
  const focusSearchInput = () => searchInputRef.current?.focus();

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
          {
            paddingTop: insets.top + scale(8),
            paddingBottom: insets.bottom + SEARCH_SCROLL_BOTTOM_PAD,
          },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        {...bottomNavScroll}
      >
        <SearchPanel
          ref={searchInputRef}
          value={query}
          onChangeText={handleQueryChange}
          onSubmit={() => handleSearch(query, navigation)}
          loading={loading}
          recentSearches={recentSearches}
          recentViewed={recentViewed}
          onPickSuggestion={(suggestion) => handleSearch(suggestion, navigation)}
          onPickRecentViewed={(match) => handleSelectMatch(match, navigation)}
          hideHistory={searchPhase !== 'idle'}
          typeResults={typeResults}
          typeLoading={typeLoading}
          onTypeSelect={(match) => handleTypeSelect(match, navigation)}
          onClear={clearSearch}
          submittedQuery={submittedQuery}
          onVoicePress={toggleVoiceSearch}
          voiceListening={voiceListening}
        />
        {showLoadingState && <SearchResultsLoading query={submittedQuery} />}
        {showResults && (
          <MatchResults
            matches={results}
            onSelect={(match) => handleSelectMatch(match, navigation)}
            onToggleWatchlist={handleToggleWatchlist}
            watchlistIds={savedWatchlistKeys}
          />
        )}
        {showEmptyState && (
          <EmptyState
            variant="empty"
            title="No matches found"
            description={`We couldn't find anything for “${submittedQuery}”. Try a shorter title or edit your search.`}
            primaryAction={{
              label: 'Edit Search',
              icon: 'create-outline',
              onPress: focusSearchInput,
              accessibilityLabel: `Edit search for ${submittedQuery}`,
            }}
            secondaryAction={{
              label: 'Discover',
              onPress: () => handleTabPress('discover'),
              accessibilityLabel: 'Go to Discover',
            }}
            compact
          />
        )}
        {showErrorState && (
          <EmptyState
            variant={
              searchError?.severity === 'offline'
                ? 'offline'
                : searchError?.severity === 'service'
                  ? 'service'
                  : 'error'
            }
            title={searchError?.title || 'Unable to search right now'}
            description={searchError?.message || 'Please try your search again.'}
            primaryAction={{
              label: 'Try Again',
              icon: 'refresh-outline',
              onPress: () => handleSearch(submittedQuery, navigation),
              accessibilityLabel: `Retry search for ${submittedQuery}`,
            }}
            secondaryAction={{
              label: 'Edit Search',
              onPress: focusSearchInput,
              accessibilityLabel: `Edit search for ${submittedQuery}`,
            }}
            compact
          />
        )}
      </ScrollView>

      <View
        style={[
          searchStyles.surpriseDock,
          { bottom: insets.bottom + SURPRISE_DOCK_OFFSET, paddingHorizontal: scale(22) },
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
      currentTmdbId={filmographyPerson.currentTmdbId}
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
      <Stack.Screen name="Detail" component={DetailScreenRoute} />
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
