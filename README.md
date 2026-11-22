# 📱 QR Studio

<div align="center">

[![Next.js 15](https://img.shields.io/badge/Next.js-15.2.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2d3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

**A modern, privacy-first QR code generator, dynamic short-link manager, and scan analytics platform.**

[Features](#-features) • [Quick Start](#-quick-start) • [Storage Architecture](#-dual-mode-storage-architecture) • [API Reference](#-api-reference) • [Project Structure](#-project-structure) • [Contributing](#-contributing)

</div>

---

## 🌟 Overview

**QR Studio** is an all-in-one web application for designing, customizing, publishing, and tracking QR codes. Engineered with the **Next.js App Router**, **React 19**, and **TypeScript**, it bridges the gap between simple static QR tools and enterprise link management platforms.

Whether you need a quick, high-resolution vector QR code for print packaging or a dynamic link with editable destinations and real-time scan analytics, QR Studio handles both seamlessly with zero mandatory database configuration.

---

## ✨ Features

### 🎨 Deep Visual Customization
- **Color Customization**: Granular color pickers with real-time contrast checks for foreground and background.
- **Smart Presets**: Instant size selection (*Small (240px)*, *Medium (320px)*, *Large (420px)*, *Poster (640px)*, or custom up to 1400px).
- **Quiet Zone & Padding**: Adjustable module margins (0–12 modules) and interior canvas padding (0–40px).
- **Center Logo Integration**: Upload your logo (SVG, PNG, JPEG) with automated proportional scaling and Level-H error correction so the code remains 100% scannable.

### ⚡ Static vs. Dynamic Modes
- **Static QR Codes**: The destination URL is encoded directly into the 2D matrix. Permanent, tamper-proof, and works completely offline forever with zero server reliance.
- **Dynamic QR Codes**: Routes through a branded short slug (`/q/[slug]`). Allows you to **change the destination URL at any time**, even after thousands of physical materials have already been printed.

### 📊 Real-Time Scan Analytics
- **Device Intelligence**: Automatic classification of scanner devices (Mobile, Tablet, Desktop, Bot/Crawler).
- **Location Insights**: Captures lightweight regional and city data from request headers.
- **Privacy By Design**: IP addresses are cryptographically hashed using SHA-256 before analysis; raw personal identifiers are never stored.

### 🛡️ URL Safety & Security Shield
- **Phishing & Scheme Guard**: Automatically detects unsafe protocols (`javascript:`, `data:`, `file:`) and displays immediate visual warnings.
- **SSRF Prevention**: Flags localhost, loopback, and private IPv4/IPv6 ranges to protect internal infrastructure.
- **Punycode & Homograph Detection**: Highlights lookalike and misleading domains before you generate or share.

### 📦 Versatile Multi-Format Export
- **PNG**: Crisp bitmap with customizable resolution.
- **SVG**: Clean vector format ready for billboards, merchandise, and print production.
- **PDF**: Download a print-ready document formatted with clean margins and metadata via `jspdf`.
- **Clipboard Actions**: One-click "Copy Image" to clipboard and instant shareable link generation (`/share/[slug]`).

### 💾 Zero-Config Dual Storage Layer
- **Local File Store**: Out-of-the-box local JSON storage (`data/qr-store.json`) with atomic writes and write-queue locking.
- **PostgreSQL via Prisma**: Instantly upgrade to a relational database by simply adding a `DATABASE_URL` environment variable.

---

## 🏗️ Architecture & Workflow

```mermaid
flowchart TD
    User([User / Scanner]) --> UI[QR Studio Interface]
    
    subgraph Client ["Client Layer (React 19 & Next.js)"]
        UI --> Editor[Customization Editor]
        Editor --> Safety[URL Safety Shield]
        Safety --> ArtEngine[Artwork & SVG Renderer]
        ArtEngine --> Exports[PNG / SVG / PDF / Clipboard]
    end

    subgraph Server ["Server & API Layer"]
        UI -->|Save / Update| APICodes[/api/codes]
        UI -->|Fetch History| APIHistory[/api/history]
        Scanner([Physical Scanner]) -->|Hits /q/:slug| ShortUrl[/q/:slug]
        ShortUrl -->|Redirect 307| TargetUrl[Destination Website]
        ShortUrl -->|Log Telemetry| Analytics[Analytics Service]
    end

    subgraph Storage ["Dual-Mode Storage Adapter"]
        APICodes --> Repo[Repository Pattern]
        ShortUrl --> Repo
        Repo -->|Default| FileStore[(Local JSON Store)]
        Repo -->|DATABASE_URL set| PrismaStore[(PostgreSQL / Prisma)]
    end
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) version **18.18+** or **20+**
- `npm`, `pnpm`, or `yarn`

### 1. Clone & Install
```bash
git clone https://github.com/mr-nitin28/QRstuido.git
cd QRstuido
npm install
```

### 2. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

Default `.env.example`:
```env
NEXT_PUBLIC_APP_NAME="QR Studio"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qrstudio?schema=public"
```

> [!NOTE]
> `DATABASE_URL` is completely optional for local development. If omitted or unreachable, QR Studio automatically falls back to the built-in local JSON file store (`data/qr-store.json`).

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to start generating QR codes!

---

## 💾 Dual-Mode Storage Architecture

QR Studio utilizes a repository pattern (`src/lib/store/repository.ts`) that decouples storage implementation from business logic:

```text
src/lib/store/
├── file-store.ts     # Atomic JSON file persistence (default)
├── prisma-store.ts   # PostgreSQL adapter with Prisma ORM
├── repository.ts     # Automatic environment switch
└── shared.ts         # Shared serialization and sorting utilities
```

### Mode 1: Default Local File Mode (Zero Setup)
No database container or installation required. QR configurations and scan logs are written directly to `data/qr-store.json` using atomic file writes (`fs/promises` with temp files and process-level write locks) to prevent corruption.

### Mode 2: Enterprise PostgreSQL Mode
To scale for production workloads:
1. Provide your PostgreSQL connection string in `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/qrstudio?schema=public"
   ```
2. Generate Prisma client & apply database migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

---

## 📡 API Reference

QR Studio provides a clean, rate-limited REST API for programmatic QR generation and management.

### Endpoints Overview

| Method | Endpoint | Description | Auth / Rate Limit |
| :--- | :--- | :--- | :--- |
| `POST` | `/generate-qr` | On-the-fly QR code generation (Base64 PNG or SVG) | Rate-Limited |
| `GET` | `/api/history` | Retrieve list of recently created QR codes | Public |
| `GET` | `/api/codes` | Fetch all QR records with scan summaries | Public |
| `POST` | `/api/codes` | Create and persist a new static or dynamic QR code | Rate-Limited |
| `GET` | `/api/codes/:id` | Get detailed analytics and metadata for a code | Public |
| `PATCH` | `/api/codes/:id` | Update destination URL, styling, or title | Rate-Limited |
| `DELETE` | `/api/codes/:id` | Delete a QR record and all associated scan logs | Public |
| `GET` | `/q/:slug` | Public redirect endpoint that records scan analytics | 307 Redirect |
| `GET` | `/share/:slug` | Public web landing page for a generated QR code | Web Page |

---

### Request & Response Examples

#### 1. Instant QR Generation (`POST /generate-qr`)

**Request:**
```bash
curl -X POST http://localhost:3000/generate-qr \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/mr-nitin28/QRstuido",
    "size": 320,
    "foreground": "#000000",
    "background": "#ffffff",
    "margin": 4
  }'
```

**Response (200 OK):**
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAFA..."
}
```

---

#### 2. Create Dynamic QR Code (`POST /api/codes`)

**Request:**
```bash
curl -X POST http://localhost:3000/api/codes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "GitHub Profile",
    "mode": "dynamic",
    "destinationUrl": "https://github.com/mr-nitin28",
    "customization": {
      "foreground": "#101828",
      "background": "#FFFFFF",
      "size": 320,
      "margin": 4,
      "padding": 6,
      "logoDataUrl": null
    }
  }'
```

**Response (201 Created):**
```json
{
  "record": {
    "id": "cuid_xyz123",
    "slug": "k7x9p2",
    "mode": "dynamic",
    "title": "GitHub Profile",
    "destinationUrl": "https://github.com/mr-nitin28",
    "redirectUrl": "http://localhost:3000/q/k7x9p2",
    "shareUrl": "http://localhost:3000/share/k7x9p2",
    "analytics": {
      "totalScans": 0,
      "devices": [],
      "locations": [],
      "recent": []
    }
  }
}
```

---

## 📂 Project Structure

```text
QRstudio/
├── data/                       # Local JSON store directory
│   └── qr-store.json           # Default data file for zero-config mode
├── prisma/                     # Database schema & migrations
│   └── schema.prisma           # Prisma models (QrCode, ScanEvent)
├── public/                     # Static public assets
├── src/
│   ├── app/                    # Next.js App Router routes
│   │   ├── api/
│   │   │   ├── codes/          # QR CRUD API routes
│   │   │   │   └── [id]/       # Dynamic single code route
│   │   │   └── history/        # History list API route
│   │   ├── generate-qr/        # On-the-fly QR generator route
│   │   ├── q/[slug]/           # Dynamic redirect handler & analytics logger
│   │   ├── share/[slug]/       # Public QR showcase page
│   │   ├── globals.css         # Tailwind directives & CSS design tokens
│   │   ├── layout.tsx          # Root HTML layout with theme provider
│   │   └── page.tsx            # Main application dashboard
│   ├── components/             # Reusable React UI components
│   │   ├── ui/                 # Base primitives (button, card, badge, input)
│   │   ├── dashboard-shell.tsx # Main dashboard layout and state orchestrator
│   │   ├── history-panel.tsx   # Saved QR codes list and scan analytics graphs
│   │   ├── logo-uploader.tsx   # Center logo upload and validation component
│   │   ├── qr-customization.tsx# Color, size, margin, and logo configuration controls
│   │   ├── qr-preview.tsx      # Real-time preview canvas and export triggers
│   │   └── theme-toggle.tsx    # Light/dark mode toggle button
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-debounced-value.ts # Debounces rapid input changes
│   │   └── use-online-status.ts   # Detects offline/online browser status
│   └── lib/                    # Shared business logic & utilities
│       ├── qr/
│       │   ├── analytics.ts    # Device parsing and telemetry bucketing
│       │   ├── artwork.ts      # Canvas and SVG QR rendering engine
│       │   ├── defaults.ts     # Default styles and validation presets
│       │   ├── server.ts       # Server-side QR generation with sharp
│       │   ├── slug.ts         # Nanoid/CUID-based slug generation
│       │   ├── types.ts        # TypeScript interfaces and payloads
│       │   └── url-safety.ts   # URL validation, SSRF, and phishing guard
│       ├── store/              # Storage abstraction layer
│       │   ├── file-store.ts   # Local JSON persistence
│       │   ├── prisma-store.ts # PostgreSQL Prisma repository
│       │   ├── repository.ts   # Auto-detects store mode
│       │   └── shared.ts       # Shared utility helpers
│       ├── rate-limit.ts       # Token bucket API rate limiter
│       ├── request.ts          # Request header IP/device extractors
│       └── utils.ts            # Class merging (cn) and formatting
├── .env.example                # Sample environment configuration
├── package.json                # Project dependencies and npm scripts
├── tailwind.config.ts          # Tailwind styling configuration
└── tsconfig.json               # Strict TypeScript configuration
```

---

## 🛠️ Available Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server on `http://localhost:3000` |
| `npm run build` | Compiles optimized production bundle and validates types |
| `npm run start` | Runs the production build server |
| `npm run lint` | Runs ESLint to check for code quality and standard compliance |
| `npm run prisma:generate` | Generates the Prisma Client based on `prisma/schema.prisma` |
| `npm run prisma:migrate` | Applies database migrations in development mode |

---

## 🔒 Security & Privacy

- **Safe URL Analysis**: Proactively protects users from malicious input by evaluating URL schemes, detecting loopbacks (SSRF defense), and warning against suspicious domains before generation.
- **Anonymized Telemetry**: IP addresses logged during dynamic scans are converted to a SHA-256 hash using a server salt. No personally identifiable information (PII) is stored.
- **In-Memory Rate Limiting**: Built-in token-bucket algorithm mitigates denial-of-service and brute-force traffic on generation and modification endpoints.

---

## 🤝 Contributing

Contributions are always welcome! To get started:

1. **Fork the Repository**
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit Your Changes**:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
4. **Push to Your Branch**:
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

<div align="center">
  <sub>Built with care by <a href="https://github.com/mr-nitin28">Nitin Kumar</a></sub>
</div>
