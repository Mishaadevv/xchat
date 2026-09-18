HTML_CONTENT = r"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>AIens</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
<style>
/* ═══════════════════════════════════════════════
   DESIGN TOKENS - DARK & LIGHT THEMES
═══════════════════════════════════════════════ */
:root {
  /* Dark theme (default) */
  --bg:         #08080b;
  --bg2:        #0d0d11;
  --surface:    #111116;
  --surface2:   #18181e;
  --surface3:   #1f1f27;
  --border:     rgba(255,255,255,0.06);
  --border2:    rgba(255,255,255,0.11);
  --border3:    rgba(255,255,255,0.18);
  --text:       #e2e2ec;
  --text2:      #a8a8be;
  --muted:      #5a5a72;
  --accent:     #5b6ef5;
  --accent2:    #818cf8;
  --accent3:    #a5b4fc;
  --glow:       rgba(91,110,245,0.2);
  --green:      #34d399;
  --red:        #f87171;
  --yellow:     #fbbf24;
  --purple:     #a78bfa;
  --r:          12px;
  --r-sm:       8px;
  --r-lg:       18px;
  --r-xl:       24px;
  --shadow-sm:  0 2px 8px rgba(0,0,0,0.3);
  --shadow:     0 4px 20px rgba(0,0,0,0.4);
  --shadow-lg:  0 8px 40px rgba(0,0,0,0.5);
}

/* Light theme */
[data-theme="light"] {
  --bg:         #f8f9fa;
  --bg2:        #e9ecef;
  --surface:    #ffffff;
  --surface2:   #f1f3f5;
  --surface3:   #e9ecef;
  --border:     rgba(0,0,0,0.08);
  --border2:    rgba(0,0,0,0.12);
  --border3:    rgba(0,0,0,0.18);
  --text:       #212529;
  --text2:      #495057;
  --muted:      #6c757d;
  --accent:     #4f46e5;
  --accent2:    #6366f1;
  --accent3:    #818cf8;
  --glow:       rgba(79,70,229,0.15);
  --green:      #10b981;
  --red:        #ef4444;
  --yellow:     #f59e0b;
  --purple:     #8b5cf6;
  --shadow-sm:  0 2px 8px rgba(0,0,0,0.08);
  --shadow:     0 4px 20px rgba(0,0,0,0.1);
  --shadow-lg:  0 8px 40px rgba(0,0,0,0.12);
}

/* ═══════════════════════════════════════════════
   RESET & BASE
═══════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  transition: background 0.3s ease, color 0.3s ease;
}
[v-cloak] { display: none; }
input, textarea, select, button { font-family: inherit; font-size: inherit; color: inherit; }

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--border3); }

/* ═══════════════════════════════════════════════
   ANIMATIONS
═══════════════════════════════════════════════ */
@keyframes fadeIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeSlide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
@keyframes spin      { to{transform:rotate(360deg)} }
@keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0.3} }
@keyframes bounce    { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
@keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.05)} }
@keyframes toast     { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
@keyframes scaleIn   { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
@keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 var(--glow)} 50%{box-shadow:0 0 0 12px transparent} }
@keyframes float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes ripple    { 0%{transform:scale(0);opacity:1} 100%{transform:scale(4);opacity:0} }
@keyframes typing    { 0%,100%{opacity:0.3} 50%{opacity:1} }

/* ═══════════════════════════════════════════════
   LAYOUT
═══════════════════════════════════════════════ */
.app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--bg);
}

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */
.sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  position: relative;
  z-index: 30;
}
.sidebar.collapsed {
  width: 0;
  min-width: 0;
  border-right-color: transparent;
}

/* Sidebar toggle pill */
.sb-toggle {
  position: absolute;
  top: 50%;
  right: -14px;
  transform: translateY(-50%);
  width: 14px;
  height: 60px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-left: none;
  border-radius: 0 10px 10px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  z-index: 31;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}
.sb-toggle:hover { 
  color: var(--text); 
  background: var(--surface3); 
  width: 18px;
  right: -18px;
}
.sidebar.collapsed .sb-toggle { right: -15px; }

/* Sidebar header */
.sb-head {
  padding: 20px 16px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px var(--glow);
  animation: glowPulse 3s ease-in-out infinite;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--text);
}

/* Sidebar search */
.sb-search {
  padding: 12px 14px;
  flex-shrink: 0;
}

/* Sidebar tabs */
.sb-tabs {
  display: flex;
  padding: 0 12px 10px;
  gap: 4px;
  flex-shrink: 0;
}
.sb-tab {
  flex: 1;
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: var(--muted);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sb-tab:hover { color: var(--text2); background: rgba(255,255,255,.04); }
.sb-tab.active { 
  color: var(--accent2); 
  background: var(--glow);
  box-shadow: 0 2px 8px var(--glow);
}

/* Sidebar list */
.sb-list { flex: 1; overflow-y: auto; padding: 6px 10px 10px; }

/* Chat item */
.chat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 2px;
  position: relative;
}
.chat-item:hover { 
  background: rgba(255,255,255,.04); 
  transform: translateX(2px);
}
.chat-item.active {
  background: var(--glow);
  border: 1px solid var(--accent);
}
.chat-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: linear-gradient(180deg, var(--accent), var(--accent2));
  border-radius: 2px;
}
.chat-item-icon { color: var(--muted); flex-shrink: 0; }
.chat-item.active .chat-item-icon { color: var(--accent2); }
.chat-item-title {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text2);
  font-weight: 500;
}
.chat-item.active .chat-item-title { color: var(--text); }
.chat-item-actions {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.chat-item:hover .chat-item-actions,
.chat-item.active .chat-item-actions { opacity: 1; }

/* Model item */
.model-item {
  padding: 12px 14px;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--surface2);
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.model-item:hover { 
  border-color: var(--accent); 
  transform: translateX(4px);
  box-shadow: var(--shadow-sm);
}
.model-item.active { 
  border-color: var(--accent); 
  background: var(--glow);
  box-shadow: 0 0 20px var(--glow);
}
.model-name { font-size: 12px; font-weight: 600; margin-bottom: 8px; line-height: 1.4; word-break: break-word; }
.model-size-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(52,211,153,.12);
  color: var(--green);
  border: 1px solid rgba(52,211,153,.2);
}
.model-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }

/* Sidebar footer */
.sb-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* System stats */
.sb-stats {
  flex-shrink: 0;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.stat-label {
  font-size: 10px;
  color: var(--muted);
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-weight: 500;
}
.stat-bar {
  height: 4px;
  background: rgba(255,255,255,.06);
  border-radius: 3px;
  overflow: hidden;
}
.stat-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* ═══════════════════════════════════════════════
   CHAT AREA
═══════════════════════════════════════════════ */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-width: 0;
  transition: background 0.2s;
}

/* Header */
.chat-header {
  height: 60px;
  background: var(--surface);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 18px;
  gap: 14px;
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 20;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.hdr-model {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-width: 0;
}

.hdr-toggles {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px 12px;
  flex-shrink: 0;
}
.hdr-divider {
  width: 1px;
  height: 16px;
  background: var(--border2);
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.toggle-group:hover { opacity: 0.8; }

.hdr-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════
   MESSAGES
═══════════════════════════════════════════════ */
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 75px 0 220px;
  scroll-behavior: smooth;
}
.msg-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.msg-row {
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.3s ease;
}
.msg-row.user { align-items: flex-end; }
.msg-row.ai   { align-items: flex-start; }

/* AI avatar */
.ai-avatar {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 8px;
  box-shadow: 0 4px 16px var(--glow);
}

/* Bubbles */
.bubble {
  max-width: 75%;
  word-break: break-word;
  line-height: 1.7;
  font-size: 14px;
  position: relative;
}

/* User messages - Gradient bubble */
.bubble.user {
  max-width: 75%;
  border-radius: 20px;
  border-bottom-right-radius: 6px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #fff;
  box-shadow: 0 6px 24px var(--glow), 0 3px 12px rgba(0,0,0,.2);
  word-break: break-word;
  line-height: 1.65;
  font-size: 14px;
  position: relative;
  animation: fadeIn 0.3s ease;
}
.bubble.user::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.12), transparent);
  border-radius: 20px;
  border-bottom-right-radius: 6px;
  pointer-events: none;
}

/* AI messages - Card style with gradient border */
.bubble.ai {
  max-width: 85%;
  border-radius: 20px;
  border-bottom-left-radius: 6px;
  padding: 20px 24px;
  background: var(--surface2);
  border: 2px solid var(--border);
  color: var(--text);
  box-shadow: var(--shadow);
  word-break: break-word;
  line-height: 1.7;
  font-size: 14px;
  position: relative;
  animation: fadeIn 0.3s ease;
}
.bubble.ai::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(135deg, var(--accent), var(--purple), var(--accent));
  background-size: 200% 200%;
  border-radius: 22px;
  border-bottom-left-radius: 8px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s;
}
.bubble.ai:hover::before {
  opacity: 0.5;
  animation: shimmer 3s linear infinite;
}

/* Generating animation */
.bubble.ai.generating {
  border-color: var(--accent);
  animation: aiPulse 2s ease-in-out infinite;
}

/* Allow text selection in AI messages */
.bubble.ai, .bubble.ai * {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}
.bubble.ai .msg-actions, .bubble.ai .msg-actions * {
  user-select: none !important;
  -webkit-user-select: none !important;
}
@keyframes aiPulse {
  0%,100% { box-shadow: 0 4px 20px var(--glow); border-color: var(--border); }
  50% { box-shadow: 0 8px 32px var(--glow); border-color: var(--accent); }
}

/* Edit form */
.edit-form {
  width: 100%;
  max-width: 80%;
}
.edit-textarea {
  width: 100%;
  background: var(--surface2);
  border: 2px solid var(--accent);
  border-radius: var(--r);
  padding: 14px;
  color: var(--text);
  resize: none;
  outline: none;
  font-family: inherit;
  font-size: 14px;
  min-height: 100px;
  box-shadow: 0 0 0 4px var(--glow);
  transition: all 0.2s;
}
.edit-textarea:focus {
  box-shadow: 0 0 0 6px var(--glow);
}

/* Message meta */
.msg-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 0 6px;
}
.msg-time { font-size: 11px; color: var(--muted); }
.msg-tok  { 
  font-size: 10px; 
  color: var(--muted); 
  background: var(--surface2); 
  padding: 3px 8px; 
  border-radius: 6px;
  border: 1px solid var(--border);
}
.msg-actions { 
  display: flex; 
  gap: 4px; 
  opacity: 0; 
  transition: opacity 0.2s; 
}
.msg-row:hover .msg-actions { opacity: 1; }

/* Typing dots */
.dots {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}
.dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: bounce 1.4s ease-in-out infinite;
}
.dots span:nth-child(2) { animation-delay: .2s; }
.dots span:nth-child(3) { animation-delay: .4s; }

/* ═══════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  gap: 20px;
  text-align: center;
  min-height: 400px;
}
.empty-icon {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, var(--glow), rgba(167,139,250,.1));
  border: 2px solid var(--accent);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: float 3s ease-in-out infinite;
  box-shadow: 0 8px 32px var(--glow);
}
.empty-title { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
.empty-sub   { font-size: 14px; color: var(--text2); }
.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 12px;
  max-width: 580px;
}
.qprompt {
  padding: 10px 16px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 99px;
  font-size: 13px;
  color: var(--text2);
  cursor: pointer;
  transition: all 0.2s;
}
.qprompt:hover {
  border-color: var(--accent);
  color: var(--text);
  background: var(--glow);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.kb-hints { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.kb-hint {
  font-size: 11px;
  color: var(--muted);
  background: var(--surface2);
  border: 1px solid var(--border);
  padding: 5px 10px;
  border-radius: 6px;
}

/* ═══════════════════════════════════════════════
   TOOL STRIP
═══════════════════════════════════════════════ */
.tool-strip {
  position: absolute;
  z-index: 15;
  display: flex;
  flex-direction: column;
  gap: 6px;
  bottom: 195px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 900px;
}
.tool-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text2);
  backdrop-filter: blur(12px);
  animation: fadeIn 0.3s ease;
  box-shadow: var(--shadow);
}

/* ═══════════════════════════════════════════════
   INPUT AREA - ENHANCED DESIGN
═══════════════════════════════════════════════ */
.input-area {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: linear-gradient(to top, var(--bg) 85%, transparent);
  padding: 16px 20px 20px;
  z-index: 10;
}
.input-wrap { max-width: 900px; margin: 0 auto; }
.input-box {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--surface);
  border: 2px solid var(--border2);
  border-radius: 28px;
  padding: 10px 10px 10px 16px;
  transition: all 0.3s;
  box-shadow: var(--shadow-lg);
  position: relative;
}
.input-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--glow), var(--shadow-lg);
  transform: translateY(-2px);
}
.input-box textarea {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  resize: none;
  max-height: 200px;
  min-height: 44px;
  padding: 8px 0;
  color: var(--text);
  line-height: 1.6;
  font-size: 15px;
}
.input-box textarea::placeholder { color: var(--muted); }

.input-actions-left { 
  display: flex; 
  align-items: center; 
  gap: 4px; 
  flex-shrink: 0; 
  align-self: flex-end; 
  padding-bottom: 4px; 
}
.input-actions-right { 
  display: flex; 
  align-items: center; 
  gap: 4px; 
  flex-shrink: 0; 
  align-self: flex-end; 
  padding-bottom: 4px; 
}

.input-foot {
  max-width: 900px;
  margin: 8px auto 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
  color: var(--muted);
}
.tok-meter {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tok-bar {
  width: 70px;
  height: 4px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.tok-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s, background 0.3s;
}
.input-hints { display: flex; align-items: center; gap: 10px; }
.input-hint-key {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 2px 6px;
  font-size: 10px;
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
}

/* Input action buttons */
.iact {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.iact::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.2s;
}
.iact:hover::after { opacity: 1; }
.iact.attach {
  background: var(--surface2);
  color: var(--muted);
}
.iact.attach:hover { 
  background: var(--surface3); 
  color: var(--text2); 
  transform: scale(1.05);
}
.iact.voice {
  background: var(--surface2);
  color: var(--muted);
}
.iact.voice:hover { 
  background: rgba(167,139,250,.15); 
  color: var(--purple); 
  transform: scale(1.05);
}
.iact.voice.active { 
  background: rgba(248,113,113,.15); 
  color: var(--red); 
  animation: pulse 1.5s ease-in-out infinite;
}
.iact.clear-btn {
  background: var(--surface2);
  color: var(--muted);
}
.iact.clear-btn:hover { 
  background: rgba(248,113,113,.12); 
  color: var(--red); 
  transform: scale(1.05);
}
.iact.send {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #fff;
  box-shadow: 0 4px 16px var(--glow);
  width: 44px;
  height: 44px;
  border-radius: 14px;
}
.iact.send:hover { 
  filter: brightness(1.15); 
  transform: scale(1.08);
  box-shadow: 0 6px 24px var(--glow);
}
.iact.send:disabled { 
  background: var(--surface3); 
  color: var(--muted); 
  box-shadow: none; 
  transform: none; 
  filter: none;
  cursor: not-allowed;
}
.iact.stop { 
  background: rgba(248,113,113,.12); 
  color: var(--red); 
  border: 1px solid rgba(248,113,113,.2); 
  width: 44px; 
  height: 44px; 
  border-radius: 14px;
  animation: pulse 1.5s ease-in-out infinite;
}
.iact.stop:hover { 
  background: rgba(248,113,113,.22); 
  transform: scale(1.05);
}

/* Status */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
}
.status-dot.gen { 
  background: var(--accent); 
  animation: blink 1s infinite;
  box-shadow: 0 0 12px var(--accent);
}

