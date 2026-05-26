# frappe-react-ui

A modern, fully metadata-driven **React-based replacement for the Frappe Desk** interface.

Unlike simple API wrappers, this project implements a full **SMVC (Smart Model-View-Controller)** architecture on the frontend, dynamically reading Frappe DocType metadata to render forms, lists, and fields exactly as Frappe does.

---

## ✨ Core Features

- 🧠 **True Metadata-Driven UI:** Forms and lists dynamically build themselves by fetching DocType metadata from the Frappe server.
- 🔌 **Pluggable Architecture:**
  - `DocTypeRegistry`: Register custom React components for specific DocTypes.
  - `FieldRegistry`: Extendable registry for adding custom field renderers.
  - `ScriptRegistry`: Run standard Frappe client scripts dynamically.
  - `ExtensionRegistry`: Add completely custom views and functionality.
- 🏗 **SMVC Pattern:** 
  - Uses `FormController` and `ListController` to manage document lifecycles securely.
- 🔒 **Native Frappe Auth:** Uses the official `frappe-js-sdk` to authenticate and maintain sessions with the Frappe backend. No proxy server needed.
- ⌨️ **Command Palette:** Built-in `Cmd+K` command palette for quick navigation, mimicking Frappe's awesomebar.
- 🎨 **Modern Stack:** React 18, Vite, shadcn/ui, Tailwind CSS, TanStack Query, and Zustand.

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
│   └── fields/            # Standard Field Renderers (Data, Link, Table, etc)
├── models/                # Data Models
│   └── DocumentModel.ts   # Document state wrapper
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
