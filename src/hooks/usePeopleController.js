import { useState, useCallback } from 'react';
import { fetchPersonFilmography, fetchProductionCompanyCatalog } from '../lib/tmdb';
import { pushOnCurrentTab } from '../navigation/navigationRef';

/**
 * Owns the people/company filmography screen: the active subject, its results,
 * and the loading flag, plus the handlers that open a person's filmography, a
 * production company's catalog, and a selected title from those lists.
 *
 * @param {{
 *   openResolvedDetail: (queryTitle: string, match: object, navigation: object, fallbackMessage?: string) => Promise<void>,
 *   handleRequestError: (err: unknown, fallbackMessage: string, options?: object) => void,
 *   setOfflineBanner: (value: object | null) => void,
 * }} deps
 */
export function usePeopleController({ openResolvedDetail, handleRequestError, setOfflineBanner }) {
  const [filmographyPerson, setFilmographyPerson] = useState(null); // { id, name, role }
  const [filmographyResults, setFilmographyResults] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);

  const openFilmography = useCallback((navigation) => {
    if (navigation) {
      navigation.push('Filmography');
    } else {
      pushOnCurrentTab('Filmography');
    }
  }, []);

  const handlePersonPress = useCallback(
    async (personId, personName, role, navigation) => {
      setFilmographyLoading(true);
      setFilmographyPerson({ id: personId, name: personName, role, profileUrl: null });
      setFilmographyResults([]);
      openFilmography(navigation);
      try {
        const { results, profileUrl } = await fetchPersonFilmography(personId, personName, role);
        setFilmographyResults(results);
        setFilmographyPerson((prev) => ({ ...prev, profileUrl }));
        setOfflineBanner(null);
      } catch (err) {
        handleRequestError(err, 'Unable to fetch filmography.');
      } finally {
        setFilmographyLoading(false);
      }
    },
    [openFilmography, handleRequestError, setOfflineBanner],
  );

  const handleCompanyPress = useCallback(
    async (companyId, companyName, logoUrl, navigation) => {
      setFilmographyLoading(true);
      setFilmographyPerson({
        id: companyId,
        name: companyName,
        role: 'company',
        profileUrl: logoUrl || null,
        total: null,
      });
      setFilmographyResults([]);
      openFilmography(navigation);
      try {
        const { results, profileUrl, total } = await fetchProductionCompanyCatalog(
          companyId,
          companyName,
          logoUrl,
        );
        setFilmographyResults(results);
        setFilmographyPerson((prev) => ({
          ...prev,
          profileUrl: profileUrl ?? prev.profileUrl,
          // The grid is a page-1 slice; the header needs the real catalogue
          // size to stop presenting that slice as the total.
          total: total ?? null,
        }));
        setOfflineBanner(null);
      } catch (err) {
        handleRequestError(err, 'Unable to load titles from this studio.');
      } finally {
        setFilmographyLoading(false);
      }
    },
    [openFilmography, handleRequestError, setOfflineBanner],
  );

  const handleSelectFilmographyItem = useCallback(
    async (item, navigation) => {
      await openResolvedDetail(item.title, item, navigation, 'Unable to fetch details.');
    },
    [openResolvedDetail],
  );

  return {
    filmographyPerson,
    filmographyResults,
    filmographyLoading,
    openFilmography,
    handlePersonPress,
    handleCompanyPress,
    handleSelectFilmographyItem,
  };
}
