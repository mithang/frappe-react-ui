import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavSecondaryItem {
  title: string
  icon: LucideIcon
  /** Where the item goes. Omit when the item performs an action instead of navigating. */
  url?: string
  /** An in-app action (e.g. opening the command palette) rather than a route. */
  onClick?: () => void
}

/**
 * The small action group at the bottom of the sidebar.
 *
 * Items render as a <button> unless they have a real `url`. They used to be `<Link to="#">`
 * regardless: clicking one navigated nowhere but still moved focus to the bottom of a scrollable
 * sidebar, dragging the panel's scroll with it — the nav appeared to "jump" to an unrelated part
 * of the list. An item with neither `url` nor `onClick` is a placeholder and renders disabled, the
 * same way an unroutable sidebar link does, rather than pretending to be actionable.
 */
export function NavSecondary({
  items,
  ...props
}: {
  items: NavSecondaryItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.url ? (
                <SidebarMenuButton asChild>
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  type="button"
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  aria-disabled={!item.onClick}
                  className={item.onClick ? undefined : "opacity-50 cursor-default"}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
