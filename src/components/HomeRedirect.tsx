import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaces } from '@/hooks/useWorkspaces';

export const HomeRedirect: React.FC = () => {
  const { workspaces, isLoading } = useWorkspaces();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (workspaces.length > 0) {
        // Find 'Home' or 'Build' or just use the first available workspace
        const defaultWorkspace = workspaces.find(w => w.name === 'Home') || workspaces[0];
        navigate(`/workspace/${defaultWorkspace.name}`, { replace: true });
      }
    }
  }, [isLoading, workspaces, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null;
};
