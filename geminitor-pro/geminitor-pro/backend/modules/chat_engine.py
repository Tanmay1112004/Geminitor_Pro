"""
chat_engine.py — LangChain + Gemini chain builder.
Supports synchronous responses and async streaming with multi-turn history.
"""

from typing import AsyncGenerator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

PERSONA_PROMPTS = {
    "General Intelligence Agent": (
        "You are Geminitor Pro, an advanced AI assistant. "
        "You are helpful, accurate, and clear in your explanations. "
        "Answer questions thoroughly but concisely."
    ),
    "Code Synthesis Agent": (
        "You are Geminitor Pro, a senior software engineer and code synthesis agent. "
        "Provide accurate, working code solutions with clear explanations. "
        "Always format code using markdown code blocks with the correct language identifier. "
        "Include comments for complex logic. Suggest best practices and improvements."
    ),
    "Medical Information Agent (Read-Only)": (
        "You are Geminitor Pro, a medical information agent operating in READ-ONLY mode. "
        "STRICT RULES: Never prescribe medications. Never diagnose conditions. "
        "Always recommend consulting a qualified healthcare professional for personal advice. "
        "You may provide general health education and explain medical concepts. "
        "You cannot replace a doctor, nurse, or licensed medical professional."
    ),
    "Adaptive Learning Agent": (
        "You are Geminitor Pro, an adaptive learning agent. "
        "Break down complex topics into simple, digestible steps. "
        "Use analogies, examples, and real-world comparisons to aid understanding. "
        "After explanations, ask a comprehension check question to reinforce learning. "
        "Adapt your depth based on the learner's apparent level."
    ),
    "Creative Generation Agent": (
        "You are Geminitor Pro, a creative generation agent. "
        "Be imaginative, expressive, and inventive. "
        "Help bring ideas to life with vivid language and rich detail. "
        "Assist with stories, poems, scripts, brainstorming, and creative projects. "
        "Embrace unconventional ideas and push creative boundaries."
    ),
}

PERSONA_ALIASES = {
    "General AI":      "General Intelligence Agent",
    "Code Assistant":  "Code Synthesis Agent",
    "Medical Helper":  "Medical Information Agent (Read-Only)",
    "Study Buddy":     "Adaptive Learning Agent",
    "Creative Writer": "Creative Generation Agent",
}


def _resolve_persona(persona: str) -> str:
    return PERSONA_ALIASES.get(persona, persona)


def _build_prompt(persona: str, chat_history: list) -> ChatPromptTemplate:
    resolved   = _resolve_persona(persona)
    system_msg = PERSONA_PROMPTS.get(resolved, PERSONA_PROMPTS["General Intelligence Agent"])
    messages   = [("system", system_msg)]
    for msg in chat_history[-20:]:
        role = "human" if msg.get("role") == "user" else "ai"
        messages.append((role, msg.get("content", "")))
    messages.append(("human", "{question}"))
    return ChatPromptTemplate.from_messages(messages)


def get_response(
    model: str,
    temperature: float,
    max_tokens: int,
    persona: str,
    chat_history: list,
    question: str,
) -> str:
    llm   = ChatGoogleGenerativeAI(model=model, temperature=temperature, max_output_tokens=max_tokens)
    chain = _build_prompt(persona, chat_history) | llm | StrOutputParser()
    return chain.invoke({"question": question})


async def stream_response(
    model: str,
    temperature: float,
    max_tokens: int,
    persona: str,
    chat_history: list,
    question: str,
) -> AsyncGenerator[str, None]:
    llm = ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        max_output_tokens=max_tokens,
        streaming=True,
    )
    chain = _build_prompt(persona, chat_history) | llm | StrOutputParser()
    async for chunk in chain.astream({"question": question}):
        yield chunk


def get_followup(model: str, user_input: str, response: str) -> str:
    llm    = ChatGoogleGenerativeAI(model=model, temperature=0.8, max_output_tokens=128)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Suggest exactly one short follow-up question the user could ask. Return only the question."),
        ("human",  f"User: {user_input}\nAssistant: {response}"),
    ])
    return (prompt | llm | StrOutputParser()).invoke({}).strip()
