import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GitHubAuthService } from '@/lib/githubAuthService';
import { Loader2 } from 'lucide-react';

const GitHubCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  
  useEffect(() => {
    const code = searchParams.get('code');
    const authService = GitHubAuthService.getInstance();
    
    const handleCallback = async () => {
      if (code) {
        try {
          const success = await authService.handleCallback(code);
          if (success) {
            setStatus('success');
            // Redirect after short delay so user can see success message
            setTimeout(() => {
              navigate('/');
            }, 1500);
          } else {
            setStatus('error');
          }
        } catch (error) {
          console.error('Error handling GitHub callback:', error);
          setStatus('error');
        }
      } else {
        setStatus('error');
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
              <p className="text-muted-foreground">There was a problem connecting your GitHub account.</p>
              <button 
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                onClick={() => navigate('/')}
              >
                Return to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitHubCallback; 