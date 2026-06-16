/** An authenticated family member (from Google sign-in). */
export interface User {
  id: string; // stable Google subject id
  name: string;
  email: string;
  pictureUrl?: string;
  /** True when this user's email is in the server's admin list. */
  isAdmin?: boolean;
}
