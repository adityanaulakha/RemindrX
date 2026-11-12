# RemindrX | Intelligent Academic Platform

![RemindrX Logo](public/logo-mark.svg)

**RemindrX** is a professional, high-performance academic management platform designed to bridge the gap between students, class representatives, and institutional administration. Built with a cinematic **"Premium Glassmorphism"** aesthetic, it prioritizes visual excellence without compromising on performance or security.

---

## 🚀 Vision
To provide a unified, real-time intelligence hub for academic enclaves, optimizing student productivity through data-driven insights, automated analytics, and seamless cross-network communication.

## ⚡ Core Intelligence (Key Features)

### 1. Unified Intelligence Dashboard
A high-level overview of the academic state, featuring real-time activity monitors, quick-access cards for subjects, and dynamic greeting systems.

### 2. Integrated Timeline & Mission Control
*   **Temporal Stream**: A unified feed merging tasks, assignments, and campus events into a single chronological view.
*   **Critical Alerts**: "Intercept Imminent" warnings for tasks due within 48 hours.
*   **Mission Management**: Quick-create objectives with priority levels (Low, Medium, Critical).

### 3. Attendance Pulse (Bunk Analytics)
*   **Institutional Handshake**: Securely connects to institutional portals for real-time attendance syncing.
*   **Bunk Analytics Engine**: 
    *   **Safe Skips**: Automatically calculates how many sessions can be missed while staying above the 75% threshold.
    *   **Recovery Sessions**: Calculates exactly how many consecutive classes are needed to restore a dipping attendance percentage.
    *   **Accuracy Tracking**: Real-time percentage visualization with danger/safety color-coding.

### 4. Campus Events Hub (Live Discovery)
*   **Broadcast System**: Clubs and organizers can broadcast cultural, academic, and competitive events across the network.
*   **Participation Tracking**: "Going" vs "Not Going" metrics with real-time sync to the personal timeline.
*   **Rich Metadata**: Includes registration links, team sizes, entry fees, and social media integration.

### 5. Class Updates (Real-Time Intel)
*   **Crowdsourced Feed**: Class representatives post verified updates regarding lecture changes, room swaps, or cancellations.
*   **Verification System**: Posts can be tagged as "Unverified", "Likely", or "Verified" based on peer confirmation.
*   **Performance Optimization**: Rolling 30-day window ensures zero lag even in high-volume classes.

### 6. Management Console (CR & Super Admin)
*   **CR Panel**: Specialized controls for Class Representatives to manage subjects, tasks, and class-specific announcements.
*   **Super Admin Core**: Global oversight of all classes, users, and event approvals. Features failsafe protection and real-time system metrics.

### 7. Progressive Web App (PWA)
*   **Native Experience**: Installable on iOS/Android home screens with dedicated splash screens and no browser chrome.
*   **Offline First**: Built-in Firebase Persistent Cache allows viewing academic data even without an active internet connection.

---

## 🛠️ Technical Matrix (Tech Stack)

*   **Frontend**: React 19 + Vite (TypeScript)
*   **State Management**: Zustand (Global Store)
*   **Styling**: Tailwind CSS 4.0 + Custom Design Tokens (Vanilla CSS Philosophy)
*   **Backend**: Firebase Suite (Firestore, Auth, Storage)
*   **Real-time**: Firestore Snapshots for sub-100ms UI updates
*   **PWA**: Vite PWA Plugin + Service Workers
*   **Icons**: Lucide React
*   **Feedback**: React Hot Toast

---

## 📦 Getting Started

### Prerequisites
- Node.js (Latest LTS)
- NPM or PNPM
- Firebase Project

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/remindrx.git

# Navigate to project
cd remindrx

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environmental Configuration
Create a `.env.local` file in the root directory:
```env
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
VITE_FIREBASE_MEASUREMENT_ID="your_measurement_id"

# Server-only (Vercel /api/gla/enroll) — never expose in VITE_*
FIREBASE_PROJECT_ID="your_project_id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@….iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
# Or: FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",…}'
PORTAL_BACKEND_URL="https://portal-backend-z9ce.onrender.com"
```

---

## 🏛️ Architecture & Best Practices

*   **Native-Feel Navigation**: Optimized routing logic (`replace: true`) ensures mobile "back gestures" behave like native apps.
*   **Granular Security**: Hardened Firestore rules prevent unauthorized data mutation while enabling real-time collaboration.
*   **Responsive Typography**: Fluid font-scaling system ensures legibility from 320px smartphones to 4K displays.
*   **Glassmorphism Engine**: Custom CSS blur effects and high-contrast borders for a premium, futuristic aesthetic.

---

## 📂 Folder Structure
```text
src/
├── components/     # Reusable UI components (Buttons, Inputs, Modals)
├── context/        # Auth and Global State providers
├── hooks/          # Custom React hooks for Firebase & Real-time data
├── pages/          # Full page layouts (Dashboard, Timeline, etc.)
├── types/          # TypeScript interfaces and type definitions
├── utils/          # Helper functions and constants
└── firebase.ts     # Firebase initialization and service exports
```

---

*Developed with ❤️ for the Academic Elite.*
