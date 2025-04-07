import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GitHubAuthService } from '@/lib/githubAuthService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setError(`GitHub authentication error: ${error}`);
      setLoading(false);
      return;
    }

    if (!code || !state) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    const handleCallback = async () => {
      try {
        const authService = GitHubAuthService.getInstance();
        await authService.handleCallback(code, state);
        toast({
          title: "Successfully connected to GitHub",
          description: "Your GitHub account has been connected.",
        });
        navigate('/');
      } catch (err) {
        console.error('Error handling GitHub callback:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        toast({
          title: "Authentication failed",
          description: "Failed to connect to GitHub. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Completing GitHub Sign In</CardTitle>
            <CardDescription>Please wait while we complete the authentication process...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Authentication Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/')}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
} 