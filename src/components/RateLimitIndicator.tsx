import React, { useState, useEffect } from 'react';
import { GitHubService } from '@/lib/githubService';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Progress } from './ui/progress';

interface RateLimitIndicatorProps {
  resource?: string;
  className?: string;
}

const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({ 
  resource = 'core',
  className = '' 
}) => {
  const [limits, setLimits] = useState({
    remaining: 5000,
    total: 5000,
    used: 0,
    resetTime: 'Unknown',
    isLow: false
  });
  const [updating, setUpdating] = useState(false);
  const githubService = new GitHubService();

  useEffect(() => {
    // Get rate limits on component mount
    updateLimits();
    
    // Set up interval to refresh limits (every 5 minutes)
    const intervalId = setInterval(updateLimits, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [resource]);

  const updateLimits = () => {
    const info = githubService.getRateLimitInfo(resource);
    setLimits(info);
  };

  const handleRefresh = async () => {
    if (!githubService.isAuthenticated()) return;
    
    setUpdating(true);
    try {
      // Access the octokit instance via the service
      const octokit = githubService['octokit'];
      if (octokit) {
        // Call the rateLimitService through the githubService
        setUpdating(false);
        updateLimits();
      }
    } catch (error) {
      console.error('Failed to refresh rate limits:', error);
    } finally {
      setUpdating(false);
    }
  };

  const percentage = Math.max(0, Math.min(100, (limits.remaining / limits.total) * 100));
  
  const getColorClass = () => {
    if (percentage < 10) return 'text-destructive';
    if (percentage < 30) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  return (
    <div className={`text-xs flex items-center gap-2 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {limits.isLow && (
                <CircleAlert className="h-3 w-3 text-amber-500" />
              )}
              <span className={getColorClass()}>
                GitHub API: {limits.remaining}/{limits.total}
              </span>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-4 w-4 p-0" 
                onClick={handleRefresh}
                disabled={updating}
              >
                <RefreshCw className={`h-3 w-3 ${updating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="space-y-2 p-1">
              <div className="text-xs">
                GitHub API Rate Limits ({resource})
              </div>
              <div className="text-xs">
                {limits.remaining} remaining of {limits.total}
              </div>
              <div className="text-xs">
                Resets at: {limits.resetTime}
              </div>
              <Progress value={percentage} className="h-1" />
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default RateLimitIndicator; 