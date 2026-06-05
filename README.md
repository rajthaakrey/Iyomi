# Iyomi

An emotionally intelligent AI companion — built with Groq, Clerk, and vanilla HTML/CSS/JS.

## Structure

```
iyomi/
├── frontend/         # Static site — open with Live Server
│   ├── assets/       # Logo, favicons
│   ├── styles/       # All CSS files
│   ├── scripts/      # All JS files
│   ├── pages/auth/   # Auth pages (login, signup, etc.)
│   ├── chat/         # Chat UI
│   └── index.html    # Landing page
│
└── backend/          # Express API server
    ├── controllers/  # Route handlers
    ├── routes/       # Express routers
    ├── middleware/   # CORS, auth
    ├── .env          # API keys (never commit)
    └── server.js     # Entry point
```

## Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Add your GROQ_API_KEY to .env
npm start
```

### Frontend
Open `frontend/index.html` with VS Code Live Server.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS, Clerk auth, GSAP, Lenis
- **Backend**: Node.js, Express
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Auth**: Clerk
