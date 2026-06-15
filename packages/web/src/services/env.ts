/** Browser-exposed config (Vite injects VITE_* at build time). */
export const env = {
  // Empty string = same origin (correct in production where API and web are co-located).
  // Set VITE_API_BASE_URL=http://localhost:4000 only when running web separately from the server.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
};

export const hasGoogleSignIn = (): boolean => env.googleClientId !== '';
export const hasMaps = (): boolean => env.googleMapsApiKey !== '';
