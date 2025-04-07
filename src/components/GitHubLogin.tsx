import { Button } from '@/components/ui/button';
import { GitHubAuthService, GitHubUser } from '@/lib/githubAuthService';
import { Github, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GitHubLoginProps {
  onAuthChange?: (authenticated: boolean) => void;
}

export default function GitHubLogin({ onAuthChange }: GitHubLoginProps) {
  const { toast } = useToast();
  const authService = GitHubAuthService.getInstance();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [user, setUser] = useState<GitHubUser | null>(authService.getUser());
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Added loading state

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      const isAuth = authService.isAuthenticated();
      let currentUser = authService.getUser();
      
      // If authenticated state is true but user is null, try fetching
      if (isAuth && !currentUser) {
        try {
          currentUser = await authService.fetchUserInfo();
        } catch (error) {
          console.warn('Token likely invalid on initial load:', error);
          authService.signOut(); // Sign out if initial fetch fails
          currentUser = null;
        }
      }
      
      setIsAuthenticated(!!currentUser); // Update based on whether user fetch succeeded
      setUser(currentUser);
      if (onAuthChange) {
        onAuthChange(!!currentUser);
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, [authService, onAuthChange]);

  const handleOpenTokenDialog = () => {
    setTokenInput(''); // Clear previous input
    setShowTokenDialog(true);
  };

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) {
      toast({ title: "Token Required", description: "Please enter a GitHub Personal Access Token.", variant: "destructive" });
      return;
    }
    setIsConnecting(true);
    try {
      const loggedInUser = await authService.setToken(tokenInput);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      setShowTokenDialog(false);
      if (onAuthChange) {
        onAuthChange(true);
      }
      toast({ title: "Successfully Connected", description: `Signed in as ${loggedInUser.login}.` });
    } catch (error: any) {
      console.error('Error setting token:', error);
      toast({ title: "Connection Failed", description: error.message || "Could not connect with the provided token.", variant: "destructive" });
      // Ensure state reflects failed auth
      setUser(null);
      setIsAuthenticated(false);
      if (onAuthChange) {
        onAuthChange(false);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignOut = () => {
    authService.signOut();
    setIsAuthenticated(false);
    setUser(null);
    if (onAuthChange) {
      onAuthChange(false);
    }
    toast({ title: "Signed Out", description: "You have been signed out from GitHub." });
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-full justify-start">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking GitHub Auth...
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center justify-between w-full p-2 border rounded-md">
        <div className="flex items-center gap-2">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium">{user.login}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
          <LogOut className="mr-1 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button onClick={handleOpenTokenDialog} variant="outline" className="w-full justify-start">
        <Github className="mr-2 h-4 w-4" />
        Connect GitHub (Token)
      </Button>

      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect with GitHub Personal Access Token</DialogTitle>
            <DialogDescription>
              Enter a Personal Access Token (PAT) with <code className="font-mono bg-muted px-1 py-0.5 rounded">repo</code> scope to connect your account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">Personal Access Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
            </div>
            
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
               <AlertCircle className="h-4 w-4 !text-blue-500" />
              <AlertTitle className="text-sm">How to create a token:</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <li>Go to <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">GitHub token settings (Fine-grained)</a>.</li>
                <li>Click "Generate new token".</li>
                <li>Give it a name (e.g., "Preview Card App").</li>
                <li>Set expiration (e.g., 90 days).</li>
                <li>Under "Repository access", select "All repositories" or specific ones.</li>
                <li>Under "Permissions" &gt; "Repository permissions", find <strong>"Contents"</strong> and set access to <strong>"Read and write"</strong>. (This grants the `repo` scope needed).</li>
                <li>Click "Generate token" and copy it.</li>
              </AlertDescription>
            </Alert>
             <Alert className="bg-amber-50 border-amber-200 text-amber-800">
               <AlertCircle className="h-4 w-4 !text-amber-500" />
              <AlertTitle className="text-sm">Security Note</AlertTitle>
              <AlertDescription className="text-xs">
                This token is stored only in your browser's local storage and is never sent to our servers. Treat it like a password.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleTokenSubmit} 
              disabled={!tokenInput || isConnecting}
            >
              {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 