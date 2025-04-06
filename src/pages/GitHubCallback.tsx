import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GitHubAuthService } from '@/lib/githubAuthService';
import { Loader2, AlertCircle, Info } from 'lucide-react';

const GitHubCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const authService = GitHubAuthService.getInstance();
    
    const handleCallback = async () => {
      console.log('GitHub callback page loaded', { code, error });
      setDebugInfo(`Code: ${code ? 'present' : 'missing'}, Error: ${error || 'none'}`);
      
      if (error) {
        console.error('GitHub auth error:', error);
        setStatus('error');
        setErrorMessage(`GitHub returned an error: ${error}`);
        return;
      }
      
      if (!code) {
        console.error('No code parameter found in callback URL');
        setStatus('error');
        setErrorMessage('No authorization code was provided by GitHub');
        return;
      }
      
      try {
        console.log('Processing GitHub auth code...');
        const success = await authService.handleCallback(code);
        
        if (success) {
          console.log('GitHub authentication successful');
          setStatus('success');
          
          // Redirect after short delay so user can see success message
          setTimeout(() => {
            console.log('Redirecting to home page after successful GitHub login');
            navigate('/');
          }, 1500);
        } else {
          console.error('GitHub auth failed - no success response');
          setStatus('error');
          setErrorMessage('Failed to authenticate with GitHub');
        }
      } catch (error) {
        console.error('Error handling GitHub callback:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };
    
    handleCallback();
  }, [searchParams, navigate]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Connecting to GitHub</h2>
              <p className="text-muted-foreground">Please wait while we connect your GitHub account...</p>
              {debugInfo && (
                <div className="mt-4 p-2 bg-muted rounded text-xs text-muted-foreground text-left">
                  <p>Debug info: {debugInfo}</p>
                </div>
              )}
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Successfully Connected!</h2>
              <p className="text-muted-foreground">Your GitHub account has been connected. Redirecting you back...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
              <p className="text-muted-foreground mb-4">There was a problem connecting your GitHub account.</p>
              
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-left">
                  <p className="text-red-700 text-sm font-medium">Error details:</p>
                  <p className="text-red-600 text-sm">{errorMessage}</p>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button 
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  onClick={() => navigate('/')}
                >
                  Return to Home
                </button>
                <button
                  className="w-full px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/90 flex items-center justify-center gap-2"
                  onClick={() => {
                    const authService = GitHubAuthService.getInstance();
                    authService.signIn();
                  }}
                >
                  <Info className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitHubCallback; 