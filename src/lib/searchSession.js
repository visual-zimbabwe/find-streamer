/**
 * The committed-search surface has to describe one query at a time. Keeping
 * this state separate from the editable field prevents the previous query's
 * cards from surviving while a new submit is in flight.
 */
export const SEARCH_PHASE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  RESULTS: 'results',
  EMPTY: 'empty',
  ERROR: 'error',
});

export const INITIAL_SEARCH_SESSION = Object.freeze({
  phase: SEARCH_PHASE.IDLE,
  submittedQuery: '',
  results: [],
  error: null,
});

/**
 * Pure reducer for the committed-results surface. Request IDs stay in the
 * controller because they coordinate promises; this only describes what may be
 * on screen after the controller has accepted a response.
 */
export function searchSessionReducer(state, action) {
  switch (action.type) {
    case 'SUBMIT':
      return {
        phase: SEARCH_PHASE.LOADING,
        submittedQuery: action.query,
        results: [],
        error: null,
      };
    case 'RESOLVE':
      return {
        ...state,
        phase: SEARCH_PHASE.RESULTS,
        results: action.results,
        error: null,
      };
    case 'EMPTY':
      return {
        ...state,
        phase: SEARCH_PHASE.EMPTY,
        results: [],
        error: null,
      };
    case 'FAIL':
      return {
        ...state,
        phase: SEARCH_PHASE.ERROR,
        results: [],
        error: action.error,
      };
    // Editing invalidates a committed answer immediately. A new live-search
    // panel can then answer the text the user can actually see in the field.
    case 'EDIT':
      return state.phase === SEARCH_PHASE.IDLE ? state : INITIAL_SEARCH_SESSION;
    case 'CLEAR':
      return INITIAL_SEARCH_SESSION;
    default:
      return state;
  }
}
