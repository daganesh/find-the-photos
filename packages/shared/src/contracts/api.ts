import type { Hint, Item, Route, Rating } from '../models/route.js';
import type { GeoPoint } from '../models/geo.js';
import type { HuntSession, MatchVerdict, StepProgress } from '../models/hunt.js';
import type { User } from '../models/user.js';

/**
 * Request/response shapes shared by the web client and the server so the two
 * cannot drift. Keep these JSON-serialisable (no class instances, no Dates).
 */

// --- Auth ---
export interface GoogleSignInRequest {
  /** The ID token from Google Identity Services. */
  credential: string;
}
export interface SessionResponse {
  token: string;
  user: User;
}

// --- Routes (authoring) ---
export interface CreateRouteRequest {
  title: string;
  description?: string;
}

export interface ItemInput {
  name: string;
  description?: string;
  hint: Hint;
  /** Ids of photos already uploaded via the photos endpoint. */
  photoIds: string[];
  location?: GeoPoint;
}

export interface UpdateRouteRequest {
  title?: string;
  description?: string;
  /** Replace the full ordered item list (handles add/edit/reorder/remove). */
  items?: Item[];
}

export interface RouteSummary {
  id: string;
  title: string;
  description?: string;
  authorId: string;
  itemCount: number;
  status: Route['status'];
  avgRating?: number;
  createdAt: string;
}

// --- Photos ---
export interface UploadedPhotoResponse {
  id: string;
  url: string;
}

// --- Hunt (playing) ---
export interface StartHuntResponse {
  session: HuntSession;
}

export interface SubmitPhotoResponse {
  verdict: MatchVerdict;
  step: StepProgress;
  session: HuntSession;
}

export interface EscalateHelpRequest {
  /** Current device location, when available, to choose the right help. */
  hunterLocation?: GeoPoint;
}

export interface RateRouteRequest {
  stars: number;
  comment?: string;
}

export type RatingResponse = Rating;

/** Standard error body returned by the API. */
export interface ApiError {
  error: string;
  details?: unknown;
}
