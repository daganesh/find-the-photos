import type { GeoPoint } from './geo.js';

/** A clue for an item. Either typed text or a short recorded audio clip. */
export interface Hint {
  kind: 'text' | 'audio';
  /** Present when kind === 'text'. */
  text?: string;
  /** Present when kind === 'audio' — URL to the stored clip. */
  audioUrl?: string;
  /** Optional duration of the audio clip, in seconds. */
  audioDurationS?: number;
}

/** One photo of an item, ideally captured from a distinct angle. */
export interface Photo {
  id: string;
  url: string;
  /** Free-text angle label, e.g. "front", "from the bench". */
  angleLabel?: string;
}

/** A single thing to find on a route. */
export interface Item {
  id: string;
  /** 'photo' (default) = photo-match hunt item. 'task' = AI-scored action. 'riddle' = text answer compared to name. */
  kind?: 'photo' | 'task' | 'riddle';
  name: string;
  description?: string;
  hint: Hint;
  /** Optional additional clues shown alongside the primary hint. */
  extraHints?: Hint[];
  /** Reference photos used both as clues and for AI matching. */
  photos: Photo[];
  /** Where it is. Optional: the device may have no/disabled GPS. */
  location?: GeoPoint;
  /** Flagged internally when hunters struggle (skips / many clues). */
  difficult: boolean;
  /** For task items: the full instruction shown to the player ("Jump as high as you can!"). */
  taskInstruction?: string;
}

export type RouteStatus = 'draft' | 'ready';

/** A player's star rating of a route they finished. */
export interface Rating {
  hunterId: string;
  stars: number; // 1..5
  comment?: string;
  createdAt: string; // ISO timestamp
}

/** The core game object: an ordered list of items to find. */
export interface Route {
  id: string;
  title: string;
  description?: string;
  /** Optional hero image shown on the route card and play screen. */
  coverPhotoUrl?: string;
  authorId: string;
  items: Item[];
  status: RouteStatus;
  createdAt: string; // ISO timestamp
  ratings: Rating[];
  /** Average of ratings.stars, or undefined when unrated. */
  avgRating?: number;
}