/* ═══════════════════════════════════════════════
   PRIMITIVES
═══════════════════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r-sm);
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.15s;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}
.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.2s;
}
.btn:hover::after { opacity: 1; }
.btn:active { transform: scale(0.97); }
.btn-p {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #fff;
  box-shadow: 0 4px 16px var(--glow);
}
.btn-p:hover { 
  filter: brightness(1.12); 
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--glow);
}
.btn-g {
  background: var(--surface2);
  color: var(--text2);
  border: 1px solid var(--border2);
}
.btn-g:hover { 
  background: var(--surface3); 
  color: var(--text);
  border-color: var(--border3);
}
.btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }
.btn-xs { padding: 5px 10px; font-size: 11px; border-radius: 6px; }

.icon-btn {
  background: none;
  border: none;
  color: var(--muted);
  border-radius: var(--r-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
}
.icon-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.2s;
}
.icon-btn:hover { 
  color: var(--text); 
  background: rgba(255,255,255,.06);
}
.icon-btn:hover::after { opacity: 1; }
.icon-btn:active { transform: scale(0.92); }

.field {
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: var(--r-sm);
  padding: 10px 13px;
  color: var(--text);
  width: 100%;
  outline: none;
  transition: all 0.2s;
}
.field:focus { 
  border-color: var(--accent); 
  box-shadow: 0 0 0 3px var(--glow);
}
.field::placeholder { color: var(--muted); }
select.field {
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235a5a72' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
  cursor: pointer;
}
select.field option { background: var(--surface); }

.tgl {
  width: 36px;
  height: 18px;
  background: var(--surface3);
  border: 1px solid var(--border2);
  border-radius: 99px;
  position: relative;
  flex-shrink: 0;
  transition: .25s;
  cursor: pointer;
}
.tgl::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--muted);
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: .25s;
}
.tgl.on { 
  background: var(--accent); 
  border-color: var(--accent);
  box-shadow: 0 0 12px var(--glow);
}
.tgl.on::after { 
  transform: translateX(18px); 
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.badge {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.badge-blue   { background: var(--glow); color: var(--accent2); }
.badge-green  { background: rgba(52,211,153,.12); color: var(--green); }
.badge-muted  { background: var(--surface3); color: var(--text2); }

/* ═══════════════════════════════════════════════
   MARKDOWN
═══════════════════════════════════════════════ */
.md p { margin: 0 0 .7em; }
.md p:last-child { margin: 0; }
.md a { color: var(--accent2); text-decoration: none; font-weight: 500; }
.md a:hover { text-decoration: underline; }
.md strong { font-weight: 800; color: var(--accent2); text-shadow: 0 0 8px var(--glow); background: rgba(129, 140, 248, 0.1); padding: 0 4px; border-radius: 4px; }
.md em { font-style: italic; color: var(--text2); }
.md ul, .md ol { margin: .6em 0 .6em 1.6em; }
.md li { margin-bottom: .4em; line-height: 1.7; }
.md h1, .md h2, .md h3 { font-weight: 700; margin: 1em 0 .5em; color: var(--text); }
.md h1 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: .4em; }
.md h2 { font-size: 1.3em; }
.md h3 { font-size: 1.15em; }
.md blockquote {
  border-left: 3px solid var(--accent);
  padding: .5em 1.2em;
  color: var(--text2);
  margin: .8em 0;
  background: var(--glow);
  border-radius: 0 10px 10px 0;
  font-style: italic;
}
.md code {
  font-family: 'JetBrains Mono', monospace;
  font-size: .88em;
  background: var(--surface3);
  color: var(--accent3);
  padding: 3px 8px;
  border-radius: 6px;
}
.md table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.md th, .md td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
.md th { font-weight: 600; color: var(--accent2); background: var(--glow); }
.md tr:hover { background: rgba(255,255,255,.02); }

/* Code blocks */
.code-frame {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin: 1.2em 0;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}
.code-frame pre {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
}
.code-frame code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  display: block;
  line-height: 1.6;
  overflow-x: auto;
  padding: 16px 18px;
  background: transparent;
}

.code-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  gap: 12px;
}
.mac-dots {
  display: flex;
  gap: 6px;
  margin-right: 8px;
}
.mac-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.mac-dots span:nth-child(1) { background: #ff5f56; box-shadow: 0 0 6px rgba(255,95,86,0.5); }
.mac-dots span:nth-child(2) { background: #ffbd2e; box-shadow: 0 0 6px rgba(255,189,46,0.5); }
.mac-dots span:nth-child(3) { background: #27c93f; box-shadow: 0 0 6px rgba(39,201,63,0.5); }

.code-lang {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--accent2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: auto;
}
.code-copy {
  font-size: 11px;
  padding: 5px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--text2);
  cursor: pointer;
  transition: all .2s;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-weight: 600;
}
.code-copy:hover { 
  background: rgba(255,255,255,0.1); 
  color: var(--text);
  border-color: var(--border3);
  transform: translateY(-1px);
}
.code-copy:active {
  transform: translateY(1px);
}
.code-copy.copied { 
  background: rgba(16,185,129,0.15); 
  border-color: rgba(16,185,129,0.3); 
  color: var(--green); 
}


/* ═══════════════════════════════════════════════
   THINKING BLOCK - ENHANCED DESIGN
═══════════════════════════════════════════════ */
.think-block {
  margin: 1.2em 0;
  border-radius: 18px;
  overflow: hidden;
  border: 2px solid rgba(251,191,36,.4);
  background: linear-gradient(135deg, rgba(251,191,36,.1), rgba(245,158,11,.05));
  box-shadow: 0 8px 32px rgba(251,191,36,.2), inset 0 1px 0 rgba(255,255,255,.1);
  position: relative;
  backdrop-filter: blur(10px);
}
.think-block::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24);
  background-size: 200% 100%;
}
.think-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  background: linear-gradient(90deg, rgba(251,191,36,.2), rgba(245,158,11,.1));
  cursor: pointer;
  transition: all .2s;
  border-bottom: 2px solid rgba(251,191,36,.25);
}
.think-header:hover {
  background: linear-gradient(90deg, rgba(251,191,36,.3), rgba(245,158,11,.2));
}
.think-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(251,191,36,.4);
  flex-shrink: 0;
}
.think-icon svg {
  width: 18px;
  height: 18px;
  color: #fff;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.3));
}
.think-title {
  font-size: 14px;
  font-weight: 700;
  color: #fbbf24;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(0,0,0,.2);
  display: flex;
  align-items: center;
  gap: 10px;
}
.think-arrow {
  margin-left: auto;
  color: #fbbf24;
  opacity: .8;
  transition: transform .2s;
  flex-shrink: 0;
}
.think-block[open] .think-arrow {
  transform: rotate(180deg);
}
.think-content {
  padding: 20px 24px;
  color: #ff4444;
  font-size: 13px;
  line-height: 1.9;
  background: rgba(255,68,68,.08);
  font-style: italic;
  border-top: 1px solid rgba(255,68,68,.25);
  text-shadow: 0 0 20px rgba(255,68,68,.3);
}
.think-content strong {
  color: #ff6666;
}
.think-content em {
  color: #ff5555;
}

/* Active thinking animation */
.think-active {
  border-color: rgba(251,191,36,.8);
  animation: thinkPulse 2s ease-in-out infinite;
  box-shadow: 0 12px 40px rgba(251,191,36,.4), inset 0 1px 0 rgba(255,255,255,.15);
}
.think-active::before {
  animation: shimmer 2s linear infinite;
}
.think-active .think-header {
  background: linear-gradient(90deg, rgba(251,191,36,.4), rgba(245,158,11,.3));
}
.think-active .think-icon {
  animation: thinkSpin 3s linear infinite;
  box-shadow: 0 4px 24px rgba(251,191,36,.6);
}
.think-active .think-title {
  animation: thinkGlow 2s ease-in-out infinite;
}

@keyframes thinkPulse {
  0%,100% {
    border-color: rgba(251,191,36,.8);
    box-shadow: 0 12px 40px rgba(251,191,36,.4);
  }
  50% {
    border-color: #fbbf24;
    box-shadow: 0 16px 48px rgba(251,191,36,.6);
  }
}
@keyframes thinkGlow {
  0%,100% {
    color: #fbbf24;
    text-shadow: 0 2px 4px rgba(0,0,0,.2);
  }
  50% {
    color: #fde68a;
    text-shadow: 0 0 16px rgba(251,191,36,.8);
  }
}
@keyframes thinkSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Thinking dots */
.think-dots {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}
.think-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fbbf24;
  animation: typing 1.4s ease-in-out infinite;
}
.think-dots span:nth-child(2) { animation-delay: 0.2s; }
.think-dots span:nth-child(3) { animation-delay: 0.4s; }

/* ═══════════════════════════════════════════════
   AI THINKING OVERLAY - NEW!
═══════════════════════════════════════════════ */
.thinking-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,.85);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}
.thinking-box {
  background: var(--surface);
  border: 2px solid var(--accent);
  border-radius: 24px;
  padding: 40px 50px;
  text-align: center;
  box-shadow: 0 24px 80px var(--glow), 0 0 0 1px var(--glow);
  animation: scaleIn 0.4s ease;
  max-width: 420px;
  width: 90%;
}
.thinking-brain {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  position: relative;
}
.thinking-brain svg {
  width: 100%;
  height: 100%;
  animation: brainPulse 2s ease-in-out infinite;
}
@keyframes brainPulse {
  0%,100% { transform: scale(1); filter: drop-shadow(0 0 20px var(--accent)); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 40px var(--accent2)); }
}
.thinking-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
  background: linear-gradient(90deg, var(--accent), var(--accent2), var(--purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.thinking-subtitle {
  font-size: 14px;
  color: var(--text2);
  margin-bottom: 28px;
  line-height: 1.6;
}
.thinking-progress {
  width: 100%;
  height: 6px;
  background: var(--surface2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 20px;
}
.thinking-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent2), var(--purple));
  background-size: 200% 100%;
  border-radius: 3px;
  animation: progressMove 2s linear infinite, shimmer 2s linear infinite;
  width: 60%;
}
@keyframes progressMove {
  0% { width: 30%; margin-left: 0; }
  50% { width: 60%; margin-left: 20%; }
  100% { width: 30%; margin-left: 70%; }
}
.thinking-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.thinking-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  animation: bounce 1.4s ease-in-out infinite;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

/* ═══════════════════════════════════════════════
   AI TRAINER MENU - NEW!
═══════════════════════════════════════════════ */
.trainer-menu-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #10b981, #34d399);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 24px rgba(16,185,129,.4);
  z-index: 50;
  transition: all 0.3s;
}
.trainer-menu-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 32px rgba(16,185,129,.5);
}
.trainer-menu-btn svg {
  width: 26px;
  height: 26px;
  color: #fff;
}
.trainer-menu-btn::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px solid rgba(16,185,129,.3);
  border-radius: 50%;
  animation: trainerPulse 2s ease-in-out infinite;
}
@keyframes trainerPulse {
  0%,100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.5; }
}

.trainer-modal {
  max-width: 1100px !important;
}

.trainer-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 16px;
}
.trainer-tab {
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  background: none;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.trainer-tab:hover { color: var(--text); background: rgba(255,255,255,.04); }
.trainer-tab.active { 
  color: #10b981; 
  background: rgba(16,185,129,.12);
  box-shadow: 0 2px 12px rgba(16,185,129,.2);
}

.trainer-section {
  display: none;
}
.trainer-section.active {
  display: block;
  animation: fadeIn 0.3s ease;
}

/* Chat section */
.trainer-chat-area {
  display: flex;
  flex-direction: column;
  height: 500px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
}
.trainer-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg);
}
.trainer-chat-input-area {
  padding: 12px 16px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  gap: 10px;
}
.trainer-chat-input {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 12px;
  padding: 10px 14px;
  color: var(--text);
  outline: none;
  resize: none;
  min-height: 44px;
  max-height: 120px;
}
.trainer-chat-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,.15);
}
.trainer-msg {
  margin-bottom: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  max-width: 85%;
  animation: fadeIn 0.2s ease;
}
.trainer-msg.user {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: #fff;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}
.trainer-msg.ai {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}
.trainer-msg-label {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
  opacity: 0.8;
}

/* Training section */
.trainer-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.trainer-config-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
}
.trainer-config-item label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
  font-weight: 500;
}
.trainer-config-item input,
.trainer-config-item select {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 13px;
}
.trainer-config-item input:focus,
.trainer-config-item select:focus {
  border-color: #10b981;
  outline: none;
}

.trainer-progress-area {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px;
  margin-top: 20px;
}
.trainer-progress-bar {
  height: 10px;
  background: var(--bg);
  border-radius: 5px;
  overflow: hidden;
  margin: 12px 0;
}
.trainer-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 5px;
  transition: width 0.5s ease;
  box-shadow: 0 0 12px rgba(16,185,129,.4);
}
.trainer-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.trainer-stat {
  text-align: center;
  padding: 12px;
  background: var(--bg);
  border-radius: 10px;
}
.trainer-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #10b981;
}
.trainer-stat-label {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

/* Datasets section */
.dataset-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dataset-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  transition: all 0.2s;
}
.dataset-item:hover {
  border-color: #10b981;
  background: rgba(16,185,129,.05);
}
.dataset-icon {
  width: 44px;
  height: 44px;
  background: rgba(16,185,129,.12);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
}
.dataset-info {
  flex: 1;
}
.dataset-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 3px;
}
.dataset-meta {
  font-size: 12px;
  color: var(--muted);
}
.dataset-actions {
  display: flex;
  gap: 6px;
}

/* Import/Export section */
.ie-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.ie-card {
  background: var(--surface2);
  border: 2px dashed var(--border2);
  border-radius: var(--r);
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}
.ie-card:hover {
  border-color: #10b981;
  background: rgba(16,185,129,.05);
}
.ie-card-icon {
  width: 60px;
  height: 60px;
  background: rgba(16,185,129,.12);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #10b981;
}
.ie-card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.ie-card-desc {
  font-size: 13px;
  color: var(--muted);
}

/* Model list in trainer */
.trainer-model-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}
.trainer-model-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  cursor: pointer;
  transition: all 0.2s;
}
.trainer-model-item:hover {
  border-color: var(--accent);
}
.trainer-model-item.active {
  border-color: #10b981;
  background: rgba(16,185,129,.08);
}
.trainer-model-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--muted);
}
.trainer-model-status.trained {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}
.trainer-model-status.training {
  background: var(--yellow);
  animation: blink 1s infinite;
}

