import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GitHubAuthService } from '@/lib/githubAuthService';
import { GitHubService } from '@/lib/githubService';
import { Loader2, LogOut, Github, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface GitHubLoginProps {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

const GitHubLogin: React.FC<GitHubLoginProps> = ({ onAuthChange }) => {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showManualTokenDialog, setShowManualTokenDialog] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar_url} alt={user.login} />
              <AvatarFallback>{user.login?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="max-w-[100px] truncate">{user.login}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            className="text-destructive gap-2 cursor-pointer"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
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
    </>
  );
};

export default GitHubLogin; 