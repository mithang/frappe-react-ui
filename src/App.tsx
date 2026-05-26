
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import LoginForm from "@/components/LoginForm";
import Dashboard from "@/components/Dashboard";
import WorkspaceView from "@/components/WorkspaceView";
import { initializeFrappe } from "@/lib/frappe";
import { initializeFramework } from "@/init";
import { registerSalesOrderExtension } from "@/extensions/examples/SalesOrderExtension";
import NotFound from "./pages/NotFound";
import { CommandPalette } from "@/components/CommandPalette";
import { CommandProvider } from "@/contexts/CommandContext";
import { Header } from "@/components/Header";

// Import new SMVC components
import { SmartForm } from "@/views/forms";
import { SmartList } from "@/views/lists";

const queryClient = new QueryClient();

// Initialize Frappe API on app start
initializeFrappe();

// Initialize Frappe Canvas framework (registries, field renderers, etc.)
initializeFramework();

// Register example extension (demonstrates client scripts and custom fields)
registerSalesOrderExtension();

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoading } = useAuth();

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
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <main className="flex-1 flex flex-col">
            <Header />
            <div className="flex-1 p-2">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workspace/:workspaceName" element={<WorkspaceView />} />
                {/* Use new SMVC-based Smart components */}
                <Route path="/doctype/:doctype" element={<SmartList />} />
                <Route path="/doctype/:doctype/:name" element={<SmartForm />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </CommandProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
