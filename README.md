# Geminitor Pro

AI chatbot powered by Google Gemini and LangChain. Built with FastAPI, featuring real-time response streaming, Firebase Authentication, Firestore chat history, PDF & image analysis, and multiple AI personas.

---

## Demo Images 

![demo](https://github.com/Tanmay1112004/Geminitor_Pro/blob/main/demo_app_screenshots/Screenshot_3-6-2026_184029_79ee36a2-bae9-456b-aace-34eb5de20832-00-1y86fvg5ujd54.pike.replit.dev.jpeg)

![demo](https://github.com/Tanmay1112004/Geminitor_Pro/blob/main/demo_app_screenshots/Screenshot_3-6-2026_184213_79ee36a2-bae9-456b-aace-34eb5de20832-00-1y86fvg5ujd54.pike.replit.dev.jpeg)

![demo](https://github.com/Tanmay1112004/Geminitor_Pro/blob/main/demo_app_screenshots/Screenshot_3-6-2026_185856_geminitor-smart-gemini-chatbot-with-lang-smith--kshirsagarrutuj.replit.app.jpeg)

![demo]()




---

## Features

- 🤖 Google Gemini powered conversational AI
- 🔗 LangChain integration for intelligent workflows
- ⚡ Real-time streaming responses
- 🔐 Firebase Authentication
- ☁️ Firestore-based chat history storage
- 📄 PDF document analysis
- 🖼️ Image understanding and analysis
- 🎭 5 specialized AI personas
- 🚀 FastAPI backend architecture
- 📚 Persistent conversation management

---

## Tech Stack

### Backend
- FastAPI
- Python
- Uvicorn

### AI & Machine Learning
- Google Gemini API
- LangChain

### Database & Authentication
- Firebase Authentication
- Google Firestore

### Additional Capabilities
- Real-time Streaming
- PDF Processing
- Image Analysis
- Environment-based Configuration

---

## Project Structure

```text
Geminitor-Pro/
│
├── backend/
│   ├── main.py
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── utils/
│   └── config/
│
├── uploads/
│
├── requirements.txt
├── .env
├── .gitignore
└── README.md
```

> Note: The structure may vary depending on project updates and feature additions.

---

## Quick Start (VS Code)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd geminitor-pro
```

### 2. Create and Activate a Virtual Environment

#### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

#### macOS / Linux

```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the project root directory:

```env
GOOGLE_API_KEY=your_google_api_key_here
```

Get a free API key from:

https://aistudio.google.com/app/apikey

### 5. Run the Development Server

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
```

---

## API Server

Once the server is running, the application will be available at:

```text
http://localhost:5000
```

Interactive API Documentation:

```text
http://localhost:5000/docs
```

Alternative ReDoc Documentation:

```text
http://localhost:5000/redoc
```

---

## Key Functionalities

### AI Chat
- Context-aware conversations
- Real-time response generation
- Multi-turn chat support

### Document Analysis
- PDF upload and processing
- Information extraction
- AI-powered summarization

### Image Analysis
- Visual content understanding
- Image-based question answering

### Authentication
- Secure user login and registration
- Firebase Authentication integration

### Chat History
- Persistent conversation storage
- Firestore cloud database integration

---

## Requirements

- Python 3.10+
- Google Gemini API Key
- Firebase Project Configuration
- Internet Connection

---

## License

This project is intended for educational, research, and development purposes.

---

## Author

**Tanmay**

AI & Data Science Enthusiast | Full-Stack Developer | Generative AI Developer
