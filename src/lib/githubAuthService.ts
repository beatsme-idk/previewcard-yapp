import { Octokit } from 'octokit';

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name?: string;
  html_url: string;
}

export class GitHubAuthService {
  private static instance: GitHubAuthService;
  private token: string | null = null;
  private octokit: Octokit | null = null;
  private user: GitHubUser | null = null;

  // GitHub OAuth App credentials are no longer needed for PAT auth
  // private clientId = 'Ov23lirpINVUj2qYzgtp';
  // private get redirectUri(): string { ... }

  constructor() {
    // Check if there's a stored token
    this.token = localStorage.getItem('github_token');
    if (this.token) {
      this.initOctokit();
      // Fetch user info on initial load if token exists
      this.fetchUserInfo().catch(err => {
        console.error('Failed to fetch user info on load:', err);
        // If token is invalid on load, sign out
        this.signOut(); 
      });
    }
  }

  public static getInstance(): GitHubAuthService {
    if (!GitHubAuthService.instance) {
      GitHubAuthService.instance = new GitHubAuthService();
    }
    return GitHubAuthService.instance;
  }

  private initOctokit() {
    if (this.token) {
      this.octokit = new Octokit({ auth: this.token });
    } else {
      this.octokit = null;
    }
  }

  public isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  public getOctokit(): Octokit | null {
    return this.octokit;
  }

  public getUser(): GitHubUser | null {
    return this.user;
  }

  public getToken(): string | null {
    return this.token;
  }

  // Method to set and validate a Personal Access Token
  public async setToken(newToken: string): Promise<GitHubUser> {
    if (!newToken || typeof newToken !== 'string' || newToken.trim().length === 0) {
      throw new Error('Invalid token provided.');
    }
    
    this.token = newToken.trim();
    localStorage.setItem('github_token', this.token);
    this.initOctokit();
    
    // Validate the token by fetching user info
    try {
      const user = await this.fetchUserInfo();
      console.log('Token validated successfully for user:', user.login);
      return user;
    } catch (error) {
      // If validation fails, clear the invalid token
      this.signOut();
      console.error('Token validation failed:', error);
      throw new Error('Invalid token or insufficient scope. Please ensure the token has \'repo\' scope.');
    }
  }

  // Fetch user info (kept public for validation and component use)
  public async fetchUserInfo(): Promise<GitHubUser> {
    if (!this.octokit) {
      throw new Error('Authentication required (Octokit not initialized).');
    }

    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      this.user = {
        login: data.login,
        avatar_url: data.avatar_url,
        name: data.name || undefined,
        html_url: data.html_url
      };
      return this.user;
    } catch (error) {
      console.error('Error fetching user info:', error);
      // Reset user if fetch fails
      this.user = null;
      throw error; // Re-throw to indicate failure
    }
  }

  public signOut(): void {
    this.token = null;
    this.octokit = null;
    this.user = null;
    localStorage.removeItem('github_token');
    // Optionally notify listeners if using an event system
    console.log('User signed out.');
  }
  
  // Removed OAuth specific methods: signIn(), handleCallback()
} 