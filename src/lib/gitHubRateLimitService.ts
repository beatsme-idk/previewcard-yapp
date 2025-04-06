import { Octokit } from 'octokit';

interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resource?: string; // Make the resource field optional
}

export class GitHubRateLimitService {
  private static instance: GitHubRateLimitService;
  private rateLimits: Record<string, RateLimit> = {};
  private lastUpdated: number = 0;
  
  // How often to update rate limits in milliseconds
  private updateInterval: number = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Load any saved rate limits from localStorage
    const savedLimits = localStorage.getItem('github_rate_limits');
    if (savedLimits) {
      try {
        const parsed = JSON.parse(savedLimits);
        this.rateLimits = parsed.rateLimits || {};
        this.lastUpdated = parsed.lastUpdated || 0;
      } catch (e) {
        console.warn('Failed to parse saved rate limits');
      }
    }
  }
  
  public static getInstance(): GitHubRateLimitService {
    if (!GitHubRateLimitService.instance) {
      GitHubRateLimitService.instance = new GitHubRateLimitService();
    }
    return GitHubRateLimitService.instance;
  }
  
  /**
   * Updates rate limits from GitHub API
   * @param octokit Authenticated Octokit instance
   * @returns Promise<boolean> Success status
   */
  public async updateRateLimits(octokit: Octokit): Promise<boolean> {
    if (!octokit) return false;
    
    // Only update if it's been more than the update interval
    const now = Date.now();
    if (now - this.lastUpdated < this.updateInterval) {
      return true;
    }
    
    try {
      const { data } = await octokit.rest.rateLimit.get();
      
      // Store rate limits for different resources
      this.rateLimits = {
        core: { ...data.resources.core, resource: 'core' },
        search: { ...data.resources.search, resource: 'search' },
        graphql: { ...data.resources.graphql, resource: 'graphql' },
        integration_manifest: { ...data.resources.integration_manifest, resource: 'integration_manifest' },
        code_scanning_upload: { ...data.resources.code_scanning_upload, resource: 'code_scanning_upload' }
      };
      
      this.lastUpdated = now;
      
      // Save to localStorage
      localStorage.setItem('github_rate_limits', JSON.stringify({
        rateLimits: this.rateLimits,
        lastUpdated: this.lastUpdated
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
      return false;
    }
  }
  
  /**
   * Checks if there are enough API calls remaining for a resource
   * @param resource The API resource (core, search, etc.)
   * @param minimumRequired Minimum number of calls needed
   * @returns true if enough calls remain, false otherwise
   */
  public hasEnoughRemaining(resource: string = 'core', minimumRequired: number = 10): boolean {
    const resourceLimit = this.rateLimits[resource];
    
    if (!resourceLimit) {
      return true; // Assume it's ok if we don't have data
    }
    
    // Check if reset time has passed
    const now = Math.floor(Date.now() / 1000);
    if (now > resourceLimit.reset) {
      return true; // Limit has reset, so we're good
    }
    
    return resourceLimit.remaining >= minimumRequired;
  }
  
  /**
   * Get formatted info about rate limits
   * @param resource API resource name
   * @returns Object with formatted info
   */
  public getRateLimitInfo(resource: string = 'core'): {
    remaining: number;
    total: number;
    used: number;
    resetTime: string;
    isLow: boolean;
  } {
    const resourceLimit = this.rateLimits[resource];
    
    if (!resourceLimit) {
      return {
        remaining: 5000,
        total: 5000,
        used: 0,
        resetTime: 'Unknown',
        isLow: false
      };
    }
    
    const resetDate = new Date(resourceLimit.reset * 1000);
    
    return {
      remaining: resourceLimit.remaining,
      total: resourceLimit.limit,
      used: resourceLimit.used,
      resetTime: resetDate.toLocaleTimeString(),
      isLow: resourceLimit.remaining < 100
    };
  }
  
  /**
   * Check if a request can be made and throw error if rate limited
   * @param resource API resource to check
   * @param minimumRequired Minimum calls needed
   * @throws Error if rate limited
   */
  public checkRateLimit(resource: string = 'core', minimumRequired: number = 5): void {
    if (!this.hasEnoughRemaining(resource, minimumRequired)) {
      const info = this.getRateLimitInfo(resource);
      throw new Error(
        `GitHub API rate limit exceeded. ${info.remaining} remaining. ` +
        `Resets at ${info.resetTime}.`
      );
    }
  }
} 