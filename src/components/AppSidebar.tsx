"use client"

import * as React from "react"
import {
  ArrowUpCircleIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SettingsIcon,
  LogOutIcon,
  FileText
} from "lucide-react"

import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useCommand } from '@/contexts/CommandContext'
import { useAuth } from '@/contexts/AuthContext'
import { resolveLucideIcon } from '@/lib/icons'

import { NavDocuments } from "@/components/nav-documents"
import { NavPanel } from "@/components/nav/NavPanel"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Link } from "react-router-dom"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { workspaces, isLoading } = useWorkspaces()
  const { user } = useAuth()
  const { toggle: toggleCommandPalette } = useCommand()

  // Search opens the command palette that already exists (Cmd+K). Settings and Get Help have no
  // destination in this app yet, so they render disabled rather than as links to nowhere.
  const navSecondary = React.useMemo(
    () => [
      { title: 'Settings', icon: SettingsIcon },
      { title: 'Get Help', icon: HelpCircleIcon },
      { title: 'Search', icon: SearchIcon, onClick: toggleCommandPalette },
    ],
    [toggleCommandPalette]
  )


  // Extract Top 5 shortcuts across all workspaces for NavDocuments
  const shortcuts = React.useMemo(() => {
    if (!workspaces) return []
    return workspaces
      .flatMap(ws => ws.shortcuts)
      .slice(0, 5)
      .map(sc => ({
        name: sc.label,
        url: sc.link_to ? `/doctype/${sc.link_to}` : '#',
        icon: resolveLucideIcon(sc.icon, FileText)
      }))
  }, [workspaces])

  const userData = {
    name: user?.full_name || "Administrator",
    email: user?.email || "admin@example.com",
    avatar: user?.user_image || "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-lg font-black italic">F</span>
                </div>
                <span className="text-base font-semibold">Frappe Desk</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* The current workspace's own grouped nav. Workspace switching moved to the rail
            (WorkspaceRail), so this pane shows one workspace at a time, as Desk does. */}
        <NavPanel />
        {!isLoading && (
          <>
            {shortcuts.length > 0 && <NavDocuments items={shortcuts} />}
            <NavSecondary items={navSecondary} className="mt-auto" />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
