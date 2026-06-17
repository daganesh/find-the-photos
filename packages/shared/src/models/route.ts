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

/**
 * All supported item kinds, shared between hunt items and the final item.
 * Not every kind is valid in every context:
 *   Hunt items: photo | task | riddle | jigsaw
 *   Final item: riddle | code | jigsaw
 */
export type ItemKind = 'photo' | 'task' | 'riddle' | 'jigsaw' | 'code';

/** A single thing to find on a route. */
export interface Item {
  id: string;
  kind?: ItemKind;
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
  /** For task items: the full instruction shown to the player. */
  taskInstruction?: string;
  /** For jigsaw items: puzzle complexity (1=3×3, 2=5×5, 3=10×10). */
  jigsawDifficulty?: 1 | 2 | 3;
}

/**
 * An optional hidden bonus item collected progressively across the whole hunt.
 * As each regular item is solved the player earns a clue (letters / code
 * characters / jigsaw pieces) toward solving the final item.
 */
export interface FinalItem {
  kind: ItemKind; // riddle | code | jigsaw are the supported kinds
  /** For riddle: the question shown upfront. */
  riddleQuestion?: string;
  /** The answer / code to verify against. For jigsaw: what the photo shows. */
  answer: string;
  /** For jigsaw: the reference photo URL. */
  photoUrl?: string;
  /** For jigsaw: puzzle complexity (1=3×3, 2=5×5, 3=10×10). */
  difficulty?: 1 | 2 | 3;
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
  /** Optional bonus item unlocked progressively as hunt items are solved. */
  finalItem?: FinalItem;
}

