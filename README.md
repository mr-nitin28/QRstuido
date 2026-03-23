# 📱 QR Studio

> A high-performance, modern QR code generator built for the web.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=for-the-badge&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma)

QR Studio is a robust, dynamic QR code management platform built on the **Next.js App Router**. It supports real-time link validation, advanced customization, dynamic routing, and plug-and-play storage solutions.

## ✨ Key Features

- **Real-Time Validation:** Automatic URL and app-link validation featuring phishing and unsafe-scheme warnings.
- **Advanced Customization:** High-resolution live QR previews. Customize colors, sizes, paddings, and embed center logos seamlessly.
- **Multiple Exports:** Export to PNG, SVG, PDF, or simply copy the image/link directly to your clipboard.
- **Dynamic Routing:** Create dynamic, editable short links mapped via `/q/[slug]`.
- **Scan Analytics:** Built-in tracking for device data and high-level location insights.
- **Shareable Landing Pages:** Generate public-facing QR landing pages quickly via `/share/[slug]`.
- **Dual-Storage Support:** Runs seamlessly with a local `JSON` fallback or scales up out-of-the-box with **PostgreSQL** via Prisma.

## 🚀 Getting Started

### Prerequisites
Ensure you have Node.js (v18+) and npm installed.

### Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env.local
   ```
   *Edit `.env.local` to match your target environment configuration.*

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

Your application will now be running on `http://localhost:3000`.

## 🗄️ Storage Configuration

QR Studio is built with a flexible Repository Pattern, supporting multiple storage modes:

- **Local Mode (Default):** Records are safely persisted to `data/qr-store.json`. Ideal for quick development and offline use.
- **Scalable Mode (PostgreSQL):** To enable full database persistence, provide a valid connection string to `DATABASE_URL` in your `.env.local` and run the migrations:
  ```bash
  npm run prisma:migrate
  ```

## 📡 API Reference

The internal API exposes endpoints for advanced integrations:

| Endpoint | Method | Description |
|---|---|---|
| `/generate-qr` | `POST` | Core QR generation engine |
| `/api/history` | `GET` | Retrieve generated QR history & analytics |
| `/api/codes` | `GET` / `POST` | Retrieve all codes or create a new code record |
| `/api/codes/:id` | `GET` / `PATCH`| Fetch or update a specific QR record |
| `/q/:slug` | `GET` | Dynamic QR redirect endpoint |
| `/share/:slug` | `GET` | Fetch metadata for public sharing |



