// Core Framework Exports
// This is the main entry point for the @frappe-canvas/core package

// Types
export type {
    FrappeFieldType,
    DocField,
    DocTypeMeta,
    Document,
    FormController,
    FormHook,
    FieldHook,
    ClientScriptHooks,
    ClientScript,
    FieldRendererProps,
    FieldRenderer,
    DocTypeComponents,
    ExtensionManifest,
    Extension,
    EventHandler,
    EventBusEvents,
} from './types';

// Registries
export { ExtensionRegistry } from './registry/ExtensionRegistry';
export { DocTypeRegistry } from './registry/DocTypeRegistry';
export { FieldRegistry } from './registry/FieldRegistry';
export { ScriptRegistry, registerClientScript } from './registry/ScriptRegistry';

// Event Bus
export { EventBus } from './eventbus/EventBus';
