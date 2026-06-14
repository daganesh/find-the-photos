import { JsonRouteRepository, type RouteRepository } from './storage/routeRepository.js';
import { JsonHuntRepository, type HuntRepository } from './storage/huntRepository.js';
import { PhotoStore } from './photos/photoStore.js';
import { createImageMatchService, type ImageMatchService } from './gemini/imageMatch.js';

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
  return {
    routes: new JsonRouteRepository(),
    hunts: new JsonHuntRepository(),
    photos: new PhotoStore(),
    imageMatch: createImageMatchService(),
  };
}
