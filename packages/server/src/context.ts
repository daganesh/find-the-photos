import { JsonRouteRepository, type RouteRepository } from './storage/routeRepository.js';
import { JsonHuntRepository, type HuntRepository } from './storage/huntRepository.js';
import { PgRouteRepository } from './storage/pgRouteRepository.js';
import { PgHuntRepository } from './storage/pgHuntRepository.js';
import { PhotoStore } from './photos/photoStore.js';
import { createImageMatchService, type ImageMatchService } from './gemini/imageMatch.js';
import { config } from './config.js';

/**
 * The app's wired-up dependencies. Built once and passed to routers, which keeps
 * them free of hidden globals and easy to test with fakes.
 */
export interface AppContext {
  routes: RouteRepository;
  hunts: HuntRepository;
  photos: PhotoStore;
  imageMatch: ImageMatchService;
}

export function createAppContext(): AppContext {
  const usePostgres = config.databaseUrl !== '';
  return {
    routes: usePostgres ? new PgRouteRepository() : new JsonRouteRepository(),
    hunts: usePostgres ? new PgHuntRepository() : new JsonHuntRepository(),
    photos: new PhotoStore(),
    imageMatch: createImageMatchService(),
  };
}
