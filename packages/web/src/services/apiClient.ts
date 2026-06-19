import type {
  CleanupResult,
  CreateRouteRequest,
  EscalateHelpRequest,
  GeoPoint,
  HuntSession,
  ModerationResult,
  Rating,
  RateRouteRequest,
  Route,
  RouteSummary,
  SessionResponse,
  StorageStats,
  SubmitPhotoResponse,
  Team,
  TeamResult,
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
  finalizeRoute(id: string, flagOverride?: string): Promise<Route> {
    return this.request(`/api/routes/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ flagOverride }),
    });
  }
  moderateRoute(routeId: string): Promise<ModerationResult> {
    return this.request(`/api/routes/${routeId}/moderate`, { method: 'POST' });
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
  startHunt(routeId: string, location?: GeoPoint, reversed?: boolean): Promise<{ session: HuntSession }> {
    return this.request('/api/hunt/start', { method: 'POST', body: JSON.stringify({ routeId, location, reversed }) });
  }
  listMyHunts(): Promise<{ sessions: HuntSession[] }> {
    return this.request('/api/hunt/mine');
  }
  listAllMyHunts(): Promise<{ sessions: HuntSession[] }> {
    return this.request('/api/hunt/mine?finished=true');
  }
  getHunt(sessionId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}`);
  }
  pauseHunt(sessionId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/pause`, { method: 'POST' });
  }
  resumeHunt(sessionId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/resume`, { method: 'POST' });
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
  disputeStep(sessionId: string, itemId: string, description: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  }
  returnToSkipped(sessionId: string, itemId: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/return`, { method: 'POST' });
  }
  solveRiddle(sessionId: string, itemId: string, answer: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/steps/${itemId}/solve`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    });
  }
  solveFinalItem(sessionId: string, answer: string): Promise<{ session: HuntSession }> {
    return this.request(`/api/hunt/${sessionId}/solve-final`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    });
  }

  // --- Teams ---
  createTeam(routeId: string, name?: string, avatarEmoji?: string): Promise<Team> {
    return this.request('/api/teams', { method: 'POST', body: JSON.stringify({ routeId, name, avatarEmoji }) });
  }
  getTeam(teamId: string): Promise<Team> {
    return this.request(`/api/teams/${teamId}`);
  }
  listMyTeams(): Promise<{ teams: Team[] }> {
    return this.request('/api/teams/my');
  }
  joinTeamByCode(code: string, avatarEmoji?: string): Promise<Team> {
    return this.request(`/api/teams/join/${code}`, { method: 'POST', body: JSON.stringify({ avatarEmoji }) });
  }
  startTeamHunt(teamId: string, location?: GeoPoint, reversed?: boolean): Promise<{ team: Team; session: HuntSession }> {
    return this.request(`/api/teams/${teamId}/start`, { method: 'POST', body: JSON.stringify({ location, reversed }) });
  }
  pauseOrResumeTeam(teamId: string): Promise<Team> {
    return this.request(`/api/teams/${teamId}/pause`, { method: 'POST' });
  }
  getTeamLeaderboard(routeId: string): Promise<TeamResult[]> {
    return this.request(`/api/teams/route/${routeId}/leaderboard`);
  }

  // --- Admin ---
  getStorageStats(): Promise<StorageStats> {
    return this.request('/api/admin/storage');
  }
  cleanupOrphanedPhotos(): Promise<CleanupResult> {
    return this.request('/api/admin/cleanup/orphaned-photos', { method: 'DELETE' });
  }
  cleanupOldSessions(days = 30): Promise<CleanupResult> {
    return this.request(`/api/admin/cleanup/old-sessions?days=${days}`, { method: 'DELETE' });
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
