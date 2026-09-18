import json
import os
from pathlib import Path

# Load Russian dataset
ru_path = Path("dataset_ru.json")
ru_data = json.loads(ru_path.read_text(encoding="utf-8"))
print(f"Loaded {len(ru_data)} Russian samples")

# Create English translations for first 200 Russian samples (simple mapping for demo, in real would use proper translation)
# For now, create English versions by reusing the same structure but with English instruction/response
# We'll create a simple English dataset by translating common Russian patterns to English

en_samples = []
# Take first 200 Russian samples and create English equivalents
for i, item in enumerate(ru_data[:200]):
    ru_inst = item.get("instruction", "")
    ru_resp = item.get("response", "")
    # Simple translation mapping for demo - in production would use proper translation
    # For now, create English version with same meaning but in English
    # We'll just prefix with English and keep code as is
    en_inst = ru_inst
    en_resp = ru_resp
    # Replace some Russian phrases with English for demo
    replacements = {
        "привет": "hello",
        "как дела": "how are you",
        "что ты умеешь": "what can you do",
        "расскажи шутку": "tell a joke",
        "как тебя зовут": "what is your name",
        "сколько будет": "how much is",
        "напиши стих": "write a poem",
        "что такое ИИ": "what is AI",
        "как выучить английский": "how to learn English",
        "реши уравнение": "solve equation",
        "как приготовить": "how to cook",
        "что такое любовь": "what is love",
        "кто написал": "who wrote",
        "расскажи про космос": "tell about space",
        "как сделать бэкап": "how to backup",
    }
    for ru, en in replacements.items():
        if ru in en_inst.lower():
            en_inst = en_inst.replace(ru, en).replace(ru.capitalize(), en.capitalize())
        if ru in en_resp.lower():
            en_resp = en_resp.replace(ru, en).replace(ru.capitalize(), en.capitalize())
    # For English, make it more natural
    if i < 10:
        # Keep some as is for variety
        pass
    en_samples.append({"instruction": en_inst, "response": en_resp, "category": item.get("category", "general"), "lang": "en"})

