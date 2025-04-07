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
  
  private get redirectUri(): string {
    // Use the current origin for the redirect URI
    return `${window.location.origin}/github-callback`;
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

  public getToken(): string | null {
    return this.token;
  }

  public async signIn(): Promise<void> {
    // Construct the GitHub OAuth URL
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUri);
    authUrl.searchParams.append('scope', 'repo');
    authUrl.searchParams.append('state', Math.random().toString(36).substring(7));

    // Store the state for verification
    sessionStorage.setItem('github_oauth_state', authUrl.searchParams.get('state')!);

    // Redirect to GitHub
    window.location.href = authUrl.toString();
  }

  public async handleCallback(code: string, state: string): Promise<void> {
    // Verify the state matches
    const storedState = sessionStorage.getItem('github_oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    try {
      // Exchange the code for an access token
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: 'GITHUB_CLIENT_SECRET', // This should be handled by a backend
          code,
          redirect_uri: this.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      // Store the token
      this.token = data.access_token;
      localStorage.setItem('github_token', this.token);
      this.initOctokit();

      // Get user info
      await this.fetchUserInfo();
    } catch (error) {
      console.error('Error handling GitHub callback:', error);
      throw error;
    }
  }

  public async fetchUserInfo(): Promise<GitHubUser> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
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
      throw error;
    }
  }

  public signOut(): void {
    this.token = null;
    this.octokit = null;
    this.user = null;
    localStorage.removeItem('github_token');
  }
} 