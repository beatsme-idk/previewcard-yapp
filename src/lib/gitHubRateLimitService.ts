import { Octokit } from 'octokit';
import { GitHubAuthService } from './githubAuthService';

// Interface for GitHub rate limit info
interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  reset: number;
}

// Interface for all rate limits
interface RateLimits {
  core: RateLimitInfo;
  graphql: RateLimitInfo;
  search: RateLimitInfo;
  [key: string]: RateLimitInfo;
}

export class GitHubRateLimitService {
  private limits: RateLimits | null = null;
  private lastChecked: number = 0;
  private authService: GitHubAuthService;

  constructor() {
    this.authService = GitHubAuthService.getInstance();
  }

  // Check if we're using a simulated token that doesn't support real API calls
  private isUsingSimulatedToken(): boolean {
    const token = this.authService.getToken();
    return !!token && (token.startsWith('gh_simulated_') || token.startsWith('gh_'));
  }
  
  // Get default mock rate limits for demo mode
  private getMockRateLimits(): RateLimits {
    return {
      core: {
        limit: 5000,
        used: 10,
        remaining: 4990,
        reset: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      },
      search: {
        limit: 30,
        used: 2,
        remaining: 28,
        reset: Math.floor(Date.now() / 1000) + 60 // 1 minute from now
      },
      graphql: {
        limit: 5000,
        used: 5,
        remaining: 4995,
        reset: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      },
      integration_manifest: {
        limit: 5000,
        used: 0,
        remaining: 5000,
        reset: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      },
      code_scanning_upload: {
        limit: 500,
        used: 0,
        remaining: 500,
        reset: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      }
    };
  }

  // Update rate limits by fetching the latest from GitHub API
  public async updateRateLimits(octokit: Octokit): Promise<void> {
    // Use mock data for simulated tokens
    if (this.isUsingSimulatedToken()) {
      console.log('Using mock rate limits for demo mode');
      this.limits = this.getMockRateLimits();
      this.lastChecked = Date.now();
      return;
    }

    try {
      const { data } = await octokit.rest.rateLimit.get();
      this.limits = data.resources as RateLimits;
      this.lastChecked = Date.now();
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
      throw error;
    }
  }

  // Get the current rate limits
  public getRateLimits(): RateLimits | null {
    // If using simulated token and no limits exist, initialize with mock data
    if (this.isUsingSimulatedToken() && !this.limits) {
      this.limits = this.getMockRateLimits();
      this.lastChecked = Date.now();
    }
    
    return this.limits;
  }

  // Check if we're about to exceed a rate limit
  public checkRateLimit(category: string, requiredCalls: number = 1): void {
    // Never throw rate limit errors if using simulated token
    if (this.isUsingSimulatedToken()) {
      return;
    }
  
    if (!this.limits || !this.limits[category]) {
      throw new Error(`Rate limit information for ${category} not available. Please call updateRateLimits first.`);
    }

    const limit = this.limits[category];
    
    if (limit.remaining < requiredCalls) {
      const resetTime = new Date(limit.reset * 1000);
      const minutesUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / (1000 * 60));
      
      throw new Error(
        `GitHub API rate limit for ${category} exceeded. ` +
        `${limit.remaining} of ${limit.limit} calls remaining. ` +
        `Rate limit will reset in ${minutesUntilReset} minutes.`
      );
    }
  }

  // Time since last rate limit check
  public getTimeSinceLastCheck(): number {
    return Date.now() - this.lastChecked;
  }

  // Check if the token is valid
  public async isTokenValid(octokit: Octokit): Promise<boolean> {
    // Always return true for simulated tokens
    if (this.isUsingSimulatedToken()) {
      return true;
    }
  
    try {
      await octokit.rest.users.getAuthenticated();
      return true;
    } catch (error) {
      return false;
    }
  }
} 