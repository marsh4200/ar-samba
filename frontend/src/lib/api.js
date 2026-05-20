// Minimal fetch-based API client with JWT and automatic refresh.

const ACCESS_KEY = 'sc.access';
const REFRESH_KEY = 'sc.refresh';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let refreshing = null;

async function tryRefresh() {
  const rt = getRefreshToken();
  if (!rt) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await fetch(`/api/auth/refresh?refresh_token=${encodeURIComponent(rt)}`, {
          method: 'POST',
        });
        if (!r.ok) return false;
        const body = await r.json();
        setTokens(body);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function api(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(opts.headers || {}) };
  if (!opts.headers['Content-Type'] && opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
  }
  const token = getAccessToken();
  if (token && !opts.headers.Authorization) {
    opts.headers.Authorization = `Bearer ${token}`;
  }
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }

  let res = await fetch(`/api${path}`, opts);

  // One-shot refresh attempt on 401
  if (res.status === 401 && getRefreshToken()) {
    const ok = await tryRefresh();
    if (ok) {
      opts.headers.Authorization = `Bearer ${getAccessToken()}`;
      res = await fetch(`/api${path}`, opts);
    } else {
      clearTokens();
    }
  }

  if (res.status === 204) return null;

  let payload = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }

  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && (payload.detail || payload.message)) ||
      (typeof payload === 'string' && payload) ||
      `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, payload);
  }
  return payload;
}

api.get  = (p, o)   => api(p, { ...o, method: 'GET' });
api.post = (p, b, o) => api(p, { ...o, method: 'POST', body: b });
api.put  = (p, b, o) => api(p, { ...o, method: 'PUT', body: b });
api.patch = (p, b, o) => api(p, { ...o, method: 'PATCH', body: b });
api.del  = (p, o)   => api(p, { ...o, method: 'DELETE' });

export { ApiError };