/* ═══════════════════════════════════════════════
   DOWNLOAD ITEM
═══════════════════════════════════════════════ */
.dl-item {
  padding: 12px 14px;
  border-radius: var(--r);
  border: 1px solid rgba(91,110,245,.25);
  background: var(--glow);
  margin-bottom: 6px;
}
.dl-bar { 
  height: 4px; 
  background: var(--border); 
  border-radius: 3px; 
  overflow: hidden; 
  margin-top: 8px; 
}
.dl-fill { 
  height: 100%; 
  background: linear-gradient(90deg, var(--accent), var(--accent2)); 
  border-radius: 3px; 
  transition: width .3s;
  box-shadow: 0 0 8px var(--glow);
}

/* ═══════════════════════════════════════════════
   OVERLAYS & MODALS
═══════════════════════════════════════════════ */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0,0,0,.75);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--border2);
  width: 100%;
  max-height: 90vh;
  border-radius: var(--r-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: scaleIn .25s ease;
  box-shadow: var(--shadow-lg);
}
.modal-sm { max-width: 540px; }
.modal-lg { max-width: 960px; }

.modal-head {
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}
.modal-body { flex: 1; overflow-y: auto; padding: 22px; }
.modal-foot {
  padding: 16px 22px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.modal-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 14px;
}
.modal-tab {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  background: none;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all .15s;
}
.modal-tab:hover { color: var(--text); background: rgba(255,255,255,.04); }
.modal-tab.active { 
  color: var(--accent2); 
  background: var(--glow);
  box-shadow: 0 2px 8px var(--glow);
}

.form-section { margin-bottom: 24px; }
.form-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--muted);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.perm-card {
  padding: 14px 16px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all .15s;
}
.perm-card:hover { 
  border-color: var(--border2); 
  background: var(--surface3);
}
.perm-title { font-size: 13px; font-weight: 600; }
.perm-sub   { font-size: 11px; color: var(--muted); margin-top: 3px; }

/* Model hub */
.mh-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.mh-cat {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 99px;
  cursor: pointer;
  transition: all .15s;
}
.mh-cat:hover { border-color: var(--border2); color: var(--text); }
.mh-cat.active { 
  background: linear-gradient(135deg, var(--accent), var(--accent2)); 
  border-color: var(--accent); 
  color: #fff;
  box-shadow: 0 4px 16px var(--glow);
}
.mh-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap: 14px; }
.mh-card {
  padding: 16px 18px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all .2s;
}
.mh-card:hover { 
  border-color: var(--accent); 
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}
.mh-card-name { font-size: 13px; font-weight: 700; line-height: 1.4; }
.mh-card-desc { font-size: 12px; color: var(--text2); line-height: 1.5; }
.mh-card-meta { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }

/* Templates panel */
.tpl-panel {
  position: absolute;
  top: 60px; right: 0; bottom: 0;
  width: 320px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  z-index: 18;
  transform: translateX(100%);
  transition: transform .3s cubic-bezier(0.4,0,0.2,1);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 32px rgba(0,0,0,.4);
}
.tpl-panel.open { transform: translateX(0); }
.tpl-item {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: all .15s;
}
.tpl-item:hover { 
  background: rgba(255,255,255,.03);
  padding-left: 20px;
}
.tpl-name { font-size: 13px; font-weight: 600; margin-bottom: 5px; }
.tpl-preview { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Toasts */
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  width: 320px;
}
.toast {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r);
  padding: 12px 16px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: toast .25s ease;
  pointer-events: all;
  box-shadow: var(--shadow-lg);
}
.toast.success { border-color: rgba(52,211,153,.4); }
.toast.error   { border-color: rgba(248,113,113,.4); }
.toast-dot { 
  width: 8px; 
  height: 8px; 
  border-radius: 50%; 
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}
.toast.success .toast-dot { background: var(--green); color: var(--green); }
.toast.error   .toast-dot { background: var(--red); color: var(--red); }
.toast.info    .toast-dot { background: var(--accent); color: var(--accent); }

/* Search results */
.search-result {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all .15s;
}
.search-result:hover { 
  border-color: var(--accent); 
  background: var(--glow);
  transform: translateX(4px);
}

/* Stats cards */
.stat-card {
  padding: 24px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  text-align: center;
  transition: all .2s;
}
.stat-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}
.stat-num { font-size: 32px; font-weight: 800; }
.stat-name { font-size: 12px; color: var(--muted); margin-top: 6px; font-weight: 500; }

/* ═══════════════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════════════ */
@media (max-width: 900px) {
  .sidebar {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    z-index: 50;
    box-shadow: 4px 0 32px rgba(0,0,0,.5);
  }
  .sidebar.collapsed { transform: translateX(-100%); width: 280px; min-width: 280px; }
  .tpl-panel { width: 100%; }
}
@media (max-width: 500px) {
  .form-grid { grid-template-columns: 1fr; }
  .mh-grid { grid-template-columns: 1fr; }
  .bubble.user, .bubble.ai { max-width: 92%; }
  .input-box { border-radius: 20px; padding: 8px 8px 8px 12px; }
}

/* Training Chart */
.training-chart {
  background: var(--surface2);
  border-radius: var(--r);
  padding: 20px;
  margin-bottom: 20px;
}

.training-chart canvas {
  width: 100%;
  height: 100%;
}

/* Training Status */
.training-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--glow);
  border: 1px solid var(--accent);
  border-radius: 99px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent2);
}

.training-status-badge.training {
  animation: pulse 2s infinite;
}

/* Quantization Options */
.quant-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.quant-option:hover {
  border-color: var(--border2);
}

.quant-option input:checked + span {
  color: var(--accent2);
  font-weight: 600;
}

