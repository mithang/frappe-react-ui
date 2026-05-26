import type { ClientScript, ClientScriptHooks, FormController, FormHook, FieldHook } from '../types';

/**
 * ScriptRegistry - Registry for client scripts
 * Provides Frappe-like client script functionality with hooks
 */
class ScriptRegistryImpl {
    private scripts: Map<string, ClientScript[]> = new Map();

    /**
     * Register a client script for a DocType
     */
    register(script: ClientScript): () => void {
        const { doctype, name = `script_${Date.now()}` } = script;

        if (!this.scripts.has(doctype)) {
            this.scripts.set(doctype, []);
        }

        const scriptWithName = { ...script, name, enabled: script.enabled ?? true };
        this.scripts.get(doctype)!.push(scriptWithName);

        console.log(`[ScriptRegistry] Registered script "${name}" for: ${doctype}`);

        // Return unregister function
        return () => this.unregister(doctype, name);
    }

    /**
     * Unregister a client script
     */
    unregister(doctype: string, name: string): void {
        const scripts = this.scripts.get(doctype);
        if (scripts) {
            const index = scripts.findIndex((s) => s.name === name);
            if (index !== -1) {
                scripts.splice(index, 1);
                console.log(`[ScriptRegistry] Unregistered script "${name}" for: ${doctype}`);
            }
        }
    }

    /**
     * Get all scripts for a DocType
     */
    get(doctype: string): ClientScript[] {
        return this.scripts.get(doctype)?.filter((s) => s.enabled !== false) || [];
    }

    /**
     * Execute a hook for all scripts of a DocType
     */
    async executeHook(
        doctype: string,
        hookName: keyof ClientScriptHooks,
        frm: FormController,
        ...args: any[]
    ): Promise<boolean> {
        const scripts = this.get(doctype);

        for (const script of scripts) {
            const hook = script.hooks[hookName];
            if (hook) {
                try {
                    const result = await (hook as FormHook | FieldHook)(frm, ...args);
                    // If validate hook returns false, stop execution
                    if (hookName === 'validate' && result === false) {
                        return false;
                    }
                } catch (error) {
                    console.error(`[ScriptRegistry] Error in ${hookName} hook for ${doctype}:`, error);
                    // For validate, treat errors as validation failures
                    if (hookName === 'validate') {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Execute field change hooks
     */
    async executeFieldChange(
        doctype: string,
        fieldname: string,
        frm: FormController,
        cdt: string = doctype,
        cdn: string = frm.docname
    ): Promise<void> {
        const hookName = `${fieldname}_change`;
        await this.executeHook(doctype, hookName, frm, cdt, cdn);
    }

    /**
     * Check if any scripts are registered for a DocType
     */
    has(doctype: string): boolean {
        const scripts = this.scripts.get(doctype);
        return !!scripts && scripts.length > 0;
    }

    /**
     * Enable/disable a script
     */
    setEnabled(doctype: string, name: string, enabled: boolean): void {
        const scripts = this.scripts.get(doctype);
        if (scripts) {
            const script = scripts.find((s) => s.name === name);
            if (script) {
                script.enabled = enabled;
            }
        }
    }

    /**
     * Get all registered DocTypes with scripts
     */
    getRegisteredDocTypes(): string[] {
        return Array.from(this.scripts.keys());
    }

    /**
     * Clear all scripts for a DocType or all scripts
     */
    clear(doctype?: string): void {
        if (doctype) {
            this.scripts.delete(doctype);
        } else {
            this.scripts.clear();
        }
    }
}

// Singleton instance
export const ScriptRegistry = new ScriptRegistryImpl();

// Convenience function for registering scripts (more ergonomic API)
export function registerClientScript(script: ClientScript): () => void {
    return ScriptRegistry.register(script);
}
