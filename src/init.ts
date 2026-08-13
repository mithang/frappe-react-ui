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

interface Registration {
    name: string;
    register: () => void | Promise<void>;
}

/**
 * Registration modules run here rather than being separate hardcoded calls, so a later wave
 * (e.g. 1C's NavRegistry/RouteRegistry/CommandRegistry/WidgetRegistry) adds one entry instead of
 * editing initializeFramework's body. A failure in one registration is isolated — see below —
 * so one broken module can't take the whole framework down before it starts.
 *
 * Extension discovery (discoverAndInstallExtensions, 3C) deliberately does NOT live here: this
 * runs at raw app boot, before login. Its RPCs (e.g. frappe.utils.change_log.get_versions) are
 * not guest-accessible, so calling it this early always 403s with a misleading "not whitelisted"
 * message (is_whitelisted's guest check and its "genuinely not whitelisted" check share one error
 * string) until the user has authenticated — confirmed live. It's called from AuthContext.tsx
 * instead, once `checkAuth()`/`login()` actually establish a session.
 */
const registrations: Registration[] = [
    { name: 'field-renderers', register: registerDefaultFieldRenderers },
];

/**
 * Initialize the Frappe Canvas framework
 * Call this once at app startup before rendering. Deliberately synchronous end-to-end for a
 * synchronous `register()` (like field renderers today) — an `await`, even on a non-promise,
 * defers a microtask, which would let the first render happen before registration completes.
 */
export function initializeFramework(): void {
    if (initialized) {
        console.warn('[FrappeCanvas] Framework already initialized');
        return;
    }

    console.log('[FrappeCanvas] Initializing framework...');

    for (const { name, register } of registrations) {
        try {
            const result = register();
            if (result instanceof Promise) {
                result.catch((error) => {
                    console.error(`[FrappeCanvas] Registration "${name}" failed:`, error);
                });
            }
        } catch (error) {
            console.error(`[FrappeCanvas] Registration "${name}" failed:`, error);
        }
    }

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
 * Check if framework is initialized
 */
export function isFrameworkInitialized(): boolean {
    return initialized;
}
