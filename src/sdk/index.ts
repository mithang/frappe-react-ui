// The extension-author-facing SDK surface (1C). Types plus `defineExtension` — nearly empty at
// runtime, deliberately: the extension imports nothing else, everything arrives through the
// `host` object passed to `setup()`. This is what a real `@frappe-react-ui/sdk` npm package
// would be; it lives inside the app for now since there's no separate package/workspace here,
// but the import boundary is already the intended one — nothing outside this file should be
// imported by an extension module.

import type { ExtensionHost } from '@/core/registry/ExtensionHost';

export type { ExtensionHost } from '@/core/registry/ExtensionHost';

export interface DefinedExtension {
  name: string;
  /** Checked against the host's supported major version — a mismatch fails loudly, named and
   *  attributed, instead of a white screen three routes later. */
  apiVersion: string;
  setup: (host: ExtensionHost) => void | Promise<void>;
}

export function defineExtension(ext: DefinedExtension): DefinedExtension {
  return ext;
}
