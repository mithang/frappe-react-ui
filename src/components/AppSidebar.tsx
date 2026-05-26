import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronRight, 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Package, 
  Calculator, 
  Target, 
  FileText, 
  Box, 
  Warehouse, 
  Clock, 
  CreditCard 
} from 'lucide-react';

const iconMap: { [key: string]: React.ElementType } = {
  home: LayoutDashboard,
  users: Users,
  'shopping-cart': ShoppingCart,
  package: Package,
  calculator: Calculator,
  target: Target,
  'file-text': FileText,
  box: Box,
  warehouse: Warehouse,
  clock: Clock,
  'credit-card': CreditCard,
  dashboard: LayoutDashboard,
};

export function AppSidebar() {
  const { user } = useAuth();
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

  const handleItemClick = (shortcut: any) => {
    if (shortcut.link_to) {
      navigate(`/doctype/${shortcut.link_to}`);
    } else if (shortcut.name === 'Dashboard') {
      navigate('/');
    }
  };

  const getIcon = (iconName?: string) => {
    return iconMap[iconName || ''] || FileText;
  };

  return (
    <Sidebar className="border-r-0 bg-sidebar-background">
      <SidebarHeader className="p-6 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 text-primary-foreground transform rotate-3">
            <span className="text-lg font-black italic">E</span>
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-sidebar-foreground">Enterprise</h2>
            <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-tighter">Systems v2.0</p>
          </div>
        </div>
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
            return (
              <Collapsible
                key={workspace.name}
                open={openGroups.includes(workspace.name)}
                onOpenChange={() => toggleGroup(workspace.name)}
                className="mb-1"
              >
                <SidebarGroup className="p-0">
                  <CollapsibleTrigger asChild>
                    <div
                      className={`
                        flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl cursor-pointer transition-all group
                        ${openGroups.includes(workspace.name) ? 'text-sidebar-foreground bg-sidebar-accent/30' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/20'}
                      `}
                      onClick={() => navigate(`/workspace/${workspace.name}`)}
                    >
                      <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${openGroups.includes(workspace.name) ? 'text-primary' : ''}`} />
                      <span className="flex-1">{workspace.label}</span>
                      <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${openGroups.includes(workspace.name) ? 'rotate-90' : 'opacity-40'}`} />
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-1 ml-4 pl-4 border-l-2 border-sidebar-accent/30 space-y-1">
                      {workspace.shortcuts.map((shortcut) => {
                        const isActive = location.pathname.includes(shortcut.link_to || '');
                        const SubIcon = getIcon(shortcut.icon);

                        return (
                          <div
                            key={shortcut.name}
                            onClick={() => handleItemClick(shortcut)}
                            className={`
                              cursor-pointer text-xs font-bold px-4 py-2 flex items-center gap-3 transition-all rounded-lg
                              ${isActive
                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/20'
                              }
                            `}
                          >
                            <SubIcon className="h-3.5 w-3.5" />
                            <span>{shortcut.label}</span>
                          </div>
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

      <SidebarFooter className="p-4 mt-auto">
        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/10">
          <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">Status</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-sidebar-foreground/80">System Online</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}