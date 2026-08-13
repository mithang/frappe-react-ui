// Resolves a Frappe `Icon`-fieldtype value (kebab-case, e.g. "shopping-cart", "building-2") to
// its lucide-react component. Frappe's Icon field picker (Workspace.icon, Workspace Sidebar
// Item.icon) uses lucide's own icon names verbatim, just kebab-cased — lucide-react's `icons`
// registry is keyed PascalCase ("ShoppingCart"), so this is a name-format bridge, not a curated
// subset. A small hardcoded map covering every real icon name used in one app would always be
// one release behind whatever icons a DocType's Workspace record actually references.

import { icons, FileText, type LucideIcon } from 'lucide-react';

function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function resolveLucideIcon(iconName: string | undefined, fallback: LucideIcon = FileText): LucideIcon {
  if (!iconName) return fallback;
  const pascalName = toPascalCase(iconName) as keyof typeof icons;
  return icons[pascalName] ?? fallback;
}
