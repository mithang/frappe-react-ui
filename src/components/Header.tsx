import React from 'react';
import { Search, Bell, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCommand } from '@/contexts/CommandContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore } from '@/store/uiStore';

export function Header() {
    const { toggle } = useCommand();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useUIStore();

    return (
        <header className="border-b h-16 flex items-center px-6 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-30 w-full shadow-sm">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="hover-elevate" />
                <div className="h-6 w-[1px] bg-border hidden sm:block" />
                <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent hidden sm:block">
                  Frappe Desk
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative group hidden md:block">
                    <Button
                        variant="outline"
                        className="w-[300px] justify-start text-muted-foreground h-10 border-muted bg-muted/30 hover:bg-muted/50 transition-all rounded-full px-4"
                        onClick={toggle}
                    >
                        <Search className="mr-2 h-4 w-4" />
                        <span className="flex-1 text-left text-sm">Search documents...</span>
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full relative text-muted-foreground"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                      {theme === 'dark' ? (
                          <Moon className="h-5 w-5" />
                      ) : (
                          <Sun className="h-5 w-5" />
                      )}
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                        <Avatar className="h-8 w-8 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                          <AvatarImage src={user?.user_image} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                            {user?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-semibold">{user?.full_name || 'Administrator'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email || 'admin@example.com'}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
