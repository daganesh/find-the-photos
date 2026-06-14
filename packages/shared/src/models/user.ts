/** An authenticated family member (from Google sign-in). */
export interface User {
  id: string; // stable Google subject id
  name: string;
  email: string;
  pictureUrl?: string;
}
