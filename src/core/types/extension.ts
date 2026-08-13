// Extension manifest and registration types.

import type { DocTypeComponents, FieldRenderer } from './field';
import type { ClientScript } from './form';

export interface ExtensionManifest {
    name: string;
    version: string;
    description?: string;
    author?: string;
    doctypes?: string[];
    remoteEntry?: string;
    exposedModules?: string[];
}

export interface Extension {
    manifest: ExtensionManifest;
    doctypeComponents?: Record<string, DocTypeComponents>;
    clientScripts?: ClientScript[];
    fieldRenderers?: Record<string, FieldRenderer>;
    init?: () => void | Promise<void>;
}
