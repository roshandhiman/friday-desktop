# 🚀 Friday Desktop

> A futuristic AI-powered desktop assistant built with **Electron + React + Vite**.

Friday Desktop is a modern AI workspace application designed with a cinematic futuristic interface and built for scalability.  
The project is structured for clean frontend/backend separation and team collaboration.

---

## ✨ Tech Stack

### 🖥 Frontend
- Electron
- React (Vite)
- Tailwind CSS
- Framer Motion
- Lucide Icons

### ⚙ Backend (In Progress)
- Node.js
- Express
- REST API Architecture

---

## 🧠 Features (Frontend)

- Futuristic AI dashboard UI
- Animated voice orb (GPU optimized)
- Glassmorphism interface
- Sidebar navigation layout
- Chat panel placeholder
- System monitor placeholder
- Modular page routing structure
- Team-ready architecture

---

## 📂 Project Structure
friday-desktop/
│
├── main/                 # Electron main process
├── renderer/             # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layout/
│   │   └── index.css
│
├── backend/              # Backend API (separate service)
│   └── src/server.js
│
├── package.json
└── README.md
---

## 🛠 Installation

### 1️⃣ Clone Repository

git clone https://github.com/YOUR_USERNAME/friday-desktop.git
cd friday-desktop

---

## 🖥 Run Frontend (Electron + React)

npm install
npm run dev
This starts:
- Vite Dev Server (Renderer)
- Electron App

---

## ⚙ Run Backend (API Server)

cd backend
npm install
node src/server.js

Backend runs on:
http://localhost:5000

---

## 🌿 Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable production-ready code |
| `frontend-dev` | UI & layout updates |
| `backend-dev` | API & server development |

---

## 👥 Team Collaboration

To add contributors:

1. Go to Repository → Settings
2. Click **Collaborators**
3. Invite by GitHub username

---

## 🚀 Production Build

To package the app:

npm run build

Electron Builder will generate:
- macOS `.dmg`
- Windows `.exe`

---

## 📌 Roadmap

- [ ] Real microphone voice detection
- [ ] Live system monitoring
- [ ] AI backend integration
- [ ] Authentication system
- [ ] Database integration
- [ ] Production auto-deployment

---

## 🔒 Security Notes

- No sensitive keys should be committed.
- Use `.env` files for API keys.
- Backend and frontend remain modular for security separation.

---

## 📜 License

MIT License

---

## 🧑‍💻 Author

Developed by the Friday Team.

---

### 🌌 Vision

Friday Desktop aims to become a modular AI workspace platform with:

- Voice interaction
- Intelligent automation
- Workflow orchestration
- Cross-platform support

---



