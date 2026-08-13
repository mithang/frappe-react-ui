import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useRoutes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { WorkspaceRail, RAIL_WIDTH } from "@/components/nav/WorkspaceRail";
import LoginForm from "@/components/LoginForm";
import { initializeFrappe } from "@/lib/frappe";
import { initializeFramework } from "@/init";
import { CommandPalette } from "@/components/CommandPalette";
import { CommandProvider } from "@/contexts/CommandContext";
import { Header } from "@/components/Header";
import { routes } from "@/routes";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AIChatBar } from "@/components/AIChatBar";

const queryClient = new QueryClient();

// Initialize Frappe API on app start
initializeFrappe();

// Initialize Frappe Canvas framework (registries, field renderers, etc.)
initializeFramework();

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const routeElement = useRoutes(routes);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <CommandProvider>
      <SidebarProvider>
        <CommandPalette />
        <div className="min-h-screen flex w-full" style={{ ["--rail-width" as string]: RAIL_WIDTH }}>
          {/* Rail first, then the collapsible panel — matching Desk, where collapsing the
              sidebar leaves the rail in place. */}
          <WorkspaceRail />
          {/* The shadcn Sidebar's visible pane is `position: fixed; left: 0`, so without this it
              renders UNDERNEATH the in-flow rail and clips the panel's labels. Offsetting both
              states keeps the collapse animation intact: expanded sits beside the rail, collapsed
              still slides fully off-screen. */}
          <AppSidebar className="left-[var(--rail-width)] group-data-[collapsible=offcanvas]:left-[calc(var(--rail-width)-var(--sidebar-width))]" />
          <main className="flex-1 flex flex-col relative">
            <Header />
            <div className="flex-1 p-2">{routeElement}</div>
            <AIChatBar />
          </main>
        </div>
      </SidebarProvider>
    </CommandProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
