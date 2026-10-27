/**
 * AI Buddy — Frontend Interactions & API Communication
 * 
 * Features:
 * - Session message history management
 * - Fetch communication with Express backend (/api/chat)
 * - Safe HTML escaping & lightweight markdown formatting
 * - Auto-expanding input textarea with Enter / Shift+Enter handling
 * - Copy response to clipboard with animated visual feedback
 * - Retry capability for AI responses
 * - Recent conversations persistence in localStorage
 * - Responsive mobile sidebar controls & keyboard shortcuts
 */

// ============================================================================
// Global State & Elements
// ============================================================================
const state = {
  messages: [], // Holds current session messages: [{ role: 'user' | 'assistant', content: string }]
  isProcessing: false,
  activeSessionId: null,
};

// DOM Elements
const chatScrollContainer = document.getElementById('chatScrollContainer');
const welcomeSection = document.getElementById('welcomeSection');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const recentList = document.getElementById('recentList');
const emptyRecentText = document.getElementById('emptyRecentText');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const modelNameDisplay = document.getElementById('modelNameDisplay');
const settingsModelBadge = document.getElementById('settingsModelBadge');
const toastElement = document.getElementById('toast');

// Mobile Sidebar Elements
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

// Settings Modal Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const closeSettingsFooterBtn = document.getElementById('closeSettingsFooterBtn');
const modalClearHistoryBtn = document.getElementById('modalClearHistoryBtn');

// ============================================================================
// Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadRecentChats();
  startNewSession(false);
  fetchServerInfo();
});

// ============================================================================
// Event Listeners Setup
// ============================================================================
function setupEventListeners() {
  // Input form submission
  chatForm.addEventListener('submit', handleFormSubmit);

  // Dynamic textarea sizing & input change detection
  messageInput.addEventListener('input', handleInputChange);
  messageInput.addEventListener('keydown', handleInputKeydown);

  // New Chat buttons
  newChatBtn.addEventListener('click', () => startNewSession(true));
  clearChatBtn.addEventListener('click', () => startNewSession(true));

  // Clear history buttons
  clearHistoryBtn.addEventListener('click', clearAllStoredChats);
  modalClearHistoryBtn.addEventListener('click', () => {
    clearAllStoredChats();
    closeModal();
  });

  // Suggestion Cards click delegation
  const suggestionCards = document.querySelectorAll('.suggestion-card');
  suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt && !state.isProcessing) {
        messageInput.value = prompt;
        handleInputChange();
        sendMessage(prompt);
      }
    });
  });

  // Mobile Sidebar Toggles
  openSidebarBtn.addEventListener('click', openMobileSidebar);
  closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Settings Modal Toggles
  settingsBtn.addEventListener('click', openModal);
  closeSettingsBtn.addEventListener('click', closeModal);
  closeSettingsFooterBtn.addEventListener('click', closeModal);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeModal();
  });

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K for new chat, Esc for modal)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      startNewSession(true);
      messageInput.focus();
    } else if (e.key === 'Escape') {
      closeModal();
      closeMobileSidebar();
    }
  });
}

// ============================================================================
// Message Handling & Backend API Call
// ============================================================================

/**
 * Handles form submit event
 */
function handleFormSubmit(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || state.isProcessing) return;

  sendMessage(text);
}

/**
 * Sends a user message to the backend and handles AI response
 * @param {string} text - The user query
 */
