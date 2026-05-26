# frappe-react-ui

A modern, fully metadata-driven **React-based replacement for the Frappe Desk** interface.

Unlike simple API wrappers, this project implements a full **SMVC (Smart Model-View-Controller)** architecture on the frontend, dynamically reading Frappe DocType metadata to render forms, lists, and fields exactly as Frappe does.

---

## ✨ Core Features

- 🧠 **True Metadata-Driven UI:** Forms and lists dynamically build themselves by fetching DocType metadata from the Frappe server.
- 💾 **Full Data Lifecycle (CRUD):** Built-in `DocumentModel` and `FormController` handle `create`, `update`, `save`, and `delete` operations seamlessly, including executing Frappe's `before_save` and `after_save` client scripts.
- 🔗 **Advanced Link Field Handling:** Fully supports standard and **Dynamic Links**. Uses native `frappe.desk.search.search_link` RPC calls with debouncing and renders results in a fast, keyboard-accessible combobox.
- 🔒 **Native Frappe Auth:** Uses the official `frappe-js-sdk` to authenticate and maintain sessions with the Frappe backend. No proxy server needed.
- ⌨️ **Command Palette:** Built-in `Cmd+K` command palette for quick navigation, mimicking Frappe's awesomebar.

---

## 🎨 UI Framework Stack

This project achieves a modern, SaaS-like aesthetic without compromising accessibility:

- **React 18** as the core library.
- **shadcn/ui** for the component system.
- **Radix UI** primitives under the hood to ensure full accessibility (WAI-ARIA compliance, screen reader support, keyboard navigation).
- **Tailwind CSS** for all styling, layouts, and theming (including out-of-the-box Dark Mode).
- **Lucide React** for beautiful, consistent iconography.

---

## 🔌 Pluggable Architecture

The framework is built to be extended:
- `DocTypeRegistry`: Register custom React components for specific DocTypes.
- `FieldRegistry`: Extendable registry for adding custom field renderers (like barcode scanners or custom maps).
- `ScriptRegistry`: Run standard Frappe client scripts dynamically.
- `ExtensionRegistry`: Add completely custom views and functionality.

---

## 📁 Architecture Overview

```
src/
├── core/                  # Core Framework
│   ├── registry/          # Registries for DocTypes, Fields, Scripts, Extensions
│   └── eventbus/          # Frappe-style event communication
├── controllers/           # SMVC Controllers
│   ├── FormController.ts  # Handles document fetch, save, validate lifecycles
│   └── ListController.ts  # Handles list fetching, pagination, filtering
├── views/                 # Core Views
│   ├── forms/             # SmartForm (Dynamic Form Engine)
│   ├── lists/             # SmartList (Dynamic List Engine)
│   └── fields/            # Field Renderers (Data, Link, Dynamic Link, Table, etc)
├── models/                # Data Models
│   └── DocumentModel.ts   # Document state wrapper & CRUD logic via SDK
├── components/            # UI Components
│   └── ui/                # shadcn/ui primitives
├── extensions/            # Example Custom Extensions
└── lib/                   # API Utilities (frappe-js-sdk integration)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A running Frappe instance with CORS configured to allow your local frontend URL (e.g. `http://localhost:8080`).

### Installation

```bash
# Clone the repository
git clone https://github.com/vyogotech/frappe-react-ui.git
cd frappe-react-ui

# Install dependencies
npm install
```

### Configuration

Ensure you have your Frappe instance running. The frontend uses `frappe-js-sdk` and will authenticate directly with the Frappe server.

Update `src/lib/frappe.ts` to point to your development Frappe URL if not running on the same origin.

### Development

```bash
npm run dev
```

App will be available at **http://localhost:8080**

---

## 🛠 Extending the UI

### 1. Register a Custom DocType View

Instead of relying on the dynamic `SmartForm`, you can register a fully custom view for a specific DocType.

```tsx
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';

// Register a custom form for 'Sales Order'
DocTypeRegistry.registerForm('Sales Order', MyCustomSalesOrderForm);
```

### 2. Add Custom Field Renderers

```tsx
import { FieldRegistry } from '@/core/registry/FieldRegistry';

// Create a custom barcode scanner field for 'Data' fields named 'barcode'
FieldRegistry.registerRenderer('Data', MyBarcodeRenderer, (field) => field.fieldname === 'barcode');
```

---

## 🤝 Contributing

PRs are welcome! Please open an issue to discuss significant changes to the core architecture before submitting a PR.

---

## 📄 License

MIT © [Vyogo Technologies](https://github.com/vyogotech)
