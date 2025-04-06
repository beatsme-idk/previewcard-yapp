import { Octokit } from 'octokit';
import { FolderPath, ImageFile } from './types';
import { GitHubAuthService } from './githubAuthService';
import { GitHubRateLimitService } from './gitHubRateLimitService';

export class GitHubService {
  private octokit: Octokit | null = null;
  private authService: GitHubAuthService;
  private rateLimitService: GitHubRateLimitService;
  
  constructor() {
    this.authService = GitHubAuthService.getInstance();
    this.rateLimitService = GitHubRateLimitService.getInstance();
    this.octokit = this.authService.getOctokit();
    
    // If we have an octokit instance, update rate limits
    if (this.octokit) {
      this.rateLimitService.updateRateLimits(this.octokit).catch(err => {
        console.warn('Failed to update rate limits initially:', err);
      });
    }
  }

  setToken(token: string) {
    this.authService.setManualToken(token);
    this.octokit = this.authService.getOctokit();
    
    // Update rate limits with new token
    if (this.octokit) {
      this.rateLimitService.updateRateLimits(this.octokit).catch(err => {
        console.warn('Failed to update rate limits after setting token:', err);
      });
    }
  }

  async uploadFile(
    params: {
      owner: string;
      repo: string;
      path: string;
      content: string;
      message?: string;
    }
  ) {
    // Use the authenticated octokit instance from auth service
    this.octokit = this.authService.getOctokit();
    
    if (!this.octokit) {
      throw new Error('GitHub authentication required');
    }
    
    // Check rate limits before making API calls
    try {
      this.rateLimitService.checkRateLimit('core', 5);
    } catch (error: any) {
      if (error.message.includes('rate limit exceeded')) {
        throw error; // Re-throw rate limit errors
      }
      // Other errors with checking rate limit can be ignored
    }

    try {
      // Check if file already exists
      let sha;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
        });
        
        if (!Array.isArray(data)) {
          sha = data.sha;
        }
      } catch (error) {
        // File doesn't exist, no need for sha
      }

      // Create or update file
      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: params.owner,
        repo: params.repo,
        path: params.path,
        message: params.message || `Upload ${params.path}`,
        content: params.content,
        ...(sha ? { sha } : {}),
      });
      
      // Update rate limits after operation
      this.rateLimitService.updateRateLimits(this.octokit).catch(console.error);

      return response.data;
    } catch (error) {
      console.error('Error uploading file to GitHub:', error);
      throw error;
    }
  }

  async uploadOgCardAssets(
    folderPath: FolderPath,
    files: ImageFile[]
  ) {
    // Ensure we have the latest octokit instance
    this.octokit = this.authService.getOctokit();
    
    if (!this.octokit) {
      throw new Error('GitHub authentication required');
    }
    
    // Check if we have enough rate limit remaining for all files
    try {
      // We'll need approximately 2 API calls per file (getContent + createOrUpdate)
      const requiredCalls = files.filter(f => f.preview).length * 2;
      this.rateLimitService.checkRateLimit('core', requiredCalls);
    } catch (error: any) {
      if (error.message.includes('rate limit exceeded')) {
        throw error; // Re-throw rate limit errors
      }
    }

    const results = [];
    const baseFolder = `og/${folderPath.folder}`;

    for (const file of files) {
      if (!file.preview) continue;

      try {
        // Extract base64 content from data URL
        const base64Content = file.preview.split(',')[1];
        
        const result = await this.uploadFile({
          owner: folderPath.username,
          repo: folderPath.repo,
          path: `${baseFolder}/${file.name}.png`,
          content: base64Content,
          message: `Upload ${file.name}.png for OG card preview`,
        });
        
        results.push(result);
      } catch (error) {
        console.error(`Error uploading ${file.name}.png:`, error);
        throw error;
      }
    }
    
    // Final rate limit update after all operations
    if (this.octokit) {
      this.rateLimitService.updateRateLimits(this.octokit).catch(console.error);
    }

    return {
      success: true,
      baseUrl: `https://cdn.jsdelivr.net/gh/${folderPath.username}/${folderPath.repo}/${baseFolder}`,
      results,
    };
  }

  async getUserRepositories() {
    this.octokit = this.authService.getOctokit();
    
    if (!this.octokit) {
      throw new Error('GitHub authentication required');
    }
    
    // Check rate limits
    try {
      this.rateLimitService.checkRateLimit('core', 1);
    } catch (error: any) {
      if (error.message.includes('rate limit exceeded')) {
        throw error;
      }
    }

    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      // Update rate limits after operation
      this.rateLimitService.updateRateLimits(this.octokit).catch(console.error);
      
      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        html_url: repo.html_url
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw error;
    }
  }

  async createRepository(repoName: string, isPrivate: boolean = false) {
    this.octokit = this.authService.getOctokit();
    
    if (!this.octokit) {
      throw new Error('GitHub authentication required');
    }
    
    // Check rate limits
    try {
      this.rateLimitService.checkRateLimit('core', 2); // Creating repo uses more API points
    } catch (error: any) {
      if (error.message.includes('rate limit exceeded')) {
        throw error;
      }
    }

    try {
      const { data } = await this.octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'Repository for storing OG card assets',
        private: isPrivate,
        auto_init: true, // Initialize with README to make it valid immediately
      });
      
      // Create an 'og' folder by adding a .gitkeep file
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: data.owner.login,
        repo: data.name,
        path: 'og/.gitkeep',
        message: 'Initialize og folder',
        content: Buffer.from('').toString('base64'),
      });
      
      // Update rate limits after operation
      this.rateLimitService.updateRateLimits(this.octokit).catch(console.error);
      
      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        owner: data.owner.login,
        private: data.private,
        html_url: data.html_url
      };
    } catch (error) {
      console.error('Error creating repository:', error);
      throw error;
    }
  }

  isAuthenticated() {
    return this.authService.isAuthenticated();
  }

  getUser() {
    return this.authService.getUser();
  }

  signOut() {
    this.authService.signOut();
    this.octokit = null;
  }
  
  getRateLimitInfo(resource: string = 'core') {
    return this.rateLimitService.getRateLimitInfo(resource);
  }
} 