from dotenv import load_dotenv
import os

load_dotenv()
print("Loaded API key:", os.getenv("OPENAI_API_KEY"))