import os
import sys
import json
import sqlite3
import threading
import subprocess
import re
import traceback
import logging
import time as _time
import uuid
from pathlib import Path
from datetime import datetime
import hashlib
import math

# ----------------- AUTO INSTALL DEPENDENCIES -----------------
def install_requirements():
    if os.environ.get("AIENS_SKIP_AUTO_INSTALL"): return
    
    # Check NumPy version first to avoid compatibility issues
    try:
        import numpy as np
        numpy_version = np.__version__
        print(f"NumPy version: {numpy_version}")
        # If NumPy 2.x is installed, try to downgrade to 1.26.x for compatibility
        if numpy_version.startswith('2.'):
            print("NumPy 2.x detected. Installing NumPy 1.26.4 for compatibility...")
            subprocess.call([sys.executable, "-m", "pip", "install", "numpy==1.26.4", "--force-reinstall"])
            print("Restarting to apply NumPy changes...")
            os.environ["AIENS_SKIP_AUTO_INSTALL"] = "1"
            try:
                os.execv(sys.executable, [sys.executable] + sys.argv)
            except Exception:
                print("Restart failed. Please re-run manually.")
                sys.exit(0)
    except ImportError:
        pass
    
    required = ["pywebview", "requests", "huggingface_hub", "ddgs", "openai", "psutil", "llama-cpp-python"]
    missing = []
    
    # Check required dependencies
    for req in required:
        try:
            if req == "pywebview":
                import webview
            elif req == "llama-cpp-python":
                import llama_cpp
            else:
                __import__(req.replace("-", "_"))
        except ImportError:
            missing.append(req)
    
    # Optional dependencies - install only if available
    optional_deps = []
    try:
        import pdfkit
    except ImportError:
        optional_deps.append("pdfkit")
    
    try:
        import pyperclip
    except ImportError:
        optional_deps.append("pyperclip")

    try:
        import reportlab
    except ImportError:
        optional_deps.append("reportlab")

    # Do not import heavy ML stacks here.
    # Training runtime checks/install are handled separately in BackendAPI.
    
    if missing:
        print(f"Installing missing dependencies: {', '.join(missing)}...")
        all_ok = True
        for pkg in missing:
            print(f"  Installing {pkg}...")
            res = subprocess.call([sys.executable, "-m", "pip", "install", pkg, "--prefer-binary"])
            if res != 0:
                print(f"  FAILED to install {pkg}.")
                all_ok = False
        if all_ok:
            print("Dependencies installed. Restarting...")
            os.environ["AIENS_SKIP_AUTO_INSTALL"] = "1"
            try:
                os.execv(sys.executable, [sys.executable] + sys.argv)
            except Exception:
                print("Restart failed. Please re-run manually.")
                sys.exit(0)
        else:
            print("Some deps failed. App may not work correctly.")
            input("Press Enter to continue or Ctrl+C to stop...")

install_requirements()

import webview
from huggingface_hub import HfApi
try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None
from openai import OpenAI
try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

def safe_web_search(query, max_results=5):
    if not DDGS: return []
    try:
        return list(DDGS().text(query, max_results=max_results))
    except Exception:
        try:
            return list(DDGS().text(query, max_results=max_results, backend='lite'))
        except Exception:
            return []

logging.getLogger('pywebview').setLevel(logging.CRITICAL)

APP_DIR = Path(os.getenv('APPDATA', os.path.expanduser('~'))) / "AIens_Data"
APP_DIR.mkdir(exist_ok=True)
DB_PATH = APP_DIR / "aiens.db"
MODELS_DIR = APP_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)
PROMPTS_DIR = APP_DIR / "prompts"
DEPS_CACHE_FILE = APP_DIR / "deps_cache.json"
TRAINING_WORKER_FILE = Path(__file__).parent / "training_worker.py"
TRAINING_JOBS_DIR = APP_DIR / "training_jobs"
TRAINING_JOBS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Built-in default training dataset (Alpaca format, Russian + English)
# Covers general assistant behaviour: reasoning, coding, explanation, safety
# ---------------------------------------------------------------------------
DEFAULT_DATASET_ID = "builtin_default_v1"
DEFAULT_DATASET_NAME = "Default Assistant Dataset (built-in)"
BUILTIN_DATASET_FILE = Path(__file__).parent / "builtin_dataset_good.json"


def _fallback_builtin_dataset():
    return [
        {
            "instruction": "Привет",
            "response": "Привет! Я готов помочь. Напиши, что нужно сделать.",
            "category": "everyday",
        },
        {
            "instruction": "Помоги с Python",
            "response": "Конечно. Покажи код или ошибку, и разберем по шагам.",
            "category": "coding",
        },
    ]


def _load_builtin_dataset_from_file():
    try:
        if not BUILTIN_DATASET_FILE.exists():
            print("Built-in dataset file not found. Using fallback dataset.")
            return _fallback_builtin_dataset()

        raw = BUILTIN_DATASET_FILE.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
        if not isinstance(data, list):
            raise ValueError("builtin_dataset_good.json must contain JSON array")

        cleaned = []
        for item in data:
            if not isinstance(item, dict):
                continue
            instruction = str(item.get("instruction", "")).strip()
            response = str(item.get("response", "")).strip()
            if not instruction or not response:
                continue
            obj = {"instruction": instruction, "response": response}
            if item.get("input"):
                obj["input"] = str(item.get("input", "")).strip()
            if item.get("category"):
                obj["category"] = str(item.get("category", "")).strip()
            cleaned.append(obj)

        if not cleaned:
            raise ValueError("builtin_dataset_good.json has no valid records")

        print(f"Built-in dataset loaded: {len(cleaned)} samples.")
        return cleaned
    except Exception as e:
        print("Failed to load built-in dataset. Using fallback dataset.")
        return _fallback_builtin_dataset()


DEFAULT_DATASET = _load_builtin_dataset_from_file()
DEFAULT_DATASET_SIGNATURE = hashlib.sha256(
    json.dumps(DEFAULT_DATASET, ensure_ascii=False, sort_keys=True).encode("utf-8")
).hexdigest()
PROMPTS_DIR.mkdir(exist_ok=True)

# Popular models database
POPULAR_MODELS = {
    "chat": [
        {"id": "Qwen/Qwen2.5-7B-Instruct-GGUF", "name": "Qwen 2.5 7B Instruct", "desc": "Excellent general purpose model", "size": "~5GB", "downloads": 500000},
        {"id": "bartowski/Llama-3.2-3B-Instruct-GGUF", "name": "Llama 3.2 3B Instruct", "desc": "Fast and efficient, great for chat", "size": "~2GB", "downloads": 450000},
        {"id": "TheBloke/Mistral-7B-Instruct-v0.2-GGUF", "name": "Mistral 7B v0.2", "desc": "High quality open model", "size": "~4GB", "downloads": 1200000},
        {"id": "Qwen/Qwen2.5-14B-Instruct-GGUF", "name": "Qwen 2.5 14B Instruct", "desc": "Larger, more capable", "size": "~9GB", "downloads": 300000},
    ],
    "code": [
        {"id": "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF", "name": "Qwen Coder 7B", "desc": "Specialized for code", "size": "~5GB", "downloads": 200000},
        {"id": "TheBloke/deepseek-coder-6.7B-instruct-GGUF", "name": "DeepSeek Coder 6.7B", "desc": "Excellent for programming", "size": "~4GB", "downloads": 180000},
    ],
    "creative": [
        {"id": "TheBloke/MythoMax-L2-13B-GGUF", "name": "MythoMax 13B", "desc": "Great for creative writing", "size": "~8GB", "downloads": 100000},
    ],
    "reasoning": [
        {"id": "Qwen/QwQ-32B-Preview-GGUF", "name": "QwQ 32B Preview", "desc": "Advanced reasoning model", "size": "~20GB", "downloads": 150000},
    ],
    "small": [
        {"id": "Qwen/Qwen2.5-1.5B-Instruct-GGUF", "name": "Qwen 2.5 1.5B", "desc": "Ultra fast, low resource", "size": "~1GB", "downloads": 400000},
        {"id": "TheBloke/Phi-3-mini-4k-instruct-GGUF", "name": "Phi-3 Mini", "desc": "Microsoft's tiny model", "size": "~2GB", "downloads": 350000},
    ]
}

def init_db():
    # Create necessary directories for trainer
    (APP_DIR / "training_data").mkdir(exist_ok=True)
    (APP_DIR / "datasets").mkdir(exist_ok=True)
    (APP_DIR / "exports").mkdir(exist_ok=True)
    (APP_DIR / "trained_models").mkdir(exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('''CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY, title TEXT, pinned INTEGER DEFAULT 0,
        folder TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, role TEXT,
        content TEXT, timestamp TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
    conn.execute('''CREATE TABLE IF NOT EXISTS prompt_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, content TEXT, category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS command_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, command TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    # Migrations
    for col, default in [("timestamp", None), ("pinned", None), ("folder", "")]:
        try:
            if col == "pinned" or col == "folder":
                conn.execute(f"SELECT {col} FROM chats LIMIT 1")
            else:
                conn.execute(f"SELECT {col} FROM messages LIMIT 1")
        except sqlite3.OperationalError:
            if col == "pinned":
                conn.execute(f"ALTER TABLE chats ADD COLUMN pinned INTEGER DEFAULT 0")
            elif col == "folder":
                conn.execute(f"ALTER TABLE chats ADD COLUMN folder TEXT DEFAULT ''")
            else:
                conn.execute(f"ALTER TABLE messages ADD COLUMN {col} TEXT")
    
    defaults = {
        'openai_api_key': '', 'hf_token': '', 'hf_image_model': 'stabilityai/stable-diffusion-xl-base-1.0',
        'custom_api_url': '', 'allow_terminal': '0',
        'allow_file_read': '0', 'allow_file_write': '0', 'unlimited_tokens': '1',
        'theme': 'dark', 'local_models_path': '', 'default_model': 'gpt-3.5-turbo',
        'context_window': '4096', 'gpu_layers': '0', 'auto_refresh_models': '1',
        'model_size_display': '1', 'download_progress': '1', 'background_operations': '1',
        'temperature': '0.7', 'language': 'en', 'accent': 'blue',
        'auto_search': '0', 'voice_output': '0', 'stream_response': '1',
        'max_history': '50', 'auto_title': '1', 'show_tokens': '1'
    }
    for k, v in defaults.items():
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, str(v)))
    conn.commit()
    return conn

# Import frontend HTML
from ui_content import HTML_CONTENT

