import type {
  CreateRouteRequest,
  EscalateHelpRequest,
  GeoPoint,
  HuntSession,
  Rating,
  RateRouteRequest,
  Route,
  RouteSummary,
  SessionResponse,
  SubmitPhotoResponse,
  UpdateRouteRequest,
  UploadedPhotoResponse,
} from '@ftp/shared';
import { env } from './env.js';

const TOKEN_KEY = 'ftp.session.token';

/**
 * The single gateway to the server. UI and hooks call these typed methods;
 * nothing else makes network requests. Holds the session token and attaches it.
 */
export class ApiClient {
  private token: string | null = localStorage.getItem(TOKEN_KEY);

  setToken(token: string | null): void {
    this.token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const message = await res
        .json()
        .then((b) => (b as { error?: string }).error)
        .catch(() => undefined);
      throw new ApiError(res.status, message ?? `Request failed (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // --- Auth ---
  authConfig(): Promise<{ googleConfigured: boolean }> {
    return this.request('/api/auth/config');
  }
  signInWithGoogle(credential: string): Promise<SessionResponse> {
    return this.request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  // --- Routes ---
  listRoutes(): Promise<RouteSummary[]> {
    return this.request('/api/routes');
  }
  getRoute(id: string): Promise<Route> {
    return this.request(`/api/routes/${id}`);
  }
  createRoute(body: CreateRouteRequest): Promise<Route> {
    return this.request('/api/routes', { method: 'POST', body: JSON.stringify(body) });
  }
  updateRoute(id: string, body: UpdateRouteRequest): Promise<Route> {
    return this.request(`/api/routes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  finalizeRoute(id: string): Promise<Route> {
    return this.request(`/api/routes/${id}/finalize`, { method: 'POST' });
  }
  deleteRoute(id: string): Promise<void> {
    return this.request(`/api/routes/${id}`, { method: 'DELETE' });
  }
  rateRoute(id: string, body: RateRouteRequest): Promise<Rating> {
    return this.request(`/api/routes/${id}/ratings`, { method: 'POST', body: JSON.stringify(body) });
  }

  // --- Media ---
  async uploadFile(file: Blob, filename = 'upload'): Promise<UploadedPhotoResponse> {
    const form = new FormData();
    form.append('file', file, filename);
    return this.request('/api/photos', { method: 'POST', body: form });
  }

  // --- Hunt ---
  startHunt(routeId: string): Promise<{ session: HuntSession }> {
    return this.request('/api/hunt/start', { method: 'POST', body: JSON.stringify({ routeId }) });
  }
  getHunt(sessionId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}`);
  }
  submitHuntPhoto(sessionId: string, itemId: string, photo: Blob): Promise<SubmitPhotoResponse> {
    const form = new FormData();
    form.append('file', photo, 'attempt.jpg');
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/photo`, {
      method: 'POST',
      body: form,
    });
  }
  useHelp(
    sessionId: string,
    itemId: string,
    hunterLocation?: GeoPoint,
  ): Promise<{ session: HuntSession }> {
    const body: EscalateHelpRequest = { hunterLocation };
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/help`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  skipStep(sessionId: string, itemId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/skip`, { method: 'POST' });
  }
  disputeStep(sessionId: string, itemId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/dispute`, { method: 'POST' });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Shared singleton used across the app. */
export const api = new ApiClient();
