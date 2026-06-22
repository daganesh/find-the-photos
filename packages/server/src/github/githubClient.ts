import { config, isGithubConfigured } from '../config.js';

export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

export interface CreatedIssue {
  number: number;
  /** Public html_url of the issue. */
  url: string;
}

/**
 * Talks to the GitHub REST API to file issues and post comments. Two
 * implementations: a real token-backed client and a dev stub that throws a
 * clear error, so the app boots without a token (the route guards on
 * isGithubConfigured first).
 */
export interface GitHubService {
  createIssue(input: CreateIssueInput): Promise<CreatedIssue>;
  addComment(issueNumber: number, body: string): Promise<void>;
}

const API_BASE = 'https://api.github.com';

/** Retry an async fn up to `attempts` times with exponential back-off. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Real GitHub-backed client using a fine-grained PAT (config.github.token). */
export class RealGitHubService implements GitHubService {
  private get repoPath(): string {
    return `/repos/${config.github.owner}/${config.github.repo}`;
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.github.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`GitHub ${init.method ?? 'GET'} ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async createIssue(input: CreateIssueInput): Promise<CreatedIssue> {
    const issue = await withRetry(() =>
      this.call<{ number: number; html_url: string }>(`${this.repoPath}/issues`, {
        method: 'POST',
        body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
      }),
    );
    return { number: issue.number, url: issue.html_url };
  }

  async addComment(issueNumber: number, body: string): Promise<void> {
    await withRetry(() =>
      this.call(`${this.repoPath}/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    );
  }
}

/** Dev/test stub: no token, no network. Throws so misconfiguration is loud. */
export class StubGitHubService implements GitHubService {
  async createIssue(): Promise<CreatedIssue> {
    throw new Error('GitHub integration is not configured (set GITHUB_TOKEN).');
  }

  async addComment(): Promise<void> {
    throw new Error('GitHub integration is not configured (set GITHUB_TOKEN).');
  }
}

/** Pick the real client when a token is configured, else the stub. */
export function createGitHubService(): GitHubService {
  return isGithubConfigured() ? new RealGitHubService() : new StubGitHubService();
}