.quant-option:has(input:checked) {
  border-color: var(--accent);
  background: var(--glow);
}
</style>
</head>
<body>
<div id="app" v-cloak class="app">

  <!-- AI Thinking Overlay -->
  <div v-if="showThinkingOverlay && isGen" class="thinking-overlay" @click.self="showThinkingOverlay=false">
    <div class="thinking-box">
      <div class="thinking-brain">
        <svg viewBox="0 0 24 24" fill="none" stroke="url(#brainGrad)" stroke-width="1.5">
          <defs>
            <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#5b6ef5"/>
              <stop offset="50%" style="stop-color:#818cf8"/>
              <stop offset="100%" style="stop-color:#a78bfa"/>
            </linearGradient>
          </defs>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M12 6v12M6 12h12"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
      </div>
      <div class="thinking-title">ИИ размышляет</div>
      <div class="thinking-subtitle">{{ thinkingMessage }}</div>
      <div class="thinking-progress">
        <div class="thinking-progress-bar"></div>
      </div>
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  </div>

  <!-- Toasts -->
  <div class="toast-stack">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
      <div class="toast-dot"></div>
      <span>{{ t.msg }}</span>
    </div>
  </div>

  <!-- ═══════════════ SIDEBAR ═══════════════ -->
  <aside class="sidebar" :class="{collapsed: sidebarCollapsed}">
    <button class="sb-toggle" @click="sidebarCollapsed=!sidebarCollapsed" :title="sidebarCollapsed?'Открыть':'Закрыть'">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path v-if="sidebarCollapsed" d="M9 18l6-6-6-6"/>
        <path v-else d="M15 18l-6-6 6-6"/>
      </svg>
    </button>

    <div class="sb-head">
      <div class="logo">
        <div class="logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <span class="logo-text">AIens</span>
      </div>
      <div style="display:flex;gap:6px">
        <button v-if="currentChatId" @click="clearCurrentChat" class="icon-btn" title="Очистить чат">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
        </button>
        <button @click="newChat" class="btn btn-p btn-sm" style="padding:7px 12px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14m-7-7h14"/></svg>
        </button>
      </div>
    </div>

    <div class="sb-search">
      <input v-model="chatSearch" placeholder="Поиск чатов..." class="field" style="font-size:13px;padding:8px 12px">
    </div>

    <div class="sb-tabs">
      <button v-for="t in ['chats','models','history']" :key="t"
        @click="activeTab=t" class="sb-tab" :class="{active:activeTab===t}">
        {{ t==='chats'?'Чаты':t==='models'?'Модели':'История' }}
      </button>
    </div>

    <div class="sb-list" :key="'list-'+listKey">
      <!-- Chats tab -->
      <template v-if="activeTab==='chats'">
        <div v-if="!filteredChats.length" style="padding:28px;text-align:center;font-size:13px;color:var(--muted)">Нет чатов</div>
        <div v-for="c in filteredChats" :key="c.id" class="chat-item" :class="{active:currentChatId===c.id}" @click="selectChat(c.id)">
          <svg class="chat-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="c.pinned" d="M12 17v5m-4-2h8M8 3l4 8 4-8"/>
            <path v-else d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span class="chat-item-title">{{ c.title }}</span>
          <div class="chat-item-actions">
            <button @click.stop="togglePin(c.id)" class="icon-btn" style="padding:3px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="c.pinned?'var(--yellow)':'currentColor'" stroke-width="2"><path d="M12 17v5m-4-2h8M8 3l4 8 4-8"/></svg>
            </button>
            <button @click.stop="deleteChat(c.id)" class="icon-btn" style="padding:3px;color:var(--red)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </template>

      <!-- Models tab -->
      <template v-if="activeTab==='models'">
        <div v-if="!localModels.length" style="padding:28px;text-align:center;font-size:13px;color:var(--muted)">
          Нет моделей<br><span style="opacity:.5;font-size:12px">Откройте Model Hub</span>
        </div>
        <div v-for="m in localModels" :key="m.id" class="model-item" :class="{active:m.id===selectedModel}" @click="selectedModel=m.id">
          <div class="model-name">{{ m.name }}</div>
          <div class="model-meta">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <span class="model-size-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                {{ m.size }}
              </span>
              <span v-if="m.quant" class="badge badge-muted">{{ m.quant }}</span>
              <span v-if="m.id===selectedModel" class="badge badge-green">Активна</span>
            </div>
            <button @click.stop="deleteModel(m.id)" class="icon-btn" style="color:var(--red);padding:3px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
            </button>
          </div>
        </div>
        <div v-for="(dl,id) in activeDownloads" :key="id" class="dl-item">
          <div style="font-size:12px;color:var(--accent2);font-weight:600">{{ dl.text }}</div>
          <div class="dl-bar"><div class="dl-fill" :style="{width:dl.percent+'%'}"></div></div>
        </div>
      </template>

      <!-- History tab -->
      <template v-if="activeTab==='history'">
        <div v-if="!cmdHistory.length" style="padding:28px;text-align:center;font-size:13px;color:var(--muted)">Нет истории</div>
        <div v-for="(h,i) in cmdHistory" :key="i" class="chat-item" @click="useHistory(h)">
          <svg class="chat-item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span class="chat-item-title">{{ h.substring(0,46) }}{{ h.length>46?'...':'' }}</span>
        </div>
      </template>
    </div>

    <div class="sb-footer">
      <button @click="hubOpen=true" class="btn btn-g btn-sm" style="width:100%;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
        Model Hub
      </button>
      <button @click="settingsOpen=true" class="btn btn-g btn-sm" style="width:100%;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        Настройки
      </button>
    </div>

    <div class="sb-stats">
      <div>
        <div class="stat-label"><span>CPU</span><span>{{sys.cpu}}%</span></div>
        <div class="stat-bar"><div class="stat-fill" style="background:linear-gradient(90deg,var(--accent),var(--accent2))" :style="{width:sys.cpu+'%'}"></div></div>
      </div>
      <div>
        <div class="stat-label"><span>RAM</span><span>{{sys.ram}}%</span></div>
        <div class="stat-bar"><div class="stat-fill" style="background:linear-gradient(90deg,var(--green),#6ee7b7)" :style="{width:sys.ram+'%'}"></div></div>
      </div>
      <div v-if="sys.gpu!==null">
        <div class="stat-label"><span>GPU</span><span>{{sys.gpu}}%</span></div>
        <div class="stat-bar"><div class="stat-fill" style="background:linear-gradient(90deg,var(--purple),#c4b5fd)" :style="{width:sys.gpu+'%'}"></div></div>
      </div>
      <div v-if="sys.disk!==null">
        <div class="stat-label"><span>Disk</span><span>{{sys.disk}}%</span></div>
        <div class="stat-bar"><div class="stat-fill" style="background:linear-gradient(90deg,var(--yellow),#fcd34d)" :style="{width:sys.disk+'%'}"></div></div>
      </div>
    </div>
  </aside>

  <!-- ═══════════════ CHAT AREA ═══════════════ -->
  <div class="chat-area">

    <!-- Header -->
    <header class="chat-header">
      <div class="hdr-model">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6m-6 4h6m-6 4h4"/></svg>
        <select v-model="selectedModel" class="field" style="padding:6px 28px 6px 10px;font-size:13px;flex:1;min-width:0;max-width:280px">
          <optgroup label="☁ API">
            <option v-for="m in apiModels" :value="m.id" :key="m.id">{{ m.name }}</option>
          </optgroup>
          <optgroup label="💻 Локальные">
            <option v-for="m in localModels" :value="m.id" :key="m.id">{{ m.name.replace('.gguf','') }} — {{ m.size }}</option>
          </optgroup>
          <optgroup label="🎓 Обученные" v-if="trainedModelsList.length">
            <option v-for="m in trainedModelsList" :value="'trained:'+m.name" :key="m.name">{{ m.name }} — {{ m.size }}</option>
          </optgroup>
        </select>
      </div>

      <div class="hdr-toggles">
        <div class="toggle-group" @click="tog.web=!tog.web">
          <label class="tgl" :class="{on:tog.web}" title="Веб поиск"></label>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          <span style="font-size:12px;color:var(--muted)">Web</span>
        </div>
        <div class="hdr-divider"></div>
        <div class="toggle-group" @click="tog.agent=!tog.agent">
          <label class="tgl" :class="{on:tog.agent}" title="Агент"></label>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><path d="M4 17l6-6-6-6m8 14h6"/></svg>
          <span style="font-size:12px;color:var(--muted)">Agent</span>
        </div>
        <div class="hdr-divider"></div>
        <div class="toggle-group" @click="tog.think=!tog.think">
          <label class="tgl" :class="{on:tog.think}" title="Мышление"></label>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><path d="M12 2a8 8 0 00-8 8c0 3.5 2.5 6.5 6 7.5V22l4-4h-2a8 8 0 000-16z"/></svg>
          <span style="font-size:12px;color:var(--muted)">Think</span>
        </div>
      </div>

      <div class="hdr-right">
        <!-- Thinking indicator -->
        <div v-if="isGen" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--glow);border:1px solid var(--accent);border-radius:20px;margin-right:8px;animation:pulse 2s infinite">
          <div class="dots" style="padding:0"><span></span><span></span><span></span></div>
          <span style="font-size:12px;color:var(--accent2);font-weight:500">Думает...</span>
        </div>
        <button v-if="isGen" @click="stopGen" class="btn btn-sm" style="background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.2)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          Стоп
        </button>
        <button @click="showThinkingOverlay=true" v-if="isGen" class="icon-btn" title="Показать процесс мышления">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 2a8 8 0 00-8 8c0 3.5 2.5 6.5 6 7.5V22l4-4h-2a8 8 0 000-16z"/></svg>
        </button>
        <span v-if="genTime>0" style="font-size:11px;color:var(--muted)">{{ genTime }}с</span>
        <span v-if="msgs.length" style="font-size:11px;color:var(--muted)">{{ msgs.length }} сообщ.</span>
        <button @click="searchOpen=true" class="icon-btn" title="Поиск">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>
        <button v-if="currentChatId" @click="showChatStats" class="icon-btn" title="Статистика">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9m-5 8V5m-5 12v-3"/></svg>
        </button>
        <button @click="tplPanel=!tplPanel" class="icon-btn" title="Шаблоны">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        </button>
        <button v-if="currentChatId && msgs.length" @click="copyAll" class="icon-btn" title="Копировать чат">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button v-if="currentChatId" @click="doExport('markdown')" class="icon-btn" title="Экспорт">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3"/></svg>
        </button>
        <button @click="toggleTheme" class="icon-btn" title="Переключить тему">
          <svg v-if="settings.theme==='dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        </button>
      </div>
    </header>

    <!-- Messages -->
    <div class="msg-list" id="chat-box" :key="'msg-'+msgKey" @click="handleChatClick">
      <div class="msg-inner">

        <!-- Empty state -->
        <div v-if="!msgs.length" class="empty-state">
          <div class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div class="empty-title">AIens готов</div>
          <div class="empty-sub" v-if="selectedModel">{{ selectedModel }}</div>
          <div class="quick-prompts">
            <span v-for="p in quickPrompts" :key="p" class="qprompt" @click="sendQuick(p)">{{ p }}</span>
          </div>
          <div class="kb-hints">
            <span class="kb-hint">Ctrl+N — Новый чат</span>
            <span class="kb-hint">Ctrl+K — Поиск</span>
            <span class="kb-hint">Shift+Enter — Новая строка</span>
          </div>
        </div>

        <!-- Message rows -->
        <div v-for="(m,i) in msgs" :key="i" class="msg-row" :class="m.role==='user'?'user':'ai'">

          <!-- AI avatar -->
          <div v-if="m.role==='assistant'" class="ai-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>

          <!-- Edit mode -->
          <div v-if="editIdx===i" class="edit-form">
            <textarea class="edit-textarea" v-model="editText" rows="3"></textarea>
            <div style="display:flex;gap:10px;margin-top:10px;justify-content:flex-end">
              <button @click="editIdx=-1" class="btn btn-g btn-sm">Отмена</button>
              <button @click="saveEdit(i)" class="btn btn-p btn-sm">Сохранить</button>
            </div>
          </div>

          <!-- Normal bubble -->
          <div v-else class="bubble" :class="[m.role==='user'?'user':'ai', {generating: m.role==='assistant' && isGen && i===msgs.length-1}]">
            <div v-if="!m.content && isGen && i===msgs.length-1" class="dots"><span></span><span></span><span></span></div>
            <div v-else-if="m.content" class="md" v-html="renderMd(m.content, i===msgs.length-1 && isGen)"></div>
            <div v-else style="color:var(--muted);font-style:italic;opacity:.5">Пустое сообщение</div>
          </div>

          <!-- Meta row -->
          <div class="msg-meta" :style="m.role==='user'?'justify-content:flex-end':'justify-content:flex-start'">
            <span v-if="m.timestamp" class="msg-time">{{ m.timestamp }}</span>
            <span v-if="m.content && !isGen" class="msg-tok">~{{ estTok(m.content) }} tok</span>
            <div class="msg-actions">
              <button v-if="m.role==='user' && editIdx!==i" @click="startEdit(i,m.content)" class="icon-btn" style="padding:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button @click="copyMsg(m.content)" class="icon-btn" style="padding:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
              <button v-if="m.role==='assistant'" @click="speak(m.content)" class="icon-btn" style="padding:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg></button>
              <button v-if="m.role==='assistant' && i===msgs.length-1 && !isGen" @click="regenerate(i)" class="icon-btn" style="padding:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg></button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Tool strip -->
    <div v-if="tools.length" class="tool-strip">
      <div v-for="(t,i) in tools" :key="i" class="tool-chip">
        <svg v-if="t.status==='running'" style="animation:spin .8s linear infinite" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        <svg v-else-if="t.status==='done'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span style="font-weight:600;color:var(--accent2)">{{ t.tool }}</span>
        <span>{{ t.result }}</span>
        <button v-if="t.status!=='running'" @click="tools.splice(i,1)" class="icon-btn" style="padding:3px;margin-left:auto"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
    </div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrap">
        <div class="input-box">
          <!-- Left actions -->
          <div class="input-actions-left">
            <button @click="attachFile" class="iact attach" title="Прикрепить файл (Ctrl+O)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
          </div>
          <!-- Textarea -->
          <textarea
            v-model="input"
            id="chat-input"
            :placeholder="isGen ? 'ИИ думает...' : 'Написать сообщение... (Enter — отправить, Shift+Enter — новая строка)'"
            @keydown.enter.exact.prevent="send"
            @keydown.ctrl.enter.prevent="send"
            rows="1"
            @input="autoResize"
            :disabled="isGen">
          </textarea>
          <!-- Right actions -->
          <div class="input-actions-right">
            <button v-if="input.trim()" @click="input='';$nextTick(()=>{const t=document.getElementById('chat-input');if(t)t.style.height='auto'})" class="iact clear-btn" title="Очистить (Esc)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <button @click="toggleVoice" class="iact voice" :class="{active:isListening}" :title="isListening?'Остановить запись':'Голосовой ввод'">
              <svg v-if="!isListening" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </button>
            <button v-if="isGen" @click="stopGen" class="iact stop" title="Остановить генерацию">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </button>
            <button v-else @click="send" :disabled="!input.trim()" class="iact send" :title="'Отправить (Enter)'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
        <div class="input-foot">
          <div class="tok-meter">
            <div class="tok-bar">
              <div class="tok-fill" :style="{
                width: Math.min(100, estTok(input) / (settings.context_window||4096) * 100 * 3) + '%',
                background: estTok(input) > 1000 ? 'var(--red)' : estTok(input) > 500 ? 'var(--yellow)' : 'var(--accent)'
              }"></div>
            </div>
            <span>{{ input.length }} симв. · ~{{ estTok(input) }} tok</span>
          </div>
          <div class="input-hints">
            <div class="status-dot" :class="{gen:isGen}"></div>
            <span>{{ isGen ? 'Генерация...' : isListening ? '🎙 Слушаю...' : '' }}</span>
            <span class="input-hint-key">Enter</span><span style="color:var(--muted)">отправить</span>
            <span class="input-hint-key">Shift+Enter</span><span style="color:var(--muted)">новая строка</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Templates panel -->
    <div class="tpl-panel" :class="{open:tplPanel}">
      <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <span style="font-weight:700;font-size:14px">Шаблоны</span>
        <div style="display:flex;gap:6px">
          <button @click="openTemplateEditor()" class="icon-btn" title="Создать"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg></button>
          <button @click="tplPanel=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto">
        <div v-for="t in templates" :key="t.id" class="tpl-item">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div style="flex:1;cursor:pointer" @click="useTemplate(t.content)">
              <div class="tpl-name">{{ t.name }}</div>
              <div class="tpl-preview">{{ t.content.substring(0,60) }}...</div>
            </div>
            <div style="display:flex;gap:3px;margin-left:10px">
              <button @click.stop="openTemplateEditor(t)" class="icon-btn" style="padding:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button @click.stop="deleteTemplate(t.id)" class="icon-btn" style="padding:4px;color:var(--red)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
            </div>
          </div>
        </div>
        <div v-if="!templates.length" style="padding:24px;text-align:center;color:var(--muted);font-size:13px">Нет шаблонов</div>
      </div>
    </div>
  </div>

  <!-- ═══════════════ SETTINGS MODAL ═══════════════ -->
  <div v-if="settingsOpen" class="overlay" @click.self="settingsOpen=false">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div class="modal-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          Настройки
        </div>
        <button @click="settingsOpen=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="modal-tabs">
          <button v-for="t in ['general','api','agent','local']" :key="t" @click="settingsTab=t" class="modal-tab" :class="{active:settingsTab===t}">
            {{ t==='general'?'Основные':t==='api'?'API':t==='agent'?'Агент':'Локальные' }}
          </button>
        </div>

        <div v-show="settingsTab==='general'" class="form-section">
          <div class="form-label">Внешний вид</div>
          <div class="form-grid">
            <div>
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Акцент</label>
              <select v-model="settings.accent" @change="applyTheme" class="field" style="font-size:13px">
                <option v-for="c in ['blue','violet','emerald','rose','amber','cyan']" :value="c">{{ c }}</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Температура: {{ (+settings.temperature).toFixed(2) }}</label>
              <input type="range" min="0" max="2" step="0.05" v-model="settings.temperature" style="width:100%">
            </div>
          </div>
          <div style="margin-top:16px">
            <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Тема</label>
            <div style="display:flex;gap:10px">
              <button @click="settings.theme='dark';applyTheme()" class="btn" :class="settings.theme==='dark'?'btn-p':'btn-g'" style="flex:1;justify-content:center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                Тёмная
              </button>
              <button @click="settings.theme='light';applyTheme()" class="btn" :class="settings.theme==='light'?'btn-p':'btn-g'" style="flex:1;justify-content:center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                Светлая
              </button>
            </div>
          </div>
        </div>

        <div v-show="settingsTab==='api'" class="form-section">
          <div class="form-label">API конфигурация</div>
          <div class="form-grid">
            <div style="grid-column:1/-1">
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">OpenAI API Key</label>
              <input type="password" v-model="settings.openai_api_key" placeholder="sk-..." class="field" style="font-size:13px">
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Hugging Face API Token (<a href="https://huggingface.co/settings/tokens" target="_blank" style="color:var(--accent2)">Получить</a>)</label>
              <input type="password" v-model="settings.hf_token" placeholder="hf_..." class="field" style="font-size:13px">
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">HF: Image Gen</label>
              <input v-model="settings.hf_image_model" placeholder="black-forest-labs/FLUX.1-schnell" class="field" style="font-size:13px">
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Base URL (опционально)</label>
              <input v-model="settings.custom_api_url" placeholder="https://api.openai.com/v1" class="field" style="font-size:13px">
            </div>
          </div>
        </div>

        <div v-show="settingsTab==='agent'" class="form-section">
          <div class="form-label">Разрешения агента</div>
          <div class="form-grid">
            <label class="perm-card"><div><div class="perm-title">Терминал</div><div class="perm-sub" style="color:var(--red)">Выполнять команды</div></div><input type="checkbox" v-model="settings.allow_terminal"></label>
            <label class="perm-card"><div><div class="perm-title">Чтение файлов</div><div class="perm-sub">Просмотр файлов</div></div><input type="checkbox" v-model="settings.allow_file_read"></label>
            <label class="perm-card"><div><div class="perm-title">Запись файлов</div><div class="perm-sub">Создание / изменение</div></div><input type="checkbox" v-model="settings.allow_file_write"></label>
            <label class="perm-card"><div><div class="perm-title">Без лимита</div><div class="perm-sub">Без ограничения токенов</div></div><input type="checkbox" v-model="settings.unlimited_tokens"></label>
          </div>
        </div>

        <div v-show="settingsTab==='local'" class="form-section">
          <div class="form-label">Локальные модели</div>
          <div class="form-grid">
            <div style="grid-column:1/-1">
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Директория моделей</label>
              <div style="display:flex;gap:10px">
                <input v-model="settings.local_models_path" placeholder="По умолчанию" class="field" style="flex:1;font-size:13px">
                <button @click="browseDir" class="btn btn-g btn-sm">Обзор</button>
              </div>
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Контекст</label>
              <select v-model="settings.context_window" class="field" style="font-size:13px">
                <option v-for="v in [2048,4096,8192,16384,32768]" :value="v">{{ v }}</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">GPU слои</label>
              <input type="number" v-model.number="settings.gpu_layers" min="0" max="200" class="field" style="font-size:13px">
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button @click="settingsOpen=false" class="btn btn-g btn-sm">Отмена</button>
        <button @click="saveSettings" class="btn btn-p btn-sm">Сохранить</button>
      </div>
    </div>
  </div>

  <!-- ═══════════════ MODEL HUB ═══════════════ -->
  <div v-if="hubOpen" class="overlay" @click.self="hubOpen=false">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div class="modal-title" style="color:var(--accent2)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          Model Hub
        </div>
        <button @click="hubOpen=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body" :key="'hub-'+hubKey">
        <div v-if="sysRec" style="padding:14px 16px;background:var(--glow);border:1px solid rgba(91,110,245,.25);border-radius:12px;font-size:13px;margin-bottom:16px">
          <strong style="color:var(--accent2)">Система: {{ sysRec.ram }}</strong><br>
          <span style="color:var(--muted)">Рекомендуется: {{ sysRec.rec }}</span>
        </div>

        <div class="mh-cats">
          <button v-for="(name,key) in mhCategories" :key="key" @click="mhCategory=key;mhSearchResults=[]" class="mh-cat" :class="{active:mhCategory===key}">{{ name }}</button>
        </div>

        <div v-if="mhCategory!=='search'" style="display:flex;gap:10px;margin-bottom:16px">
          <input v-model="mhSearchQ" placeholder="Поиск на HuggingFace..." class="field" style="flex:1;font-size:13px" @keydown.enter="searchHF">
          <button @click="searchHF" class="btn btn-p btn-sm" :disabled="mhSearching">Поиск</button>
        </div>

        <div v-if="mhCategory==='search' && mhSearchResults.length" class="mh-grid">
          <div v-for="r in mhSearchResults" :key="r.id" class="mh-card">
            <div class="mh-card-name" style="word-break:break-all;font-size:12px">{{ r.id }}</div>
            <div class="mh-card-meta">
              <div style="display:flex;flex-direction:column;gap:6px">
                <span v-if="r.size" class="model-size-badge" style="font-size:12px;padding:4px 10px">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                  {{ r.size }}
                </span>
                <span v-if="r.downloads" style="font-size:11px;color:var(--muted)">⬇ {{ (r.downloads||0).toLocaleString() }}</span>
              </div>
              <button @click="downloadHF(r.id)" class="btn btn-p btn-xs">Скачать</button>
            </div>
          </div>
        </div>
        <div v-else-if="mhCategory==='search'" style="padding:36px;text-align:center;color:var(--muted);font-size:13px">Используйте поиск выше</div>

        <div v-if="mhCategory!=='search'" class="mh-grid">
          <div v-for="m in popularModels[mhCategory]||[]" :key="m.id" class="mh-card">
            <div class="mh-card-name">{{ m.name }}</div>
            <div class="mh-card-desc">{{ m.desc }}</div>
            <div class="mh-card-meta">
              <div style="display:flex;gap:6px;align-items:center">
                <span class="badge badge-blue">{{ m.size }}</span>
                <span style="font-size:11px;color:var(--muted)">{{ (m.downloads||0).toLocaleString() }} ⬇</span>
              </div>
              <button @click="downloadHF(m.id)" class="btn btn-p btn-xs">Скачать</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════ SEARCH MODAL ═══════════════ -->
  <div v-if="searchOpen" class="overlay" @click.self="searchOpen=false">
    <div class="modal modal-sm">
      <div class="modal-head">
        <div class="modal-title">Поиск по сообщениям</div>
        <button @click="searchOpen=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:10px;margin-bottom:18px">
          <input v-model="searchQuery" placeholder="Введите запрос..." class="field" @keydown.enter="searchMessages">
          <button @click="searchMessages" class="btn btn-p btn-sm">Искать</button>
        </div>
        <div v-if="searchResults.length" style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
          <div v-for="(r,i) in searchResults" :key="i" class="search-result" @click="selectChat(r.chat_id);searchOpen=false">
            <div style="font-size:12px;color:var(--accent2);margin-bottom:4px;font-weight:600">{{ r.title }}</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:4px">{{ r.role==='user'?'Вы':'AIens' }} • {{ r.timestamp }}</div>
            <div style="font-size:13px;line-height:1.5">{{ r.content.substring(0,150) }}{{ r.content.length>150?'...':'' }}</div>
          </div>
        </div>
        <div v-else-if="searchQuery" style="padding:40px;text-align:center;color:var(--muted)">Ничего не найдено</div>
        <div v-else style="padding:40px;text-align:center;color:var(--muted)">Введите запрос</div>
      </div>
    </div>
  </div>

  <!-- ═══════════════ STATS MODAL ═══════════════ -->
  <div v-if="statsOpen" class="overlay" @click.self="statsOpen=false">
    <div class="modal modal-sm">
      <div class="modal-head">
        <div class="modal-title">Статистика чата</div>
        <button @click="statsOpen=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body" v-if="currentStats">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="stat-card">
            <div class="stat-num" style="color:var(--accent2)">{{ currentStats.message_count }}</div>
            <div class="stat-name">Сообщений</div>
          </div>
          <div class="stat-card">
            <div class="stat-num" style="color:var(--green)">{{ currentStats.total_characters.toLocaleString() }}</div>
            <div class="stat-name">Символов</div>
          </div>
          <div class="stat-card" style="grid-column:1/-1">
            <div class="stat-num" style="color:var(--purple)">~{{ currentStats.estimated_tokens.toLocaleString() }}</div>
            <div class="stat-name">Примерно токенов</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════ TEMPLATE EDITOR ═══════════════ -->
  <div v-if="templateEditorOpen" class="overlay" @click.self="templateEditorOpen=false">
    <div class="modal modal-sm">
      <div class="modal-head">
        <div class="modal-title">{{ editingTemplate ? 'Редактировать' : 'Новый' }} шаблон</div>
        <button @click="templateEditorOpen=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom:14px">
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Название</label>
          <input v-model="newTemplateName" placeholder="Название шаблона" class="field">
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Категория</label>
          <select v-model="newTemplateCategory" class="field">
            <option value="general">Общее</option>
            <option value="code">Код</option>
            <option value="writing">Написание</option>
            <option value="analysis">Анализ</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Содержание</label>
          <textarea v-model="newTemplateContent" placeholder="Текст шаблона..." class="field" style="min-height:200px;resize:vertical"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button @click="templateEditorOpen=false" class="btn btn-g btn-sm">Отмена</button>
        <button @click="saveTemplate" class="btn btn-p btn-sm">Сохранить</button>
      </div>
    </div>
  </div>

  <!-- ═══════════════ AI TRAINER MENU BUTTON ═══════════════ -->
  <button class="trainer-menu-btn" @click="trainerOpen=true" title="AI Trainer - Обучение моделей">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  </button>

  <!-- ═══════════════ AI TRAINER MODAL ═══════════════ -->
  <div v-if="trainerOpen" class="overlay" @click.self="trainerOpen=false">
    <div class="modal trainer-modal">
      <div class="modal-head">
        <div class="modal-title" style="color:#10b981">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          AI Trainer - Обучение моделей
        </div>
        <button @click="trainerOpen=false" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <!-- Tabs -->
        <div class="trainer-tabs">
          <button v-for="t in ['setup','train','progress','datasets','models','export']" :key="t"
            @click="trainerTab=t" class="trainer-tab" :class="{active:trainerTab===t}">
            <svg v-if="t==='setup'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            <svg v-else-if="t==='train'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            <svg v-else-if="t==='progress'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <svg v-else-if="t==='datasets'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <svg v-else-if="t==='models'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3"/></svg>
            {{ t==='setup'?'Настройка':t==='train'?'Новое обучение':t==='progress'?'Прогресс':t==='datasets'?'Датасеты':t==='models'?'Модели':'Экспорт' }}
          </button>
        </div>

        <!-- Chat Section -->
        <div v-if="trainerTab==='chat'" class="trainer-section" style="display:block">
          <div style="display:flex;gap:16px;margin-bottom:16px">
            <select v-model="trainerSelectedModel" class="field" style="flex:1">
              <option value="">Выберите модель для обучения</option>
              <option v-for="m in localModels" :value="m.id" :key="m.id">{{ m.name }}</option>
            </select>
            <button @click="loadModelForTraining" class="btn btn-p btn-sm" :disabled="!trainerSelectedModel||trainerModelLoading">
              {{ trainerModelLoading?'Загрузка...':'Загрузить' }}
            </button>
          </div>
          <div class="trainer-chat-area">
            <div class="trainer-chat-messages" ref="trainerChatBox">
              <div v-if="!trainerMessages.length" style="text-align:center;padding:40px;color:var(--muted)">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="margin-bottom:16px;opacity:.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                <div>Загрузите модель и начните общаться для обучения</div>
              </div>
              <div v-for="(m,i) in trainerMessages" :key="i" class="trainer-msg" :class="m.role">
                <div class="trainer-msg-label">{{ m.role==='user'?'Вы':'AI' }}</div>
                <div>{{ m.content }}</div>
              </div>
              <div v-if="trainerTyping" class="trainer-msg ai">
                <div class="trainer-msg-label">AI</div>
                <div class="dots"><span></span><span></span><span></span></div>
              </div>
            </div>
            <div class="trainer-chat-input-area">
              <textarea v-model="trainerInput" class="trainer-chat-input" placeholder="Напишите сообщение..." rows="1" @keydown.enter.exact.prevent="sendTrainerMessage"></textarea>
              <button @click="sendTrainerMessage" class="btn btn-p btn-sm" :disabled="!trainerInput.trim()||trainerTyping||!trainerModelLoaded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
          <div v-if="trainerModelLoaded" style="margin-top:12px;display:flex;gap:10px;align-items:center">
            <span class="badge badge-green">Модель загружена</span>
            <span style="font-size:12px;color:var(--muted)">Все сообщения сохраняются для дообучения</span>
            <button @click="saveTrainingData" class="btn btn-g btn-sm" style="margin-left:auto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Сохранить данные
            </button>
          </div>
        </div>

        <!-- Setup Section -->
        <div v-if="trainerTab==='setup'" class="trainer-section" style="display:block">
          <div v-if="!trainingDepsReady" style="padding:30px;background:var(--surface2);border-radius:var(--r);text-align:center;margin-bottom:20px">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2" style="margin-bottom:16px">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <div style="font-size:16px;font-weight:600;margin-bottom:8px">Требуются зависимости</div>
            <div style="color:var(--muted);margin-bottom:16px">Для обучения моделей необходимо установить: torch</div>
            <div v-if="installingDeps" style="color:var(--accent);font-size:13px;margin-bottom:12px">{{ trainingStatusMessage || 'Установка...' }}</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
              <button @click="installTrainingDeps" class="btn btn-p" :disabled="installingDeps">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {{ installingDeps ? 'Установка...' : 'Установить зависимости' }}
              </button>
              <button @click="checkTrainingDeps(true)" class="btn" :disabled="installingDeps" title="Принудительно пересканировать установленные пакеты">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Перепроверить
              </button>
            </div>
          </div>

          <div v-else>
            <div style="padding:20px;background:var(--surface2);border-radius:var(--r);margin-bottom:20px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span style="font-weight:600;color:var(--green)">Все зависимости установлены!</span>
              </div>
              <div style="color:var(--muted);font-size:13px">Можете переходить к обучению моделей.</div>
            </div>

            <div class="trainer-config-grid">
              <div class="trainer-config-item">
                <label>Режим обучения</label>
                <input value="Scratch Seq2Seq (только с нуля)" disabled>
              </div>
              <div class="trainer-config-item">
                <label>Название модели</label>
                <input v-model="realTrainingConfig.name" placeholder="my-model-v1">
              </div>
            </div>
          </div>
        </div>

        <!-- Training Config Section -->
        <div v-if="trainerTab==='train'" class="trainer-section" style="display:block">
          <div class="trainer-config-grid">
            <div class="trainer-config-item">
              <label>Эпохи</label>
              <input type="number" v-model.number="realTrainingConfig.epochs" min="1" max="10">
            </div>
            <div class="trainer-config-item">
              <label>Checkpoint every N epochs</label>
              <input type="number" v-model.number="realTrainingConfig.checkpoint_every_epochs" min="1" max="100">
            </div>
            <div class="trainer-config-item">
              <label>Batch Size</label>
              <input type="number" v-model.number="realTrainingConfig.batch_size" min="1" max="32">
            </div>
            <div class="trainer-config-item">
              <label>Learning Rate</label>
              <input type="number" v-model.number="realTrainingConfig.learning_rate" step="0.0001">
            </div>
            <div class="trainer-config-item">
              <label>Max Length</label>
              <input type="number" v-model.number="realTrainingConfig.max_length" min="128" max="2048" step="64">
            </div>
          </div>
          <div class="trainer-config-grid" style="margin-top:12px">
            <div class="trainer-config-item">
              <label>d_model</label>
              <input type="number" v-model.number="realTrainingConfig.d_model" min="64" max="1024" step="32">
            </div>
            <div class="trainer-config-item">
              <label>nhead</label>
              <input type="number" v-model.number="realTrainingConfig.nhead" min="1" max="16">
            </div>
            <div class="trainer-config-item">
              <label>Encoder Layers</label>
              <input type="number" v-model.number="realTrainingConfig.num_enc_layers" min="1" max="12">
            </div>
            <div class="trainer-config-item">
              <label>Decoder Layers</label>
              <input type="number" v-model.number="realTrainingConfig.num_dec_layers" min="1" max="12">
            </div>
            <div class="trainer-config-item">
              <label>dim_ff</label>
              <input type="number" v-model.number="realTrainingConfig.dim_ff" min="128" max="4096" step="64">
            </div>
            <div class="trainer-config-item">
              <label>Dropout</label>
              <input type="number" v-model.number="realTrainingConfig.dropout" min="0" max="0.9" step="0.05">
            </div>
            <div class="trainer-config-item">
              <label>Min Freq</label>
              <input type="number" v-model.number="realTrainingConfig.min_freq" min="1" max="10">
            </div>
            <div class="trainer-config-item">
              <label>Accumulation Steps</label>
              <input type="number" v-model.number="realTrainingConfig.accumulation_steps" min="1" max="64">
            </div>
          </div>

          <div style="margin-bottom:16px">
            <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:8px">Датасет для обучения</label>
            <div style="display:flex;gap:10px;margin-bottom:8px">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text);cursor:pointer">
                <input type="checkbox" v-model="realTrainingConfig.is_image_training" style="width:16px;height:16px;cursor:pointer">
                Обучение на картинках (Image Dataset)
              </label>
            </div>
            <div style="display:flex;gap:10px" v-if="!realTrainingConfig.is_image_training">
              <select v-model="realTrainingConfig.dataset_path" class="field" style="flex:1">
                <option value="">Выберите текстовый датасет</option>
                <option v-for="d in availableDatasets" :value="d.path" :key="d.id">{{ d.name }}{{ d.builtin ? ' [встроенный]' : '' }} ({{ d.size }} примеров)</option>
              </select>
              <button @click="browseTrainingFile" class="btn btn-g btn-sm">Загрузить файл</button>
            </div>
            <div style="display:flex;gap:10px" v-else>
              <input v-model="realTrainingConfig.dataset_path" class="field" style="flex:1" placeholder="Путь к папке с картинками..." readonly>
              <button @click="browseImageFolder" class="btn btn-g btn-sm">Выбрать папку</button>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:20px">
            <button @click="startRealTraining" class="btn btn-p" :disabled="realTrainingInProgress||!realTrainingConfig.dataset_path" style="flex:1;justify-content:center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
              {{ realTrainingInProgress?'Обучение запущено...':'Начать обучение' }}
            </button>
          </div>
        </div>

        <!-- Progress Section with Charts -->
        <div v-if="trainerTab==='progress'" class="trainer-section" style="display:block">
          <div v-if="!realTrainingInProgress && trainingHistory.loss.length === 0" style="text-align:center;padding:60px 20px;color:var(--muted)">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:20px;opacity:0.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <div style="font-size:16px;margin-bottom:8px">Нет активного обучения</div>
            <div style="font-size:13px">Запустите обучение во вкладке "Новое обучение"</div>
          </div>

          <div v-else>
            <!-- Status Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:16px;background:var(--surface2);border-radius:var(--r)">
              <div>
                <div style="font-weight:600;font-size:16px">{{ realTrainingInProgress?'Обучение в процессе...':'Обучение завершено' }}</div>
                <div style="color:var(--muted);font-size:13px;margin-top:4px">{{ trainingStatusMessage }}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:28px;font-weight:700;color:var(--accent2)">{{ realTrainingProgress }}%</div>
                <div style="color:var(--muted);font-size:12px">Epoch step: {{ trainingStats.epoch_step || 0 }} / {{ trainingStats.epoch_total_steps || '?' }} • Global: {{ trainingStats.step || 0 }} / {{ trainingStats.total_steps || '?' }}</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="trainer-progress-bar" style="height:12px;margin-bottom:24px">
              <div class="trainer-progress-fill" :style="{width:realTrainingProgress+'%'}"></div>
            </div>

            <!-- Stats Grid -->
            <div class="trainer-stats-grid" style="margin-bottom:24px">
              <div class="trainer-stat">
                <div class="trainer-stat-value" style="color:var(--accent2)">{{ trainingStats.loss ? trainingStats.loss.toFixed(4) : '-' }}</div>
                <div class="trainer-stat-label">Loss</div>
              </div>
              <div class="trainer-stat">
                <div class="trainer-stat-value" style="color:var(--green)">{{ trainingStats.epoch ? trainingStats.epoch.toFixed(2) : '-' }}</div>
                <div class="trainer-stat-label">Эпоха</div>
              </div>
              <div class="trainer-stat">
                <div class="trainer-stat-value" style="color:var(--purple)">{{ formatTime(trainingStats.elapsed_time || 0) }}</div>
                <div class="trainer-stat-label">Время</div>
              </div>
              <div class="trainer-stat">
                <div class="trainer-stat-value" style="color:var(--yellow)">{{ trainingStats.learning_rate ? trainingStats.learning_rate.toExponential(2) : '-' }}</div>
                <div class="trainer-stat-label">LR</div>
              </div>
            </div>

            <!-- Loss Chart -->
            <div v-if="trainingHistory.loss.length > 0" style="background:var(--surface2);border-radius:var(--r);padding:20px;margin-bottom:20px">
              <div style="font-weight:600;margin-bottom:16px">График Loss</div>
              <div style="height:200px;position:relative">
                <canvas ref="lossChart" style="width:100%;height:100%"></canvas>
              </div>
            </div>

            <!-- Stop Button -->
            <div v-if="realTrainingInProgress" style="display:flex;gap:10px">
              <button @click="stopRealTraining" class="btn" style="flex:1;background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.2)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                Остановить обучение
              </button>
            </div>
          </div>
        </div>

        <!-- Datasets Section -->
        <div v-if="trainerTab==='datasets'" class="trainer-section" style="display:block">
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <input v-model="datasetSearch" placeholder="Поиск датасетов на HuggingFace..." class="field" style="flex:1" @keydown.enter="searchDatasets">
            <button @click="searchDatasets" class="btn btn-p btn-sm" :disabled="datasetSearching">
              {{ datasetSearching?'Поиск...':'Найти' }}
            </button>
          </div>

          <div v-if="datasetSearchResults.length" style="margin-bottom:20px">
            <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Результаты поиска:</div>
            <div class="dataset-list">
              <div v-for="d in datasetSearchResults" :key="d.id" class="dataset-item">
                <div class="dataset-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                </div>
                <div class="dataset-info">
                  <div class="dataset-name">{{ d.id }}</div>
                  <div class="dataset-meta">{{ d.description||'Нет описания' }} · {{ d.downloads?.toLocaleString()||0 }} загрузок</div>
                </div>
                <button @click="downloadDataset(d.id)" class="btn btn-p btn-xs">Скачать</button>
              </div>
            </div>
          </div>

          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Ваши датасеты:</div>
          <div class="dataset-list">
            <div v-for="d in availableDatasets" :key="d.id" class="dataset-item">
              <div class="dataset-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </div>
              <div class="dataset-info">
                <div class="dataset-name">{{ d.name }}</div>
                <div class="dataset-meta">{{ d.size }} примеров · {{ d.format }} · {{ d.source }}</div>
              </div>
              <div class="dataset-actions">
                <button @click="previewDataset(d.id)" class="btn btn-g btn-xs">Просмотр</button>
                <button @click="deleteDataset(d.id)" class="icon-btn" style="color:var(--red)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
              </div>
            </div>
            <div v-if="!availableDatasets.length" style="text-align:center;padding:40px;color:var(--muted)">
              Нет загруженных датасетов. Найдите и скачайте датасет с HuggingFace или загрузите свой файл.
            </div>
          </div>
        </div>

        <!-- Models Section -->
        <div v-if="trainerTab==='models'" class="trainer-section" style="display:block">
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <input v-model="newModelName" placeholder="Название новой модели" class="field" style="flex:1">
            <select v-model="newModelBase" class="field" style="flex:1">
              <option value="">Базовая модель</option>
              <option v-for="m in localModels" :value="m.id" :key="m.id">{{ m.name }}</option>
            </select>
            <button @click="createNewModel" class="btn btn-p btn-sm" :disabled="!newModelName||!newModelBase">Создать</button>
          </div>

          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Ваши обученные модели:</div>
          <div class="trainer-model-list">
            <div v-for="m in trainedModels" :key="m.id" class="trainer-model-item" :class="{active:m.id===selectedTrainedModel}" @click="selectedTrainedModel=m.id">
              <div class="trainer-model-status" :class="m.status"></div>
              <div style="flex:1">
                <div style="font-weight:600">{{ m.name }}</div>
                <div style="font-size:12px;color:var(--muted)">{{ m.base }} · {{ m.trainedOn }} · {{ m.size }}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button @click.stop="useTrainedModel(m.id)" class="btn btn-p btn-xs">Использовать</button>
                <button @click.stop="deleteTrainedModel(m.id)" class="icon-btn" style="color:var(--red)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
              </div>
            </div>
            <div v-if="!trainedModels.length" style="text-align:center;padding:40px;color:var(--muted)">
              Нет обученных моделей. Обучите модель во вкладке "Обучение".
            </div>
          </div>
        </div>

        <!-- Import/Export Section -->
        <div v-if="trainerTab==='importexport'" class="trainer-section" style="display:block">
          <div class="ie-grid">
            <div class="ie-card" @click="importModel">
              <div class="ie-card-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div class="ie-card-title">Импорт модели</div>
              <div class="ie-card-desc">Загрузите .gguf, .bin или .pt файл модели</div>
            </div>
            <div class="ie-card" @click="exportModel">
              <div class="ie-card-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <div class="ie-card-title">Экспорт модели</div>
              <div class="ie-card-desc">Сохраните обученную модель в файл</div>
            </div>
            <div class="ie-card" @click="importDataset">
              <div class="ie-card-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div class="ie-card-title">Импорт датасета</div>
              <div class="ie-card-desc">Загрузите JSON, CSV или TXT файл с данными</div>
            </div>
            <div class="ie-card" @click="exportDataset">
              <div class="ie-card-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div class="ie-card-title">Экспорт датасета</div>
              <div class="ie-card-desc">Сохраните данные обучения в файл</div>
            </div>
          </div>

          <div v-if="ieStatus" style="margin-top:20px;padding:16px;background:var(--surface2);border-radius:var(--r);border:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <svg v-if="ieStatus.type==='success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>{{ ieStatus.message }}</span>
            </div>
            <div v-if="ieStatus.progress!==undefined" style="margin-top:10px">
              <div class="trainer-progress-bar" style="height:6px">
                <div class="trainer-progress-fill" :style="{width:ieStatus.progress+'%'}"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</div>

