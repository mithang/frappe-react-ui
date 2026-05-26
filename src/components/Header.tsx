
import React, { Fragment } from 'react';
import { Search, Bell, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCommand } from '@/contexts/CommandContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, Transition } from '@headlessui/react';

export function Header() {
    const { toggle } = useCommand();
    const { user, logout } = useAuth();

    return (
        <header className="border-b h-16 flex items-center px-6 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-30 w-full shadow-sm">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="hover-elevate" />
                <div className="h-6 w-[1px] bg-border hidden sm:block" />
                <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent hidden sm:block">
                  Enterprise Dashboard
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
                  <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-background" />
                  </Button>
                  
                  <Menu as="div" className="relative">
                    <Menu.Button className="flex items-center gap-2 p-1 hover:bg-muted rounded-full transition-colors focus:outline-none">
                      <Avatar className="h-8 w-8 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
                        <AvatarImage src={user?.user_image} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                          {user?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-border rounded-xl bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="px-4 py-3">
                          <p className="text-sm font-semibold">{user?.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                        <div className="p-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button className={`${active ? 'bg-muted' : ''} flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors`}>
                                <Settings className="h-4 w-4" /> Settings
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button 
                                onClick={logout}
                                className={`${active ? 'bg-red-50 dark:bg-red-950/20 text-red-600' : 'text-red-500'} flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors`}
                              >
                                <LogOut className="h-4 w-4" /> Logout
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
            </div>
        </header>
    );
}
