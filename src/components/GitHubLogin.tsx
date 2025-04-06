import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GitHubAuthService, GitHubUser } from '@/lib/githubAuthService';
import { GitHubService } from '@/lib/githubService';
import { Loader2, LogOut, Github, AlertCircle, InfoIcon, LoaderCircle, Copy, CheckCircle2, Terminal } from 'lucide-react';
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
        <p>You're using a simulated GitHub account. Some features like repository creation 
        and file uploads are simulated with mock data.</p>
        <p className="mt-2 text-xs">
          <strong>Note:</strong> GitHub OAuth is currently in demo mode due to a configuration issue. 
          To use with a real GitHub account, enter a personal access token using the "Use Token" button.
        </p>
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
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [deviceAuthData, setDeviceAuthData] = useState<{
    userCode: string;
    verificationUri: string;
  } | null>(null);

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

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      const deviceAuth = await authService.signIn();
      
      if (deviceAuth) {
        setDeviceAuthData(deviceAuth);
        startPolling();
      } else {
        toast({
          title: "Authentication Error",
          description: "Failed to start GitHub authentication flow.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Authentication Error",
        description: "An error occurred during authentication.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = () => {
    setIsPolling(true);
    
    authService.pollForToken(
      // onSuccess
      () => {
        setIsPolling(false);
        setDeviceAuthData(null);
        setIsAuthenticated(true);
        setUser(authService.getUser());
        toast({
          title: "Authentication Successful",
          description: "You've successfully connected to GitHub!",
          variant: "default",
        });
      },
      // onPending
      () => {
        // Continue polling, no UI updates needed
      },
      // onError
      (error) => {
        setIsPolling(false);
        setDeviceAuthData(null);
        toast({
          title: "Authentication Failed",
          description: error,
          variant: "destructive",
        });
      }
    );
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

  const copyCodeToClipboard = () => {
    if (deviceAuthData) {
      navigator.clipboard.writeText(deviceAuthData.userCode);
      toast({
        title: "Code Copied",
        description: "User code copied to clipboard!",
      });
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignIn}
          disabled={isLoading || isPolling}
          className="gap-2"
        >
          {isLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}
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

      <Dialog open={!!deviceAuthData} onOpenChange={(open) => {
        if (!open) setDeviceAuthData(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to GitHub</DialogTitle>
            <DialogDescription>
              To link your GitHub account, please complete the following steps:
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-muted p-4 rounded-lg text-center space-y-3">
              <p className="text-sm text-muted-foreground">Go to:</p>
              <a 
                href={deviceAuthData?.verificationUri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-lg font-semibold text-primary hover:underline block"
              >
                {deviceAuthData?.verificationUri}
              </a>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">Enter this code:</p>
              <div className="flex items-center justify-center gap-3">
                <div className="bg-muted p-3 px-5 rounded-lg font-mono text-xl tracking-wider">
                  {deviceAuthData?.userCode}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={copyCodeToClipboard}
                  className="h-8 w-8"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-center">
              {isPolling ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Waiting for GitHub authentication...
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Ready to authenticate
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Terminal className="h-3 w-3 inline-block mr-1" />
              This uses the GitHub Device Flow
            </p>
            <Button
              variant="outline"
              onClick={() => setDeviceAuthData(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GitHubLogin; 