async function sendMessage(text) {
  if (state.isProcessing) return;

  // 1. Reset input box
  messageInput.value = '';
  handleInputChange();

  // 2. Hide welcome screen once conversation starts
  welcomeSection.style.display = 'none';

  // 3. Append user message to UI and state
  const userTimestamp = formatTime(new Date());
  appendMessageToUI('user', text, userTimestamp);
  state.messages.push({ role: 'user', content: text });

  // 4. Save session into recent chats
  saveCurrentSession();

  // 5. Update state & show typing indicator
  setProcessing(true);
  showTypingIndicator(true);
  scrollToBottom();

  try {
    // 6. Call Express backend endpoint
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: state.messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server responded with status ${response.status}`);
    }

    const aiReply = data.reply || "I'm sorry, I couldn't generate a response.";
    const aiTimestamp = formatTime(new Date());

    // 7. Append AI message to UI and state
    appendMessageToUI('assistant', aiReply, aiTimestamp);
    state.messages.push({ role: 'assistant', content: aiReply });

    // 8. Update persistent session
    saveCurrentSession();

  } catch (err) {
    console.error('Error during chat request:', err);
    // Display friendly error card
    appendErrorMessage(err.message);
  } finally {
    showTypingIndicator(false);
    setProcessing(false);
    scrollToBottom();
  }
}

/**
 * Retries generating a response for the last user message
 */
function retryLastMessage() {
  if (state.isProcessing) return;

  // Find last user message in the current conversation
  const lastUserMsg = [...state.messages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return;

  // Remove the failed AI response or last assistant message if exists
  if (state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'assistant') {
    state.messages.pop();
  }

  // Resend the message
  sendMessage(lastUserMsg.content);
}

// ============================================================================
// UI Rendering & Safe Markdown Formatting
// ============================================================================

/**
 * Appends a user or assistant message to the chat view
 * @param {'user'|'assistant'} role - Sender role
 * @param {string} content - Message text
 * @param {string} timestamp - Formatted time string
 */
function appendMessageToUI(role, content, timestamp) {
  const row = document.createElement('div');
  row.className = `message-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

  if (role === 'user') {
    row.innerHTML = `
      <div class="message-wrapper">
        <div class="user-bubble">${escapeHTML(content).replace(/\n/g, '<br>')}</div>
        <span class="message-timestamp">${timestamp}</span>
      </div>
    `;
  } else {
    const formattedContent = parseMarkdownSafe(content);
    row.innerHTML = `
      <div class="avatar ai-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>
        </svg>
      </div>
      <div class="message-wrapper">
        <div class="ai-bubble">${formattedContent}</div>
        <div class="message-actions">
          <button class="action-btn copy-btn" title="Copy response to clipboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
          <button class="action-btn retry-btn" title="Retry last message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            <span>Retry</span>
          </button>
          <span class="message-timestamp">${timestamp}</span>
        </div>
      </div>
    `;

    // Attach copy button action
    const copyBtn = row.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => copyToClipboard(content, copyBtn));

    // Attach retry button action
    const retryBtn = row.querySelector('.retry-btn');
    retryBtn.addEventListener('click', retryLastMessage);
  }

  messagesContainer.appendChild(row);
  scrollToBottom();
}

/**
 * Renders a friendly error notification bubble in the chat view
 * @param {string} errorMessage - Error details
 */
function appendErrorMessage(errorMessage) {
  const row = document.createElement('div');
  row.className = 'message-row ai-row';
  
  // Format beginner-friendly instructions if API key is missing
  let hint = 'Please verify that your Node server is running and your network is connected.';
  if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('configured')) {
    hint = 'Check your <code>.env</code> file: ensure <code>OPENAI_API_KEY</code> is set, or switch to local Ollama.';
  }

  row.innerHTML = `
    <div class="avatar ai-avatar" style="background: #EF4444;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <div class="message-wrapper">
      <div class="ai-bubble error-bubble">
        <div class="error-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Something went wrong</span>
        </div>
        <p>${escapeHTML(errorMessage)}</p>
        <div class="error-tip">${hint}</div>
      </div>
      <div class="message-actions">
        <button class="action-btn retry-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"></path>
          </svg>
          <span>Retry</span>
        </button>
      </div>
    </div>
  `;

  row.querySelector('.retry-btn').addEventListener('click', retryLastMessage);
  messagesContainer.appendChild(row);
  scrollToBottom();
}

/**
 * Escapes raw strings to prevent HTML injection (XSS defense)
 * @param {string} str - Raw input
 * @returns {string} Sanitized string
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safe, lightweight markdown renderer for AI responses:
 * - Code blocks (```language ... ```)
 * - Inline code (`...`)
 * - Bold (**text**) and Italics (*text*)
 * - Unordered list items (- item)
 * - Paragraph breaks
 * @param {string} text - Raw AI message
 * @returns {string} Safe HTML string
 */
