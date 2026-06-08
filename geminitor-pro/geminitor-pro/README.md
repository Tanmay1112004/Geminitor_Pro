# Geminitor Pro

AI chatbot powered by Google Gemini + LangChain. FastAPI backend with real-time streaming, Firebase Auth, Firestore chat history, PDF/image analysis, and 5 AI personas.

---

## Quick Start (VS Code)

### 1. Create and activate a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Add your API key

Create a `.env` file in the root folder:

```
GOOGLE_API_KEY=your_google_api_key_here
```

Get a free key at: https://aistudio.google.com/app/apikey

### 4. Run the server

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
```

### 5. Open in browser

```
http://localhost:5000
```

---

## Features

- Real-time streaming responses (Server-Sent Events)
- 5 AI Personas — General, Code, Medical, Learning, Creative
- PDF / TXT document Q&A (RAG with FAISS + Gemini Embeddings)
- Image analysis (Gemini Vision)
- Firebase Authentication (Email/Password + Google)
- Firestore persistent chat history
- Analytics dashboard (Chart.js)
- Chat export to PDF and TXT
- Safety guardrails — blocks harmful/medical queries on the backend
- Dark / Light theme, responsive mobile layout

---

## Project Structure

```
geminitor-pro/
├── backend/
│   ├── main.py                  # FastAPI app, all routes, safety filters
│   └── modules/
│       ├── chat_engine.py       # LangChain + Gemini streaming chain
│       ├── rag_module.py        # PDF/TXT → FAISS → RAG pipeline
│       ├── vision_module.py     # Image analysis via Gemini Vision
│       ├── analytics_module.py  # Session analytics helpers
│       └── export_module.py     # Chat export to TXT and PDF
├── frontend/
│   ├── index.html               # Main chat UI
│   ├── auth.html                # Login / Sign Up page
│   ├── style.css                # All styles
│   ├── app.js                   # Frontend logic
│   ├── firebase.js              # Firebase Auth + Firestore functions
│   └── config.js                # API base URL config
├── .env.example                 # Copy this to .env and add your key
├── requirements.txt             # Python dependencies
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/stream` | Streaming chat response (SSE) |
| POST | `/api/chat` | Non-streaming chat response |
| POST | `/api/upload/pdf` | Upload PDF/TXT for document Q&A |
| POST | `/api/upload/image` | Analyze an image |
| POST | `/api/rag/query` | Ask a question about uploaded document |
| GET | `/api/analytics` | Session analytics stats |
| POST | `/api/export` | Export chat to PDF or TXT |
| GET | `/health` | Health check |

Swagger UI: http://localhost:5000/api/docs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Uvicorn (Python 3.10+) |
| AI Model | Google Gemini 2.5 Flash |
| LLM Framework | LangChain |
| Vector Search | FAISS |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Charts | Chart.js |
| PDF Export | fpdf2 |
