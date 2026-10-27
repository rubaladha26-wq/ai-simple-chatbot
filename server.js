/**
 * AI Buddy — Node.js & Express Backend Server
 * 
 * Secure backend handling:
 * - Environment variable management via dotenv
 * - OpenAI SDK integration with configurable models
 * - Support for local Ollama / OpenRouter through custom base URLs
 * - Request validation & rate limiting for security
 * - Express static file serving for public frontend assets
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined;

// ============================================================================
// OpenAI Client Initialization
// ============================================================================
// Initialize the official OpenAI client SDK
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here' ? OPENAI_API_KEY : 'dummy-key',
  baseURL: OPENAI_BASE_URL || undefined,
});

// Helper flag to verify if a genuine API key has been supplied
const isConfigured = Boolean(
  OPENAI_API_KEY &&
  OPENAI_API_KEY !== 'your_openai_api_key_here' &&
  OPENAI_API_KEY.trim().length > 10
);

// ============================================================================
// Middleware Setup
// ============================================================================
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve frontend static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic request rate limiter (max 60 requests per 1 minute window per IP)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests sent. Please wait a moment before trying again.',
  },
});

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /api/info
 * Returns non-sensitive engine status for frontend display
 */
app.get('/api/info', (req, res) => {
  res.json({
    model: OPENAI_MODEL,
    hasApiKey: isConfigured,
    provider: OPENAI_BASE_URL ? 'Custom / Ollama' : 'OpenAI',
  });
});

/**
 * POST /api/chat
 * Handles incoming chat messages, validates payload, and queries the AI model
 */
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { messages } = req.body;

    // 1. Input Validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: "messages" must be a non-empty array of message objects.',
      });
    }

    // Ensure messages don't exceed reasonable conversation depth (prevent token overload)
    const sanitizedMessages = messages.slice(-20).map((msg) => {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      const content = String(msg.content || '').trim().slice(0, 4000);
      return { role, content };
    });

    const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    // 2. Fallback when OPENAI_API_KEY is not configured or left as placeholder
    // This allows beginners to run and experience the UI immediately with instructions
    if (!isConfigured && !OPENAI_BASE_URL) {
      const demoReply = generateDemoResponse(lastMessage.content);
      return res.json({
        reply: demoReply,
        note: 'Running in demo mode because OPENAI_API_KEY is not configured in .env',
      });
    }

    // 3. Prepare system prompt to ensure friendly, concise, and helpful responses
    const systemPrompt = {
      role: 'system',
      content:
        'You are AI Buddy, a friendly, concise, and modern AI assistant. Provide helpful, structured, and accurate responses. Format code blocks with language identifiers where appropriate.',
    };

    const conversationPayload = [systemPrompt, ...sanitizedMessages];

    // 4. Invoke OpenAI Chat Completion API
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: conversationPayload,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const reply = completion.choices[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: 'The AI model returned an empty response. Please try again.',
      });
    }

    // Return the successful response
    return res.json({ reply });

  } catch (error) {
    console.error('Server error during AI request:', error);

    // Provide friendly, actionable error messages based on OpenAI error status codes
    if (error.status === 401) {
      return res.status(401).json({
        error:
          'Invalid OpenAI API key. Please check your OPENAI_API_KEY in the .env file.',
      });
    } else if (error.status === 429) {
      return res.status(429).json({
        error:
          'OpenAI API rate limit or quota exceeded. Please verify your account billing and credits at platform.openai.com.',
      });
    } else if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error:
          'Connection refused. If using local Ollama, ensure "ollama serve" is running.',
      });
    }

    return res.status(500).json({
      error:
        error.message ||
        'An unexpected error occurred while communicating with the AI service.',
    });
  }
});

/**
 * Generates an informative demo response when no API key is configured yet.
 * Helps beginners test the full interface right away and explains how to connect OpenAI or Ollama.
 * @param {string} userQuery
 * @returns {string}
 */
function generateDemoResponse(userQuery) {
  const queryLower = userQuery.toLowerCase();

  if (queryLower.includes('quantum')) {
    return `**Quantum Computing Explained Simply**

Think of normal computers as light switches: they are either **ON (1)** or **OFF (0)**. These are called *bits*.

A **quantum computer** uses quantum physics principles like *superposition*. Instead of just ON or OFF, a quantum bit (or **qubit**) can exist in a combination of both states at once!

- **Analogy:** Flipping a coin. While it spins in the air, it's a blur of both heads and tails simultaneously.
- **Why it matters:** It can evaluate thousands of possibilities at once, solving complex calculations in seconds that would take standard supercomputers thousands of years.

*(Note: AI Buddy is currently running in Demo Mode. Add your \`OPENAI_API_KEY\` in \`.env\` to unlock live GPT-4o-mini responses!)*`;
  }

  if (queryLower.includes('debounce') || queryLower.includes('code')) {
    return `Here is a clean, practical JavaScript **debounce** function:

\`\`\`javascript
function debounce(fn, delay = 300) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// Example usage:
const handleSearch = debounce((query) => {
  console.log("Searching for:", query);
}, 400);

// Input event listener
document.querySelector('#search').addEventListener('input', (e) => {
  handleSearch(e.target.value);
});
\`\`\`

**How it works:**
- Every keystroke resets the timer via \`clearTimeout\`.
- The actual function runs only after the user stops typing for 400 milliseconds.

*(Note: To connect live AI models, open \`.env\` and insert your OpenAI API key).*`;
  }

  return `Hello! 👋 I received your message:

> "${userQuery}"

**AI Buddy is working great!** You are currently seeing this interactive demo response because **no OpenAI API Key was detected in your \`.env\` file**.

### How to connect Live AI:
1. Open the \`.env\` file in your project folder.
2. Replace \`your_openai_api_key_here\` with your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys):
   \`\`\`env
   OPENAI_API_KEY=sk-proj-...
   OPENAI_MODEL=gpt-4o-mini
   \`\`\`
3. Restart your server (\`npm start\`).

### Alternatively, use 100% Free Local Ollama:
1. Download Ollama from [ollama.com](https://ollama.com) and run:
   \`\`\`bash
   ollama run llama3.2
   \`\`\`
2. In your \`.env\` set:
   \`\`\`env
   OPENAI_BASE_URL=http://localhost:11434/v1
   OPENAI_MODEL=llama3.2
   \`\`\``;
}

// ============================================================================
// Start Server
// ============================================================================
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🤖 AI Buddy Chatbot Server is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🧠 Model:     ${OPENAI_MODEL}`);
  console.log(
    `🔑 API Key:   ${
      isConfigured
        ? 'Configured (Active)'
        : 'Not Set (Interactive Demo / Fallback Active)'
    }`
  );
  if (OPENAI_BASE_URL) {
    console.log(`🔗 Base URL:  ${OPENAI_BASE_URL}`);
  }
  console.log(`====================================================`);
});