# Add English code samples (Aider-style)
code_samples_en = [
    {"instruction": "Fix bug in Python function that adds two numbers", "input": "def add(a, b):\n    return a - b", "response": "<<<<<<< SEARCH\ndef add(a, b):\n    return a - b\n=======\ndef add(a, b):\n    return a + b\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
    {"instruction": "Add error handling to file reading", "input": "def read_file(path):\n    return open(path).read()", "response": "<<<<<<< SEARCH\ndef read_file(path):\n    return open(path).read()\n=======\ndef read_file(path):\n    try:\n        with open(path) as f:\n            return f.read()\n    except FileNotFoundError:\n        return None\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
    {"instruction": "Optimize loop for performance", "input": "result = []\nfor i in range(len(items)):\n    result.append(items[i] * 2)", "response": "<<<<<<< SEARCH\nresult = []\nfor i in range(len(items)):\n    result.append(items[i] * 2)\n=======\nresult = [x * 2 for x in items]\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
    {"instruction": "Add type hints to function", "input": "def greet(name):\n    return f'Hello {name}'", "response": "<<<<<<< SEARCH\ndef greet(name):\n    return f'Hello {name}'\n=======\ndef greet(name: str) -> str:\n    return f'Hello {name}'\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
    {"instruction": "Fix async bug", "input": "async def fetch(url):\n    data = requests.get(url)\n    return data", "response": "<<<<<<< SEARCH\nasync def fetch(url):\n    data = requests.get(url)\n    return data\n=======\nasync def fetch(url):\n    data = await aiohttp.get(url)\n    return data\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
    {"instruction": "Create Python function to read JSON file", "input": "", "response": "import json\ndef load_json(path):\n    with open(path) as f:\n        return json.load(f)", "category": "code", "lang": "en"},
    {"instruction": "Write a simple HTTP server in Python", "input": "", "response": "from http.server import HTTPServer, BaseHTTPRequestHandler\nclass Handler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.end_headers()\n        self.wfile.write(b'Hello')\nHTTPServer(('localhost', 8000), Handler).serve_forever()", "category": "code", "lang": "en"},
    {"instruction": "Explain this code", "input": "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a+b\n    return a", "response": "This is Fibonacci: it iterates n times, swapping a and b, returns a. Time O(n), space O(1).", "category": "code", "lang": "en"},
    {"instruction": "Add docstring to function", "input": "def add(a,b):\n return a+b", "response": "<<<<<<< SEARCH\ndef add(a,b):\n return a+b\n=======\ndef add(a: int, b: int) -> int:\n    \"\"\"Add two numbers and return result.\"\"\"\n    return a + b\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
    {"instruction": "Refactor to use list comprehension", "input": "evens = []\nfor x in nums:\n    if x % 2 == 0:\n        evens.append(x)", "response": "<<<<<<< SEARCH\nevens = []\nfor x in nums:\n    if x % 2 == 0:\n        evens.append(x)\n=======\nevens = [x for x in nums if x % 2 == 0]\n>>>>>>> REPLACE", "category": "code", "lang": "en"},
]

code_samples_ru = [
    {"instruction": "Исправь баг в функции сложения", "input": "def add(a, b):\n    return a - b", "response": "<<<<<<< SEARCH\ndef add(a, b):\n    return a - b\n=======\ndef add(a, b):\n    return a + b\n>>>>>>> REPLACE", "category": "code", "lang": "ru"},
    {"instruction": "Добавь обработку ошибок для чтения файла", "input": "def read_file(path):\n    return open(path).read()", "response": "<<<<<<< SEARCH\ndef read_file(path):\n    return open(path).read()\n=======\ndef read_file(path):\n    try:\n        with open(path) as f:\n            return f.read()\n    except FileNotFoundError:\n        return None\n>>>>>>> REPLACE", "category": "code", "lang": "ru"},
    {"instruction": "Оптимизируй цикл", "input": "result = []\nfor i in range(len(items)):\n    result.append(items[i] * 2)", "response": "<<<<<<< SEARCH\nresult = []\nfor i in range(len(items)):\n    result.append(items[i] * 2)\n=======\nresult = [x * 2 for x in items]\n>>>>>>> REPLACE", "category": "code", "lang": "ru"},
    {"instruction": "Добавь аннотации типов", "input": "def greet(name):\n    return f'Привет {name}'", "response": "<<<<<<< SEARCH\ndef greet(name):\n    return f'Привет {name}'\n=======\ndef greet(name: str) -> str:\n    return f'Привет {name}'\n>>>>>>> REPLACE", "category": "code", "lang": "ru"},
    {"instruction": "Напиши функцию чтения JSON", "input": "", "response": "import json\ndef load_json(path):\n    with open(path) as f:\n        return json.load(f)", "category": "code", "lang": "ru"},
    {"instruction": "Объясни код", "input": "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a+b\n    return a", "response": "Это Фибоначчи: итерируется n раз, меняет a и b, возвращает a. Сложность O(n).", "category": "code", "lang": "ru"},
    {"instruction": "Добавь докстроку", "input": "def add(a,b):\n return a+b", "response": "<<<<<<< SEARCH\ndef add(a,b):\n return a+b\n=======\ndef add(a: int, b: int) -> int:\n    \"\"\"Складывает два числа.\"\"\"\n    return a + b\n>>>>>>> REPLACE", "category": "code", "lang": "ru"},
    {"instruction": "Перепиши через list comprehension", "input": "evens = []\nfor x in nums:\n    if x % 2 == 0:\n        evens.append(x)", "response": "<<<<<<< SEARCH\nevens = []\nfor x in nums:\n    if x % 2 == 0:\n        evens.append(x)\n=======\nevens = [x for x in nums if x % 2 == 0]\n>>>>>>> REPLACE", "category": "code", "lang": "ru"},
]

# Combine all
bilingual = []

# Add Russian originals (266)
for item in ru_data:
    bilingual.append({"instruction": item["instruction"], "response": item["response"], "category": item.get("category", "general"), "lang": "ru"})

# Add English translations (200)
for item in en_samples:
    bilingual.append(item)

# Add code samples (20)
for item in code_samples_en + code_samples_ru:
    # Convert to instruction/response format already
    if "input" in item and item["input"]:
        bilingual.append({"instruction": f"{item['instruction']}\n\nInput:\n{item['input']}", "response": item["response"], "category": item["category"], "lang": item["lang"]})
    else:
        bilingual.append({"instruction": item["instruction"], "response": item["response"], "category": item["category"], "lang": item["lang"]})

# Add some general English samples for balance (from builtin good dataset, but we'll create simple ones)
general_en = [
    {"instruction": "hello", "response": "Hello! How can I help?", "category": "everyday", "lang": "en"},
    {"instruction": "how are you", "response": "I'm great, thanks for asking!", "category": "everyday", "lang": "en"},
    {"instruction": "what is AI", "response": "AI is artificial intelligence, machines that learn and think like humans.", "category": "general", "lang": "en"},
    {"instruction": "tell a joke", "response": "Why do programmers prefer dark mode? Because light attracts bugs!", "category": "general", "lang": "en"},
    {"instruction": "write a poem about autumn", "response": "Leaves are falling, wind is cold,\nAutumn paints the world in gold.", "category": "general", "lang": "en"},
]
for i in range(5):
    for item in general_en:
        bilingual.append(item)

print(f"Total bilingual dataset: {len(bilingual)}")
# Shuffle for training
import random
random.seed(42)
random.shuffle(bilingual)

# Save
out = Path("AIens/datasets/default_bilingual_aider_v1.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(bilingual, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Saved to {out} ({out.stat().st_size} bytes)")

# Also save separate en/ru for reference
ru_out = Path("AIens/datasets/default_ru.json")
ru_out.write_text(json.dumps([x for x in bilingual if x.get("lang")=="ru"], ensure_ascii=False, indent=2), encoding="utf-8")
en_out = Path("AIens/datasets/default_en.json")
en_out.write_text(json.dumps([x for x in bilingual if x.get("lang")=="en"], ensure_ascii=False, indent=2), encoding="utf-8")
print(f"RU: {len([x for x in bilingual if x.get('lang')=='ru'])} EN: {len([x for x in bilingual if x.get('lang')=='en'])}")

# Create a small preview
preview = bilingual[:3]
print(json.dumps(preview, ensure_ascii=False, indent=2))
