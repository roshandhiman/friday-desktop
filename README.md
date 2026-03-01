# 🚀 Friday Desktop

> A futuristic AI-powered desktop assistant built with **Electron + React + Vite**.

Friday Desktop is a modern AI workspace application designed with a cinematic futuristic interface and built for scalability.  
The architecture is modular, cleanly separated (frontend + backend), and structured for team collaboration.

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

## 🧠 Features

- Futuristic AI dashboard UI
- Animated voice orb (GPU optimized)
- Glassmorphism dark interface
- Sidebar navigation layout
- Chat panel (UI placeholder)
- System monitor (UI placeholder)
- Modular routing structure
- Clean scalable architecture
- Team-ready repository structure

---

## 📂 Project Structure

```
friday-desktop/
│
├── main/                     # Electron main process
│
├── renderer/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layout/
│   │   └── index.css
│
├── backend/                  # Backend API (separate service)
│   └── src/server.js
│
├── package.json
└── README.md
```

---

## 🛠 Installation

### 1️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/friday-desktop.git
cd friday-desktop
```

---

## 🖥 Run Frontend (Electron + React)

```bash
npm install
npm run dev
```

This will start:
- Vite Dev Server (Renderer)
- Electron Application

---

## ⚙ Run Backend (API Server)

```bash
cd backend
npm install
node src/server.js
```

Backend runs on:

```
http://localhost:5000
```

---

## 🌿 Branch Strategy

| Branch         | Purpose                        |
|---------------|--------------------------------|
| main          | Stable production-ready code   |
| frontend-dev  | UI & layout updates            |
| backend-dev   | API & server development       |

---

## 👥 Team Collaboration

To add contributors:

1. Go to Repository → Settings  
2. Click "Collaborators"  
3. Invite by GitHub username  

---

## 🚀 Production Build

To package the desktop application:

```bash
npm run build
```

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
- [ ] Cloud sync support

---

## 🔒 Security Notes

- Never commit API keys.
- Use `.env` files for sensitive credentials.
- Keep backend and frontend modular for better security.

---

## 📜 License

MIT License

---

## 🧑‍💻 Author

Developed by the Friday Team.

---

## 🌌 Vision

Friday Desktop aims to become a modular AI workspace platform featuring:

- Voice interaction  
- Intelligent automation  
- Workflow orchestration  
- Cross-platform support  

---

Built with precision, performance, and futuristic design principles.
