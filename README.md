# AI Buddy — Modern, Simple AI Chatbot Website

AI Buddy is a clean, modern, beginner-friendly AI chatbot web application built with **HTML, CSS, vanilla JavaScript**, and a lightweight **Node.js/Express backend**.

---

## 📁 Project Structure

```text
ai-simple-chatbot/
├── public/
│   ├── index.html        # Semantic HTML5 layout (sidebar, chat area, welcome screen, cards)
│   ├── style.css         # Complete responsive styles, lavender/blue gradients, animations
│   └── script.js         # Frontend interactions, safe markdown parsing, clipboard, sessions
├── .env                  # Environment variables (OpenAI API key, port, model)
├── .env.example          # Environment variable template
├── .gitignore            # Excludes node_modules, .env secrets, system files
├── package.json          # Node.js project manifest & dependencies
├── server.js             # Express backend with /api/chat, rate limiting, and OpenAI SDK
└── README.md             # Project documentation & step-by-step setup guide
```

---

## 🚀 Quick Start Guide

### Step 1: Install Node.js and Dependencies
Ensure you have [Node.js](https://nodejs.org/) installed (v18 or newer recommended).

In your project directory, install dependencies:
```bash
npm install
```

This installs:
- `express`: Fast web framework for static serving and the `/api/chat` endpoint.
- `dotenv`: Securely loads variables from `.env`.
- `cors`: Cross-Origin Resource Sharing middleware.
- `openai`: Official OpenAI JavaScript SDK.
- `express-rate-limit`: Protects the backend against excessive requests.

---

### Step 2: Configure the `.env` File
Create or edit your `.env` file in the root directory:

```env
# Server Port (default 3000)
PORT=3000

# OpenAI API Key (from https://platform.openai.com/api-keys)
OPENAI_API_KEY=your_openai_api_key_here

# Configurable OpenAI Model
OPENAI_MODEL=gpt-4o-mini
```

> **Note:** If you run the server without an API key, AI Buddy automatically operates in **Interactive Demo Mode**, allowing you to test the interface, suggestions, copy buttons, and responsive layout immediately!

---

### Step 3: Get an OpenAI API Key (Optional for Live Mode)
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys).
2. Sign in or create an account.
3. Click **"Create new secret key"**, provide a name (e.g. `ai-buddy-local`), and copy the key (`sk-...`).
4. Paste the key into your `.env` file as `OPENAI_API_KEY=sk-...`.

---

### Step 4: (Alternative) Use 100% Free Local Ollama
If you do not have OpenAI credits or prefer running a private, local model offline:

1. Download and install **Ollama** from [ollama.com](https://ollama.com/).
2. Pull and start a model (e.g. Llama 3.2):
   ```bash
   ollama run llama3.2
   ```
3. Update your `.env` to point to Ollama's local OpenAI-compatible endpoint:
   ```env
   PORT=3000
   OPENAI_BASE_URL=http://localhost:11434/v1
   OPENAI_MODEL=llama3.2
   OPENAI_API_KEY=ollama
   ```
4. AI Buddy will automatically query your local Ollama instance with zero code changes!

---

### Step 5: Start the Backend Server
Run the standard start command:
```bash
npm start
```

Or run with automatic reload during development:
```bash
npm run dev
```

You should see:
```text
====================================================
🤖 AI Buddy Chatbot Server is running!
🌐 Local URL: http://localhost:3000
🧠 Model:     gpt-4o-mini
🔑 API Key:   Configured (Active)
====================================================
```

---

### Step 6: Open the Chatbot in Your Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## ✨ Features

- **Modern & Minimal UI**: Soft lavender/blue gradient accents (`#6366F1` and `#8B5CF6`), clean white cards, subtle shadows, and readable typography.
- **Suggestion Cards**: 4 quick-start prompts to explore concepts, write code, learn topics, or brainstorm ideas.
- **Auto-Expanding Input**: Dynamically expands up to 160px; handles `Enter` to send and `Shift + Enter` for new lines.
- **Chat Actions**: "Copy Response" with visual feedback and "Retry" button to regenerate answers.
- **Session History**: Persists past conversations in `localStorage` in the collapsible left sidebar.
- **Safe Markdown Rendering**: Safely renders code blocks, bulleted lists, and bold text while preventing script/HTML injection.
- **Fully Responsive**: Adapts seamlessly to desktop, tablet, and mobile screens with a slide-out drawer navigation.
- **Keyboard Shortcuts**: `Ctrl + K` (or `Cmd + K`) starts a new chat, `Esc` closes modals and drawers.

---

## 🛠️ Troubleshooting Common Errors

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `Error: 401 Invalid OpenAI API key` | Incorrect or expired API key | Check `.env` and verify your key starts with `sk-` without trailing spaces. |
| `Error: 429 Quota Exceeded` | OpenAI account has depleted credits | Visit [platform.openai.com/billing](https://platform.openai.com/billing) to add credits or switch to **Ollama** (free). |
| `Error: Connection Refused` | Ollama or backend is not running | If using Ollama, run `ollama serve`. If using Node, check `npm start`. |
| Port 3000 already in use | Another process is using port 3000 | Change `PORT=3001` in `.env` and restart. |
