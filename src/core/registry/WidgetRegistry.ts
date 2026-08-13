// WidgetRegistry (1C) — workspace/dashboard widget types. Replaces the hardcoded `switch` on 8
// widget types (D1-D4's home); a downstream app registers a new widget type without touching
// core dashboard-rendering code.

import type { ComponentType } from 'react';

class WidgetRegistryImpl {
  private widgets = new Map<string, ComponentType<never>>();

  register<P>(type: string, component: ComponentType<P>): void {
    // Widget prop shapes vary per widget type — this Map deliberately stores the erased type;
    // callers of get() get an untyped ComponentType back and are responsible for passing the
    // right props for whatever `type` they asked for. Kept out of `any` via ComponentType<never>
    // (which still forbids accidentally invoking it with the wrong props internally) rather than
    // widening the stored type to `any`.
    this.widgets.set(type, component as unknown as ComponentType<never>);
  }

  get(type: string): ComponentType<never> | undefined {
    return this.widgets.get(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.widgets.keys());
  }

  clear(): void {
    this.widgets.clear();
  }
}

export const WidgetRegistry = new WidgetRegistryImpl();
