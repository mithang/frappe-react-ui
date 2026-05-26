/**
 * Frappe Canvas Framework - Initialization
 * 
 * This module initializes the core framework components:
 * - Registers default field renderers
 * - Sets up event listeners
 * - Exposes global APIs for extension developers
 */

import { registerDefaultFieldRenderers } from '@/views/fields/FieldRenderers';
import { ExtensionRegistry } from '@/core/registry/ExtensionRegistry';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import { FieldRegistry } from '@/core/registry/FieldRegistry';
import { ScriptRegistry, registerClientScript } from '@/core/registry/ScriptRegistry';
import { EventBus } from '@/core/eventbus/EventBus';

let initialized = false;

/**
 * Initialize the Frappe Canvas framework
 * Call this once at app startup before rendering
 */
export function initializeFramework(): void {
    if (initialized) {
        console.warn('[FrappeCanvas] Framework already initialized');
        return;
    }

    console.log('[FrappeCanvas] Initializing framework...');

    // Register default field renderers
    registerDefaultFieldRenderers();

    // Set up global error handler for extensions
    EventBus.on('extension:loaded', ({ name }) => {
        console.log(`[FrappeCanvas] Extension loaded: ${name}`);
    });

    // Expose APIs globally for extension developers (similar to frappe)
    if (typeof window !== 'undefined') {
        (window as any).frappeCanvas = {
            // Registries
            ExtensionRegistry,
            DocTypeRegistry,
            FieldRegistry,
            ScriptRegistry,
            EventBus,

            // Convenience methods
            registerClientScript,

            // Version info
            version: '1.0.0',
        };
    }

    initialized = true;
    console.log('[FrappeCanvas] Framework initialized successfully');
}

/**
 * Load a remote extension
 */
export async function loadExtension(
    remoteEntry: string,
    scope: string,
    module: string = './extension'
): Promise<void> {
    await ExtensionRegistry.loadRemote(remoteEntry, scope, module);
}

/**
 * Check if framework is initialized
 */
export function isFrameworkInitialized(): boolean {
    return initialized;
}
