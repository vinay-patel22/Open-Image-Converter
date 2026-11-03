# Open Image Converter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A fast, modern, and completely private image converter that runs **100% in your browser**. Powered by **WebAssembly (WASM)** and Web Workers — your files never leave your device.

---

## ✨ Features

- 🔒 **100% Client-Side Privacy**: Zero server uploads. Conversions happen locally in your browser sandbox.
- ⚡ **WebAssembly Speed**: Powered by `@jsquash` WASM codecs for near-native encoding and decoding performance.
- 🧵 **Multi-threaded Web Workers**: Offloads heavy compression and decoding to background workers to keep the UI smooth and responsive.
- 📦 **Batch Conversion & ZIP Export**: Convert multiple images in parallel and download them individually or as a single `.zip` archive.
- 🔍 **Real Signature Sniffing**: Inspects true byte magic headers instead of trusting file extensions blindly.
- 🎛️ **Granular Controls**: Customize lossy quality sliders, inspect dimensions, and manage image queues effortlessly.
- 🎨 **Minimal & Modern UI**: Built with React 19, Tailwind CSS v4, and Radix UI primitives.

---

## 🔄 Supported Formats

| Format | Extensions | Input | Output | Quality Tuning |
| :--- | :--- | :---: | :---: | :---: |
| **JPEG** | `.jpg`, `.jpeg` | ✅ | ✅ | ✅ (1–100%) |
| **PNG** | `.png` | ✅ | ✅ | Lossless |
| **WebP** | `.webp` | ✅ | ✅ | ✅ (1–100%) |
| **AVIF** | `.avif` | ✅ | ✅ | ✅ (1–100%) |
| **GIF** | `.gif` | ✅ | ✅ | Lossless |
| **BMP** | `.bmp` | ✅ | ✅ | Lossless |
| **TIFF** | `.tif`, `.tiff` | ✅ | ✅ | Lossless |
| **ICO** | `.ico` | ✅ | ✅ | Lossless |
| **SVG** | `.svg` | ✅ | ✅ | Vector / XML |

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Image Codecs**: `@jsquash/avif`, `@jsquash/jpeg`, `@jsquash/png`, `@jsquash/webp`, `omggif`
- **Archiving**: `fflate` (high-speed zip compression)
- **Testing**: [Vitest](https://vitest.dev/) (Unit/Integration) & [Playwright](https://playwright.dev/) (E2E)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) `>= 20.19.0`
- `npm`, `pnpm`, or `yarn`

### Installation

```bash
# Clone the repository
git clone https://github.com/vinay-patel22/Open-Image-Converter.git

# Navigate into the project directory
cd Open-Image-Converter

# Install dependencies
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### Building for Production

```bash
npm run build
```

The production output will be generated in the `dist/` directory, ready to be deployed to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages, etc.).

---

## 🧪 Testing

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run Playwright end-to-end tests
npm run test:e2e
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