function parseMarkdownSafe(text) {
  if (!text) return '';

  // Step 1: Extract code blocks before HTML escaping
  const codeBlocks = [];
  let processed = text.replace(/```([\s\S]*?)```/g, (match, codeContent) => {
    // Check if first line specifies a language
    const lines = codeContent.split('\n');
    let code = codeContent;
    if (lines.length > 1 && lines[0].trim().match(/^[a-zA-Z0-9_-]+$/)) {
      code = lines.slice(1).join('\n');
    }
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${escapeHTML(code.trim())}</code></pre>`);
    return placeholder;
  });

  // Step 2: Escape remaining content
  processed = escapeHTML(processed);

  // Step 3: Inline code (`code`)
  processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Step 4: Bold (**text**) & Italic (*text*)
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Step 5: Convert Markdown list items (- item or * item)
  const lines = processed.split('\n');
  let inList = false;
  const resultLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        resultLines.push('<ul>');
        inList = true;
      }
      resultLines.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }
      resultLines.push(line);
    }
  }
  if (inList) {
    resultLines.push('</ul>');
  }

  processed = resultLines.join('\n');

  // Step 6: Convert double linebreaks to paragraphs
  const paragraphs = processed.split(/\n\s*\n/);
  processed = paragraphs
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<pre>') || trimmed.startsWith('<ul>')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  // Step 7: Restore code blocks
  codeBlocks.forEach((blockHtml, index) => {
    processed = processed.replace(`__CODE_BLOCK_${index}__`, blockHtml);
  });

  return processed;
}

// ============================================================================
// Clipboard & Toast Notification
// ============================================================================

/**
 * Copies text to user clipboard with visual feedback
 * @param {string} text - Text to copy
 * @param {HTMLElement} btnElement - The copy button clicked
 */
async function copyToClipboard(text, btnElement) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-https or older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    // Update button visual state
    const originalHtml = btnElement.innerHTML;
    btnElement.classList.add('copied');
    btnElement.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Copied!</span>
    `;
    showToast('Response copied to clipboard');

    setTimeout(() => {
      btnElement.classList.remove('copied');
      btnElement.innerHTML = originalHtml;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text:', err);
    showToast('Failed to copy response');
  }
}

/**
 * Displays floating notification toast
 * @param {string} message - Message text
 */
function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 2500);
}

// ============================================================================
// Session & History Management (LocalStorage)
// ============================================================================

/**
 * Starts a new chat session
 * @param {boolean} promptFocus - Whether to focus input
 */
function startNewSession(promptFocus = true) {
  // If current session has messages, make sure it was saved
  if (state.messages.length > 0) {
    saveCurrentSession();
  }

  // Reset in-memory state
  state.messages = [];
  state.activeSessionId = 'session_' + Date.now();

  // Reset DOM
  messagesContainer.innerHTML = '';
  welcomeSection.style.display = 'flex';
  showTypingIndicator(false);
  setProcessing(false);
  messageInput.value = '';
  handleInputChange();

  // Update recent list active state
  highlightActiveRecentSession();

  if (promptFocus) {
    messageInput.focus();
    closeMobileSidebar();
  }
}

/**
 * Saves current conversation to LocalStorage
 */
function saveCurrentSession() {
  if (!state.messages || state.messages.length === 0) return;

  const sessions = getStoredSessions();
  const firstUserMsg = state.messages.find(m => m.role === 'user');
  const title = firstUserMsg ? firstUserMsg.content.slice(0, 36) : 'Conversation';

  const sessionData = {
    id: state.activeSessionId,
    title: title,
    timestamp: Date.now(),
    messages: state.messages,
  };

  const existingIndex = sessions.findIndex(s => s.id === state.activeSessionId);
  if (existingIndex >= 0) {
    sessions[existingIndex] = sessionData;
  } else {
    sessions.unshift(sessionData);
  }

  // Keep max 25 recent conversations
  const trimmed = sessions.slice(0, 25);
  localStorage.setItem('ai_buddy_recent_chats', JSON.stringify(trimmed));
  renderRecentList(trimmed);
}

/**
 * Retrieves stored conversations from localStorage
 * @returns {Array} Array of saved sessions
 */
function getStoredSessions() {
  try {
    const raw = localStorage.getItem('ai_buddy_recent_chats');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Loads recent chats into the sidebar
 */
function loadRecentChats() {
  const sessions = getStoredSessions();
  renderRecentList(sessions);
}

/**
 * Renders recent conversations in the sidebar
 * @param {Array} sessions
 */
function renderRecentList(sessions) {
  if (!sessions || sessions.length === 0) {
    emptyRecentText.style.display = 'block';
    // Remove existing items except empty text
    const items = recentList.querySelectorAll('.recent-item');
    items.forEach(el => el.remove());
    return;
  }

  emptyRecentText.style.display = 'none';

  // Clear previous buttons
  const existingButtons = recentList.querySelectorAll('.recent-item');
  existingButtons.forEach(btn => btn.remove());

  sessions.forEach(session => {
    const btn = document.createElement('button');
    btn.className = `recent-item ${session.id === state.activeSessionId ? 'active' : ''}`;
    btn.dataset.id = session.id;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>${escapeHTML(session.title)}</span>
    `;

    btn.addEventListener('click', () => loadStoredSession(session.id));
    recentList.appendChild(btn);
  });
}

/**
 * Loads a past stored conversation
 * @param {string} sessionId
 */
function loadStoredSession(sessionId) {
  const sessions = getStoredSessions();
  const target = sessions.find(s => s.id === sessionId);
  if (!target) return;

  // Set active session
  state.activeSessionId = target.id;
  state.messages = [...target.messages];

  // Render to UI
  messagesContainer.innerHTML = '';
  welcomeSection.style.display = 'none';

  state.messages.forEach(msg => {
    const time = formatTime(new Date(target.timestamp || Date.now()));
    appendMessageToUI(msg.role, msg.content, time);
  });

  highlightActiveRecentSession();
  closeMobileSidebar();
  messageInput.focus();
}

/**
 * Highlights active recent session button in sidebar
 */
function highlightActiveRecentSession() {
  const items = recentList.querySelectorAll('.recent-item');
  items.forEach(item => {
    if (item.dataset.id === state.activeSessionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/**
 * Clears all locally stored conversations
 */
function clearAllStoredChats() {
  if (confirm('Are you sure you want to clear your chat history?')) {
    localStorage.removeItem('ai_buddy_recent_chats');
    loadRecentChats();
    startNewSession(true);
    showToast('Chat history cleared');
  }
}

// ============================================================================
// Input, UI Helper Functions & Accessibility
// ============================================================================

/**
 * Auto-expands textarea as user types and toggles send button disabled state
 */
function handleInputChange() {
  // Auto-resize
  messageInput.style.height = 'auto';
  const newHeight = Math.min(messageInput.scrollHeight, 160);
  messageInput.style.height = `${newHeight}px`;

  // Enable / disable send button
  const hasText = messageInput.value.trim().length > 0;
  sendBtn.disabled = !hasText || state.isProcessing;
}

/**
 * Handles Enter to submit and Shift+Enter for new lines
 */
function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) {
      chatForm.dispatchEvent(new Event('submit'));
    }
  }
}

/**
 * Sets processing state and disables/enables input elements
 * @param {boolean} processing
 */
function setProcessing(processing) {
  state.isProcessing = processing;
  messageInput.disabled = processing;
  sendBtn.disabled = processing || messageInput.value.trim().length === 0;

  if (!processing) {
    setTimeout(() => messageInput.focus(), 50);
  }
}

/**
 * Toggles typing indicator visibility
 * @param {boolean} visible
 */
function showTypingIndicator(visible) {
  typingIndicator.style.display = visible ? 'block' : 'none';
  if (visible) scrollToBottom();
}

/**
 * Smoothly scrolls chat to newest message
 */
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
  });
}

/**
 * Formats a Date object to a readable hh:mm AM/PM string
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// Mobile Sidebar Controls
// ============================================================================
function openMobileSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('active');
}

function closeMobileSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('active');
}

// ============================================================================
// Settings Modal Controls
// ============================================================================
function openModal() {
  settingsModal.style.display = 'flex';
}

function closeModal() {
  settingsModal.style.display = 'none';
}

// ============================================================================
// Backend Status / Config Info Check
// ============================================================================
async function fetchServerInfo() {
  try {
    const res = await fetch('/api/info');
    if (res.ok) {
      const data = await res.json();
      if (data.model) {
        modelNameDisplay.textContent = data.model;
        settingsModelBadge.textContent = data.model;
      }
    }
  } catch (e) {
    // Graceful fallback to default label if server is not reporting
    console.log('Server info endpoint optional check skipped.');
  }
}

