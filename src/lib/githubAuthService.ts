import { Octokit } from 'octokit';

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name?: string;
  html_url: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export class GitHubAuthService {
  private static instance: GitHubAuthService;
  private token: string | null = null;
  private octokit: Octokit | null = null;
  private user: GitHubUser | null = null;

  // GitHub OAuth App credentials
  private clientId = 'Ov23lirpINVUj2qYzgtp';
  
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

  // Start GitHub Device Flow authentication
  public async signIn(): Promise<{ userCode: string; verificationUri: string } | null> {
    try {
      // Step 1: Request device and user codes
      const response = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          scope: 'repo' // Request access to repositories
        })
      });

      if (!response.ok) {
        console.error('Failed to start device flow:', response.status);
        return null;
      }

      const data = await response.json() as DeviceCodeResponse;
      console.log('Device flow started:', data);

      // Store device code in session storage (will be used for polling)
      sessionStorage.setItem('github_device_code', data.device_code);
      sessionStorage.setItem('github_device_interval', data.interval.toString());
      
      // Return the user code and verification URI to display to the user
      return {
        userCode: data.user_code,
        verificationUri: data.verification_uri
      };
    } catch (error) {
      console.error('Error starting device flow:', error);
      return null;
    }
  }

  // Poll for the access token
  public async pollForToken(onSuccess: () => void, onPending: () => void, onError: (error: string) => void): Promise<void> {
    const deviceCode = sessionStorage.getItem('github_device_code');
    const interval = parseInt(sessionStorage.getItem('github_device_interval') || '5', 10);
    
    if (!deviceCode) {
      onError('No device code found. Please try again.');
      return;
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      if (!response.ok) {
        console.error('Error polling for token:', response.status);
        onError(`HTTP error: ${response.status}`);
        return;
      }

      const data = await response.json();
      
      if (data.error) {
        if (data.error === 'authorization_pending') {
          // User hasn't completed authorization yet
          onPending();
          // Continue polling after the interval
          setTimeout(() => this.pollForToken(onSuccess, onPending, onError), interval * 1000);
          return;
        } else if (data.error === 'slow_down') {
          // We're polling too fast, slow down
          const newInterval = interval + 5;
          sessionStorage.setItem('github_device_interval', newInterval.toString());
          console.log(`Slowing down polling to ${newInterval} seconds`);
          setTimeout(() => this.pollForToken(onSuccess, onPending, onError), newInterval * 1000);
          return;
        } else if (data.error === 'expired_token') {
          onError('The device code has expired. Please try again.');
          sessionStorage.removeItem('github_device_code');
          sessionStorage.removeItem('github_device_interval');
          return;
        } else {
          onError(`Authentication error: ${data.error_description || data.error}`);
          return;
        }
      }

      if (data.access_token) {
        // Success! We have an access token
        this.token = data.access_token;
        localStorage.setItem('github_token', this.token);
        this.initOctokit();
        
        // Clean up session storage
        sessionStorage.removeItem('github_device_code');
        sessionStorage.removeItem('github_device_interval');
        
        // Fetch user info to validate token
        await this.fetchUserInfo();
        onSuccess();
      } else {
        onError('No access token received');
      }
    } catch (error) {
      console.error('Error polling for token:', error);
      onError('Network error while checking authorization status');
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