class BackendAPI:
    def __init__(self):
        self._window = None
        self.db = init_db()
        self.llama_instance = None
        self.current_model_path = None
        self.is_generating = False
        self.is_stopping = False
        self._active_downloads = {}
        self._memory = {}  # Simple memory storage
        # Trainer-related attributes
        self._trainer_model = None
        self._trainer_model_path = None
        self._training_in_progress = False
        self._training_progress = 0
        self._training_stats = {}
        self._datasets = {}
        self._trained_models = []
        self._trainer = None  # legacy trainer (kept for compatibility)
        self._training_process = None
        self._training_reader_thread = None
        self._training_job = {}
        self._training_lock = threading.Lock()
        self._trained_inference_runtime = None
        self._loaded_trained_model_name = None
        self._load_trainer_data()

    def set_window(self, w):
        self._window = w

    def stop_ai(self):
        self.is_stopping = True
        return True

    def _dispatch(self, event, detail):
        if self._window:
            try:
                safe = json.dumps(detail)
                self._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('{event}', {{detail: {safe}}}));")
            except Exception as e:
                print(f"Dispatch error: {e}")

    # ---- DIALOGS ----
    def prompt_file_dialog(self):
        r = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=('All files (*.*)',))
        return r[0] if r and len(r) > 0 else None

    def prompt_folder_dialog(self):
        r = self._window.create_file_dialog(webview.FOLDER_DIALOG, allow_multiple=False)
        return r[0] if r and len(r) > 0 else None

    # ---- CHATS & FOLDERS ----
    def get_chats(self):
        cur = self.db.execute("SELECT id, title, pinned, folder FROM chats ORDER BY pinned DESC, created_at DESC")
        return [dict(row) for row in cur.fetchall()]

    def create_chat(self, title, folder=''):
        cid = os.urandom(8).hex()
        self.db.execute("INSERT INTO chats (id, title, folder) VALUES (?, ?, ?)", (cid, title, folder))
        self.db.commit()
        return cid

    def update_chat_title(self, cid, title):
        self.db.execute("UPDATE chats SET title = ? WHERE id = ?", (title, cid))
        self.db.commit()

    def toggle_pin_chat(self, cid):
        cur = self.db.execute("SELECT pinned FROM chats WHERE id = ?", (cid,))
        row = cur.fetchone()
        new_val = 0 if (row and row['pinned']) else 1
        self.db.execute("UPDATE chats SET pinned = ? WHERE id = ?", (new_val, cid))
        self.db.commit()
        return new_val

    def move_chat_to_folder(self, cid, folder):
        self.db.execute("UPDATE chats SET folder = ? WHERE id = ?", (folder, cid))
        self.db.commit()

    def get_folders(self):
        cur = self.db.execute("SELECT DISTINCT folder FROM chats WHERE folder != '' UNION SELECT name FROM folders")
        folders = set(row['folder'] for row in cur.fetchall() if row['folder'])
        # also include folders from folders table even if empty
        cur = self.db.execute("SELECT name FROM folders")
        for row in cur.fetchall():
            folders.add(row['name'])
        return sorted(folders)

    def create_folder(self, name):
        try:
            self.db.execute("INSERT INTO folders (name) VALUES (?)", (name,))
            self.db.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def rename_folder(self, old, new):
        self.db.execute("UPDATE chats SET folder = ? WHERE folder = ?", (new, old))
        self.db.execute("UPDATE folders SET name = ? WHERE name = ?", (new, old))
        self.db.commit()

    def delete_folder(self, name):
        self.db.execute("UPDATE chats SET folder = '' WHERE folder = ?", (name,))
        self.db.execute("DELETE FROM folders WHERE name = ?", (name,))
        self.db.commit()

    def get_messages(self, cid):
        try:
            cur = self.db.execute("SELECT role, content, timestamp FROM messages WHERE chat_id = ? ORDER BY id ASC", (cid,))
            return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            print(f"[ERROR] Failed to load messages: {e}")
            return []

    def delete_chat(self, cid):
        self.db.execute("DELETE FROM chats WHERE id = ?", (cid,))
        self.db.execute("DELETE FROM messages WHERE chat_id = ?", (cid,))
        self.db.commit()

    def clear_chat(self, cid):
        self.db.execute("DELETE FROM messages WHERE chat_id = ?", (cid,))
        self.db.commit()

    def clear_all_chats(self):
        self.db.execute("DELETE FROM chats")
        self.db.execute("DELETE FROM messages")
        self.db.commit()
        return True
    
    def get_chat_stats(self, cid):
        cur = self.db.execute("SELECT COUNT(*) as count FROM messages WHERE chat_id = ?", (cid,))
        msg_count = cur.fetchone()['count']
        
        cur = self.db.execute("SELECT content FROM messages WHERE chat_id = ?", (cid,))
        total_chars = sum(len(row['content']) for row in cur.fetchall())
        
        return {
            "message_count": msg_count,
            "total_characters": total_chars,
            "estimated_tokens": total_chars // 4
        }

    def get_total_stats(self):
        """Aggregated statistics across all chats"""
        cur = self.db.execute("SELECT COUNT(*) as chats FROM chats")
        total_chats = cur.fetchone()['chats']
        cur = self.db.execute("SELECT COUNT(*) as msgs FROM messages")
        total_msgs = cur.fetchone()['msgs']
        cur = self.db.execute("SELECT SUM(LENGTH(content)) as chars FROM messages")
        total_chars = cur.fetchone()['chars'] or 0
        return {
            "chats": total_chats,
            "messages": total_msgs,
            "characters": total_chars,
            "tokens": total_chars // 4
        }
    
    def search_messages(self, query, limit=50):
        cur = self.db.execute("""
            SELECT m.chat_id, m.role, m.content, m.timestamp, c.title 
            FROM messages m 
            JOIN chats c ON m.chat_id = c.id 
            WHERE m.content LIKE ? 
            ORDER BY m.created_at DESC 
            LIMIT ?
        """, (f'%{query}%', limit))
        return [dict(row) for row in cur.fetchall()]

    def rollback_chat(self, cid, idx):
        cur = self.db.execute("SELECT id FROM messages WHERE chat_id = ? ORDER BY id ASC", (cid,))
        rows = cur.fetchall()
        if len(rows) > idx:
            cut_id = rows[idx]['id']
            self.db.execute("DELETE FROM messages WHERE chat_id = ? AND id >= ?", (cid, cut_id))
            self.db.commit()

    def export_chat(self, cid, fmt='json'):
        msgs = self.get_messages(cid)
        cur = self.db.execute("SELECT title FROM chats WHERE id = ?", (cid,))
        row = cur.fetchone()
        title = row['title'] if row else 'Chat'
        if fmt == 'markdown':
            lines = [f"# {title}\n\n"]
            for m in msgs:
                role = "**You**" if m['role'] == 'user' else "**AIens**"
                lines.append(f"{role} ({m.get('timestamp','')}):\n{m['content']}\n\n")
            return '\n'.join(lines)
        elif fmt == 'txt':
            lines = [f"=== {title} ===\n"]
            for m in msgs:
                role = "You" if m['role'] == 'user' else "AIens"
                lines.append(f"\n[{role}]:\n{m['content']}\n")
            return '\n'.join(lines)
        elif fmt == 'pdf':
            # Generate PDF using reportlab if available, otherwise return HTML for print
            try:
                from reportlab.lib.pagesizes import A4
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                from reportlab.lib.units import inch
                from io import BytesIO
                import base64

                buffer = BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=A4,
                                      rightMargin=72, leftMargin=72,
                                      topMargin=72, bottomMargin=18)

                styles = getSampleStyleSheet()
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading1'],
                    fontSize=24,
                    spaceAfter=30,
                    textColor='#1a1a1a'
                )

                story = []

                # Title
                story.append(Paragraph(title, title_style))
                story.append(Spacer(1, 0.2 * inch))
                story.append(Paragraph(f"Exported: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
                story.append(Spacer(1, 0.3 * inch))

                # Messages
                for m in msgs:
                    role = "You" if m['role'] == 'user' else "AIens"
                    role_style = ParagraphStyle(
                        'RoleStyle',
                        parent=styles['Heading3'],
                        textColor='#4f46e5' if m['role'] == 'user' else '#10b981',
                        fontSize=12
                    )
                    story.append(Paragraph(f"<b>{role}</b> ({m.get('timestamp', '')})", role_style))

                    # Clean content for PDF
                    clean_content = m['content'].replace('<', '&lt;').replace('>', '&gt;').replace(chr(10), '<br/>')
                    story.append(Paragraph(clean_content, styles['Normal']))
                    story.append(Spacer(1, 0.2 * inch))

                doc.build(story)
                pdf_content = buffer.getvalue()
                buffer.close()

                # Return as base64 for download
                return base64.b64encode(pdf_content).decode('utf-8')

            except ImportError:
                # Fallback: return HTML that can be printed to PDF
                html_lines = [f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>{title}</title>"]
                html_lines.append("<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}h1{color:#333;border-bottom:2px solid #4f46e5;padding-bottom:10px}.msg{margin:20px 0;padding:15px;border-radius:8px}.user{background:#eef2ff;border-left:4px solid #4f46e5}.ai{background:#f0fdf4;border-left:4px solid #10b981}.role{font-weight:bold;margin-bottom:8px}.user .role{color:#4f46e5}.ai .role{color:#10b981}.timestamp{color:#666;font-size:12px}</style></head><body>")
                html_lines.append(f"<h1>{title}</h1><p class='timestamp'>Exported: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>")

                for m in msgs:
                    role = "You" if m['role'] == 'user' else "AIens"
                    css_class = "user" if m['role'] == 'user' else "ai"
                    html_lines.append(f"<div class='msg {css_class}'><div class='role'>{role} <span class='timestamp'>{m.get('timestamp', '')}</span></div><div>{m['content'].replace(chr(10), '<br>')}</div></div>")

                html_lines.append("</body></html>")
                return chr(10).join(html_lines)
        return json.dumps({"title": title, "messages": msgs}, ensure_ascii=False, indent=2)

    def import_chat(self, json_str):
        try:
            data = json.loads(json_str)
            cid = self.create_chat(data.get('title', 'Imported Chat'))
            for m in data.get('messages', []):
                self.db.execute("INSERT INTO messages (chat_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                    (cid, m['role'], m['content'], m.get('timestamp', '')))
            self.db.commit()
            return {"id": cid}
        except Exception as e:
            return {"error": str(e)}

    # ---- SETTINGS ----
    def get_all_settings(self):
        cur = self.db.execute("SELECT key, value FROM settings")
        return {r['key']: r['value'] for r in cur.fetchall()}

    def get_setting(self, key):
        cur = self.db.execute("SELECT value FROM settings WHERE key = ?", (key,))
        r = cur.fetchone()
        return r['value'] if r else None

    def save_settings(self, data):
        for k, v in data.items():
            self.db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, str(v)))
        self.db.commit()
        return True

    def get_system_stats(self):
        try:
            import psutil
            result = {"cpu": psutil.cpu_percent(interval=0.1), "ram": psutil.virtual_memory().percent, "gpu": None, "vram": None, "disk": None}
            try:
                result["disk"] = psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:\\').percent
            except:
                pass
            try:
                # Try new nvidia-ml-py first, fallback to deprecated pynvml
                try:
                    import pynvml
                    pynvml.nvmlInit()
                    h = pynvml.nvmlDeviceGetHandleByIndex(0)
                    util = pynvml.nvmlDeviceGetUtilizationRates(h)
                    mem  = pynvml.nvmlDeviceGetMemoryInfo(h)
                    result["gpu"]  = util.gpu
                    result["vram"] = round(mem.used / mem.total * 100)
                except ImportError:
                    # Try nvidia-ml-py
                    import nvidia_ml_py
                    nvidia_ml_py.nvmlInit()
                    h = nvidia_ml_py.nvmlDeviceGetHandleByIndex(0)
                    util = nvidia_ml_py.nvmlDeviceGetUtilizationRates(h)
                    mem  = nvidia_ml_py.nvmlDeviceGetMemoryInfo(h)
                    result["gpu"]  = util.gpu
                    result["vram"] = round(mem.used / mem.total * 100)
            except Exception:
                pass
            return result
        except Exception:
            return {"cpu": 0, "ram": 0, "gpu": None, "vram": None, "disk": 0}

    # ---- PROMPT TEMPLATES ----
    def get_templates(self):
        cur = self.db.execute("SELECT id, name, content, category FROM prompt_templates ORDER BY id DESC")
        return [dict(row) for row in cur.fetchall()]

    def add_template(self, name, content, category="general"):
        self.db.execute("INSERT INTO prompt_templates (name, content, category) VALUES (?, ?, ?)", (name, content, category))
        self.db.commit()
        return True
    
    def update_template(self, tid, name, content, category):
        self.db.execute("UPDATE prompt_templates SET name = ?, content = ?, category = ? WHERE id = ?", 
                       (name, content, category, tid))
        self.db.commit()
        return True

    def delete_template(self, tid):
        self.db.execute("DELETE FROM prompt_templates WHERE id = ?", (tid,))
        self.db.commit()
        return True

    # ---- COMMAND HISTORY ----
    def get_history(self, chat_id=None, limit=20):
        if chat_id:
            cur = self.db.execute("SELECT command FROM command_history WHERE chat_id = ? ORDER BY id DESC LIMIT ?", (chat_id, limit))
        else:
            cur = self.db.execute("SELECT command FROM command_history ORDER BY id DESC LIMIT ?", (limit,))
        return [row['command'] for row in cur.fetchall()]

    def add_history(self, chat_id, command):
        self.db.execute("INSERT INTO command_history (chat_id, command) VALUES (?, ?)", (chat_id, command))
        self.db.commit()
        # Keep only last 100 entries
        self.db.execute("DELETE FROM command_history WHERE id NOT IN (SELECT id FROM command_history ORDER BY id DESC LIMIT 100)")
        self.db.commit()

    # ---- MODELS ----
    def get_local_models(self):
        models = []
        custom = self.get_setting("local_models_path")
        dirs = [MODELS_DIR]
        if custom and os.path.isdir(custom):
            dirs.append(Path(custom))
        seen = set()
        for d in dirs:
            for f in Path(d).glob("*.gguf"):
                if f.name not in seen:
                    seen.add(f.name)
                    sz = f.stat().st_size
                    if sz > 1024**3:
                        sz_str = f"{sz/(1024**3):.1f} GB"
                    elif sz > 1024**2:
                        sz_str = f"{sz/(1024**2):.0f} MB"
                    else:
                        sz_str = f"{sz/1024:.0f} KB"
                    
                    # Detect quantization
                    quant = ""
                    fname_lower = f.name.lower()
                    for q in ['q8_0', 'q6_k', 'q5_k_m', 'q5_k_s', 'q5_0', 'q4_k_m', 'q4_k_s', 'q4_0', 'q3_k_m', 'q3_k_s', 'q2_k']:
                        if q in fname_lower:
                            quant = q.upper()
                            break
                    
                    models.append({"id": f"local_{f.name}", "name": f.name, "path": str(f), "size": sz_str, "size_bytes": sz, "quant": quant})
        return models

    def delete_local_model(self, model_id):
        name = model_id.replace("local_", "", 1)
        custom = self.get_setting("local_models_path")
        for d in [MODELS_DIR] + ([Path(custom)] if custom and os.path.isdir(custom) else []):
            p = Path(d) / name
            if p.exists():
                p.unlink()
                return True
        return False

    def get_active_downloads(self):
        return self._active_downloads

    def get_system_recommendation(self):
        try:
            import psutil
            ram_gb = psutil.virtual_memory().total / (1024**3)
            suggested_ctx = 4096
            if ram_gb >= 32: suggested_ctx = 32768
            elif ram_gb >= 16: suggested_ctx = 16384
            elif ram_gb >= 8: suggested_ctx = 8192
            
            if ram_gb >= 32: return {"ram": f"{ram_gb:.0f} GB", "rec": "Q5_K_M or Q8 (8B-14B models)", "max_q": "Q8_0", "ctx": suggested_ctx, "tier": "high"}
            elif ram_gb >= 16: return {"ram": f"{ram_gb:.0f} GB", "rec": "Q4_K_M (7B-8B models)", "max_q": "Q5_K_M", "ctx": suggested_ctx, "tier": "medium"}
            elif ram_gb >= 8: return {"ram": f"{ram_gb:.0f} GB", "rec": "Q3_K_M or Q4_K_S (3B-7B models)", "max_q": "Q4_K_M", "ctx": suggested_ctx, "tier": "low"}
            else: return {"ram": f"{ram_gb:.0f} GB", "rec": "Q2_K or Q3_K_S (1B-3B models)", "max_q": "Q3_K_M", "ctx": suggested_ctx, "tier": "minimal"}
        except Exception:
            return {"ram": "Unknown", "rec": "Q4_K_M (7B models)", "max_q": "Q4_K_M", "ctx": 4096, "tier": "unknown"}

    def get_popular_models(self):
        return POPULAR_MODELS

    def search_hf_models(self, query):
        try:
            api = HfApi()
            results = api.list_models(search=query, limit=30, filter="gguf", sort="downloads")
            out = []
            for m in results:
                info = {"id": m.modelId, "downloads": getattr(m, 'downloads', 0)}
                try:
                    siblings = getattr(m, 'siblings', None)
                    if siblings:
                        gguf_sizes = [s.size for s in siblings if s.rfilename.endswith('.gguf') and s.size]
                        if gguf_sizes:
                            total = sum(gguf_sizes)
                            info["size"] = f"{total/(1024**3):.1f} GB" if total > 1024**3 else f"{total/(1024**2):.0f} MB"
                except Exception:
                    pass
                out.append(info)
            return out
        except Exception as e:
            return {"error": str(e)}

    def download_hf_model(self, repo_id, quant_preference="Q4_K_M"):
        def _dl():
            try:
                api = HfApi()
                files = api.list_repo_files(repo_id=repo_id)
                gguf_files = [f for f in files if f.endswith(".gguf")]
                if not gguf_files:
                    self._dispatch('dl-error', {'id': repo_id, 'error': 'No .gguf files found.'})
                    return
                
                # Smart quantization selection
                target = gguf_files[0]
                q_order = ['q6_k', 'q5_k_m', 'q5_k_s', 'q4_k_m', 'q4_k_s', 'q4_0', 'q3_k_m', 'q3_k_s', 'q2_k', 'q8_0']
                
                for q in q_order:
                    for g in gguf_files:
                        if q in g.lower():
                            target = g
                            break
                    if target != gguf_files[0]:
                        break
                
                self._active_downloads[repo_id] = {"file": target, "percent": 0}
                self._dispatch('dl-start', {'id': repo_id, 'file': target})
                import requests
                url = f"https://huggingface.co/{repo_id}/resolve/main/{target}?download=true"
                resp = requests.get(url, stream=True, allow_redirects=True)
                total = int(resp.headers.get('content-length', 0))
                downloaded = 0
                fpath = MODELS_DIR / target
                with open(fpath, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=32768):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            if total > 0:
                                prog = int((downloaded / total) * 100)
                                self._active_downloads[repo_id]["percent"] = prog
                                self._dispatch('dl-progress', {'id': repo_id, 'text': f'Downloading {target}...', 'percent': prog})
                            else:
                                mb = downloaded // (1024*1024)
                                self._dispatch('dl-progress', {'id': repo_id, 'text': f'{target} ({mb} MB)', 'percent': -1})
                self._dispatch('dl-done', {'id': repo_id})
                if repo_id in self._active_downloads:
                    del self._active_downloads[repo_id]
                self._dispatch('models-refresh', {})
            except Exception as e:
                self._dispatch('dl-error', {'id': repo_id, 'error': str(e)})
                if repo_id in self._active_downloads:
                    del self._active_downloads[repo_id]
        threading.Thread(target=_dl, daemon=True).start()
        return {"status": "Started"}

    # ---- INFERENCE ----
    def send_message(self, chat_id, text, model_id, use_search, use_agent, use_thinking=True):
        if self.is_generating:
            return {"error": "Already generating"}
        
        # Check if local model selected without API key requirement
        is_local = model_id.startswith("local_")
        if not is_local:
            api_key = self.get_setting("openai_api_key")
            if not api_key:
                return {"error": "API key required for cloud models. Set it in Settings or select a local model."}
        
        ts = datetime.now().strftime("%H:%M")
        self.add_history(chat_id, text)
        
        self.db.execute("INSERT INTO messages (chat_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                        (chat_id, 'user', text, ts))
        self.db.commit()

        # If auto_title is enabled and chat title is still default, update it
        if self.get_setting("auto_title") == '1':
            cur = self.db.execute("SELECT title FROM chats WHERE id = ?", (chat_id,))
            row = cur.fetchone()
            if row and row['title'] == 'ÐÐ¾Ð²Ñ‹Ð¹ Ñ‡Ð°Ñ‚':
                new_title = text[:30] + ('...' if len(text) > 30 else '')
                self.update_chat_title(chat_id, new_title)

        def _task():
            self.is_generating = True
            self.is_stopping = False
            t_start = _time.time()
            try:
                c = self.db.execute("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id ASC", (chat_id,))
                messages = [{"role": r["role"], "content": r["content"]} for r in c.fetchall()]

                system_prompt = "You are AIens, a helpful AI assistant. Be concise, accurate, and friendly.\n"

                tools_enabled = False
                if use_agent:
                    at = self.get_setting("allow_terminal") == '1'
                    ar = self.get_setting("allow_file_read") == '1'
                    aw = self.get_setting("allow_file_write") == '1'
                    if at or ar or aw:
                        tools_enabled = True
                        system_prompt += "\nYou have AGENT tools. Use exact XML blocks:\n"
                        if at: system_prompt += "- <execute_terminal>cmd</execute_terminal>\n"
                        if ar: system_prompt += "- <read_file>path</read_file>\n"
                        if aw: system_prompt += '- <write_file path="path">content</write_file>\n'
                        system_prompt += "- <get_time></get_time>\n- <system_info></system_info>\n"
                        system_prompt += "- <python>code</python>\n- <read_url>url</read_url>\n"
                        system_prompt += "- <clipboard_read></clipboard_read>\n- <clipboard_write>text</clipboard_write>\n"
                        system_prompt += "- <take_screenshot></take_screenshot>\n- <generate_image>prompt</generate_image>\n"
                        system_prompt += "- <edit_image image_path=\"abs/path/img.png\">prompt</edit_image>\n"
                        system_prompt += "- <check_model_health></check_model_health>\n- <list_processes></list_processes>\n"
                        system_prompt += "- <memory_save>key:value</memory_save>\n- <memory_recall>key</memory_recall>\n"
                        system_prompt += "- <calculate>expression</calculate>\n"
                
                # Web search tool - AI decides when to use
                if use_search:
                    system_prompt += "\nYou have web search capability. When you need current information, use:\n"
                    system_prompt += "- <search_internet>your search query</search_internet>\n"
                    system_prompt += "Only search when you actually need current/real-time information.\n"

                unlim = self.get_setting("unlimited_tokens") == '1'
                ctx_sz = int(self.get_setting("context_window") or 4096)
                gpu = int(self.get_setting("gpu_layers") or 0)
                temp = float(self.get_setting("temperature") or 0.7)
                max_toks = 32768 if unlim else min(ctx_sz, 4096)

                for step in range(8):
                    full = [{"role": "system", "content": system_prompt}] + messages
                    response_text = ""

                    if model_id.startswith("local_"):
                        if Llama is None:
                            raise Exception("llama_cpp not installed. Run: pip install llama-cpp-python")
                        fname = model_id.split("local_", 1)[1]
                        file_path = None
                        custom = self.get_setting("local_models_path")
                        for d in [MODELS_DIR] + ([Path(custom)] if custom and os.path.isdir(custom) else []):
                            p = Path(d) / fname
                            if p.exists():
                                file_path = p
                                break
                        if not file_path or not file_path.exists():
                            raise Exception(f"Model file not found: {fname}")

                        if self.current_model_path != str(file_path) or self.llama_instance is None:
                            self._dispatch('ai-chunk', "\n*Loading model...*\n")
                            try:
                                # Adjust context window to match model capabilities
                                # Most GGUF models are trained with 4K-32K context
                                target_ctx = ctx_sz if not unlim else 32768
                                
                                # Try context sizes in descending order to find the best fit
                                ctx_candidates = []
                                if target_ctx >= 32768: ctx_candidates.extend([32768, 16384, 8192, 4096, 2048])
                                elif target_ctx >= 16384: ctx_candidates.extend([16384, 8192, 4096, 2048])
                                elif target_ctx >= 8192: ctx_candidates.extend([8192, 4096, 2048])
                                elif target_ctx >= 4096: ctx_candidates.extend([4096, 2048, 1024])
                                else: ctx_candidates.extend([2048, 1024, 512])
                                
                                loaded = False
                                last_exc = None
                                for try_ctx in ctx_candidates:
                                    try:
                                        self.llama_instance = Llama(
                                            model_path=str(file_path),
                                            n_ctx=try_ctx,
                                            n_gpu_layers=gpu,
                                            verbose=False,
                                            seed=1337)  # Set seed for reproducibility
                                        loaded = True
                                        self._dispatch('ai-chunk', f"*Model loaded (ctx={try_ctx})*\n\n")
                                        break
                                    except Exception as e:
                                        last_exc = e
                                        self.llama_instance = None
                                        continue

                                if not loaded:
                                    error_msg = f"Could not load model with any context size. Last error: {last_exc}"
                                    self._dispatch('ai-error', error_msg)
                                    raise Exception(error_msg)

                                self.current_model_path = str(file_path)
                            except Exception as e:
                                self.llama_instance = None
                                self.current_model_path = None
                                self._dispatch('ai-error', f"Model loading failed: {str(e)}")
                                raise Exception(str(e))

                        stream = self.llama_instance.create_chat_completion(
                            messages=full, stream=True, temperature=temp)
                        for chunk in stream:
                            if self.is_stopping:
                                break
                            t = chunk["choices"][0].get("delta", {}).get("content", "")
                            if t:
                                if not use_thinking and '<think >' in response_text and '' not in response_text:
                                    response_text += t
                                    continue
                                response_text += t
                                self._dispatch('ai-chunk', t)
                    else:
                        api_key = self.get_setting("openai_api_key")
                        custom_url = self.get_setting("custom_api_url")
                        kwargs = {"api_key": api_key}
                        if custom_url:
                            kwargs["base_url"] = custom_url
                        client = OpenAI(**kwargs)
                        stream = client.chat.completions.create(
                            model=model_id, messages=full, stream=True,
                            max_tokens=max_toks, temperature=temp)
                        for chunk in stream:
                            if self.is_stopping:
                                break
                            if chunk.choices[0].delta.content is not None:
                                t = chunk.choices[0].delta.content
                                if not use_thinking and '<think >' in response_text and '' not in response_text:
                                    response_text += t
                                    continue
                                response_text += t
                                self._dispatch('ai-chunk', t)

                    if self.is_stopping:
                        response_text += " [Stopped]"

                    ts_end = datetime.now().strftime("%H:%M")
                    self.db.execute(
                        "INSERT INTO messages (chat_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                        (chat_id, 'assistant', response_text, ts_end))
                    self.db.commit()

                    if self.is_stopping:
                        break

                    # Check for tool usage
                    tools_used, sys_resp = self._handle_tools(response_text, use_search)
                    if tools_used:
                        messages.append({"role": "assistant", "content": response_text})
                        messages.append({"role": "user", "content": sys_resp})
                        continue
                    
                    # Check for web search in response
                    if use_search and "<search_internet>" in response_text:
                        sm = re.search(r'<search_internet>(.*?)</search_internet>', response_text, re.DOTALL|re.I)
                        if sm:
                            q = sm.group(1).strip()
                            self._dispatch('ai-tool-used', {'tool': 'Web Search', 'result': f'Searching: {q}', 'status': 'running'})
                            res = safe_web_search(q, max_results=5)
                            if res:
                                ctxt = "\n".join([f"[{r['title']}]({r['href']}): {r['body']}" for r in res])
                                messages.append({"role": "assistant", "content": response_text})
                                messages.append({"role": "user", "content": f"[Search Results for '{q}']:\n{ctxt}\n\nPlease use this information to answer the original question."})
                                self._dispatch('ai-tool-used', {'tool': 'Web Search', 'result': f'Found {len(res)} results', 'status': 'done'})
                                continue
                            else:
                                self._dispatch('ai-tool-used', {'tool': 'Web Search', 'result': 'No results', 'status': 'error'})
                                messages.append({"role": "assistant", "content": response_text})
                                messages.append({"role": "user", "content": f"Search for '{q}' returned no results. Please answer based on your knowledge."})
                                continue
                    break

                elapsed = round(_time.time() - t_start, 1)
                self._dispatch('ai-done', {"time": elapsed})
            except Exception as e:
                traceback.print_exc()
                self._dispatch('ai-error', str(e))
                self._dispatch('ai-done', {"time": 0})
            finally:
                self.is_generating = False
                self.is_stopping = False

        threading.Thread(target=_task, daemon=True).start()
        return {"status": "started"}

    def _handle_tools(self, text, search_enabled=False):
        import platform
        try:
            import psutil
        except:
            psutil = None
        
        # Calculator - real math
        calc_m = re.search(r'<\s*calculate\s*>(.*?)</\s*calculate\s*>', text, re.DOTALL|re.I)
        if calc_m:
            expr = calc_m.group(1).strip()
            self._dispatch('ai-tool-used', {'tool': 'Calculator', 'result': f'Computing: {expr}', 'status': 'running'})
            try:
                # Safe math evaluation
                allowed_names = {
                    'abs': abs, 'round': round, 'min': min, 'max': max, 'sum': sum,
                    'pow': pow, 'len': len, 'int': int, 'float': float, 'str': str,
                    'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
                    'log': math.log, 'log10': math.log10, 'exp': math.exp,
                    'pi': math.pi, 'e': math.e, 'ceil': math.ceil, 'floor': math.floor
                }
                result = eval(expr, {"__builtins__": {}}, allowed_names)
                self._dispatch('ai-tool-used', {'tool': 'Calculator', 'result': f'Result: {result}', 'status': 'done'})
                return True, f"[Calculator]: {expr} = {result}"
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'Calculator', 'result': 'Error', 'status': 'error'})
                return True, f"[Calculator Error]: {e}"

        # Memory system
        mem_save_m = re.search(r'<\s*memory_save\s*>(.*?):(.*?)</\s*memory_save\s*>', text, re.DOTALL|re.I)
        mem_recall_m = re.search(r'<\s*memory_recall\s*>(.*?)</\s*memory_recall\s*>', text, re.I)

        if mem_save_m:
            key = mem_save_m.group(1).strip()
            value = mem_save_m.group(2).strip()
            self._memory[key] = value
            self._dispatch('ai-tool-used', {'tool': 'Memory', 'result': f'Saved: {key}', 'status': 'done'})
            return True, f"[Memory]: Saved '{key}' = '{value}'"

        if mem_recall_m:
            key = mem_recall_m.group(1).strip()
            value = self._memory.get(key, "Not found")
            self._dispatch('ai-tool-used', {'tool': 'Memory', 'result': f'Recalled: {key}', 'status': 'done'})
            return True, f"[Memory]: '{key}' = '{value}'"

        # Image generation
        image_m = re.search(r'<\s*generate_image\s*>(.*?)</\s*generate_image\s*>', text, re.DOTALL|re.I)
        if image_m:
            prompt = image_m.group(1).strip()
            self._dispatch('ai-tool-used', {'tool': 'Image Gen', 'result': f'Generating: {prompt[:30]}...', 'status': 'running'})
            api_key = self.get_setting("openai_api_key")
            hf_token = self.get_setting("hf_token")
            hf_model = self.get_setting("hf_image_model") or "black-forest-labs/FLUX.1-schnell"
            
            if hf_token:
                try:
                    from huggingface_hub import InferenceClient
                    client = InferenceClient(token=hf_token)
                    img = client.text_to_image(prompt, model=hf_model)
                    
                    img_dir = APP_DIR / 'images'
                    img_dir.mkdir(exist_ok=True)
                    fn = f"gen_hf_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    img_path = img_dir / fn
                    img.save(str(img_path))
                    
                    abs_path = img_path.resolve()
                    self._dispatch('ai-tool-used', {'tool': 'Image Gen (HF)', 'result': 'Generated!', 'status': 'done'})
                    return True, f"Image successfully generated via HuggingFace and saved to {abs_path}.\n![{prompt}](file:///{abs_path})"
                except Exception as e:
                    self._dispatch('ai-tool-used', {'tool': 'Image Gen (HF)', 'result': str(e), 'status': 'error'})
                    return True, f"Error generating image via HuggingFace: {e}"
            elif api_key:
                try:
                    import urllib.request
                    from openai import OpenAI
                    client = OpenAI(api_key=api_key)
                    resp = client.images.generate(model="dall-e-3", prompt=prompt, n=1, size="1024x1024")
                    url = resp.data[0].url
                    
                    # Download image locally
                    img_dir = APP_DIR / 'images'
                    img_dir.mkdir(exist_ok=True)
                    fn = f"gen_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    img_path = img_dir / fn
                    
                    urllib.request.urlretrieve(url, str(img_path))
                    
                    # Return local absolute path for reliable frontend rendering
                    abs_path = img_path.resolve()
                    
                    self._dispatch('ai-tool-used', {'tool': 'Image Gen', 'result': 'Generated!', 'status': 'done'})
                    return True, f"Image successfully generated and saved to {abs_path}.\n![{prompt}](file:///{abs_path})"
                except Exception as e:
                    self._dispatch('ai-tool-used', {'tool': 'Image Gen', 'result': str(e), 'status': 'error'})
                    return True, f"Error generating image: {e}"
            else:
                self._dispatch('ai-tool-used', {'tool': 'Image Gen', 'result': 'Missing API Key', 'status': 'error'})
                return True, "Error: OpenAI API key OR HuggingFace Token required for image generation."

        # Image editing
        edit_img_m = re.search(r'<\s*edit_image\s+image_path="([^"]+)"\s*>(.*?)</\s*edit_image\s*>', text, re.DOTALL|re.I)
        if edit_img_m:
            path = edit_img_m.group(1).strip()
            prompt = edit_img_m.group(2).strip()
            self._dispatch('ai-tool-used', {'tool': 'Image Edit', 'result': f'Editing: {prompt[:30]}...', 'status': 'running'})
            
            hf_token = self.get_setting("hf_token")
            # Usually instruct-pix2pix or similar for image-to-image
            hf_model = "timbrooks/instruct-pix2pix" 
            
            if hf_token:
                try:
                    import os
                    from huggingface_hub import InferenceClient
                    if not os.path.exists(path):
                        return True, f"Error: Image at path {path} does not exist."
                    
                    client = InferenceClient(token=hf_token)
                    with open(path, "rb") as f:
                        img_data = f.read()
                        
                    res = client.image_to_image(image=img_data, prompt=prompt, model=hf_model)
                    
                    img_dir = APP_DIR / 'images'
                    img_dir.mkdir(exist_ok=True)
                    fn = f"edit_hf_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    img_path = img_dir / fn
                    res.save(str(img_path))
                    
                    abs_path = img_path.resolve()
                    self._dispatch('ai-tool-used', {'tool': 'Image Edit (HF)', 'result': 'Edited!', 'status': 'done'})
                    return True, f"Image successfully edited via HuggingFace and saved to {abs_path}.\n![{prompt}](file:///{abs_path})"
                except Exception as e:
                    self._dispatch('ai-tool-used', {'tool': 'Image Edit (HF)', 'result': str(e), 'status': 'error'})
                    return True, f"Error editing image via HuggingFace: {e}"
            else:
                self._dispatch('ai-tool-used', {'tool': 'Image Edit', 'result': 'Missing HF Token', 'status': 'error'})
                return True, "Error: HuggingFace Token is required for image editing capabilities."

        # Model health check
        health_m = re.search(r'<\s*check_model_health\s*>\s*</\s*check_model_health\s*>', text, re.I) or re.search(r'<\s*check_model_health\s*/>', text, re.I)
        if health_m:
            self._dispatch('ai-tool-used', {'tool': 'Health Check', 'result': 'Checking...', 'status': 'running'})
            models = self.get_local_models()
            res = []
            for m in models:
                try:
                    with open(m['path'], 'rb') as f:
                        f.read(1024)
                    res.append(f"{m['name']}: OK")
                except Exception as e:
                    res.append(f"{m['name']}: ERROR ({e})")
            self._dispatch('ai-tool-used', {'tool': 'Health Check', 'result': 'Done', 'status': 'done'})
            return True, "Model Health:\n" + "\n".join(res)

        # Process list
        proc_m = re.search(r'<\s*list_processes\s*>\s*</\s*list_processes\s*>', text, re.I) or re.search(r'<\s*list_processes\s*/>', text, re.I)
        if proc_m:
            self._dispatch('ai-tool-used', {'tool': 'Process List', 'result': 'Fetching...', 'status': 'running'})
            try:
                import psutil
                procs = []
                for p in psutil.process_iter(['name', 'cpu_percent']):
                    try:
                        procs.append(p.info)
                    except:
                        pass
                procs.sort(key=lambda x: x.get('cpu_percent') or 0, reverse=True)
                summary = "\n".join([f"{p.get('name','?')}: {p.get('cpu_percent',0)}%" for p in procs[:10]])
                self._dispatch('ai-tool-used', {'tool': 'Process List', 'result': 'Done', 'status': 'done'})
                return True, f"Top 10 Processes:\n{summary}"
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'Process List', 'result': str(e), 'status': 'error'})
                return True, f"Error: {e}"

        # Screenshot
        screen_m = re.search(r'<\s*take_screenshot\s*>\s*</\s*take_screenshot\s*>', text, re.I) or re.search(r'<\s*take_screenshot\s*/>', text, re.I)
        if screen_m:
            self._dispatch('ai-tool-used', {'tool': 'Screenshot', 'result': 'Capturing...', 'status': 'running'})
            try:
                import pyautogui
                from io import BytesIO
                import base64
                shot = pyautogui.screenshot()
                buffered = BytesIO()
                shot.save(buffered, format="PNG")
                # Optionally return base64 image
                img_base64 = base64.b64encode(buffered.getvalue()).decode()
                self._dispatch('ai-tool-used', {'tool': 'Screenshot', 'result': 'Captured!', 'status': 'done'})
                return True, f"Screenshot captured. (base64 length: {len(img_base64)})"
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'Screenshot', 'result': str(e), 'status': 'error'})
                return True, f"Screenshot error: {e}"

        # URL reading
        url_m = re.search(r'<\s*read_url\s*>(.*?)</\s*read_url\s*>', text, re.DOTALL|re.I)
        if url_m:
            url = url_m.group(1).strip()
            self._dispatch('ai-tool-used', {'tool': 'URL Reader', 'result': f'Reading: {url}', 'status': 'running'})
            try:
                import urllib.request
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
                c = re.sub(r'<style.*?>.*?</style>', '', html, flags=re.DOTALL|re.I)
                c = re.sub(r'<script.*?>.*?</script>', '', c, flags=re.DOTALL|re.I)
                c = re.sub(r'<[^>]+>', ' ', c)
                c = re.sub(r'\s+', ' ').strip()[:15000]
                self._dispatch('ai-tool-used', {'tool': 'URL Reader', 'result': 'Read', 'status': 'done'})
            except Exception as e:
                c = str(e)
                self._dispatch('ai-tool-used', {'tool': 'URL Reader', 'result': 'Error', 'status': 'error'})
            return True, f"[URL {url}]:\n{c}"

        # Clipboard read
        clipr_m = re.search(r'<\s*clipboard_read\s*>\s*</\s*clipboard_read\s*>', text, re.I) or re.search(r'<\s*clipboard_read\s*/>', text, re.I)
        if clipr_m:
            self._dispatch('ai-tool-used', {'tool': 'Clipboard', 'result': 'Reading...', 'status': 'running'})
            c = ""
            try:
                # Prefer pyperclip if available
                import pyperclip
                c = pyperclip.paste()
            except ImportError:
                try:
                    import tkinter as tk
                    root = tk.Tk(); root.withdraw()
                    c = root.clipboard_get(); root.destroy()
                except Exception as e:
                    c = str(e)
            self._dispatch('ai-tool-used', {'tool': 'Clipboard', 'result': 'Read', 'status': 'done'})
            return True, f"[Clipboard]:\n{c}"

        # Clipboard write
        clipw_m = re.search(r'<\s*clipboard_write\s*>(.*?)</\s*clipboard_write\s*>', text, re.DOTALL|re.I)
        if clipw_m:
            content = clipw_m.group(1)
            self._dispatch('ai-tool-used', {'tool': 'Clipboard', 'result': 'Writing...', 'status': 'running'})
            try:
                try:
                    import pyperclip
                    pyperclip.copy(content)
                except ImportError:
                    import tkinter as tk
                    root = tk.Tk(); root.withdraw(); root.clipboard_clear()
                    root.clipboard_append(content); root.update(); root.destroy()
                self._dispatch('ai-tool-used', {'tool': 'Clipboard', 'result': 'Written', 'status': 'done'})
                return True, "[Clipboard]: Content copied."
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'Clipboard', 'result': 'Error', 'status': 'error'})
                return True, f"Clipboard error: {e}"

        # Time
        time_m = re.search(r'<\s*get_time\s*>\s*</\s*get_time\s*>', text, re.I) or re.search(r'<\s*get_time\s*/>', text, re.I)
        if time_m:
            self._dispatch('ai-tool-used', {'tool': 'Clock', 'result': 'Done', 'status': 'done'})
            return True, f"[Time]: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

        # System info
        sys_m = re.search(r'<\s*system_info\s*>\s*</\s*system_info\s*>', text, re.I) or re.search(r'<\s*system_info\s*/>', text, re.I)
        if sys_m:
            self._dispatch('ai-tool-used', {'tool': 'System', 'result': 'Checking...', 'status': 'running'})
            try:
                import psutil
                info = f"OS: {platform.system()} {platform.release()}\n"
                info += f"CPU: {platform.processor()}\n"
                info += f"RAM: {psutil.virtual_memory().percent}% used\n"
                info += f"CPU Usage: {psutil.cpu_percent()}%"
                self._dispatch('ai-tool-used', {'tool': 'System', 'result': 'Done', 'status': 'done'})
                return True, f"[System Info]:\n{info}"
            except Exception as e:
                return True, f"[System Info Error]: {e}"

        # Python execution
        py_m = re.search(r'<\s*python\s*>(.*?)</\s*python\s*>', text, re.DOTALL|re.I)
        if py_m:
            code = py_m.group(1).strip()
            self._dispatch('ai-tool-used', {'tool': 'Python', 'result': 'Executing...', 'status': 'running'})
            try:
                import io, contextlib
                out = io.StringIO()
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                    exec(code, {"__builtins__": __builtins__})
                result = out.getvalue()
                self._dispatch('ai-tool-used', {'tool': 'Python', 'result': 'Done', 'status': 'done'})
                return True, f"[Python Output]:\n```\n{result}\n```"
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'Python', 'result': 'Error', 'status': 'error'})
                return True, f"[Python Error]: {e}"

        # Terminal
        term_m = re.search(r'<\s*execute_terminal\s*>(.*?)</\s*execute_terminal\s*>', text, re.DOTALL|re.I)
        if term_m:
            cmd = term_m.group(1).strip()
            self._dispatch('ai-tool-used', {'tool': 'Terminal', 'result': f'Running: {cmd}', 'status': 'running'})
            try:
                result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=60).decode('utf-8', errors='replace')
                self._dispatch('ai-tool-used', {'tool': 'Terminal', 'result': 'Done', 'status': 'done'})
            except subprocess.CalledProcessError as e:
                result = e.output.decode('utf-8', errors='replace')
                self._dispatch('ai-tool-used', {'tool': 'Terminal', 'result': 'Error', 'status': 'error'})
            except Exception as e:
                result = str(e)
                self._dispatch('ai-tool-used', {'tool': 'Terminal', 'result': 'Error', 'status': 'error'})
            return True, f"[Terminal]:\n```\n{result}\n```"

        # File read
        read_m = re.search(r'<\s*read_file\s*>(.*?)</\s*read_file\s*>', text, re.DOTALL|re.I)
        if read_m:
            p = read_m.group(1).strip()
            self._dispatch('ai-tool-used', {'tool': 'File Reader', 'result': f'Reading: {p}', 'status': 'running'})
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    content = f.read()
                self._dispatch('ai-tool-used', {'tool': 'File Reader', 'result': 'Read', 'status': 'done'})
                return True, f"[File {p}]:\n```\n{content[:50000]}\n```"
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'File Reader', 'result': 'Error', 'status': 'error'})
                return True, f"File read error: {e}"

        # File write
        write_m = re.search(r'<\s*write_file\s+path=["\']?([^"\'>]*)["\']?\s*>(.*?)</\s*write_file\s*>', text, re.DOTALL|re.I)
        if write_m:
            p = os.path.abspath(write_m.group(1).strip())
            content = write_m.group(2)
            self._dispatch('ai-tool-used', {'tool': 'File Writer', 'result': f'Writing: {p}', 'status': 'running'})
            try:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, 'w', encoding='utf-8') as f:
                    f.write(content)
                self._dispatch('ai-tool-used', {'tool': 'File Writer', 'result': 'Written', 'status': 'done'})
                return True, f"[File Written]: {p}"
            except Exception as e:
                self._dispatch('ai-tool-used', {'tool': 'File Writer', 'result': 'Error', 'status': 'error'})
                return True, f"File write error: {e}"

        return False, None

    def copy_to_clipboard(self, text):
        """Copy text to clipboard using pyperclip or tkinter"""
        try:
            import pyperclip
            pyperclip.copy(text)
            return {"status": "copied"}
        except ImportError:
            try:
                import tkinter as tk
                root = tk.Tk()
                root.withdraw()
                root.clipboard_clear()
                root.clipboard_append(text)
                root.update()
                root.destroy()
                return {"status": "copied"}
            except Exception as e:
                return {"error": str(e)}

    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # AI TRAINER - Model Training Methods
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    def _load_trainer_data(self):
        """Load trainer data from database/files, seeding built-in dataset on first run."""
        try:
            datasets_file = APP_DIR / "datasets.json"
            if datasets_file.exists():
                with open(datasets_file, 'r', encoding='utf-8') as f:
                    self._datasets = json.load(f)
            
            models_file = APP_DIR / "trained_models.json"
            if models_file.exists():
                with open(models_file, 'r', encoding='utf-8') as f:
                    self._trained_models = json.load(f)
        except Exception as e:
            print(f"Error loading trainer data: {e}")
            self._datasets = {}
            self._trained_models = []

        # Seed built-in default dataset if missing, or refresh when bundled dataset grows.
        current = self._datasets.get(DEFAULT_DATASET_ID)
        if not current:
            self._seed_default_dataset(overwrite=True)
        else:
            raw_path = str(current.get("path", "") or "").strip()
            ds_path = Path(raw_path) if raw_path else None
            size = int(current.get("size", 0) or 0)
            signature = str(current.get("signature", "") or "").strip()
            needs_refresh = (
                (not ds_path)
                or (not ds_path.exists())
                or (size != len(DEFAULT_DATASET))
                or (signature != DEFAULT_DATASET_SIGNATURE)
            )
            if needs_refresh:
                self._seed_default_dataset(overwrite=True)

    def _seed_default_dataset(self, overwrite=False):
        """Write the built-in dataset to disk and register it."""
        try:
            datasets_dir = APP_DIR / "datasets"
            datasets_dir.mkdir(exist_ok=True)
            filepath = datasets_dir / "default_dataset_v1.json"
            if filepath.exists() and not overwrite:
                return
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_DATASET, f, ensure_ascii=False, indent=2)

            self._datasets[DEFAULT_DATASET_ID] = {
                "id": DEFAULT_DATASET_ID,
                "name": DEFAULT_DATASET_NAME,
                "size": len(DEFAULT_DATASET),
                "format": "alpaca",
                "source": "builtin",
                "path": str(filepath),
                "builtin": True,
                "signature": DEFAULT_DATASET_SIGNATURE,
            }
            self._save_trainer_data()
            print(f"Default dataset seeded: {len(DEFAULT_DATASET)} samples -> {filepath}")
        except Exception as e:
            print(f"Error seeding default dataset: {e}")
    
    def _save_trainer_data(self):
        """Save trainer data to files"""
        try:
            datasets_file = APP_DIR / "datasets.json"
            with open(datasets_file, 'w', encoding='utf-8') as f:
                json.dump(self._datasets, f, ensure_ascii=False, indent=2)
            
            models_file = APP_DIR / "trained_models.json"
            with open(models_file, 'w', encoding='utf-8') as f:
                json.dump(self._trained_models, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving trainer data: {e}")

    def load_model_for_training(self, model_id):
        """Load a model for training/chat mode"""
        try:
            if not Llama:
                return {"error": "llama_cpp not installed"}
            
            if model_id.startswith("local_"):
                fname = model_id.split("local_", 1)[1]
                file_path = None
                custom = self.get_setting("local_models_path")
                for d in [MODELS_DIR] + ([Path(custom)] if custom and os.path.isdir(custom) else []):
                    p = Path(d) / fname
                    if p.exists():
                        file_path = p
                        break
                
                if not file_path:
                    return {"error": f"Model file not found: {fname}"}
                
                # Load model with training-friendly settings
                self._trainer_model = Llama(
                    model_path=str(file_path),
                    n_ctx=2048,
                    n_gpu_layers=0,
                    verbose=False,
                    seed=42
                )
                self._trainer_model_path = str(file_path)
                return {"status": "loaded", "model": fname}
            
            return {"error": "Only local models supported for training"}
        except Exception as e:
            return {"error": str(e)}

    def trainer_chat(self, message):
        """Chat with the loaded training model"""
        try:
            if not self._trainer_model:
                return {"error": "No model loaded"}
            
            messages = [{"role": "user", "content": message}]
            response = self._trainer_model.create_chat_completion(
                messages=messages,
                temperature=0.7,
                max_tokens=512
            )
            
            content = response["choices"][0]["message"]["content"]
            return {"response": content}
        except Exception as e:
            return {"error": str(e)}

    def save_training_data(self, messages):
        """Save chat messages as training data"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"training_data_{timestamp}.json"
            filepath = APP_DIR / "training_data" / filename
            filepath.parent.mkdir(exist_ok=True)
            
            # Convert to training format
            training_data = []
            for i in range(0, len(messages) - 1, 2):
                if messages[i]["role"] == "user" and messages[i+1]["role"] == "assistant":
                    training_data.append({
                        "instruction": messages[i]["content"],
                        "response": messages[i+1]["content"]
                    })
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(training_data, f, ensure_ascii=False, indent=2)
            
            # Add to datasets
            dataset_id = f"dataset_{timestamp}"
            self._datasets[dataset_id] = {
                "id": dataset_id,
                "name": f"Training Data {timestamp}",
                "size": len(training_data),
                "format": "alpaca",
                "source": "chat",
                "path": str(filepath)
            }
            self._save_trainer_data()
            
            return {"filename": filename, "samples": len(training_data)}
        except Exception as e:
            return {"error": str(e)}

    def get_datasets(self):
        """Get list of available datasets"""
        return list(self._datasets.values())

    def search_hf_datasets(self, query):
        """Search for datasets on HuggingFace"""
        try:
            from huggingface_hub import HfApi
            api = HfApi()
            results = api.list_datasets(search=query, limit=20)
            datasets = []
            for ds in results:
                datasets.append({
                    "id": ds.id,
                    "description": getattr(ds, 'description', '') or '',
                    "downloads": getattr(ds, 'downloads', 0) or 0
                })
            return datasets
        except Exception as e:
            return {"error": str(e)}

    def download_dataset(self, dataset_id):
        """Download a dataset from HuggingFace with dependency check"""
        try:
            # Check if datasets library is installed
            try:
                from datasets import load_dataset
            except ImportError:
                return {"error": "The 'datasets' library is not installed. Install it with: pip install datasets"}

            self._dispatch('trainer-status', {'message': f'Downloading {dataset_id}...'})

            # Load dataset with progress
            try:
                ds = load_dataset(dataset_id, split='train', streaming=True)
            except Exception as e:
                return {"error": f"Failed to load dataset from HuggingFace: {str(e)}"}

            # Save first 10000 examples with progress updates
            samples = []
            self._dispatch('trainer-status', {'message': 'Downloading samples...', 'phase': 'downloading'})

            for i, example in enumerate(ds):
                if i >= 10000:
                    break
                samples.append(example)
                # Send progress every 100 samples
                if i % 100 == 0 and i > 0:
                    self._dispatch('trainer-status', {
                        'message': f'Downloaded {i} samples...',
                        'phase': 'downloading',
                        'progress': min(100, int(i / 100))
                    })

            if not samples:
                return {"error": "No samples found in dataset"}

            # Save to file
            self._dispatch('trainer-status', {'message': 'Saving to file...', 'phase': 'saving'})
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = dataset_id.replace('/', '_')
            filename = f"{safe_name}_{timestamp}.json"
            filepath = APP_DIR / "datasets" / filename
            filepath.parent.mkdir(exist_ok=True)

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(samples, f, ensure_ascii=False, indent=2)

            # Register dataset
            ds_id = f"hf_{safe_name}_{timestamp}"
            self._datasets[ds_id] = {
                "id": ds_id,
                "name": dataset_id,
                "size": len(samples),
                "format": "huggingface",
                "source": "huggingface",
                "path": str(filepath)
            }
            self._save_trainer_data()

            self._dispatch('trainer-status', {
                'message': f'Dataset downloaded: {len(samples)} samples',
                'phase': 'complete'
            })

            return {"id": ds_id, "samples": len(samples)}
        except Exception as e:
            return {"error": str(e)}

    def preview_dataset(self, dataset_id):
        """Preview first samples of a dataset"""
        try:
            if dataset_id not in self._datasets:
                return {"error": "Dataset not found"}

            ds_info = self._datasets[dataset_id]
            from training_data import load_records, format_record_for_lora
            data = load_records(ds_info["path"])

            samples = []
            for item in data[:5]:
                s = format_record_for_lora(item)
                samples.append((s or str(item))[:300])

            return {"samples": samples}
        except Exception as e:
            return {"error": str(e)}

    def delete_dataset(self, dataset_id):
        """Delete a dataset"""
        try:
            if dataset_id in self._datasets:
                ds_path = self._datasets[dataset_id].get("path")
                if ds_path and os.path.exists(ds_path):
                    os.remove(ds_path)
                del self._datasets[dataset_id]
                self._save_trainer_data()
            return {"status": "deleted"}
        except Exception as e:
            return {"error": str(e)}

    def load_dataset_file(self, filepath):
        """Load a dataset from a local file"""
        try:
            filename = os.path.basename(filepath)
            dataset_id = f"local_{filename.replace('.', '_')}"

            # Copy to datasets folder
            new_path = APP_DIR / "datasets" / filename
            import shutil
            shutil.copy(filepath, new_path)

            # Count records fast for supported dataset formats
            try:
                from training_data import count_records_fast
                size = count_records_fast(str(new_path))
            except Exception:
                size = 0

            ext = Path(filename).suffix.lower()
            if ext == '.csv':
                ds_format = 'csv'
            elif ext == '.jsonl':
                ds_format = 'jsonl'
            else:
                ds_format = 'json'

            self._datasets[dataset_id] = {
                "id": dataset_id,
                "name": filename,
                "size": size,
                "format": ds_format,
                "source": "local",
                "path": str(new_path)
            }
            self._save_trainer_data()

            return {"name": filename, "size": size}
        except Exception as e:
            return {"error": str(e)}

    def load_image_dataset_folder(self, folderpath):
        """Load an image dataset from a local folder"""
        try:
            foldername = os.path.basename(os.path.normpath(folderpath))
            dataset_id = f"local_img_{foldername}"

            # We won't copy the whole folder like we do with files; 
            # image datasets can be huge. We'll reference it directly.
            img_count = 0
            for ext in ('*.png', '*.jpg', '*.jpeg', '*.webp', '*.gif'):
                img_count += len(list(Path(folderpath).rglob(ext)))

            self._datasets[dataset_id] = {
                "id": dataset_id,
                "name": foldername,
                "size": img_count,
                "format": "images",
                "source": "local_folder",
                "path": folderpath
            }
            self._save_trainer_data()

            return {"name": foldername, "size": img_count}
        except Exception as e:
            return {"error": str(e)}

    def get_training_progress(self):
        """Get current training progress"""
        return {
            "progress": self._training_progress,
            "stats": self._training_stats,
            "complete": not self._training_in_progress and self._training_progress >= 100
        }

    def import_model_file(self, filepath, progress_callback=None):
        """Import a model file"""
        try:
            filename = os.path.basename(filepath)
            dest = MODELS_DIR / filename
            
            # Copy file with progress
            import shutil
            shutil.copy(filepath, dest)
            
            if progress_callback:
                progress_callback(100)
            
            return {"name": filename, "path": str(dest)}
        except Exception as e:
            return {"error": str(e)}

    def import_dataset_file(self, filepath, progress_callback=None):
        """Import a dataset file"""
        try:
            return self.load_dataset_file(filepath)
        except Exception as e:
            return {"error": str(e)}

    def export_dataset_file(self, dataset_id, progress_callback=None):
        """Export a dataset to file"""
        try:
            if dataset_id not in self._datasets:
                return {"error": "Dataset not found"}
            
            ds_info = self._datasets[dataset_id]
            export_path = APP_DIR / "exports" / f"{ds_info['name']}.json"
            export_path.parent.mkdir(exist_ok=True)
            
            # Copy file
            import shutil
            shutil.copy(ds_info["path"], export_path)
            
            if progress_callback:
                progress_callback(100)
            
            return {"path": str(export_path)}
        except Exception as e:
            return {"error": str(e)}


    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    # TRAINING API  â€“  ÐµÐ´Ð¸Ð½Ð°Ñ Ñ‚Ð¾Ñ‡ÐºÐ° Ð²Ñ…Ð¾Ð´Ð° Ð´Ð»Ñ UI
    # â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    def ml_runtime_doctor(self):
        missing = []
        optional_missing = []
        compatible = True
        compat_error = ''

        try:
            import torch  # noqa: F401
        except Exception as e:
            missing.append('torch')
            compatible = False
            compat_error = str(e)

        required_files = [
            TRAINING_WORKER_FILE,
            Path(__file__).parent / 'scratch_trainer.py',
            Path(__file__).parent / 'training_data.py',
        ]
        for p in required_files:
            if not p.exists():
                missing.append(p.name)

        return {
            'ready': len(missing) == 0,
            'missing': missing,
            'optional_missing': optional_missing,
            'compatible': compatible,
            'compat_error': compat_error,
        }

    def check_training_dependencies(self, force_recheck=False):
        if not force_recheck and DEPS_CACHE_FILE.exists():
            try:
                with open(DEPS_CACHE_FILE, 'r', encoding='utf-8') as f:
                    cache = json.load(f)
                if cache.get('_schema') == 'scratch_runtime_v1' and _time.time() - cache.get('_ts', 0) < 1800:
                    return {
                        'missing': cache.get('missing', []),
                        'optional_missing': cache.get('optional_missing', []),
                        'ready': cache.get('ready', False),
                        'compatible': cache.get('compatible', False),
                        'compat_error': cache.get('compat_error', ''),
                        'from_cache': True,
                    }
            except Exception:
                pass

        doctor = self.ml_runtime_doctor()
        result = {
            'missing': doctor.get('missing', []),
            'optional_missing': doctor.get('optional_missing', []),
            'ready': doctor.get('ready', False),
            'compatible': doctor.get('compatible', False),
            'compat_error': doctor.get('compat_error', ''),
            'from_cache': False,
        }
        try:
            with open(DEPS_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({'_schema': 'scratch_runtime_v1', '_ts': _time.time(), **result}, f, ensure_ascii=False)
        except Exception:
            pass
        return result

    def _install_training_dependencies_worker(self):
        try:
            self._dispatch('training-status', {'message': 'Checking torch runtime...', 'phase': 'installing_deps'})
            doctor = self.ml_runtime_doctor()
            if doctor.get('ready'):
                self._dispatch('training-deps-result', {
                    'ready': True,
                    'failed': [],
                    'optional_missing': [],
                    'message': 'Training runtime is ready',
                })
                return

            missing = list(doctor.get('missing', []))
            if 'torch' not in missing:
                self._dispatch('training-deps-result', {
                    'ready': False,
                    'failed': missing,
                    'optional_missing': [],
                    'message': 'Missing training files in application directory',
                })
                return

            self._dispatch('training-status', {'message': 'Installing torch in current Python...', 'phase': 'installing_deps'})
            res = subprocess.run(
                [sys.executable, '-m', 'pip', 'install', 'torch', '--prefer-binary'],
                timeout=1800,
                capture_output=True,
                text=True,
            )
            if res.returncode != 0:
                detail = (res.stderr or res.stdout or '').strip()[-1000:]
                self._dispatch('training-deps-result', {
                    'ready': False,
                    'failed': ['torch'],
                    'optional_missing': [],
                    'message': f'Failed to install torch: {detail}',
                })
                return

            try:
                if DEPS_CACHE_FILE.exists():
                    DEPS_CACHE_FILE.unlink()
            except Exception:
                pass

            doctor = self.ml_runtime_doctor()
            self._dispatch('training-deps-result', {
                'ready': doctor.get('ready', False),
                'failed': doctor.get('missing', []),
                'optional_missing': [],
                'message': 'Training runtime is ready' if doctor.get('ready') else (doctor.get('compat_error') or 'Runtime check failed'),
            })
        except Exception as e:
            self._dispatch('training-deps-result', {
                'ready': False,
                'failed': ['install-exception'],
                'optional_missing': [],
                'message': str(e),
            })

    def install_training_dependencies(self):
        threading.Thread(target=self._install_training_dependencies_worker, daemon=True).start()
        return {'status': 'installing'}

    def _normalize_training_config(self, config):
        mode = str(config.get('mode', '')).strip().lower()
        if not mode:
            mode = 'scratch'

        normalized = {
            'mode': mode,
            'name': str(config.get('name', 'trained_model')).strip() or 'trained_model',
            'base_model': str(config.get('base_model') or config.get('baseModel') or '').strip(),
            'dataset_path': str(config.get('dataset_path') or config.get('dataset') or '').strip(),
            'epochs': int(config.get('epochs', 3)),
            'batch_size': int(config.get('batch_size') or config.get('batchSize', 2)),
            'learning_rate': float(config.get('learning_rate') or config.get('lr', 2e-4)),
            'max_length': int(config.get('max_length') or config.get('maxLength', 256)),
            'lora_r': int(config.get('lora_r', 8)),
            'lora_alpha': int(config.get('lora_alpha', 16)),
            'lora_dropout': float(config.get('lora_dropout', 0.05)),
            'quantization': str(config.get('quantization', 'none')).lower(),
            'use_4bit': bool(config.get('use_4bit', False)),
            'use_8bit': bool(config.get('use_8bit', False)),
            'gradient_accumulation': int(config.get('gradient_accumulation', 4)),
            'warmup_ratio': float(config.get('warmup_ratio', 0.03)),
            'weight_decay': float(config.get('weight_decay', 0.01)),
            'lr_scheduler': str(config.get('lr_scheduler', 'linear')),
            'd_model': int(config.get('d_model', 256)),
            'nhead': int(config.get('nhead', 4)),
            'num_enc_layers': int(config.get('num_enc_layers', 3)),
            'num_dec_layers': int(config.get('num_dec_layers', 3)),
            'dim_ff': int(config.get('dim_ff', 512)),
            'dropout': float(config.get('dropout', 0.1)),
            'min_freq': int(config.get('min_freq', 1)),
            'accumulation_steps': int(config.get('accumulation_steps', config.get('gradient_accumulation', 1))),
            'checkpoint_every_epochs': int(config.get('checkpoint_every_epochs', config.get('checkpoint_interval_epochs', 1))),
        }

        if normalized['quantization'] == '4bit':
            normalized['use_4bit'] = True
            normalized['use_8bit'] = False
        elif normalized['quantization'] == '8bit':
            normalized['use_4bit'] = False
            normalized['use_8bit'] = True
        else:
            normalized['use_4bit'] = False
            normalized['use_8bit'] = False

        if normalized['checkpoint_every_epochs'] < 1:
            normalized['checkpoint_every_epochs'] = 1

        return normalized

    def _consume_training_worker_output(self, proc, job):
        saw_terminal_event = False
        worker_log_tail = []
        try:
            for line in proc.stdout:
                line = (line or '').strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except Exception:
                    worker_log_tail.append(line)
                    if len(worker_log_tail) > 8:
                        worker_log_tail = worker_log_tail[-8:]
                    self._dispatch('training-status', {'message': line, 'phase': 'worker_log'})
                    continue

                event = payload.get('event')
                detail = payload.get('detail', {})
                if not event:
                    continue

                if event == 'training-progress':
                    self._training_progress = int(detail.get('progress', 0))
                    self._training_stats = detail
                elif event in ('training-complete', 'training-error'):
                    saw_terminal_event = True
                    self._training_in_progress = False
                    if event == 'training-complete':
                        self._training_progress = 100

                self._dispatch(event, detail)

            rc = proc.wait(timeout=5)
            if not saw_terminal_event and rc != 0:
                self._training_in_progress = False
                msg = f'Training worker exited with code {rc}'
                if worker_log_tail:
                    msg = f'{msg}. Last log: {worker_log_tail[-1][:400]}'
                self._dispatch('training-error', {
                    'error': msg,
                    'worker_logs': worker_log_tail[-5:],
                })
        except Exception as e:
            self._training_in_progress = False
            self._dispatch('training-error', {'error': str(e)})
        finally:
            with self._training_lock:
                self._training_process = None
                self._training_reader_thread = None
                self._training_job = {}

    def start_training(self, config):
        normalized = self._normalize_training_config(config)

        if normalized['mode'] != 'scratch':
            return {'error': 'Only scratch mode is supported in this build'}
        if not normalized['dataset_path']:
            return {'error': 'dataset_path is required'}
        if not Path(normalized['dataset_path']).exists():
            return {'error': f'Dataset file not found: {normalized["dataset_path"]}'}

        with self._training_lock:
            if self._training_process and self._training_process.poll() is None:
                return {'error': 'Training is already running'}

            doctor = self.ml_runtime_doctor()
            if not doctor.get('ready'):
                return {
                    'error': 'ML runtime is not ready. Install dependencies first.',
                    'missing': doctor.get('missing', []),
                    'optional_missing': doctor.get('optional_missing', []),
                    'compat_error': doctor.get('compat_error', ''),
                }

            py = Path(sys.executable)
            if not py.exists():
                return {'error': f'Python executable not found: {sys.executable}'}
            if not TRAINING_WORKER_FILE.exists():
                return {'error': f'Training worker file not found: {TRAINING_WORKER_FILE}'}

            base_name = re.sub(r'[^A-Za-z0-9._-]+', '_', normalized['name']).strip('_') or 'trained_model'
            model_name = base_name
            output_dir = APP_DIR / 'trained_models' / model_name
            if output_dir.exists():
                suffix = datetime.now().strftime('%Y%m%d_%H%M%S')
                model_name = f'{base_name}_{suffix}'
                output_dir = APP_DIR / 'trained_models' / model_name

            job_id = uuid.uuid4().hex[:12]
            stop_file = TRAINING_JOBS_DIR / f'{job_id}.stop'
            job_file = TRAINING_JOBS_DIR / f'{job_id}.json'

            job = {
                'id': job_id,
                'output_dir': str(output_dir),
                'stop_file': str(stop_file),
                'config': {**normalized, 'name': model_name, 'mode': 'scratch'},
            }
            job_file.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding='utf-8')

            cmd = [str(py), str(TRAINING_WORKER_FILE), '--job', str(job_file)]
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1,
            )

            self._training_process = proc
            self._training_job = {
                'id': job_id,
                'job_file': str(job_file),
                'stop_file': str(stop_file),
                'config': job['config'],
                'output_dir': str(output_dir),
            }
            self._training_in_progress = True
            self._training_progress = 0
            self._training_stats = {'step': 0, 'total_steps': 0}

            t = threading.Thread(target=self._consume_training_worker_output, args=(proc, job), daemon=True)
            self._training_reader_thread = t
            t.start()

        self._dispatch('training-status', {'message': 'Training process started', 'phase': 'worker_started'})
        return {'status': 'started', 'job_id': job_id, 'output_dir': str(output_dir), 'name': model_name}

    def start_real_training(self, config):
        return self.start_training(config)

    def stop_training(self):
        with self._training_lock:
            proc = self._training_process
            job = dict(self._training_job or {})

        if not proc or proc.poll() is not None:
            self._training_in_progress = False
            return {'error': 'No active training process'}

        stop_file = Path(job.get('stop_file', ''))
        try:
            if stop_file:
                stop_file.write_text('stop', encoding='utf-8')
        except Exception:
            pass

        self._dispatch('training-status', {'message': 'Stopping training...', 'phase': 'stopping'})

        # Give worker enough time to persist a partial checkpoint after stop request.
        for _ in range(200):
            if proc.poll() is not None:
                break
            _time.sleep(0.1)

        if proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        self._training_in_progress = False
        return {'status': 'stopped'}

    def stop_real_training(self):
        return self.stop_training()

    def get_training_status(self):
        is_running = bool(self._training_process and self._training_process.poll() is None)
        return {
            'is_training': is_running,
            'progress': self._training_progress,
            'stats': self._training_stats,
            'config': (self._training_job or {}).get('config', {}),
            'job_id': (self._training_job or {}).get('id'),
        }

    def _read_model_metadata(self, model_dir: Path):
        metadata = {}
        config = {}
        history = {}

        meta_path = model_dir / 'metadata.json'
        cfg_path = model_dir / 'training_config.json'
        hist_path = model_dir / 'training_history.json'

        try:
            if meta_path.exists():
                metadata = json.loads(meta_path.read_text(encoding='utf-8'))
        except Exception:
            metadata = {}
        try:
            if cfg_path.exists():
                config = json.loads(cfg_path.read_text(encoding='utf-8'))
        except Exception:
            config = {}
        try:
            if hist_path.exists():
                history = json.loads(hist_path.read_text(encoding='utf-8'))
        except Exception:
            history = {}

        return metadata, config, history

    def get_trained_models(self):
        models_dir = APP_DIR / 'trained_models'
        models_dir.mkdir(exist_ok=True)

        result = []
        for d in models_dir.iterdir():
            if not d.is_dir():
                continue

            metadata, cfg, hist = self._read_model_metadata(d)
            final_loss = None
            losses = hist.get('loss') if isinstance(hist, dict) else None
            if isinstance(losses, list) and losses:
                try:
                    final_loss = round(float(losses[-1]), 4)
                except Exception:
                    final_loss = None

            total_size = sum(f.stat().st_size for f in d.rglob('*') if f.is_file())
            size_str = f"{total_size/(1024**3):.2f} GB" if total_size > 1024**3 else f"{total_size/(1024**2):.1f} MB"

            created_ts = metadata.get('created_at')
            if not isinstance(created_ts, (int, float)):
                created_ts = d.stat().st_mtime

            train_mode = (metadata.get('train_mode') or cfg.get('mode') or 'scratch').lower()
            result.append({
                'id': d.name,
                'name': metadata.get('name') or cfg.get('name') or d.name,
                'train_mode': train_mode,
                'base_model': metadata.get('base_model') or cfg.get('base_model', ''),
                'arch': metadata.get('arch', ''),
                'epochs': cfg.get('epochs', '?'),
                'final_loss': final_loss,
                'size': size_str,
                'path': str(d),
                'status': 'ready',
                'created': datetime.fromtimestamp(created_ts).strftime('%Y-%m-%d %H:%M'),
                'created_ts': float(created_ts),
                'history': hist,
                'config': cfg,
                'metadata': metadata,
            })

        result.sort(key=lambda x: x.get('created_ts', 0), reverse=True)
        for item in result:
            item.pop('created_ts', None)
        return result

    def delete_trained_model(self, model_id):
        model_dir = APP_DIR / 'trained_models' / model_id
        if not model_dir.exists():
            return {'error': 'Model not found'}

        try:
            import shutil
            shutil.rmtree(model_dir)
            if self._loaded_trained_model_name == model_id and self._trained_inference_runtime:
                try:
                    self._trained_inference_runtime.unload()
                except Exception:
                    pass
                self._trained_inference_runtime = None
                self._loaded_trained_model_name = None
            return {'status': 'deleted'}
        except Exception as e:
            return {'error': str(e)}

    def export_trained_model(self, model_name, export_format='adapter'):
        model_dir = APP_DIR / 'trained_models' / model_name
        if not model_dir.exists():
            return {'error': 'Model not found'}

        export_dir = APP_DIR / 'exports' / model_name
        export_dir.mkdir(parents=True, exist_ok=True)

        try:
            import shutil
            if export_format == 'merged':
                return {'error': 'Merged export is unavailable in scratch-only build'}

            adapter_path = export_dir / 'adapter'
            shutil.copytree(model_dir, adapter_path, dirs_exist_ok=True)
            return {'status': 'completed', 'path': str(adapter_path), 'format': 'adapter'}
        except Exception as e:
            return {'error': str(e)}

    def load_trained_model_for_inference(self, model_name):
        try:
            models = self.get_trained_models()
            selected = None
            for m in models:
                if m.get('name') == model_name:
                    selected = m
                    break
            if selected is None:
                for m in models:
                    if m.get('id') == model_name:
                        selected = m
                        break
            if selected is None:
                return {'error': f'Trained model not found: {model_name}'}

            target_id = selected.get('id')
            if self._trained_inference_runtime and self._loaded_trained_model_name == target_id:
                return {'status': 'loaded', 'model': target_id, 'mode': self._trained_inference_runtime.mode}

            from trained_inference import TrainedModelRuntime

            runtime = TrainedModelRuntime()
            info = runtime.load_model(selected['path'])
            self._trained_inference_runtime = runtime
            self._loaded_trained_model_name = target_id
            return {'status': 'loaded', 'model': target_id, 'mode': info.get('mode')}
        except Exception as e:
            return {'error': str(e)}

    def generate_with_trained_model(self, prompt, max_tokens=256, temperature=0.7):
        if not self._trained_inference_runtime:
            return {'error': 'No trained model loaded'}
        try:
            text = self._trained_inference_runtime.generate(
                prompt,
                max_tokens=int(max_tokens or 256),
                temperature=float(temperature or 0.7),
            )
            return {'text': text}
        except Exception as e:
            return {'error': str(e)}

    def log_error(self, err):
        print(f"JS ERROR: {err}")


if __name__ == '__main__':
    try:
        print("Starting AIens Enhanced...")
        api = BackendAPI()
        print("Backend API initialized successfully")

        window = webview.create_window(
            title='AIens - Advanced AI Assistant',
            html=HTML_CONTENT,
            js_api=api,
            width=1400, height=900,
            background_color='#0c0c0e',
            frameless=False,
            min_size=(900, 700)
        )
        print("Window created successfully")

        api.set_window(window)
        print("Window API set successfully")

        print("Starting webview...")
        webview.start(debug=False)

    except ImportError as e:
        print(f"Import Error: {e}")
        print("Please install missing dependencies:")
        print("pip install pywebview requests huggingface_hub ddgs openai psutil llama-cpp-python")
        input("Press Enter to exit...")
    except Exception as e:
        print(f"Application Error: {e}")
        traceback.print_exc()
        input("Press Enter to exit...")



