# Geminitor Pro – AI Conversational Assistant

## Overview

**Geminitor Pro** is a modern AI-powered conversational platform built using **Google Gemini**, **LangChain**, and **FastAPI**. The application delivers intelligent real-time conversations, document analysis, image understanding, and personalized AI interactions through multiple specialized personas.

Designed with scalability and user experience in mind, the platform integrates secure authentication, cloud-based chat storage, and advanced multimodal AI capabilities.

---

## Key Features

### AI-Powered Conversations

* Real-time streaming responses using Google Gemini
* Context-aware conversations powered by LangChain
* Natural language understanding and generation

### Multi-Persona AI System

* 5 specialized AI personas
* Personalized interaction experiences
* Dynamic response styles based on user requirements

### Document Intelligence

* PDF document analysis and summarization
* Intelligent information extraction
* Question-answering from uploaded documents

### Image Understanding

* Image content analysis
* Visual question answering
* Multimodal AI interactions

### Secure User Management

* Firebase Authentication integration
* Secure user login and registration
* Protected user sessions

### Cloud-Based Chat History

* Firestore database integration
* Persistent conversation storage
* User-specific chat management

---

## Technology Stack

### Backend

* FastAPI
* Python
* Uvicorn

### AI & Machine Learning

* Google Gemini API
* LangChain
* Generative AI Models

### Database & Authentication

* Firebase Authentication
* Google Firestore

### Additional Features

* Real-Time Streaming
* Document Processing
* Image Analysis
* REST API Architecture

---

## Architecture

```text
User Interface
      │
      ▼
   FastAPI Backend
      │
 ┌────┼───────────┐
 ▼    ▼           ▼
Gemini API   LangChain   Firebase
                         │
                    Firestore DB
```

---

## Business Impact

* Enhances user engagement through intelligent AI conversations
* Enables efficient document and image analysis workflows
* Provides secure and scalable cloud-based architecture
* Supports personalized AI experiences through multiple personas
* Demonstrates practical implementation of Generative AI technologies in real-world applications

---

## Installation & Setup

### Clone Repository

```bash
git clone <repository-url>
cd geminitor-pro
```

### Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python -m venv venv
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Configure Environment Variables

Create a `.env` file:

```env
GOOGLE_API_KEY=your_google_api_key_here
```

### Run Application

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
```

---

## Skills Demonstrated

* Generative AI Development
* Prompt Engineering
* LangChain Framework
* API Development
* Backend Engineering
* Authentication & Authorization
* Cloud Database Integration
* Real-Time Data Streaming
* Multimodal AI Applications
* Software Architecture Design

---

## Project Highlights

✔ Developed an end-to-end AI chatbot platform using Google Gemini and LangChain

✔ Implemented secure authentication and cloud-based conversation management using Firebase

✔ Enabled multimodal capabilities including PDF analysis and image understanding

✔ Built scalable REST APIs with FastAPI and real-time streaming support

✔ Designed a personalized AI experience through multiple intelligent personas

---