<script>
const renderer = new marked.Renderer();
renderer.code = function(arg1, arg2) {
  const text = typeof arg1 === 'string' ? arg1 : arg1.text || '';
  const lang = typeof arg1 === 'string' ? arg2 : arg1.lang || '';
  const language = (lang || 'code').toLowerCase();
  
  let highlighted = text;
  if (language && language !== 'code' && hljs.getLanguage(language)) {
    try { highlighted = hljs.highlight(text, { language }).value; } catch (e) {}
  } else {
    try { highlighted = hljs.highlightAuto(text).value; } catch (e) {}
  }
  
  // Safe HTML attribute encoding for the data-code attribute
  const encodedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '&#10;');

  return `<div class="code-frame">
    <div class="code-header">
      <div class="mac-dots"><span></span><span></span><span></span></div>
      <span class="code-lang">${language}</span>
      <button class="code-copy" data-code="${encodedText}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Копировать
      </button>
    </div>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
};

marked.use({
  breaks: true,
  gfm: true,
  renderer: renderer
});

const app = Vue.createApp({
  data() {
    return {
      chats: [], currentChatId: null, msgs: [], localModels: [],
      apiModels: [
        {id:'gpt-4o',name:'GPT-4o'},{id:'gpt-4-turbo',name:'GPT-4 Turbo'},
        {id:'gpt-3.5-turbo',name:'GPT-3.5'},{id:'claude-3-opus',name:'Claude Opus'},
        {id:'claude-3-sonnet',name:'Claude Sonnet'}
      ],
      selectedModel: 'gpt-3.5-turbo', input: '', editIdx: -1, editText: '',
      isGen: false, genTime: 0, listKey: 0, msgKey: 0, hubKey: 0,
      isListening: false, recognition: null, autoScroll: true,
      modelThinking: false,
      tog: {web:false, agent:false, think:true},
      settingsOpen: false, hubOpen: false, tplPanel: false,
      activeDownloads: {}, toasts: [], tools: [],
      settings: {
        openai_api_key:'', hf_token:'', hf_image_model:'stabilityai/stable-diffusion-xl-base-1.0',
        custom_api_url:'', allow_terminal:false,
        allow_file_read:false, allow_file_write:false, unlimited_tokens:true,
        accent:'blue', local_models_path:'', context_window:'4096',
        gpu_layers:0, temperature:0.7, theme:'dark', font_scale:1.0,
        auto_title:true, show_tokens:true, stream_response:true
      },
      sys: {cpu:0, ram:0, gpu:null, disk:null},
      chatSearch: '', activeTab: 'chats', cmdHistory: [], sysRec: null,
      settingsTab: 'general', sidebarCollapsed: false,
      templates: [],
      quickPrompts: ['Объясни квантовые вычисления','Напиши Python код','Переведи текст','Сделай краткий пересказ','Найди ошибки в коде'],
      mhCategory: 'chat',
      mhCategories: {chat:'Популярные', code:'Код', creative:'Творчество', reasoning:'Reasoning', small:'Лёгкие', search:'Поиск'},
      mhSearchQ: '', mhSearchResults: [], mhSearching: false, popularModels: {},
      toastId: 0,
      searchOpen: false, searchQuery: '', searchResults: [],
      statsOpen: false, currentStats: null,
      templateEditorOpen: false, editingTemplate: null,
      newTemplateName: '', newTemplateContent: '', newTemplateCategory: 'general',
      showThinkingOverlay: false,
      thinkingMessages: [
        'Анализирую ваш запрос...',
        'Обрабатываю информацию...',
        'Формирую ответ...',
        'Проверяю факты...',
        'Создаю структуру ответа...',
        'Генерирую текст...'
      ],
      thinkingIndex: 0,
      // AI Trainer
      trainerOpen: false,
      trainerTab: 'setup',
      trainedModelsList: [],
      trainerSelectedModel: '',
      trainerModelLoaded: false,
      trainerModelLoading: false,
      trainerMessages: [],
      trainerInput: '',
      trainerTyping: false,
      trainingConfig: { name:'', baseModel:'', epochs:3, lr:0.0001, batchSize:4, maxLength:512, dataset:'' },
      trainingInProgress: false,
      trainingComplete: false,
      trainingProgress: 0,
      trainingStats: { step: 0, total_steps: 0, epoch_step: 0, epoch_total_steps: 0, loss: null, learning_rate: null, epoch: 0, elapsed_time: 0 },
      availableDatasets: [],
      datasetSearch: '',
      datasetSearchResults: [],
      datasetSearching: false,
      trainedModels: [],
      selectedTrainedModel: '',
      newModelName: '',
      newModelBase: '',
      ieStatus: null,
      // Trainer state
      trainingDepsReady: false,
      trainingMissingDeps: [],
      installingDeps: false,
      realTrainingInProgress: false,
      realTrainingProgress: 0,
      trainingStatusMessage: '',
      trainingHistory: { loss: [], lr: [], epoch: [], step: [] },
      realTrainingConfig: {
        name: 'my-model-v1',
        train_from_scratch: true,
        epochs: 3,
        batch_size: 2,
        learning_rate: 0.0002,
        max_length: 256,
        d_model: 256,
        nhead: 4,
        num_enc_layers: 3,
        num_dec_layers: 3,
        dim_ff: 512,
        dropout: 0.1,
        min_freq: 1,
        accumulation_steps: 1,
        checkpoint_every_epochs: 1,
        dataset_path: '',
      }
    }
  },

  computed: {
    filteredChats() {
      if(!this.chatSearch) return this.chats;
      return this.chats.filter(c => c.title.toLowerCase().includes(this.chatSearch.toLowerCase()));
    },
    thinkingMessage() {
      return this.thinkingMessages[this.thinkingIndex % this.thinkingMessages.length];
    }
  },

  methods: {
    handleChatClick(e) {
      const copyBtn = e.target.closest('.code-copy');
      if (copyBtn) {
        const code = copyBtn.getAttribute('data-code');
        if (code) {
          this.copyCode(copyBtn, code);
        }
      }
    },
    estTok(t) { return Math.max(1, Math.round((t||'').replace(/<[^>]+>/g,'').length/4)); },
    toast(msg, type='info') {
      this.toasts.push({id:++this.toastId, msg, type});
      setTimeout(() => this.toasts.shift(), 3000);
    },

    toggleVoice() {
      if(this.isListening) {
        if(this.recognition) { this.recognition.stop(); this.recognition = null; }
        this.isListening = false;
        return;
      }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SR) { this.toast('Голосовой ввод не поддерживается', 'error'); return; }
      this.recognition = new SR();
      this.recognition.lang = 'ru-RU';
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
      this.recognition.onstart = () => { this.isListening = true; };
      this.recognition.onresult = (e) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        this.input = transcript;
      };
      this.recognition.onend = () => { this.isListening = false; this.recognition = null; };
      this.recognition.onerror = () => { this.isListening = false; this.recognition = null; };
      this.recognition.start();
    },

    async load() {
      const a = window.pywebview.api;
      this.chats = await a.get_chats();
      const s = await a.get_all_settings();
      Object.keys(s).forEach(k => {
        if(k in this.settings) {
          if(['allow_terminal','allow_file_read','allow_file_write','unlimited_tokens'].includes(k))
            this.settings[k] = s[k] === '1';
          else if(k === 'gpu_layers')   this.settings[k] = parseInt(s[k]||'0');
          else if(k === 'temperature')  this.settings[k] = parseFloat(s[k]||'0.7');
          else this.settings[k] = s[k];
        }
      });
      this.applyTheme();
      await this.refreshModels();
      this.templates    = await a.get_templates();
      this.cmdHistory   = await a.get_history(null, 25);
      this.popularModels = await a.get_popular_models();
      this.sysRec       = await a.get_system_recommendation();
      await this.loadTrainedModelsForChat();
    },

    async refreshModels() {
      this.localModels = await window.pywebview.api.get_local_models();
      this.listKey++;
    },

    applyTheme() {
      // Apply theme to document
      document.documentElement.setAttribute('data-theme', this.settings.theme);
      
      // Apply accent colors
      const colors = {
        blue:    ['#5b6ef5','#818cf8','rgba(91,110,245,.2)'],
        violet:  ['#8b5cf6','#a78bfa','rgba(139,92,246,.2)'],
        emerald: ['#10b981','#34d399','rgba(16,185,129,.2)'],
        rose:    ['#f43f5e','#fb7185','rgba(244,63,94,.2)'],
        amber:   ['#f59e0b','#fbbf24','rgba(245,158,11,.2)'],
        cyan:    ['#06b6d4','#22d3ee','rgba(6,182,212,.2)']
      };
      const c = colors[this.settings.accent] || colors.blue;
      document.documentElement.style.setProperty('--accent',  c[0]);
      document.documentElement.style.setProperty('--accent2', c[1]);
      document.documentElement.style.setProperty('--glow',    c[2]);
    },

    autoResize(e) {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
    },
    scroll() { const b = document.getElementById('chat-box'); if(b) b.scrollTop = b.scrollHeight; },

    async selectChat(id) {
      if(this.isGen) return;
      if(this.currentChatId === id) return;
      this.currentChatId = id;
      this.msgs = [];
      this.editIdx = -1;
      this.msgKey++;
      try {
        const messages = await window.pywebview.api.get_messages(id);
        this.msgs = Array.isArray(messages) ? messages : [];
        this.cmdHistory = await window.pywebview.api.get_history(id, 25) || [];
        this.$nextTick(() => this.scroll());
      } catch(e) {
        this.toast('Ошибка загрузки чата', 'error');
        this.msgs = [];
      }
    },

    async newChat() {
      if(this.isGen) return;
      const id = await window.pywebview.api.create_chat('Новый чат');
      await this.load();
      await this.selectChat(id);
    },

    async deleteChat(id) {
      if(this.isGen || !confirm('Удалить чат?')) return;
      await window.pywebview.api.delete_chat(id);
      if(this.currentChatId === id) { this.currentChatId = null; this.msgs = []; }
      await this.load();
      this.listKey++;
    },

    async togglePin(id) { await window.pywebview.api.toggle_pin_chat(id); await this.load(); },

    async clearCurrentChat() {
      if(this.currentChatId && confirm('Очистить все сообщения?')) {
        await window.pywebview.api.clear_chat(this.currentChatId);
        this.msgs = [];
        this.toast('Очищено', 'success');
      }
    },

    async deleteModel(id) {
      if(!confirm('Удалить модель?')) return;
      await window.pywebview.api.delete_local_model(id);
      await this.refreshModels();
      this.toast('Удалено', 'success');
    },

    async doSend(text) {
      if(!text.trim() || this.isGen) return;
      if(!this.currentChatId) await this.newChat();
      this.input = '';
      document.getElementById('chat-input').style.height = 'auto';
      const c = this.chats.find(x => x.id === this.currentChatId);
      if(c && c.title === 'Новый чат') {
        c.title = text.substring(0,30) + (text.length>30?'..':'');
        await window.pywebview.api.update_chat_title(this.currentChatId, c.title);
      }
      this.msgs.push({role:'user', content:text, timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
      this.msgs.push({role:'assistant', content:'', timestamp:''});
      this.isGen = true; this.modelThinking = true; this.tools = []; this.msgKey++; this.scroll();
      
      // Start thinking animation
      this.thinkingInterval = setInterval(() => {
        this.thinkingIndex++;
      }, 2000);
      
      try {
        // Check if using a trained model
        if(this.selectedModel && this.selectedModel.startsWith('trained:')) {
          const modelName = this.selectedModel.replace('trained:', '');
          
          // Load model if not already loaded
          const loadResult = await window.pywebview.api.load_trained_model_for_inference(modelName);
          if(loadResult.error) {
            throw new Error('Ошибка загрузки модели: ' + loadResult.error);
          }
          
          // Generate response
          const result = await window.pywebview.api.generate_with_trained_model(
            text,
            512,  // max_tokens
            parseFloat(this.settings.temperature) || 0.7
          );
          
          if(result.error) {
            throw new Error(result.error);
          }
          
          // Update message
          const last = this.msgs[this.msgs.length-1];
          if(last && last.role === 'assistant') {
            last.content = result.text;
            last.timestamp = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
          }
          
          this.isGen = false;
          this.genTime = 0;
          
        } else {
          // Use regular API
          const r = await window.pywebview.api.send_message(this.currentChatId, text, this.selectedModel, this.tog.web, this.tog.agent, this.tog.think);
          if(r.error) throw new Error(r.error);
        }
      } catch(e) {
        this.isGen = false;
        const last = this.msgs[this.msgs.length-1];
        if(last) last.content = '❌ Ошибка: ' + e.message;
        this.toast('Ошибка: ' + e.message, 'error');
      }
    },

    send()             { this.doSend(this.input); },
    sendQuick(p)       { this.input = p; this.doSend(p); },
    async copyMsg(t)   { 
      try {
        await window.pywebview.api.copy_to_clipboard(t.replace(/<[^>]+>/g,''));
        this.toast('Скопировано','success');
      } catch(e) {
        // Fallback
        navigator.clipboard.writeText(t.replace(/<[^>]+>/g,''));
        this.toast('Скопировано','success');
      }
    },
    copyAll()          { navigator.clipboard.writeText(this.msgs.map(m=>(m.role==='user'?'Вы':'AI')+': '+m.content.replace(/<[^>]+>/g,'')).join('\n\n')); this.toast('Чат скопирован','success'); },
    speak(t)           { 
      const utterance = new SpeechSynthesisUtterance(t.replace(/<[^>]+>/g,''));
      utterance.lang = 'ru-RU';
      utterance.rate = 1;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
      this.toast('Озвучиваю...'); 
    },
    startEdit(i,c)     { this.editIdx = i; this.editText = c; },
    stopGen()          { 
      window.pywebview.api.stop_ai(); 
      this.isGen = false; 
      this.modelThinking = false;
      if(this.thinkingInterval) {
        clearInterval(this.thinkingInterval);
        this.thinkingInterval = null;
      }
      this.toast('Остановлено'); 
    },
    useHistory(h)      { this.input = h; },
    useTemplate(c)     { this.input = c; this.tplPanel = false; },

    async saveEdit(i) {
      if(!this.editText.trim() || this.isGen) return;
      const t = this.editText;
      this.editIdx = -1;
      this.msgs = this.msgs.slice(0, i);
      await window.pywebview.api.rollback_chat(this.currentChatId, i);
      this.input = t;
      await this.doSend(t);
    },

    async regenerate(i) {
      if(this.isGen || i<1 || this.msgs[i-1].role!=='user') return;
      const t = this.msgs[i-1].content;
      this.msgs = this.msgs.slice(0, i-1);
      await window.pywebview.api.rollback_chat(this.currentChatId, i-1);
      this.input = t;
      await this.doSend(t);
    },

    attachFile: async function() {
      const p = await window.pywebview.api.prompt_file_dialog();
      if(p) this.input += '\n[Файл: ' + p + ']\n';
    },

    async doExport(fmt) {
      const c = await window.pywebview.api.export_chat(this.currentChatId, fmt);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([c], {type:'text/plain'}));
      a.download = 'chat.' + fmt;
      a.click();
      this.toast('Экспортировано', 'success');
    },

    async saveSettings() {
      const d = {...this.settings};
      ['allow_terminal','allow_file_read','allow_file_write','unlimited_tokens'].forEach(k => d[k] = d[k]?'1':'0');
      await window.pywebview.api.save_settings(d);
      this.settingsOpen = false;
      this.applyTheme();
      this.toast('Настройки сохранены', 'success');
    },

    browseDir: async function() {
      const p = await window.pywebview.api.prompt_folder_dialog();
      if(p) this.settings.local_models_path = p;
    },

    async searchHF() {
      if(!this.mhSearchQ.trim() || this.mhSearching) return;
      this.mhSearching = true;
      this.mhCategory = 'search';
      try {
        const r = await window.pywebview.api.search_hf_models(this.mhSearchQ);
        this.mhSearchResults = r.error ? [] : r;
      } catch(e) {}
      this.mhSearching = false;
    },

    async downloadHF(id) {
      await window.pywebview.api.download_hf_model(id);
      this.toast('Загрузка началась');
    },

    async searchMessages() {
      if(!this.searchQuery.trim()) return;
      try {
        this.searchResults = await window.pywebview.api.search_messages(this.searchQuery, 50);
        this.toast(`Найдено: ${this.searchResults.length}`, 'success');
      } catch(e) { this.toast('Ошибка поиска', 'error'); }
    },

    async showChatStats() {
      if(!this.currentChatId) return;
      try {
        this.currentStats = await window.pywebview.api.get_chat_stats(this.currentChatId);
        this.statsOpen = true;
      } catch(e) { this.toast('Ошибка статистики', 'error'); }
    },

    openTemplateEditor(template = null) {
      if(template) {
        this.editingTemplate = template;
        this.newTemplateName = template.name;
        this.newTemplateContent = template.content;
        this.newTemplateCategory = template.category || 'general';
      } else {
        this.editingTemplate = null;
        this.newTemplateName = '';
        this.newTemplateContent = '';
        this.newTemplateCategory = 'general';
      }
      this.templateEditorOpen = true;
    },

    async saveTemplate() {
      if(!this.newTemplateName.trim() || !this.newTemplateContent.trim()) {
        this.toast('Заполните все поля', 'error'); return;
      }
      try {
        if(this.editingTemplate) {
          await window.pywebview.api.update_template(this.editingTemplate.id, this.newTemplateName, this.newTemplateContent, this.newTemplateCategory);
        } else {
          await window.pywebview.api.add_template(this.newTemplateName, this.newTemplateContent, this.newTemplateCategory);
        }
        this.templates = await window.pywebview.api.get_templates();
        this.templateEditorOpen = false;
        this.toast('Шаблон сохранён', 'success');
      } catch(e) { this.toast('Ошибка сохранения', 'error'); }
    },

    async deleteTemplate(tid) {
      if(!confirm('Удалить шаблон?')) return;
      try {
        await window.pywebview.api.delete_template(tid);
        this.templates = await window.pywebview.api.get_templates();
        this.toast('Удалено', 'success');
      } catch(e) { this.toast('Ошибка удаления', 'error'); }
    },

    async toggleTheme() {
      this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme();
      await this.saveSettings();
      this.toast(this.settings.theme === 'dark' ? 'Тёмная тема' : 'Светлая тема', 'success');
    },

    copyCode(btn, code) {
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Скопировано';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Копировать';
        }, 2000);
      });
    },

    renderMd(text, isGenerating) {
      try {
        if(!text) return '';

        // Auto-detect thinking (English before Russian)
        const thinkingPattern = /^([A-Za-z\s,."'!?:;()\-]+(?:\n[A-Za-z\s,."'!?:;()\-]+)*)\n+([А-Яа-яЁё].+)$/s;
        const match = text.match(thinkingPattern);
        if(match && match[1] && match[2]) {
          text = `<think >${match[1].trim()}</think>\n\n${match[2].trim()}`;
        }

        // Closed think blocks
        let t = text.replace(/<think >([\s\S]*?)<\/think>/gi, (_, p) => {
          return `<details class="think-block" open>
            <summary class="think-header">
              <div class="think-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <span class="think-title">Размышления</span>
              <svg class="think-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </summary>
            <div class="think-content">${p}</div>
          </details>`;
        });

        // Active thinking
        if(/<think >/gi.test(t) && !/<\/think>/gi.test(t)) {
          t = t.replace(/<think >([\s\S]*?)$/gi, (_, p) => {
            return `<details class="think-block think-active" open>
              <summary class="think-header">
                <div class="think-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <span class="think-title">Думаю...</span>
                <div class="think-dots"><span></span><span></span><span></span></div>
                <svg class="think-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </summary>
              <div class="think-content">${p}</div>
            </details>`;
          });
        }

        const html = marked.parse(t);
        return html;
      } catch(e) {
        console.error('renderMd error:', e);
        return text || '';
      }
    },

    // ═══════════════════════════════════════════════════════════════════
    // AI TRAINER METHODS  –  полностью переписаны, без дублей
    // ═══════════════════════════════════════════════════════════════════

    // ── Dependencies ────────────────────────────────────────────────────

    async checkTrainingDeps(force = false) {
      try {
        const r = await window.pywebview.api.check_training_dependencies(force);
        this.trainingDepsReady = r.ready;
        this.trainingMissingDeps = r.missing || [];
        return r;
      } catch(e) {
        this.trainingDepsReady = false;
        this.trainingMissingDeps = [];
        return { ready: false, missing: [] };
      }
    },

    async installTrainingDeps() {
      this.installingDeps = true;
      this.trainingStatusMessage = 'Запуск установки...';
      try {
        await window.pywebview.api.install_training_dependencies();
        // Результат придёт через событие training-deps-result
      } catch(e) {
        this.installingDeps = false;
        this.toast('Ошибка установки: ' + e.message, 'error');
      }
    },

    // ── Training lifecycle ───────────────────────────────────────────────

    async startTraining() {
      if (!this.realTrainingConfig.dataset_path) {
        this.toast('Выберите датасет', 'error'); return;
      }

      this.realTrainingInProgress = true;
      this.trainingHistory = { loss: [], lr: [], epoch: [], step: [] };
      this.trainingStatusMessage = 'Инициализация...';
      this.realTrainingProgress = 0;
      this.trainingStats = { step: 0, total_steps: 0, epoch_step: 0, epoch_total_steps: 0, loss: null, learning_rate: null, epoch: 0, elapsed_time: 0 };

      try {
        const cfg = {
          mode:                    'scratch',
          name:                    this.realTrainingConfig.name || 'my-model',
          dataset_path:            this.realTrainingConfig.dataset_path,
          epochs:                  this.realTrainingConfig.epochs,
          batch_size:              this.realTrainingConfig.batch_size,
          learning_rate:           this.realTrainingConfig.learning_rate,
          max_length:              this.realTrainingConfig.max_length,
          d_model:                 this.realTrainingConfig.d_model,
          nhead:                   this.realTrainingConfig.nhead,
          num_enc_layers:          this.realTrainingConfig.num_enc_layers,
          num_dec_layers:          this.realTrainingConfig.num_dec_layers,
          dim_ff:                  this.realTrainingConfig.dim_ff,
          dropout:                 this.realTrainingConfig.dropout,
          min_freq:                this.realTrainingConfig.min_freq,
          accumulation_steps:      this.realTrainingConfig.accumulation_steps,
          checkpoint_every_epochs: this.realTrainingConfig.checkpoint_every_epochs,
        };
        const r = await window.pywebview.api.start_training(cfg);
        if (r && r.error) throw new Error(r.error);
        this.toast('Обучение запущено', 'success');
        this.trainerTab = 'progress';
      } catch(e) {
        this.realTrainingInProgress = false;
        this.toast('Ошибка запуска: ' + e.message, 'error');
      }
    },

    // alias, вызывается из старой кнопки
    async startRealTraining() { return this.startTraining(); },

    async stopTraining() {
      try {
        await window.pywebview.api.stop_training();
        this.realTrainingInProgress = false;
        this.toast('Остановка обучения...', 'info');
      } catch(e) {
        this.toast('Ошибка: ' + e.message, 'error');
      }
    },
    async stopRealTraining() { return this.stopTraining(); },

    // ── Event handlers (вызываются из mounted) ───────────────────────────

    _onTrainingProgress(data) {
      this.realTrainingProgress  = data.progress || 0;
      this.trainingStatusMessage = data.message  || '';
      const lrVal = (data.learning_rate != null) ? data.learning_rate : data.lr;
      this.trainingStats = {
        step:         data.step,
        total_steps:  data.total_steps,
        epoch_step:   data.epoch_step,
        epoch_total_steps: data.epoch_total_steps,
        loss:         data.loss,
        learning_rate: lrVal,
        epoch:        data.epoch,
        elapsed_time: data.elapsed_time,
      };
      if (data.loss != null)  this.trainingHistory.loss.push(data.loss);
      if (lrVal != null)      this.trainingHistory.lr.push(lrVal);
      if (data.step != null)  this.trainingHistory.step.push(data.step);
      if (data.epoch != null) this.trainingHistory.epoch.push(data.epoch);
      this.$nextTick(() => this.drawLossChart());
    },

    _onTrainingStatus(data) {
      this.trainingStatusMessage = data.message || '';
    },

    _onTrainingComplete(data) {
      this.realTrainingInProgress = false;
      this.realTrainingProgress   = 100;
      this.trainingStatusMessage  = data.message || 'Обучение завершено';
      if (data.training_history) this.trainingHistory = data.training_history;
      if (data.stopped) {
        this.toast('Обучение остановлено. Последний checkpoint сохранен.', 'info');
      } else {
        this.toast('Обучение завершено!', 'success');
      }
      this.loadTrainedModels();
      this.$nextTick(() => this.drawLossChart());
    },

    _onTrainingError(data) {
      this.realTrainingInProgress = false;
      this.trainingStatusMessage  = 'Ошибка: ' + data.error;
      this.toast('Ошибка обучения: ' + data.error, 'error');
    },

    _onDepsResult(data) {
      this.installingDeps = false;
      if (data.ready) {
        this.trainingDepsReady = true;
        this.trainingMissingDeps = [];
        this.toast('Зависимости установлены!', 'success');
      } else {
        const failed = (data.failed || []).join(', ');
        this.toast('Не удалось установить: ' + (failed || data.message), 'error');
      }
    },

    // ── Dataset management ───────────────────────────────────────────────

    async loadDatasets() {
      try {
        this.availableDatasets = await window.pywebview.api.get_datasets() || [];
        if (!this.realTrainingConfig.dataset_path) {
          const builtin = this.availableDatasets.find(d => d.id === 'builtin_default_v1');
          if (builtin) this.realTrainingConfig.dataset_path = builtin.path;
        }
      } catch(e) { this.availableDatasets = []; }
    },

    async searchDatasets() {
      if (!this.datasetSearch.trim() || this.datasetSearching) return;
      this.datasetSearching = true;
      try {
        const r = await window.pywebview.api.search_hf_datasets(this.datasetSearch);
        this.datasetSearchResults = r.error ? [] : r;
      } catch(e) { this.datasetSearchResults = []; }
      this.datasetSearching = false;
    },

    async downloadDataset(id) {
      this.toast('Загрузка датасета ' + id + '...', 'info');
      try {
        const r = await window.pywebview.api.download_dataset(id);
        if (r.error) throw new Error(r.error);
        this.toast('Датасет загружен!', 'success');
        await this.loadDatasets();
      } catch(e) {
        this.toast('Ошибка: ' + e.message, 'error');
      }
    },

    async previewDataset(id) {
      try {
        const r = await window.pywebview.api.preview_dataset(id);
        if (r.error) throw new Error(r.error);
        alert('Первые примеры:\n\n' + r.samples.map((s, i) => `${i+1}. ${s.substring(0, 300)}`).join('\n\n'));
      } catch(e) { this.toast('Ошибка: ' + e.message, 'error'); }
    },

    async deleteDataset(id) {
      if (!confirm('Удалить датасет?')) return;
      try {
        await window.pywebview.api.delete_dataset(id);
        await this.loadDatasets();
        this.toast('Удалено', 'success');
      } catch(e) { this.toast('Ошибка удаления', 'error'); }
    },

    async browseTrainingFile() {
      const p = await window.pywebview.api.prompt_file_dialog();
      if (!p) return;
      try {
        const r = await window.pywebview.api.load_dataset_file(p);
        if (r.error) throw new Error(r.error);
        this.toast('Файл загружен: ' + r.name, 'success');
        await this.loadDatasets();
      } catch(e) { this.toast('Ошибка: ' + e.message, 'error'); }
    },

    async browseImageFolder() {
      const p = await window.pywebview.api.prompt_folder_dialog();
      if (!p) return;
      try {
        const r = await window.pywebview.api.load_image_dataset_folder(p);
        if (r.error) throw new Error(r.error);
        this.toast('Папка загружена: ' + r.name, 'success');
        this.realTrainingConfig.dataset_path = p;
      } catch(e) { this.toast('Ошибка: ' + e.message, 'error'); }
    },

    // ── Trained models ───────────────────────────────────────────────────

    async loadTrainedModels() {
      try {
        this.trainedModels = await window.pywebview.api.get_trained_models() || [];
        this.trainedModelsList = this.trainedModels.map(m => ({
          id: m.id,
          name: m.name || m.id,
          size: m.size || '',
          train_mode: m.train_mode || ''
        }));
      } catch(e) {
        this.trainedModels = [];
        this.trainedModelsList = [];
      }
    },

    async loadTrainedModelsList()  { return this.loadTrainedModels(); },
    async loadTrainedModelsForChat() { return this.loadTrainedModels(); },

    async deleteTrainedModel(id) {
      if (!confirm('Удалить обученную модель?')) return;
      try {
        await window.pywebview.api.delete_trained_model(id);
        await this.loadTrainedModels();
        this.toast('Модель удалена', 'success');
      } catch(e) { this.toast('Ошибка: ' + e.message, 'error'); }
    },

    async useTrainedModel(id) {
      this.toast('Функция загрузки обученной модели в чат будет доступна после перезапуска с указанием пути к адаптеру.', 'info');
    },

    async exportModel() {
      if (!this.selectedTrainedModel) { this.toast('Выберите модель', 'error'); return; }
      this.ieStatus = { type: 'info', message: 'Экспорт...', progress: 0 };
      try {
        const r = await window.pywebview.api.export_trained_model(this.selectedTrainedModel, 'adapter');
        if (r.error) throw new Error(r.error);
        this.ieStatus = { type: 'success', message: 'Экспортировано: ' + r.path };
      } catch(e) { this.ieStatus = { type: 'error', message: 'Ошибка: ' + e.message }; }
    },

    // ── Import / Export ──────────────────────────────────────────────────

    async importModel() {
      const p = await window.pywebview.api.prompt_file_dialog();
      if (!p) return;
      this.ieStatus = { type: 'info', message: 'Импорт модели...', progress: 0 };
      try {
        const r = await window.pywebview.api.import_model_file(p);
        if (r.error) throw new Error(r.error);
        this.ieStatus = { type: 'success', message: 'Модель импортирована: ' + r.name };
      } catch(e) { this.ieStatus = { type: 'error', message: 'Ошибка: ' + e.message }; }
    },

    async importDataset() {
      const p = await window.pywebview.api.prompt_file_dialog();
      if (!p) return;
      this.ieStatus = { type: 'info', message: 'Импорт датасета...', progress: 0 };
      try {
        const r = await window.pywebview.api.load_dataset_file(p);
        if (r.error) throw new Error(r.error);
        this.ieStatus = { type: 'success', message: 'Датасет импортирован: ' + r.name };
        await this.loadDatasets();
      } catch(e) { this.ieStatus = { type: 'error', message: 'Ошибка: ' + e.message }; }
    },

    async exportDataset() {
      if (!this.realTrainingConfig.dataset_path) { this.toast('Выберите датасет', 'error'); return; }
      const ds = this.availableDatasets.find(d => d.path === this.realTrainingConfig.dataset_path);
      if (!ds) { this.toast('Датасет не найден', 'error'); return; }
      this.ieStatus = { type: 'info', message: 'Экспорт...', progress: 0 };
      try {
        const r = await window.pywebview.api.export_dataset_file(ds.id);
        if (r.error) throw new Error(r.error);
        this.ieStatus = { type: 'success', message: 'Экспортировано: ' + r.path };
      } catch(e) { this.ieStatus = { type: 'error', message: 'Ошибка: ' + e.message }; }
    },

    // ── Trainer chat (chat tab) ──────────────────────────────────────────

    async loadModelForTraining() {
      if (!this.trainerSelectedModel) return;
      this.trainerModelLoading = true;
      try {
        const r = await window.pywebview.api.load_model_for_training(this.trainerSelectedModel);
        if (r.error) throw new Error(r.error);
        this.trainerModelLoaded = true;
        this.toast('Модель загружена', 'success');
      } catch(e) {
        this.toast('Ошибка загрузки: ' + e.message, 'error');
      }
      this.trainerModelLoading = false;
    },

    async sendTrainerMessage() {
      if (!this.trainerInput.trim() || !this.trainerModelLoaded) return;
      const msg = this.trainerInput.trim();
      this.trainerInput = '';
      this.trainerMessages.push({ role: 'user', content: msg });
      this.trainerTyping = true;
      try {
        const r = await window.pywebview.api.trainer_chat(msg);
        this.trainerTyping = false;
        if (r.error) throw new Error(r.error);
        this.trainerMessages.push({ role: 'assistant', content: r.response });
      } catch(e) {
        this.trainerTyping = false;
        this.trainerMessages.push({ role: 'assistant', content: 'Ошибка: ' + e.message });
      }
      this.$nextTick(() => {
        const box = this.$refs.trainerChatBox;
        if (box) box.scrollTop = box.scrollHeight;
      });
    },

    async saveTrainingData() {
      try {
        const r = await window.pywebview.api.save_training_data(this.trainerMessages);
        if (r.error) throw new Error(r.error);
        this.toast('Сохранено: ' + r.filename, 'success');
        await this.loadDatasets();
      } catch(e) { this.toast('Ошибка: ' + e.message, 'error'); }
    },

    // ── Loss chart ───────────────────────────────────────────────────────

    drawLossChart() {
      const canvas = this.$refs.lossChart;
      if (!canvas || !this.trainingHistory.loss || this.trainingHistory.loss.length < 2) return;

      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const W = rect.width, H = rect.height, pad = 36;
      const losses = this.trainingHistory.loss;
      const steps  = this.trainingHistory.step.length === losses.length
        ? this.trainingHistory.step
        : losses.map((_, i) => i + 1);

      const minL = Math.min(...losses), maxL = Math.max(...losses);
      const rng  = maxL - minL || 1;

      // Background
      ctx.clearRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const y = pad + (H - 2 * pad) * i / 5;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.lineTo(W - pad, H - pad);
      ctx.stroke();

      // Labels
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `${10 * dpr / dpr}px sans-serif`;
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const v = maxL - rng * i / 4;
        const y = pad + (H - 2 * pad) * i / 4;
        ctx.fillText(v.toFixed(3), pad - 4, y + 3);
      }

      // Loss line with gradient
      const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
      grad.addColorStop(0, '#5b6ef5');
      grad.addColorStop(1, '#10b981');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      losses.forEach((loss, i) => {
        const x = pad + (steps[i] - steps[0]) / Math.max(steps[steps.length-1] - steps[0], 1) * (W - 2*pad);
        const y = H - pad - (loss - minL) / rng * (H - 2*pad);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill under line
      const lastX = pad + (steps[steps.length-1] - steps[0]) / Math.max(steps[steps.length-1] - steps[0], 1) * (W - 2*pad);
      ctx.lineTo(lastX, H - pad);
      ctx.lineTo(pad, H - pad);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, pad, 0, H - pad);
      fillGrad.addColorStop(0, 'rgba(91,110,245,0.25)');
      fillGrad.addColorStop(1, 'rgba(91,110,245,0)');
      ctx.fillStyle = fillGrad;
      ctx.fill();
    },

    formatTime(seconds) {
      if (!seconds) return '0s';
      if (seconds < 60) return seconds + 's';
      const m = Math.floor(seconds / 60), s = seconds % 60;
      if (m < 60) return `${m}m ${s}s`;
      return `${Math.floor(m/60)}h ${m%60}m`;
    },

    async createNewModel() {
      this.toast('Используйте вкладку "Новое обучение" для создания модели', 'info');
    },

  },

  mounted() {
    this.load();

    // Chat list auto-refresh
    setInterval(async () => {
      if(!this.isGen) {
        const c = await window.pywebview.api.get_chats();
        if(JSON.stringify(c) !== JSON.stringify(this.chats)) {
          this.chats = c;
          this.listKey++;
        }
      }
    }, 3000);

    // Real-time model list refresh
    setInterval(async () => {
      const models = await window.pywebview.api.get_local_models();
      if(JSON.stringify(models) !== JSON.stringify(this.localModels)) {
        this.localModels = models;
        this.listKey++;
      }
    }, 4000);

    // Trained models refresh
    setInterval(async () => {
      await this.loadTrainedModelsForChat();
    }, 10000);

    // System stats refresh
    setInterval(async () => {
      const s = await window.pywebview.api.get_system_stats();
      Object.assign(this.sys, s);
    }, 2000);

    // AI streaming events
    window.addEventListener('ai-chunk', e => {
      const last = this.msgs[this.msgs.length - 1];
      if(last && last.role === 'assistant') { last.content += e.detail; this.scroll(); }
    });

    window.addEventListener('ai-error', e => {
      this.isGen = false;
      this.modelThinking = false;
      if(this.thinkingInterval) {
        clearInterval(this.thinkingInterval);
        this.thinkingInterval = null;
      }
      const last = this.msgs[this.msgs.length - 1];
      if(last && last.role === 'assistant') last.content = '❌ Ошибка: ' + e.detail;
      this.toast('Ошибка', 'error');
    });

    window.addEventListener('ai-done', e => {
      this.isGen = false;
      this.modelThinking = false;
      if(this.thinkingInterval) {
        clearInterval(this.thinkingInterval);
        this.thinkingInterval = null;
      }
      this.genTime = e.detail?.time || 0;
      const last = this.msgs[this.msgs.length - 1];
      if(last && last.role === 'assistant' && !last.timestamp)
        last.timestamp = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      this.$nextTick(() => { this.scroll(); });
      setTimeout(() => this.tools = [], 3000);
    });

    window.addEventListener('ai-tool-used', e => {
      this.tools = this.tools.filter(t => t.tool !== e.detail.tool);
      this.tools.push(e.detail);
      if(e.detail.status !== 'running')
        setTimeout(() => this.tools = this.tools.filter(t => t !== e.detail), 3500);
    });

    window.addEventListener('dl-start',    e => { this.activeDownloads[e.detail.id] = {text:'Загрузка...', percent:0}; this.listKey++; });
    window.addEventListener('dl-progress', e => { if(this.activeDownloads[e.detail.id]) { this.activeDownloads[e.detail.id].text = e.detail.text; this.activeDownloads[e.detail.id].percent = e.detail.percent; } });
    window.addEventListener('dl-done',     e => { delete this.activeDownloads[e.detail.id]; this.refreshModels(); this.toast('Загрузка завершена','success'); });
    window.addEventListener('dl-error',    e => { delete this.activeDownloads[e.detail.id]; this.toast('Ошибка загрузки','error'); });
    window.addEventListener('models-refresh', () => this.refreshModels());

    document.addEventListener('keydown', e => {
      if(e.ctrlKey && e.key==='n') { e.preventDefault(); this.newChat(); }
      if(e.ctrlKey && e.key==='k') { e.preventDefault(); this.chatSearch=''; }
      if(e.key==='Escape') { 
        this.settingsOpen=false; 
        this.hubOpen=false; 
        this.tplPanel=false; 
        this.editIdx=-1; 
        this.searchOpen=false; 
        this.statsOpen=false;
        this.showThinkingOverlay=false;
        this.trainerOpen=false;
      }
    });

    // Training events  (одна регистрация, без дублей)
    window.addEventListener('training-progress',   e => this._onTrainingProgress(e.detail));
    window.addEventListener('training-status',     e => this._onTrainingStatus(e.detail));
    window.addEventListener('training-complete',   e => this._onTrainingComplete(e.detail));
    window.addEventListener('training-error',      e => this._onTrainingError(e.detail));
    window.addEventListener('training-deps-result',e => this._onDepsResult(e.detail));

    // Load trainer data when opened
    this.$watch('trainerOpen', async (val) => {
      if (val) {
        await this.checkTrainingDeps();
        await this.loadDatasets();
        await this.loadTrainedModels();
      }
    });

    // Drag and drop for files
    const chatArea = document.querySelector('.chat-area');
    if(chatArea) {
      chatArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatArea.style.background = 'rgba(91,110,245,0.05)';
      });
      chatArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        chatArea.style.background = '';
      });
      chatArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        chatArea.style.background = '';
        const files = e.dataTransfer.files;
        if(files.length > 0) {
          for(const file of files) {
            if(file.type.startsWith('image/')) {
              this.input += `\n[Изображение: ${file.name}]\n`;
            } else if(file.name.endsWith('.pdf')) {
              this.input += `\n[PDF: ${file.name}]\n`;
            } else if(file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.py') || file.name.endsWith('.js') || file.name.endsWith('.json')) {
              this.input += `\n[Файл: ${file.name}]\n`;
            } else {
              this.input += `\n[Вложение: ${file.name}]\n`;
            }
          }
          this.toast(`Добавлено ${files.length} файл(ов)`, 'success');
        }
      });
    }
  }
});

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err, info);
};

app.mount('#app');
</script>
</body>
</html>
"""

