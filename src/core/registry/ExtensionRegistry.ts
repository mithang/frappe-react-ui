import type { Extension, ExtensionManifest } from '../types';
import { EventBus } from '../eventbus/EventBus';
import { DocTypeRegistry } from './DocTypeRegistry';
import { FieldRegistry } from './FieldRegistry';
import { ScriptRegistry } from './ScriptRegistry';

/**
 * ExtensionRegistry - Central registry for micro-frontend extensions
 * Manages loading, initialization, and lifecycle of extensions
 */
class ExtensionRegistryImpl {
    private extensions: Map<string, Extension> = new Map();

    /**
     * Register an extension
     */
    async register(extension: Extension): Promise<void> {
        const { manifest } = extension;

        if (this.extensions.has(manifest.name)) {
            console.warn(`[ExtensionRegistry] Extension "${manifest.name}" already registered, replacing...`);
        }

        // Store extension
        this.extensions.set(manifest.name, extension);

        // Register DocType components
        if (extension.doctypeComponents) {
            for (const [doctype, components] of Object.entries(extension.doctypeComponents)) {
                DocTypeRegistry.register(doctype, components);
            }
        }

        // Register field renderers
        if (extension.fieldRenderers) {
            for (const [fieldType, renderer] of Object.entries(extension.fieldRenderers)) {
                FieldRegistry.register(fieldType, renderer);
            }
        }

        // Register client scripts
        if (extension.clientScripts) {
            for (const script of extension.clientScripts) {
                ScriptRegistry.register(script);
            }
        }

        // Initialize extension
        if (extension.init) {
            try {
                await extension.init();
            } catch (error) {
                console.error(`[ExtensionRegistry] Error initializing extension "${manifest.name}":`, error);
                throw error;
            }
        }

        console.log(`[ExtensionRegistry] Registered extension: ${manifest.name} v${manifest.version}`);
        EventBus.emit('extension:loaded', { name: manifest.name });
    }

    /**
     * Get a registered extension
     */
    get(name: string): Extension | undefined {
        return this.extensions.get(name);
    }

    /**
     * Check if an extension is registered
     */
    has(name: string): boolean {
        return this.extensions.has(name);
    }

    /**
     * Unregister an extension
     */
    unregister(name: string): void {
        const extension = this.extensions.get(name);
        if (!extension) return;

        // Clean up DocType registrations
        if (extension.doctypeComponents) {
            for (const doctype of Object.keys(extension.doctypeComponents)) {
                DocTypeRegistry.unregister(doctype);
            }
        }

        // Clean up client scripts
        if (extension.clientScripts) {
            for (const script of extension.clientScripts) {
                ScriptRegistry.clear(script.doctype);
            }
        }

        this.extensions.delete(name);
        console.log(`[ExtensionRegistry] Unregistered extension: ${name}`);
    }

    /**
     * Get all registered extensions
     */
    getAll(): Extension[] {
        return Array.from(this.extensions.values());
    }

    /**
     * Get all manifests
     */
    getManifests(): ExtensionManifest[] {
        return this.getAll().map((ext) => ext.manifest);
    }

    /**
     * Clear all extensions
     */
    clear(): void {
        for (const name of this.extensions.keys()) {
            this.unregister(name);
        }
    }
}

// Singleton instance
export const ExtensionRegistry = new ExtensionRegistryImpl();
