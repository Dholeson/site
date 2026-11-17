// JSON API client. Every call has a timeout and throws ApiError on failure, parsed from the
// v2 error shape {"error": {"code", "message", "retry_after"?}} or the legacy shapes
// {"error": "Human text" | "snake_code", "retry_after"?} / {"message": "..."} / non-JSON pages.
//
//   const data = await api.get('/api/v2/reports', { params: { period: 'month' }, signal });
//   await api.post('/api/like', { track_id });
//
// Aborts raised by the caller's signal are re-thrown as the original AbortError (check
// isAbort(err) and ignore those). Timeouts and network failures become ApiError with
// status 0 and code 'timeout' / 'network'.

const DEFAULT_TIMEOUT_MS = 15000;

// The static web demo (static/js/demo/, dist/web-demo) answers every request in the browser:
// it installs a fetch-compatible transport here before the app starts. Unset everywhere else.
let transport = null;
/** Send all requests through fn(url, init) → Promise<Response> instead of the network. */
export function setTransport(fn) {
  transport = typeof fn === 'function' ? fn : null;
}

const FRIENDLY = {
  400: ['bad_request', 'The request was not accepted.'],
  401: ['signed_out', 'Spotify is not connected. Sign in to continue.'],
  403: ['forbidden', 'That action is not allowed.'],
  404: ['not_found', 'This feature is not available yet.'],
  409: ['conflict', 'Things changed before that could finish. Try again.'],
  410: ['expired', 'That is no longer available.'],
  413: ['too_large', 'That request was too large.'],
  429: ['rate_limited', 'Spotify is cooling down. Try again in a bit.'],
  500: ['server_error', 'The app hit an error. Try again.'],
  502: ['upstream_error', 'Spotify returned an error. Try again.'],
  503: ['unavailable', 'That is temporarily unavailable. Try again shortly.'],
  504: ['timeout', 'The request took too long. Try again.'],
};

export class ApiError extends Error {
  constructor({ status = 0, code = 'error', message = 'Something went wrong.', retryAfter = null, data = null, url = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;   // seconds, or null
    this.data = data;               // parsed body (may be null)
    this.url = url;
  }
  get isRateLimited() { return this.status === 429 || this.code === 'rate_limited'; }
  get isNotFound() { return this.status === 404; }
  get isUnavailable() { return this.status === 404 || this.status === 501 || this.status === 503; }
  get isNetwork() { return this.status === 0; }
}

export const isAbort = (err) => !!err && (err.name === 'AbortError' || err.code === 'aborted');

function buildUrl(path, params) {
  if (!params) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else qs.append(k, String(v));
  }
  const s = qs.toString();
  if (!s) return path;
  return path + (path.includes('?') ? '&' : '?') + s;
}

function parseRetryAfter(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.max(0, Math.round((t - Date.now()) / 1000)) : null;
}

/** Build an ApiError from a failed response (exported for tests / reuse). */
export function errorFromResponse(status, data, headers, url = '') {
  const [defCode, defMsg] = FRIENDLY[status] || (status >= 500 ? FRIENDLY[500] : FRIENDLY[400]);
  let code = defCode;
  let message = defMsg;
  let retryAfter = null;
  const err = data && typeof data === 'object' ? data.error : null;
  if (err && typeof err === 'object') {
    code = err.code || code;
    message = err.message || message;
    retryAfter = parseRetryAfter(err.retry_after ?? err.retryAfter ?? data.retry_after);
  } else if (typeof err === 'string' && err.trim()) {
    const s = err.trim();
    if (/^[a-z][a-z0-9_]*$/.test(s)) code = s === 'guard' ? 'rate_limited' : s; // legacy machine codes
    else message = s;
    if (data.message && typeof data.message === 'string') message = data.message;
    retryAfter = parseRetryAfter(data.retry_after);
  } else if (data && typeof data === 'object' && typeof data.message === 'string' && data.message) {
    message = data.message;
    retryAfter = parseRetryAfter(data.retry_after);
  }
  if (retryAfter == null && headers) retryAfter = parseRetryAfter(headers.get?.('Retry-After'));
  if (code === 'rate_limited' && message === defMsg && retryAfter) {
    message = `Spotify is cooling down. Try again in ${retryAfter < 90 ? `${retryAfter}s` : `${Math.ceil(retryAfter / 60)} min`}.`;
  }
  return new ApiError({ status, code, message, retryAfter, data, url });
}

async function request(method, path, { params, body, signal, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, keepalive = false } = {}) {
  const url = buildUrl(path, params);
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const hasBody = body !== undefined && method !== 'GET';
  let res;
  try {
    const init = {
      method,
      headers: { Accept: 'application/json', ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      signal: ctrl.signal,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive,
    };
    res = await (transport ? transport(url, init) : fetch(url, init));
  } catch (e) {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
    if (signal?.aborted) throw (signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
    if (timedOut) throw new ApiError({ status: 0, code: 'timeout', message: 'The app took too long to answer. Try again.', url });
    throw new ApiError({ status: 0, code: 'network', message: "Can't reach Discover Cleaner. Is the app still running?", url });
  }
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    clearTimeout(timer);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (timedOut) throw new ApiError({ status: 0, code: 'timeout', message: 'The app took too long to answer. Try again.', url });
    throw new ApiError({ status: res.status, code: 'network', message: 'The response was cut off. Try again.', url });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) throw errorFromResponse(res.status, data, res.headers, url);
  return data;
}

export const api = {
  get: (path, opts = {}) => request('GET', path, opts),
  post: (path, body = {}, opts = {}) => request('POST', path, { ...opts, body }),
  patch: (path, body = {}, opts = {}) => request('PATCH', path, { ...opts, body }),
  put: (path, body = {}, opts = {}) => request('PUT', path, { ...opts, body }),
  del: (path, opts = {}) => request('DELETE', path, opts),
  request,
  ApiError,
  isAbort,
};
export default api;
