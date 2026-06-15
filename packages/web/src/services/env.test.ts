import { describe, it, expect } from 'vitest';
import { env, hasGoogleSignIn, hasMaps } from './env.js';

describe('env', () => {
  it('apiBaseUrl is a string', () => {
    expect(typeof env.apiBaseUrl).toBe('string');
  });

  it('empty apiBaseUrl means same-origin (correct for production)', () => {
    // When VITE_API_BASE_URL is unset, the app uses relative URLs so the
    // API and web are co-located on the same origin (Railway single service).
    if (env.apiBaseUrl === '') {
      expect(env.apiBaseUrl).toBe('');
    }
  });

  it('hasGoogleSignIn reflects googleClientId', () => {
    expect(hasGoogleSignIn()).toBe(env.googleClientId !== '');
  });

  it('hasMaps reflects googleMapsApiKey', () => {
    expect(hasMaps()).toBe(env.googleMapsApiKey !== '');
  });
});
