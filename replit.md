# ERPNext Login Application

## Overview
A React-based ERPNext login dashboard application built with Vite, TypeScript, and Tailwind CSS. The application allows users to authenticate with ERPNext credentials to access a dashboard.

## Project Structure
- `src/` - Main source code directory
  - `components/` - Reusable UI components
  - `pages/` - Page components
  - `hooks/` - Custom React hooks
  - `lib/` - Utility libraries
  - `contexts/` - React contexts
  - `controllers/` - Business logic controllers
  - `models/` - Data models
  - `store/` - State management (Zustand)
  - `views/` - View components

## Tech Stack
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation
- **Data Fetching**: TanStack React Query
- **Routing**: React Router DOM
- **ERPNext Integration**: frappe-js-sdk

## Running the Application
The application runs on port 5000 using the `npm run dev` command.

## Deployment
Configured for static deployment - build output goes to `dist/` directory.

## Recent Changes
- Migrated from Lovable to Replit environment
- Updated Vite config to use port 5000 with allowed hosts for Replit compatibility
- Removed lovable-tagger plugin dependency from vite config
