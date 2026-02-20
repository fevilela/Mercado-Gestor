# Zyrion - ERP System for Retail Markets

## Overview

Zyrion is a comprehensive Enterprise Resource Planning (ERP) system designed specifically for retail markets and grocery stores in Brazil. The application provides complete business management including Point of Sale (PDV), inventory control, financial management, customer/supplier relationships, and full Brazilian fiscal compliance with NF-e, NFC-e, NFS-e, CT-e, and MDF-e electronic document integration.

The system is built as a multi-tenant SaaS application where each company has isolated data, users, and configurations. It features role-based access control (RBAC) with granular permissions across all modules.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)
- **API Pattern**: RESTful endpoints under `/api/*` prefix
- **Authentication**: Session-based with bcrypt password hashing

### Database Layer

- **Database**: PostgreSQL (via Supabase or direct connection)
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Connection**: Uses `SUPABASE_DATABASE_URL` or `DATABASE_URL` environment variable

### Multi-Tenancy Design

- Company-scoped data isolation via `companyId` foreign keys
- Session stores `companyId` for automatic data filtering
- RBAC system with roles, permissions, and role-permission mappings

### Fiscal Integration Architecture

- **SEFAZ Integration**: SOAP-based communication with Brazilian tax authorities
- **Digital Certificates**: PKCS#12 (.pfx/.p12) certificate management with node-forge
- **XML Signing**: RSA-SHA256 signatures for fiscal documents
- **Document Types**: NF-e (55), NFC-e (65), NFS-e, CT-e (57), MDF-e (58)
- **Tax Calculations**: ICMS, IPI, PIS, COFINS, ISS with CSOSN/CST support
- **Contingency Mode**: Offline NFC-e queue with automatic retry

### Key Server Modules

- `server/auth.ts` - Authentication and RBAC management
- `server/fiscal-routes.ts` - All fiscal document endpoints
- `server/sefaz-service.ts` - SEFAZ communication layer
- `server/xml-signature.ts` - XML digital signing
- `server/tax-calculator.ts` - Tax calculation engine
- `server/storage.ts` - Database abstraction layer

### Build System

- Development: Vite dev server with HMR proxied through Express
- Production: esbuild bundles server to `dist/index.cjs`, Vite builds client to `dist/public`
- Single entry point: `npm run dev` starts both frontend and backend

## External Dependencies

### Database

- **PostgreSQL**: Primary data store (Supabase recommended)
- **Environment Variables**: `DATABASE_URL` or `SUPABASE_DATABASE_URL`

### Third-Party APIs

- **ReceitaWS**: CNPJ lookup and validation (`https://www.receitaws.com.br/v1/cnpj/`)
- **Brasil API**: EAN/GTIN product lookup
- **Open Food Facts**: Secondary product data source
- **SEFAZ Web Services**: Brazilian tax authority integration (per-state URLs)

### Key NPM Packages

- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `node-forge`: PKCS#12 certificate parsing and crypto operations
- `pdfmake`: DANFE PDF generation
- `xml2js`: XML parsing for fiscal documents
- `soap`: SEFAZ SOAP client
- `qrcode`: QR code generation for NFC-e
- `bcryptjs`: Password hashing
- `express-session` / `connect-pg-simple`: Session management

### Environment Variables Required

- `DATABASE_URL` or `SUPABASE_DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Express session encryption key (defaults provided for dev)
