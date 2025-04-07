import { Button } from '@/components/ui/button';
import { GitHubAuthService } from '@/lib/githubAuthService';
import { Github } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GitHubLoginProps {
  onAuthChange?: (authenticated: boolean) => void;
}

export default function GitHubLogin({ onAuthChange }: GitHubLoginProps) {
  const authService = GitHubAuthService.getInstance();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [user, setUser] = useState(authService.getUser());

  useEffect(() => {
    if (isAuthenticated && !user) {
      authService.fetchUserInfo()
        .then(user => setUser(user))
        .catch(error => console.error('Error fetching user info:', error));
    }
  }, [isAuthenticated, user, authService]);

  const handleSignIn = async () => {
    try {
      await authService.signIn();
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = () => {
    authService.signOut();
    setIsAuthenticated(false);
    setUser(null);
    if (onAuthChange) {
      onAuthChange(false);
    }
  };

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium">{user.login}</span>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleSignIn}>
      <Github className="mr-2 h-4 w-4" />
      Sign in with GitHub
    </Button>
  );
} 