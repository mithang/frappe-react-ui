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
import { useAuth } from '@/contexts/AuthContext'
import { resolveLucideIcon } from '@/lib/icons'

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
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

const navSecondary = [
  {
    title: "Settings",
    url: "#",
    icon: SettingsIcon,
  },
  {
    title: "Get Help",
    url: "#",
    icon: HelpCircleIcon,
  },
  {
    title: "Search",
    url: "#",
    icon: SearchIcon,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { workspaces, isLoading } = useWorkspaces()
  const { user } = useAuth()

  // Transform Frappe workspaces into Shadcn Sidebar items
  const navMain = React.useMemo(() => {
    if (!workspaces) return []
    return workspaces.map(ws => ({
      title: ws.label,
      url: `/workspace/${ws.name}`,
      icon: resolveLucideIcon(ws.icon, FileText),
      items: ws.shortcuts?.map(sc => ({
        title: sc.label,
        url: sc.link_to ? `/doctype/${sc.link_to}` : '#',
      }))
    }))
  }, [workspaces])

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
        {!isLoading && (
          <>
            <NavMain items={navMain} />
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
