# Adding a field renderer

Forms in this app are built by `FieldDispatcher` walking a `DocTypeMeta`'s fields and resolving a
component per field — see `src/views/fields/FieldDispatcher.tsx`. New field types and
doctype-specific overrides both plug into the same three-level resolution chain; pick the right
level instead of special-casing inside `FieldDispatcher` itself.

> **Corrected 2026-08-13 (W0.14).** Two path references below changed since this was first
> written: the `src/views/fields/index.ts` barrel was verified as dead code (zero importers) and
> deleted in W0.2 — renderers are imported directly from their files now, not through a re-export
> barrel. And `SalesOrderExtension.tsx` moved to `docs/examples/extensions/` (W0.3) — it was
> registered unconditionally in `App.tsx` and its `customer_change` hook wrote a fake
> `customer_name` onto real Sales Orders (defect D8); it's reference material now, not live code.

## The contract

Every renderer implements `FieldRendererProps<T>` (`src/core/types/field.ts`):

```ts
interface FieldRendererProps<T = any> {
  field: DocField;          // includes any active field-level overrides already merged in
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;       // already OR'd with field.read_only by the caller in most paths —
                             // still guard with `disabled || field.read_only` inside your own
                             // component, since some callers (e.g. TableField cells) pass it raw
  error?: string;
  doc?: Document | Record<string, any>;  // the owning document OR child row — see A2 below
  frm?: FormController;
}
```

`FieldDispatcher` renders the label, required-marker, description, and error text around
whatever your component returns — your component should render **only the input control**, not
its own label. When nesting inside `TableField`, `hideLabel` is passed through automatically;
don't duplicate that logic in the leaf renderer.

## Resolution order (register at the right scope)

`FieldDispatcher` checks, in order:

1. `DocTypeRegistry.getFieldRenderer(doctype, fieldname)` — a renderer for one specific field on
   one specific doctype (e.g. a barcode scanner only on `Item.barcode`)
2. `FieldRegistry.get(fieldtype, doctype, fieldname)` — a renderer for a whole fieldtype, either
   globally or scoped (the registry supports an optional matcher/scope — check
   `src/core/registry/FieldRegistry.ts` before assuming global-only)
3. `FallbackField` — plain text input, last resort

Pick the narrowest scope that's actually needed. A new fieldtype (e.g. real `Attach` upload
support) registers at level 2, globally, in `registerDefaultFieldRenderers()`
(`src/views/fields/FieldRenderers.tsx`). A one-off customization for a single doctype's field
registers at level 1 via `DocTypeRegistry`, and should usually live in that doctype's own
extension module (see `docs/examples/extensions/SalesOrderExtension.tsx` for the pattern — worked
example only, not wired into the app), not in the core `FieldRenderers.tsx` file.

## Steps

1. Small, self-contained renderers go straight into `src/views/fields/FieldRenderers.tsx`.
   Anything with its own data fetching, async state, or more than ~40 lines (the shape of
   `LinkField.tsx` / `TableField.tsx`) gets its own file, imported directly by whatever needs it.
2. Respect the existing styling convention: `error ? 'border-destructive' : ''` on the input's
   className, so validation errors look consistent across every field type.
3. Register it in `registerDefaultFieldRenderers()` (global fieldtype) or via
   `DocTypeRegistry.registerFieldRenderer(doctype, fieldname, Component)` (scoped override).
4. If the renderer needs data about *another* field on the same document (a Dynamic Link's
   target doctype, a `fetch_from` source), take that from `field` / the `doc` prop passed in —
   **never reach into a global current-document store.** Use `doc` — the owning document OR, for
   a field inside a child table, that row itself. A global read silently breaks the renderer for
   any field inside a child table, where the "current document" isn't the row's parent (bug A2).
5. If the renderer opens a picker/combobox (any third-party command palette, e.g. cmdk), verify
   what value its `onSelect`/`onChange` callback actually hands back before wiring it to your
   `onChange`. cmdk lowercases item values — this is exactly what corrupted Link field values
   (case-sensitive Frappe document names) before it was caught (bug C5). Prefer keeping the real
   value in your own closure/option object and ignoring the callback's argument.
6. New child-table rows must carry `__islocal: 1`, never a fabricated `name` value (bug C7) — the
   server assigns the real name on save and returns the client's placeholder as `localname`; see
   `frappe-api.md` for the exact re-keying behavior.
7. Verify against a live bench, not just visually — several existing renderers look correct and
   silently write the wrong data (wrong case, wrong child-row shape). See `run-against-bench.md`
   for how to spin one up.
