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

  // GitHub OAuth App credentials
  private clientId = 'Ov23lirpINVUj2qYzgtp';
  
  // Set redirect URI based on current environment
  private get redirectUri(): string {
    // For production
    if (window.location.hostname === 'previewcard-yapp.lovable.app') {
      return `${window.location.origin}/#/github/callback`;
    }
    // For GitHub Pages
    else if (window.location.hostname === 'beatsme-idk.github.io') {
      return `${window.location.origin}/previewcard-yapp/#/github/callback`;
    }
    // For local development
    else {
      return `${window.location.origin}/#/github/callback`;
    }
  }

  constructor() {
    // Check if there's a stored token
    this.token = localStorage.getItem('github_token');
    if (this.token) {
      this.initOctokit();
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
    }
  }

  public isAuthenticated(): boolean {
    return !!this.token;
  }

  public getOctokit(): Octokit | null {
    return this.octokit;
  }

  public getUser(): GitHubUser | null {
    return this.user;
  }

  public signIn() {
    // Standard GitHub OAuth flow
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&scope=repo`;
    
    console.log('Redirecting to GitHub OAuth:', authUrl);
    window.location.href = authUrl;
  }

  public async handleCallback(code: string): Promise<boolean> {
    try {
      console.log('Handling GitHub callback with code:', code);
      
      // GitHub doesn't support client-side token exchange due to CORS,
      // so we'll use a proxy or serverless function
      // If the proxy fails, we can recommend using personal access token instead
      
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token';
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          // client_secret should be kept on server, not client
          // this is a limitation of this demo implementation
          code: code,
          redirect_uri: this.redirectUri
        })
      });
      
      if (!response.ok) {
        console.error('Failed to exchange code for token:', response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        this.token = data.access_token;
        localStorage.setItem('github_token', this.token);
        this.initOctokit();
        
        // Fetch user info to validate the token
        const userInfo = await this.fetchUserInfo();
        return !!userInfo;
      } else {
        console.error('No access token in response:', data);
        return false;
      }
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      return false;
    }
  }

  public async fetchUserInfo(): Promise<GitHubUser | null> {
    if (!this.octokit) {
      console.warn('No Octokit instance available - cannot fetch user info');
      return null;
    }

    try {
      console.log('Fetching GitHub user info...');
      const { data } = await this.octokit.rest.users.getAuthenticated();
      this.user = {
        login: data.login,
        avatar_url: data.avatar_url,
        name: data.name || undefined,
        html_url: data.html_url
      };
      console.log('GitHub user info fetched successfully:', this.user);
      return this.user;
    } catch (error) {
      console.error('Error fetching user info from GitHub API:', error);
      return null;
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public setManualToken(token: string): void {
    this.token = token;
    localStorage.setItem('github_token', token);
    this.initOctokit();
  }

  public signOut(): void {
    this.token = null;
    this.user = null;
    this.octokit = null;
    localStorage.removeItem('github_token');
  }
} 