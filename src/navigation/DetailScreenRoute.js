import React, { useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ResultView } from '../components/ResultView';
import { useDetail, useSearch, useWatchlist, usePeople } from '../context/domainContexts';
import { watchlistEntryKey } from '../lib/watchlistModel';

/**
 * The Detail screen, shared by all four tab stacks — they had four byte-identical
 * copies of this before.
 *
 * Reads its payload by the push id in `route.params`, not from a shared
 * `selectedResult`. The stack can hold several Detail screens at once (More Like
 * This pushes another one); with a single slot, backing out of the second landed
 * on the first rendering the second one's content, Share and bookmark included.
 */
export function DetailScreenRoute() {
  const navigation = useNavigation();
  const route = useRoute();
  const detailId = route.params?.detailId;
  const { details, releaseDetail, retryDetail } = useDetail();
  const { handleToggleWatchlist, handleEnrichWatchlistItem, savedWatchlistKeys } = useWatchlist();
  const { handleSelectMatch } = useSearch();
  const { handlePersonPress, handleCompanyPress, handleCollectionPress } = usePeople();

  const entry = detailId ? details[detailId] : null;

  // Release on unmount rather than on `beforeRemove`: the entry has to outlive
  // the pop animation, or the screen re-renders empty on its way out.
  useEffect(() => {
    if (!detailId) return undefined;
    return () => releaseDetail(detailId);
  }, [detailId, releaseDetail]);

  return (
    <ResultView
      result={entry?.result ?? null}
      loading={Boolean(entry?.loading)}
      error={entry?.error ?? null}
      onRetry={() => retryDetail(detailId)}
      onBack={() => navigation.goBack()}
      onToggleWatchlist={handleToggleWatchlist}
      onEnrichWatchlistItem={handleEnrichWatchlistItem}
      isInWatchlist={savedWatchlistKeys.includes(watchlistEntryKey(entry?.result))}
      onSelectSimilar={(match) => handleSelectMatch(match, navigation)}
      onPersonPress={(personId, personName, role) =>
        handlePersonPress(personId, personName, role, navigation)
      }
      onCompanyPress={(companyId, companyName, logoUrl) =>
        handleCompanyPress(companyId, companyName, logoUrl, navigation)
      }
      onCollectionPress={(collection, currentTmdbId) =>
        handleCollectionPress(collection, currentTmdbId, navigation)
      }
      onSeeAllPeople={(params) => navigation.push('FullCast', params)}
    />
  );
}
