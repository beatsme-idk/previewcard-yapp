import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GitHubAuthService, GitHubUser } from '@/lib/githubAuthService';
import { GitHubService } from '@/lib/githubService';
import { Loader2, LogOut, Github, AlertCircle, InfoIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GitHubLoginProps {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

const DemoModeAlert = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;
  
  return (
    <Alert className="mb-4 bg-amber-50 border-amber-200">
      <InfoIcon className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-800">Demo Mode Active</AlertTitle>
      <AlertDescription className="text-amber-700">
        You're using a simulated GitHub account. Some features like repository creation 
        and file uploads are simulated with mock data.
      </AlertDescription>
      <Button 
        variant="ghost" 
        size="sm" 
        className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full text-amber-500 hover:text-amber-700 hover:bg-amber-100"
        onClick={() => setVisible(false)}
      >
        ×
      </Button>
    </Alert>
  );
};

const GitHubLogin: React.FC<GitHubLoginProps> = ({ onAuthChange }) => {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [showManualTokenDialog, setShowManualTokenDialog] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const authService = GitHubAuthService.getInstance();
  const githubService = new GitHubService();

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = authService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        try {
          const userInfo = authService.getUser() || await authService.fetchUserInfo();
          setUser(userInfo);
          
          // Check if using a simulated token
          const token = authService.getToken() || '';
          setIsDemoMode(token.startsWith('gh_simulated_') || token.startsWith('gh_'));
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
      }
      
      setLoading(false);
      if (onAuthChange) onAuthChange(isAuth);
    };
    
    checkAuth();
  }, []);

  const handleGitHubSignIn = () => {
    authService.signIn();
  };

  const handleSignOut = () => {
    authService.signOut();
    setIsAuthenticated(false);
    setUser(null);
    setIsDemoMode(false);
    if (onAuthChange) onAuthChange(false);
    
    toast({
      title: "Signed out",
      description: "You have been signed out of GitHub",
    });
  };

  const handleManualTokenSubmit = async () => {
    if (!manualToken.trim()) {
      toast({
        title: "Token required",
        description: "Please enter a valid GitHub personal access token",
        variant: "destructive"
      });
      return;
    }
    
    setTokenLoading(true);
    
    try {
      authService.setManualToken(manualToken);
      const userInfo = await authService.fetchUserInfo();
      
      if (userInfo) {
        setUser(userInfo);
        setIsAuthenticated(true);
        setShowManualTokenDialog(false);
        if (onAuthChange) onAuthChange(true);
        
        // Check if the token is a simulated one
        setIsDemoMode(manualToken.startsWith('gh_simulated_') || manualToken.startsWith('gh_'));
        
        toast({
          title: "Connected to GitHub",
          description: `Successfully connected as ${userInfo.login}`,
        });
      } else {
        toast({
          title: "Authentication failed",
          description: "Could not authenticate with the provided token",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error with manual token:', error);
      toast({
        title: "Authentication failed",
        description: "Invalid token or insufficient permissions",
        variant: "destructive"
      });
    } finally {
      setTokenLoading(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex flex-col">
        {isDemoMode && <DemoModeAlert />}
        
        <div className="flex items-center gap-4 mb-4">
          {user.avatar_url && (
            <img src={user.avatar_url} alt={user.login} className="w-10 h-10 rounded-full" />
          )}
          <div>
            <div className="font-medium">{user.name || user.login}</div>
            <div className="text-sm text-gray-500">{user.login}</div>
          </div>
        </div>
        <Button onClick={handleSignOut} variant="outline" size="sm">
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex space-x-2">
        <Button onClick={handleGitHubSignIn} className="gap-2">
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowManualTokenDialog(true)}
          className="text-xs"
        >
          Use Token
        </Button>
      </div>
      
      <Dialog open={showManualTokenDialog} onOpenChange={setShowManualTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect with Personal Access Token</DialogTitle>
            <DialogDescription>
              Enter your GitHub Personal Access Token with repo access
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">Personal Access Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
              />
            </div>
            
            <div className="flex items-center text-sm text-amber-500 bg-amber-500/10 p-2 rounded-md">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              <p>Ensure your token has permission to write to repositories.</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualTokenDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleManualTokenSubmit} 
              disabled={!manualToken || tokenLoading}
            >
              {tokenLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GitHubLogin; 