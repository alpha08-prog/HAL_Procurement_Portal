import re
import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen2.5:3b"

def generate(prompt, max_tokens=800):
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.3},
    }
    if "qwen3" in MODEL:
        payload["think"] = False
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=180)
        r.raise_for_status()
        out = r.json()["message"]["content"]
        out = re.sub(r"<think>.*?</think>", "", out, flags=re.DOTALL)
        return out.strip()
    except requests.exceptions.ConnectionError:
        print("[SLM] ERROR: Ollama not running. Start with: ollama serve")
        return "[SLM_UNAVAILABLE]"
    except Exception as e:
        print(f"[SLM] ERROR: {e}")
        return "[SLM_ERROR]"
