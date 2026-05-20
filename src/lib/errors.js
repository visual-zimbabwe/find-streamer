const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export function createAppError(message, code = 'UNKNOWN_ERROR', details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function classifyAppError(error) {
  const code = error?.code;
  const message = error?.message || '';
  const status = error?.status;

  console.error('[classifyAppError] Caught error:', error, 'Code:', code, 'Status:', status, 'Message:', message);
  if (error instanceof Error && error.stack) {
    console.error('[classifyAppError] Stack trace:', error.stack);
  }

  if (code === 'NO_RESULTS') {
    return {
      code,
      severity: 'empty',
      title: 'No matches found',
      message,
      retryable: false,
    };
  }

  if (
    code === 'OFFLINE' ||
    code === 'TIMEOUT' ||
    /network request failed|failed to fetch|internet|connection|timed out/i.test(message)
  ) {
    return {
      code: code || 'OFFLINE',
      severity: 'offline',
      title: 'No internet connection',
      message: 'Please check your connection and try again.',
      retryable: true,
    };
  }

  if (code === 'RATE_LIMITED' || status === 429) {
    return {
      code: 'RATE_LIMITED',
      severity: 'service',
      title: 'Please try again soon',
      message: 'Our movie database is busy right now. Give it a moment and refresh.',
      retryable: true,
    };
  }

  if (code === 'SERVICE_UNAVAILABLE' || (status >= 500 && status < 600)) {
    return {
      code: 'SERVICE_UNAVAILABLE',
      severity: 'service',
      title: 'Movie database unavailable',
      message: 'Our movie database is taking a quick coffee break. Please try again in a moment.',
      retryable: true,
    };
  }

  return {
    code: code || 'UNKNOWN_ERROR',
    severity: 'error',
    title: 'Something went wrong',
    message: message || 'Something went wrong. Please try again.',
    retryable: true,
  };
}

export function friendlyErrorMessage(error) {
  return classifyAppError(error).message;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff(task, {
  retries = 2,
  initialDelayMs = 350,
  shouldRetry = (error) => classifyAppError(error).retryable,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) break;
      await wait(initialDelayMs * (2 ** attempt));
    }
  }

  throw lastError;
}

export function isRetryableStatus(status) {
  return RETRYABLE_STATUS_CODES.has(status);
}
