// RouteRegistry (1C) — extension-contributed routes. W0.12 already made src/routes.tsx a plain
// array; this registry is the mechanism for a downstream extension to add to it without editing
// that file. src/routes.tsx should read RouteRegistry.getRoutes() and append them (2D/3C wiring).

import type { ReactElement } from 'react';

export interface ExtensionRoute {
  path: string;
  element: ReactElement;
}

class RouteRegistryImpl {
  private routes: ExtensionRoute[] = [];

  add(route: ExtensionRoute): () => void {
    this.routes.push(route);
    return () => {
      this.routes = this.routes.filter((r) => r !== route);
    };
  }

  getRoutes(): ExtensionRoute[] {
    return [...this.routes];
  }

  clear(): void {
    this.routes = [];
  }
}

export const RouteRegistry = new RouteRegistryImpl();
