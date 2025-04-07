import { Octokit } from 'octokit';
import { FolderPath, ImageFile } from './types';
import { GitHubAuthService } from './githubAuthService';
import { GitHubRateLimitService } from './gitHubRateLimitService';

// Interface for repository data
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  visibility: string;
}

export class GitHubService {
  private octokit: Octokit | null = null;
  private authService: GitHubAuthService;
  private rateLimitService: GitHubRateLimitService;
  
  constructor() {
    this.authService = GitHubAuthService.getInstance();
    this.rateLimitService = new GitHubRateLimitService();
    this.initOctokit();
  }
  
  private initOctokit() {
    const token = this.authService.getToken();
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
  }
  
  public isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }
  
  public getAuthService(): GitHubAuthService {
    return this.authService;
  }

  public getRateLimitService(): GitHubRateLimitService {
    return this.rateLimitService;
  }
  
  private isUsingSimulatedToken(): boolean {
    const token = this.authService.getToken();
    return !!token && (token.startsWith('gh_simulated_') || token.startsWith('gh_'));
  }
  
  public async getUserRepositories(): Promise<GitHubRepository[]> {
    // Return mock data if using simulated token
    if (this.isUsingSimulatedToken()) {
      console.log('Using simulated repositories data for demo mode');
      return this.getMockRepositories();
    }
  
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }
    
    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      await this.rateLimitService.updateRateLimits(this.octokit);
      
      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description || null,
        default_branch: repo.default_branch,
        visibility: repo.visibility
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      
      // Return mock data as fallback if API call fails
      if (this.isUsingSimulatedToken()) {
        return this.getMockRepositories();
      }
      
      throw error;
    }
  }
  
  // Get mock repositories for simulated/demo mode
  private getMockRepositories(): GitHubRepository[] {
    return [
      {
        id: 1296269,
        name: 'demo-repo',
        full_name: 'demo-user/demo-repo',
        html_url: 'https://github.com/demo-user/demo-repo',
        description: 'Demo repository for preview card testing',
        default_branch: 'main',
        visibility: 'public'
      },
      {
        id: 1296270,
        name: 'preview-card-assets',
        full_name: 'demo-user/preview-card-assets',
        html_url: 'https://github.com/demo-user/preview-card-assets',
        description: 'Storage for preview card assets',
        default_branch: 'main',
        visibility: 'public'
      }
    ];
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

  getUser() {
    return this.authService.getUser();
  }

  signOut() {
    this.authService.signOut();
    this.octokit = null;
  }
  
  getRateLimitInfo() {
    const limits = this.rateLimitService.getRateLimits();
    if (!limits || !limits.core) {
      return {
        remaining: 5000,
        total: 5000,
        used: 0,
        resetTime: 'Unknown',
        isLow: false
      };
    }
    
    const core = limits.core;
    const resetDate = new Date(core.reset * 1000);
    
    return {
      remaining: core.remaining,
      total: core.limit,
      used: core.used,
      resetTime: resetDate.toLocaleTimeString(),
      isLow: core.remaining < 100
    };
  }

  async getRepositoryContent(owner: string, repo: string, path: string, ref: string = '') {
    if (this.isUsingSimulatedToken()) {
      console.log('Using mock content data for demo mode');
      return this.getMockRepositoryContent(path);
    }
    
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }
    
    try {
      const requestParams = {
        owner,
        repo,
        path,
        ...(ref ? { ref } : {})
      };
      
      // Get the content
      const { data } = await this.octokit.rest.repos.getContent(requestParams);
      
      // Update rate limits
      await this.rateLimitService.updateRateLimits(this.octokit);
      
      return data;
    } catch (error) {
      console.error('Error getting repository content:', error);
      throw error;
    }
  }
  
  private getMockRepositoryContent(path: string) {
    // Return mock data based on the path requested
    if (path === '' || path === '/') {
      return [
        {
          name: 'README.md',
          path: 'README.md',
          sha: 'abc123',
          size: 100,
          url: 'https://api.github.com/repos/demo-user/demo-repo/contents/README.md',
          html_url: 'https://github.com/demo-user/demo-repo/blob/main/README.md',
          git_url: 'https://api.github.com/repos/demo-user/demo-repo/git/blobs/abc123',
          download_url: 'https://raw.githubusercontent.com/demo-user/demo-repo/main/README.md',
          type: 'file',
          _links: {
            self: 'https://api.github.com/repos/demo-user/demo-repo/contents/README.md',
            git: 'https://api.github.com/repos/demo-user/demo-repo/git/blobs/abc123',
            html: 'https://github.com/demo-user/demo-repo/blob/main/README.md'
          }
        },
        {
          name: 'assets',
          path: 'assets',
          sha: 'def456',
          size: 0,
          url: 'https://api.github.com/repos/demo-user/demo-repo/contents/assets',
          html_url: 'https://github.com/demo-user/demo-repo/tree/main/assets',
          git_url: 'https://api.github.com/repos/demo-user/demo-repo/git/trees/def456',
          download_url: null,
          type: 'dir',
          _links: {
            self: 'https://api.github.com/repos/demo-user/demo-repo/contents/assets',
            git: 'https://api.github.com/repos/demo-user/demo-repo/git/trees/def456',
            html: 'https://github.com/demo-user/demo-repo/tree/main/assets'
          }
        }
      ];
    } else if (path === 'assets') {
      return [
        {
          name: 'preview.png',
          path: 'assets/preview.png',
          sha: 'ghi789',
          size: 5000,
          url: 'https://api.github.com/repos/demo-user/demo-repo/contents/assets/preview.png',
          html_url: 'https://github.com/demo-user/demo-repo/blob/main/assets/preview.png',
          git_url: 'https://api.github.com/repos/demo-user/demo-repo/git/blobs/ghi789',
          download_url: 'https://raw.githubusercontent.com/demo-user/demo-repo/main/assets/preview.png',
          type: 'file',
          _links: {
            self: 'https://api.github.com/repos/demo-user/demo-repo/contents/assets/preview.png',
            git: 'https://api.github.com/repos/demo-user/demo-repo/git/blobs/ghi789',
            html: 'https://github.com/demo-user/demo-repo/blob/main/assets/preview.png'
          }
        }
      ];
    } else {
      // Return some default file content for any specific file request
      return {
        name: path.split('/').pop(),
        path: path,
        sha: 'mock123',
        size: 100,
        url: `https://api.github.com/repos/demo-user/demo-repo/contents/${path}`,
        html_url: `https://github.com/demo-user/demo-repo/blob/main/${path}`,
        git_url: `https://api.github.com/repos/demo-user/demo-repo/git/blobs/mock123`,
        download_url: `https://raw.githubusercontent.com/demo-user/demo-repo/main/${path}`,
        type: 'file',
        content: Buffer.from('# Mock Content\n\nThis is mock content for demo purposes.').toString('base64'),
        encoding: 'base64',
        _links: {
          self: `https://api.github.com/repos/demo-user/demo-repo/contents/${path}`,
          git: `https://api.github.com/repos/demo-user/demo-repo/git/blobs/mock123`,
          html: `https://github.com/demo-user/demo-repo/blob/main/${path}`
        }
      };
    }
  }

  // Get a specific repository by owner and name
  async getRepositoryInfo(owner: string, repo: string) {
    // Return mock data if using simulated token
    if (this.isUsingSimulatedToken()) {
      console.log('Using simulated repository info for demo mode');
      return {
        id: 1296269,
        name: repo,
        full_name: `${owner}/${repo}`,
        html_url: `https://github.com/${owner}/${repo}`,
        description: 'Demo repository for preview card testing',
        default_branch: 'main',
        visibility: 'public',
        private: false
      };
    }
  
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }
    
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      
      await this.rateLimitService.updateRateLimits(this.octokit);
      
      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        html_url: data.html_url,
        description: data.description || null,
        default_branch: data.default_branch,
        visibility: data.visibility,
        private: data.private
      };
    } catch (error) {
      console.error('Error fetching repository:', error);
      
      if (this.isUsingSimulatedToken()) {
        return {
          id: 1296269,
          name: repo,
          full_name: `${owner}/${repo}`,
          html_url: `https://github.com/${owner}/${repo}`,
          description: 'Demo repository for preview card testing',
          default_branch: 'main',
          visibility: 'public',
          private: false
        };
      }
      
      throw error;
    }
  }
} 