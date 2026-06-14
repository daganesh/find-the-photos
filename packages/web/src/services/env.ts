/** Browser-exposed config (Vite injects VITE_* at build time). */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
};

export const hasGoogleSignIn = (): boolean => env.googleClientId !== '';
export const hasMaps = (): boolean => env.googleMapsApiKey !== '';
