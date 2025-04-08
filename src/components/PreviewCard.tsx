import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderPath, PreviewData, ImageFile } from '@/lib/types';
import { Copy, ExternalLink, RefreshCw, Github, Loader2, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { GitHubService } from '@/lib/githubService';
import GitHubLogin from './GitHubLogin';
import RateLimitIndicator from './RateLimitIndicator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PreviewCardProps {
  previewData: PreviewData | null;
  onFolderPathChange: (path: FolderPath) => void;
  files: ImageFile[];
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  visibility: string;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ previewData, onFolderPathChange, files }) => {
  const { toast } = useToast();
  const [folderPath, setFolderPath] = useState<FolderPath>({
    username: '',
    repo: '',
    folder: `custom-${Math.random().toString(36).substring(2, 8)}`
  });
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [confirmUploadDialog, setConfirmUploadDialog] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);

  // Create GitHub service instance
  const githubService = new GitHubService();

  // Load repositories when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadRepositories();
    }
  }, [isAuthenticated]);
  
  const loadRepositories = async () => {
    setLoadingRepos(true);
    try {
      const repos = await githubService.getUserRepositories();
      setRepositories(repos);
      
      // If we have repos, pre-fill the form with the first one
      if (repos.length > 0) {
        const user = githubService.getUser();
        setFolderPath(prev => ({
          ...prev,
          username: user?.login || '',
          repo: repos[0].name
        }));
        onFolderPathChange({
          ...folderPath,
          username: user?.login || '',
          repo: repos[0].name
        });
      }
    } catch (error) {
      console.error('Error loading repositories:', error);
      toast({
        title: "Error",
        description: "Failed to load your repositories",
        variant: "destructive"
      });
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleCopyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      toast({ title: "Copied to clipboard", duration: 2000 });
    }
  };

  // Check if selected repository is public
  const checkRepositoryVisibility = useCallback(async (username: string, repo: string) => {
    try {
      const repoInfo = await githubService.getRepositoryInfo(username, repo);
      if (repoInfo && repoInfo.private) {
        setShowVisibilityWarning(true);
        toast({
          title: "Repository is private",
          description: "OG card assets must be in a public repository to work with CDN.",
          variant: "destructive"
        });
      } else {
        setShowVisibilityWarning(false);
      }
    } catch (error) {
      console.error("Error checking repository visibility:", error);
    }
  }, [githubService, toast]);

  // Update handlePathChange to check visibility when repo changes
  const handlePathChange = (field: keyof FolderPath, value: string) => {
    const newPath = { ...folderPath, [field]: value };
    setFolderPath(newPath);
    onFolderPathChange(newPath);
    
    // Check repository visibility when username and repo are set
    if (field === 'repo' && newPath.username && newPath.repo) {
      checkRepositoryVisibility(newPath.username, newPath.repo);
    }
  };

  // Add a state for preview refresh timestamp
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());

  // Construct the preview URL
  const previewUrl = folderPath.username && folderPath.repo && folderPath.folder 
    ? `https://cdn.jsdelivr.net/gh/${folderPath.username}/${folderPath.repo}/og/${folderPath.folder}`
    : null;

  // Construct the yodl preview URL with proper format and timestamp for cache busting
  const yodlPreviewUrl = previewUrl 
    ? `https://og.yodl.me/v1/preview/0x3ee275ae7504f206273f1a0f2d6bfbffda962c028542a8425ef9ca602d85a364?baseUrl=${encodeURIComponent(previewUrl)}&_t=${previewTimestamp}`
    : null;

  // Refresh the preview by updating the timestamp
  const handleRefreshPreview = () => {
    setLoading(true);
    setPreviewTimestamp(Date.now());
    // Add a slight delay to make the loading animation visible
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  const handleUploadToGitHub = async () => {
    // Check if all required files are present
    const missingFiles = ['inner', 'outer', 'overlay'].filter(
      name => !files.some(f => f.name === name && f.preview)
    );
    
    if (missingFiles.length > 0) {
      toast({
        title: "Missing files",
        description: `Please upload all required files: ${missingFiles.join(', ')}.png`,
        variant: "destructive"
      });
      return;
    }
    
    // Check if GitHub details are provided
    if (!folderPath.username || !folderPath.repo) {
      toast({
        title: "Missing repository details",
        description: "Please select GitHub username and repository name",
        variant: "destructive"
      });
      return;
    }
    
    // *** Explicitly check repository visibility before showing confirmation ***
    try {
      const repoInfo = await githubService.getRepositoryInfo(folderPath.username, folderPath.repo);
      if (repoInfo && repoInfo.private) {
         setShowVisibilityWarning(true); // Ensure warning is visible
         toast({
           title: "Cannot Upload to Private Repository",
           description: "Assets must be uploaded to a PUBLIC repository to be accessible via CDN. Please select or create a public repository.",
           variant: "destructive",
           duration: 5000, // Make it more visible
         });
         return; // Stop before showing confirmation
       } else {
         setShowVisibilityWarning(false); // Ensure warning is hidden if public
       }
    } catch (error) {
      console.error("Error checking repository visibility before upload:", error);
      toast({
        title: "Repository Check Failed",
        description: "Could not verify if the selected repository is public. Please try again.",
        variant: "destructive"
      });
      return; // Stop if check fails
    }

    // Show confirmation dialog only if all checks pass
    setConfirmUploadDialog(true);
  };

  const handleConfirmUpload = async () => {
    setUploadLoading(true);
    
    try {
      // Upload files
      const result = await githubService.uploadOgCardAssets(folderPath, files);
      
      if (result.success) {
        setUploadSuccess(true);
        toast({
          title: "Upload successful",
          description: "Assets have been uploaded to your GitHub repository",
        });
        
        // Close the dialog after success
        setConfirmUploadDialog(false);
      }
    } catch (error) {
      console.error('Error uploading to GitHub:', error);
      toast({
        title: "Upload failed",
        description: typeof error === 'object' && error !== null && 'message' in error 
          ? String(error.message) 
          : "An error occurred while uploading files",
        variant: "destructive"
      });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCreateRepository = async () => {
    if (!newRepoName.trim()) {
      toast({
        title: "Repository name required",
        description: "Please enter a name for the new repository.",
        variant: "destructive"
      });
      return;
    }
    
    setCreatingRepo(true);
    try {
      // Use the new method specifically for creating public repositories
      const result = await githubService.createNewPublicRepository(newRepoName);
      toast({
        title: "Repository created successfully",
        description: `Public repository '${result.full_name}' created.`,
      });
      
      // Set the repository in the form
      const owner = result.full_name.split('/')[0];
      handlePathChange('repo', result.name);
      handlePathChange('username', owner);
      
      // Reload repositories list to include the new one
      await loadRepositories();
      
      // Reset the input field and hide visibility warning
      setNewRepoName('');
      setShowVisibilityWarning(false);
      
    } catch (error) {
      console.error('Error creating repository:', error);
      toast({
        title: "Repository creation failed",
        description: typeof error === 'object' && error !== null && 'message' in error 
          ? String(error.message) 
          : "An error occurred while creating the repository",
        variant: "destructive"
      });
    } finally {
      setCreatingRepo(false);
    }
  };

  return (
    <>
      <Card className="w-full card-highlight">
        <CardHeader>
          <CardTitle>Preview Configuration</CardTitle>
          <CardDescription>
            Set up your GitHub repository details for asset storage
            {uploadSuccess && (
              <span className="ml-2 text-green-500 text-sm">(Files uploaded successfully)</span>
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">GitHub Connection</h3>
            <GitHubLogin onAuthChange={handleAuthChange} />
          </div>
          
          {isAuthenticated ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="repo">Repository</Label>
                {loadingRepos ? (
                  <div className="h-10 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading repositories...
                  </div>
                ) : repositories.length > 0 ? (
                  <Select 
                    value={folderPath.repo}
                    onValueChange={(value) => handlePathChange('repo', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {repositories.map(repo => (
                        <SelectItem key={repo.id} value={repo.name}>
                          {repo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-amber-500 p-2 rounded-md border border-amber-200 bg-amber-50">
                    No repositories found. Please create a repository on GitHub first.
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="folder">Folder Name</Label>
                <Input 
                  id="folder" 
                  placeholder="Auto-generated unique name" 
                  value={folderPath.folder}
                  onChange={(e) => handlePathChange('folder', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="username">GitHub Username</Label>
                <Input 
                  id="username"
                  placeholder="e.g., username" 
                  value={folderPath.username}
                  onChange={(e) => handlePathChange('username', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="repo">Repository Name</Label>
                <Input 
                  id="repo" 
                  placeholder="e.g., assets" 
                  value={folderPath.repo}
                  onChange={(e) => handlePathChange('repo', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="folder">Folder Name</Label>
                <Input 
                  id="folder" 
                  placeholder="Auto-generated unique name" 
                  value={folderPath.folder}
                  onChange={(e) => handlePathChange('folder', e.target.value)}
                />
              </div>
            </div>
          )}

          {isAuthenticated && repositories.length === 0 && (
            <div className="mt-2">
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Create a Repository</h3>
                    <p className="text-sm text-muted-foreground">
                      Create a new GitHub repository to store your OG card assets
                    </p>
                    
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor="new-repo" className="mb-2 block">Repository Name</Label>
                        <Input 
                          id="new-repo" 
                          placeholder="og-card-assets"
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Button
                          onClick={handleCreateRepository}
                          disabled={!newRepoName.trim() || creatingRepo}
                        >
                          {creatingRepo ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                          ) : (
                            'Create Repository'
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Alert className="bg-blue-50 border-blue-200">
                        <Info className="h-4 w-4 text-blue-500" />
                        <AlertTitle className="text-blue-800 text-sm">Public Repository Required</AlertTitle>
                        <AlertDescription className="text-blue-700 text-xs">
                          OG card assets must be stored in a public repository to be accessible via CDN.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {showVisibilityWarning && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Private Repository Selected</AlertTitle>
              <AlertDescription>
                The selected repository is private. Your OG card assets will not be accessible
                via CDN unless the repository is public. Please select or create a public repository.
              </AlertDescription>
            </Alert>
          )}

          {previewUrl && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Preview URL</Label>
                <div className="flex mt-1">
                  <Input 
                    readOnly 
                    value={previewUrl}
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="ml-2"
                    onClick={handleCopyUrl}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-muted rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Yodl Preview</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={handleRefreshPreview}
                    disabled={loading}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      loading && "animate-spin"
                    )} />
                    Refresh
                  </Button>
                </div>
                
                <div className="relative w-full h-[300px] bg-black/30 rounded-md overflow-hidden border border-border">
                  {previewData ? (
                    <div className="w-full h-full flex items-center justify-center">
                      {yodlPreviewUrl ? (
                        <iframe 
                          src={yodlPreviewUrl} 
                          className="w-full h-full border-0" 
                          title="Yodl Preview" 
                          loading="lazy"
                          key={previewUrl}
                        ></iframe>
                      ) : (
                        <div className="text-center">
                          <div className="text-lg font-bold gradient-text mb-2">Preview Simulation</div>
                          <div className="text-sm text-muted-foreground mb-4">
                            <div className="font-mono mt-1 text-xs bg-secondary/50 p-2 rounded">
                              Your OG card will be available at: <br />
                              {folderPath.username && folderPath.repo ? 
                                `https://og.yodl.me/v1/preview/[hash]?baseUrl=https://cdn.jsdelivr.net/gh/${folderPath.username}/${folderPath.repo}/og/${folderPath.folder}`
                                : 'Please enter repository details'}
                            </div>
                          </div>
                          {previewData.files.inner && <div className="text-green-500 text-xs">✓ inner.png</div>}
                          {previewData.files.outer && <div className="text-green-500 text-xs">✓ outer.png</div>}
                          {previewData.files.overlay && <div className="text-green-500 text-xs">✓ overlay.png</div>}
                          
                          {(!previewData.files.inner || !previewData.files.outer || !previewData.files.overlay) && (
                            <div className="text-yellow-500 text-xs mt-2">Missing required files</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Preview not available - upload files first
                    </div>
                  )}
                </div>
                
                {yodlPreviewUrl && (
                  <div className="mt-3 flex justify-between">
                    <div className="text-xs text-muted-foreground">
                      Preview shows how your OG card will look on social media
                    </div>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex items-center text-xs"
                      onClick={() => window.open(yodlPreviewUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Yodl Preview
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <Button
            className="w-full"
            onClick={handleUploadToGitHub}
            disabled={!previewData || !folderPath.username || !folderPath.repo || uploadSuccess || !isAuthenticated}
          >
            <Github className="mr-2 h-4 w-4" />
            {uploadSuccess ? 'Files Uploaded Successfully' : isAuthenticated ? 'Upload Assets to GitHub' : 'Connect GitHub to Upload'}
          </Button>
          
          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground text-center">
              Sign in to GitHub to upload assets directly to your repository
            </p>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Files will be uploaded to this location when you proceed
          </p>
          {isAuthenticated && <RateLimitIndicator />}
        </CardFooter>
      </Card>
      
      <Dialog open={confirmUploadDialog} onOpenChange={setConfirmUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Upload</DialogTitle>
            <DialogDescription>
              Files will be uploaded to your GitHub repository:
              <span className="font-mono text-xs block mt-1 p-1 bg-muted rounded">
                {folderPath.username}/{folderPath.repo}/og/{folderPath.folder}
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex flex-col space-y-3">
              {previewData?.files.inner && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="text-sm">• inner.png</div>
                    <span className="ml-2 text-xs text-muted-foreground">(Suggested: 1200×800px)</span>
                  </div>
                </div>
              )}
              {previewData?.files.outer && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="text-sm">• outer.png</div>
                    <span className="ml-2 text-xs text-muted-foreground">(Suggested: 880×480px)</span>
                  </div>
                </div>
              )}
              {previewData?.files.overlay && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="text-sm">• overlay.png</div>
                    <span className="ml-2 text-xs text-muted-foreground">(Suggested: 600×800px)</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-xs bg-blue-50 text-blue-600 p-3 rounded-md">
              <p><strong>Note:</strong> Images will be converted and uploaded directly to your GitHub repository.
              After uploading, they will be available via the jsDelivr CDN for your ENS records.</p>
              <p className="mt-2"><strong>Important:</strong> Ensure your repository is public, or the CDN will not be able to access your images.</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUploadDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmUpload} 
              disabled={uploadLoading}
            >
              {uploadLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PreviewCard;
