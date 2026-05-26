import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { WorkspaceDashboard } from '@/components/WorkspaceDashboard';

const WorkspaceView: React.FC = () => {
  const { workspaceName } = useParams<{ workspaceName: string }>();
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();

  const workspace = workspaces.find(w => w.name === workspaceName);

  const handleShortcutClick = (shortcutName: string) => {
    // Navigate to the appropriate doctype or page
    if (shortcutName === 'Dashboard') {
      navigate('/');
    } else {
      // Most shortcuts are doctype names, navigate to the list view
      navigate(`/doctype/${shortcutName}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-12 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="col-span-3 h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Workspace Not Found</h1>
          <p className="text-muted-foreground">
            The workspace "{workspaceName}" could not be found.
          </p>
        </div>
      </div>
    );
  }

  return <WorkspaceDashboard workspace={workspace} onShortcutClick={handleShortcutClick} />;
};

export default WorkspaceView;