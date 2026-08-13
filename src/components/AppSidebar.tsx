import React, { useState } from 'react';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { resolveLucideIcon } from '@/lib/icons';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaces, isLoading } = useWorkspaces();
  const [openGroups, setOpenGroups] = useState<string[]>(['Home']);

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const getIcon = (iconName?: string) => {
    return resolveLucideIcon(iconName, FileText);
  };

  return (
    <Sidebar className="border-r-0 bg-sidebar-background">
      <SidebarHeader className="p-6 mb-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 text-primary-foreground transform rotate-3">
            <span className="text-lg font-black italic">F</span>
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-sidebar-foreground">Frappe</h2>
            <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-tighter">React Desk</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-sidebar-accent/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          (workspaces || []).map((workspace) => {
            const Icon = getIcon(workspace.icon);
            const isOpen = openGroups.includes(workspace.name);
            return (
              <Collapsible
                key={workspace.name}
                open={isOpen}
                onOpenChange={() => toggleGroup(workspace.name)}
                className="mb-1"
              >
                <SidebarGroup className="p-0">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(`/workspace/${workspace.name}`)}
                      className={`
                        flex-1 flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl text-left transition-all group
                        ${isOpen ? 'text-sidebar-foreground bg-sidebar-accent/30' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20'}
                      `}
                    >
                      <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isOpen ? 'text-primary' : ''}`} />
                      <span className="flex-1">{workspace.label}</span>
                    </button>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Toggle ${workspace.label}`}
                        className="p-2.5 text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-xl"
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="mt-1 ml-4 pl-4 border-l-2 border-sidebar-accent/30 space-y-1">
                      {workspace.shortcuts.map((shortcut) => {
                        const targetPath = shortcut.link_to ? `/doctype/${shortcut.link_to}` : '/';
                        const isActive = location.pathname === targetPath;
                        const SubIcon = getIcon(shortcut.icon);

                        return (
                          <Link
                            key={shortcut.name}
                            to={targetPath}
                            className={`
                              text-xs font-bold px-4 py-2 flex items-center gap-3 transition-all rounded-lg
                              ${isActive
                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/20'
                              }
                            `}
                          >
                            <SubIcon className="h-3.5 w-3.5" />
                            <span>{shortcut.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })
        )}
      </SidebarContent>
    </Sidebar>
  );
}