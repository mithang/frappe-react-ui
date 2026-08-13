// ExtensionHost (1C) — the single object every extension's setup(host) receives. Everything
// arrives through this; the extension imports nothing at runtime (no duplicate React, no version
// skew — this is why module federation's shared-scope machinery isn't needed here, see A9/3C).

import type { ComponentType, ReactNode } from 'react';
import type { ClientScriptHooks, DocTypeComponents, FieldRenderer, FrappeFieldType } from '@/core/types';
import { DocTypeRegistry } from './DocTypeRegistry';
import { FieldRegistry } from './FieldRegistry';
import { NavRegistry, type NavItem } from './NavRegistry';
import { RouteRegistry, type ExtensionRoute } from './RouteRegistry';
import { FormRegistry, type FormButton, type FormSlotName } from './FormRegistry';
import { ListRegistry, type ListBulkAction, type ListRowAction } from './ListRegistry';
import { CommandRegistry, type Command } from './CommandRegistry';
import { WidgetRegistry } from './WidgetRegistry';
import { registerClientScript } from './ScriptRegistry';

export interface ExtensionHost {
  doctypes: {
    registerForm: (doctype: string, component: DocTypeComponents['Form']) => void;
    registerList: (doctype: string, component: DocTypeComponents['List']) => void;
    registerPrint: (doctype: string, component: DocTypeComponents['Print']) => void;
  };
  fields: {
    register: (fieldType: FrappeFieldType | string, renderer: FieldRenderer) => void;
    registerOverride: (doctype: string, fieldname: string, renderer: FieldRenderer) => void;
  };
  nav: { addItem: (item: NavItem) => () => void };
  routes: { add: (route: ExtensionRoute) => () => void };
  forms: {
    addButton: (doctype: string, button: FormButton) => () => void;
    addSlot: (doctype: string, slot: FormSlotName, content: ReactNode) => () => void;
  };
  lists: {
    addBulkAction: (doctype: string, action: ListBulkAction) => () => void;
    addRowAction: (doctype: string, action: ListRowAction) => () => void;
  };
  commands: { add: (command: Command) => () => void };
  widgets: { register: <P>(type: string, component: ComponentType<P>) => void };
  scripts: { on: (doctype: string, hooks: ClientScriptHooks) => () => void };
}

export function createExtensionHost(): ExtensionHost {
  return {
    doctypes: {
      registerForm: (doctype, component) => DocTypeRegistry.register(doctype, { Form: component }),
      registerList: (doctype, component) => DocTypeRegistry.register(doctype, { List: component }),
      registerPrint: (doctype, component) => DocTypeRegistry.register(doctype, { Print: component }),
    },
    fields: {
      register: (fieldType, renderer) => FieldRegistry.register(fieldType, renderer),
      registerOverride: (doctype, fieldname, renderer) => FieldRegistry.registerOverride(doctype, fieldname, renderer),
    },
    nav: { addItem: (item) => NavRegistry.addItem(item) },
    routes: { add: (route) => RouteRegistry.add(route) },
    forms: {
      addButton: (doctype, button) => FormRegistry.addButton(doctype, button),
      addSlot: (doctype, slot, content) => FormRegistry.addSlot(doctype, slot, content),
    },
    lists: {
      addBulkAction: (doctype, action) => ListRegistry.addBulkAction(doctype, action),
      addRowAction: (doctype, action) => ListRegistry.addRowAction(doctype, action),
    },
    commands: { add: (command) => CommandRegistry.add(command) },
    widgets: { register: (type, component) => WidgetRegistry.register(type, component) },
    scripts: { on: (doctype, hooks) => registerClientScript({ doctype, hooks }) },
  };
}
