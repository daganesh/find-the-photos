import { JsonRouteRepository, type RouteRepository } from './storage/routeRepository.js';
import { JsonHuntRepository, type HuntRepository } from './storage/huntRepository.js';
import { JsonTeamRepository } from './storage/jsonTeamRepository.js';
import { PgRouteRepository } from './storage/pgRouteRepository.js';
import { PgHuntRepository } from './storage/pgHuntRepository.js';
import { PgTeamRepository } from './storage/pgTeamRepository.js';
import { JsonReportRepository } from './storage/jsonReportRepository.js';
import { PgReportRepository } from './storage/pgReportRepository.js';
import { PhotoStore } from './photos/photoStore.js';
import { createImageMatchService, type ImageMatchService } from './gemini/imageMatch.js';
import { createModerationService, type ModerationService } from './gemini/moderationService.js';
import { config } from './config.js';
import type { BugReport, Team } from '@ftp/shared';

export interface ReportRepository {
  list(): Promise<BugReport[]>;
  upsert(report: BugReport): Promise<void>;
}

export interface TeamRepository {
  get(id: string): Promise<Team | undefined>;
  getByJoinCode(code: string): Promise<Team | undefined>;
  listByRoute(routeId: string): Promise<Team[]>;
  /** Return teams that are currently playing or paused where userId is a member. */
  listByMember(userId: string): Promise<Team[]>;
  create(team: Team): Promise<Team>;
  update(id: string, patch: Partial<Team>): Promise<Team>;
}

export interface AppContext {
  routes: RouteRepository;
  hunts: HuntRepository;
  teams: TeamRepository;
  reports: ReportRepository;
  photos: PhotoStore;
  imageMatch: ImageMatchService;
  moderation: ModerationService;
}

export function createAppContext(): AppContext {
  const usePostgres = config.databaseUrl !== '';
  return {
    routes: usePostgres ? new PgRouteRepository() : new JsonRouteRepository(),
    hunts: usePostgres ? new PgHuntRepository() : new JsonHuntRepository(),
    teams: usePostgres ? new PgTeamRepository() : new JsonTeamRepository(),
    reports: usePostgres ? new PgReportRepository() : new JsonReportRepository(),
    photos: new PhotoStore(),
    imageMatch: createImageMatchService(),
    moderation: createModerationService(),
  };
}
