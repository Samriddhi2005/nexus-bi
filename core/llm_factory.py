import os
from typing import Optional
from dotenv import load_dotenv
from langchain_core.language_models import BaseChatModel

load_dotenv()

class LLMFactory:
    """
    Factory to instantiate modern, fast, and free LLMs (Groq, Gemini, OpenAI).
    """

    @staticmethod
    def get_llm(
        provider: str = "groq",
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.0
    ) -> BaseChatModel:
        provider = provider.lower().strip()

        # 1. Groq Cloud (Recommended Free Tier)
        if provider == "groq":
            key = api_key or os.getenv("GROQ_API_KEY")
            if not key:
                raise ValueError(
                    "Groq API Key missing! Please provide it in the sidebar or set GROQ_API_KEY in your .env file."
                )
            try:
                from langchain_groq import ChatGroq
                return ChatGroq(
                    groq_api_key=key,
                    model_name=model_name or "openai/gpt-oss-120b",
                    temperature=temperature
                )
            except ImportError:
                raise ImportError("Please install langchain-groq: pip install langchain-groq")

        # 2. Google Gemini (Free Tier)
        elif provider in ["gemini", "google"]:
            key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not key:
                raise ValueError(
                    "Gemini API Key missing! Please provide it in the sidebar or set GEMINI_API_KEY in your .env file."
                )
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    google_api_key=key,
                    model=model_name or "gemini-1.5-flash",
                    temperature=temperature
                )
            except ImportError:
                raise ImportError("Please install langchain-google-genai: pip install langchain-google-genai")

        # 3. OpenAI (Optional Fallback)
        elif provider == "openai":
            key = api_key or os.getenv("OPENAI_API_KEY")
            if not key:
                raise ValueError(
                    "OpenAI API Key missing! Please provide it in the sidebar or set OPENAI_API_KEY in your .env file."
                )
            try:
                from langchain_openai import ChatOpenAI
                return ChatOpenAI(
                    openai_api_key=key,
                    model_name=model_name or "gpt-4o-mini",
                    temperature=temperature
                )
            except ImportError:
                raise ImportError("Please install langchain-openai: pip install langchain-openai")

        else:
            raise ValueError(f"Unsupported LLM provider: '{provider}'. Supported: 'groq', 'gemini', 'openai'.")
