/**
 * MargDrishti — Multilingual Agentic AI Citizen Assistant UI Controller
 * Floating 💬 AI Assistant widget, interactive dialog panel, multilingual prompts,
 * and direct action execution within MargDrishti.
 */

import { AiAssistantService } from './aiAssistantService.js';
import { I18n } from './i18n.js';

class AiChatbotManager {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mount());
    } else {
      this.mount();
    }
  }

  mount() {
    if (document.getElementById('margdrishtiChatWidget')) return;

    // Create widget container
    const widget = document.createElement('div');
    widget.id = 'margdrishtiChatWidget';
    widget.className = 'ai-chat-widget-root';
    widget.innerHTML = `
      <!-- Floating Launcher Button -->
      <button type="button" class="ai-chat-floating-btn" id="btnToggleAiChat" aria-label="Open MargDrishti AI Assistant">
        <div class="ai-chat-pulse-ring"></div>
        <span class="ai-chat-icon-box">
          <i data-lucide="message-square" style="width: 22px; height: 22px;"></i>
        </span>
        <span class="ai-chat-btn-label">AI Assistant</span>
      </button>

      <!-- Chat Window Modal / Drawer -->
      <div class="ai-chat-panel hidden" id="aiChatPanel">
        <!-- Header -->
        <div class="ai-chat-header">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="ai-avatar-circle">
              <i data-lucide="bot" style="width: 20px; height: 20px; color: #00e5ff;"></i>
            </div>
            <div>
              <div style="font-weight: 800; font-size: 0.92rem; color: #ffffff; display: flex; align-items: center; gap: 0.35rem;">
                <span data-i18n="chatbot.headerTitle">MargDrishti AI Assistant</span>
                <span class="badge" style="background: rgba(6, 182, 212, 0.2); color: #38bdf8; font-size: 0.62rem; padding: 1px 6px;">AI</span>
              </div>
              <div style="font-size: 0.7rem; color: #94a3b8;" data-i18n="chatbot.headerSubtitle">
                Citizen Road Intelligence Support
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" class="ai-chat-header-btn" id="btnChatClear" title="Clear conversation">
              <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i>
            </button>
            <button type="button" class="ai-chat-header-btn" id="btnChatClose" title="Close assistant">
              <i data-lucide="x" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </div>

        <!-- Quick Language Indicator Bar -->
        <div class="ai-chat-lang-bar">
          <span style="font-size: 0.7rem; color: #64748b;">Language / भाषा:</span>
          <div class="ai-chat-lang-pills">
            <button type="button" class="ai-chat-lang-pill ${I18n.getCurrentLanguage() === 'en' ? 'active' : ''}" data-lang="en">EN</button>
            <button type="button" class="ai-chat-lang-pill ${I18n.getCurrentLanguage() === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी</button>
            <button type="button" class="ai-chat-lang-pill ${I18n.getCurrentLanguage() === 'mr' ? 'active' : ''}" data-lang="mr">मराठी</button>
          </div>
        </div>

        <!-- Message Thread -->
        <div class="ai-chat-body" id="aiChatThread">
          <!-- Messages dynamically appended -->
        </div>

        <!-- Quick Suggestion Chips -->
        <div class="ai-chat-chips-container" id="aiChatChips">
          <!-- Dynamic Chips -->
        </div>

        <!-- Footer Input Form -->
        <form class="ai-chat-footer" id="aiChatForm">
          <input 
            type="text" 
            id="aiChatInput" 
            class="ai-chat-input" 
            placeholder="Ask your question in English, Hindi, or Marathi..." 
            autocomplete="off" 
          />
          <button type="submit" class="ai-chat-send-btn" id="btnChatSend" aria-label="Send message">
            <i data-lucide="send" style="width: 16px; height: 16px;"></i>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widget);
    if (window.lucide) window.lucide.createIcons();

    this.bindEvents();
    this.renderWelcomeMessage();
    this.renderSuggestionChips();

    // Listen to global language change
    window.addEventListener('margdrishti:lang_changed', () => {
      this.syncActiveLanguagePills();
      this.renderSuggestionChips();
      const input = document.getElementById('aiChatInput');
      if (input) input.placeholder = I18n.t('chatbot.inputPlaceholder', 'Ask your question in English, Hindi, or Marathi...');
    });
  }

  bindEvents() {
    const btnToggle = document.getElementById('btnToggleAiChat');
    const btnClose = document.getElementById('btnChatClose');
    const btnClear = document.getElementById('btnChatClear');
    const form = document.getElementById('aiChatForm');

    if (btnToggle) btnToggle.addEventListener('click', () => this.toggleChat());
    if (btnClose) btnClose.addEventListener('click', () => this.toggleChat(false));
    if (btnClear) btnClear.addEventListener('click', () => this.clearChat());

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('aiChatInput');
        const text = input ? input.value.trim() : '';
        if (text) {
          input.value = '';
          await this.sendUserMessage(text);
        }
      });
    }

    // Language pills inside chatbot
    document.querySelectorAll('.ai-chat-lang-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        I18n.setLanguage(lang);
      });
    });
  }

  toggleChat(forceOpen = null) {
    const panel = document.getElementById('aiChatPanel');
    const btnToggle = document.getElementById('btnToggleAiChat');
    if (!panel) return;

    this.isOpen = forceOpen !== null ? forceOpen : !this.isOpen;

    if (this.isOpen) {
      panel.classList.remove('hidden');
      if (btnToggle) btnToggle.classList.add('active');
      const input = document.getElementById('aiChatInput');
      if (input) setTimeout(() => input.focus(), 150);
      this.scrollToBottom();
    } else {
      panel.classList.add('hidden');
      if (btnToggle) btnToggle.classList.remove('active');
    }
  }

  clearChat() {
    this.messages = [];
    const thread = document.getElementById('aiChatThread');
    if (thread) thread.innerHTML = '';
    this.renderWelcomeMessage();
  }

  renderWelcomeMessage() {
    const welcome = I18n.t('chatbot.welcomeMessage', 'Hello! I am the MargDrishti AI Assistant. I can help you report road damage, track complaints, understand AI priority scores, or explain post-repair monitoring.');
    this.addAssistantMessage({
      text: welcome,
      actions: [
        { label: I18n.t('chatbot.btnOpenReport', 'Open Report Road Damage'), action: 'OPEN_REPORT_MODAL', icon: 'camera' },
        { label: I18n.t('chatbot.btnOpenMap', 'Open Pothole Map'), action: 'NAVIGATE_MAP', icon: 'map' }
      ]
    });
  }

  renderSuggestionChips() {
    const container = document.getElementById('aiChatChips');
    if (!container) return;

    const chips = [
      { key: 'chipReport', text: I18n.t('chatbot.chipReport', 'How to report a pothole?') },
      { key: 'chipTrack', text: I18n.t('chatbot.chipTrack', 'Where is my complaint?') },
      { key: 'chipPriority', text: I18n.t('chatbot.chipPriority', 'Explain Priority Score') },
      { key: 'chipMonitoring', text: I18n.t('chatbot.chipMonitoring', 'What does 90% Under Monitoring mean?') },
      { key: 'chipMap', text: I18n.t('chatbot.chipMap', 'How to use Pothole Map?') }
    ];

    container.innerHTML = chips.map(c => `
      <button type="button" class="ai-chat-chip" onclick="window.sendAiChatPreset('${c.text.replace(/'/g, "\\'")}')">
        ${c.text}
      </button>
    `).join('');
  }

  syncActiveLanguagePills() {
    const current = I18n.getCurrentLanguage();
    document.querySelectorAll('.ai-chat-lang-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === current);
    });
  }

  async sendUserMessage(text) {
    // 1. Append user bubble
    this.addUserMessage(text);

    // 2. Append typing indicator
    this.showTypingIndicator();

    // 3. Process via AiAssistantService
    try {
      const response = await AiAssistantService.processQuery(text);
      this.hideTypingIndicator();
      if (response) {
        this.addAssistantMessage(response);
      }
    } catch (err) {
      console.error('AI assistant query error:', err);
      this.hideTypingIndicator();
      this.addAssistantMessage({
        text: 'Sorry, I encountered an issue processing that query. Please try again or rephrase your question.',
        actions: []
      });
    }
  }

  addUserMessage(text) {
    const thread = document.getElementById('aiChatThread');
    if (!thread) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg-row user';
    msgEl.innerHTML = `
      <div class="ai-msg-bubble user">
        ${this.escapeHtml(text)}
      </div>
    `;

    thread.appendChild(msgEl);
    this.scrollToBottom();
  }

  addAssistantMessage(response) {
    const thread = document.getElementById('aiChatThread');
    if (!thread) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg-row assistant';

    const formattedText = this.formatMarkdown(response.text);

    let actionsHtml = '';
    if (response.actions && response.actions.length > 0) {
      actionsHtml = `
        <div class="ai-msg-actions-row">
          ${response.actions.map(a => `
            <button type="button" class="ai-action-btn" onclick="window.executeAssistantAction('${a.action}', '${a.param || ''}')">
              ${a.icon ? `<i data-lucide="${a.icon}" style="width: 13px; height: 13px;"></i>` : ''}
              <span>${a.label}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="ai-msg-avatar">
        <i data-lucide="bot" style="width: 15px; height: 15px; color: #00e5ff;"></i>
      </div>
      <div class="ai-msg-content-box">
        <div class="ai-msg-bubble assistant">
          ${formattedText}
        </div>
        ${actionsHtml}
      </div>
    `;

    thread.appendChild(msgEl);
    if (window.lucide) window.lucide.createIcons();
    this.scrollToBottom();
  }

  showTypingIndicator() {
    const thread = document.getElementById('aiChatThread');
    if (!thread || document.getElementById('aiTypingIndicator')) return;

    const typingEl = document.createElement('div');
    typingEl.id = 'aiTypingIndicator';
    typingEl.className = 'ai-msg-row assistant';
    typingEl.innerHTML = `
      <div class="ai-msg-avatar">
        <i data-lucide="bot" style="width: 15px; height: 15px; color: #00e5ff;"></i>
      </div>
      <div class="ai-msg-bubble assistant typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;

    thread.appendChild(typingEl);
    if (window.lucide) window.lucide.createIcons();
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const el = document.getElementById('aiTypingIndicator');
    if (el) el.remove();
  }

  scrollToBottom() {
    const thread = document.getElementById('aiChatThread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  formatMarkdown(text) {
    if (!text) return '';
    let t = this.escapeHtml(text);

    // Bold **text**
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Code `code`
    t = t.replace(/`([^`]+)`/g, '<code class="ai-code-pill">$1</code>');

    // Newlines to <br> or list items
    t = t.replace(/\n\n/g, '<div style="margin-top: 6px;"></div>');
    t = t.replace(/\n• (.*?)(?=(\n|$))/g, '<div class="ai-list-bullet">&bull; $1</div>');
    t = t.replace(/\n(\d+\. )(.*?)(?=(\n|$))/g, '<div class="ai-list-num"><span>$1</span>$2</div>');
    t = t.replace(/\n/g, '<br>');

    return t;
  }
}

// Global action dispatcher for buttons inside chat
window.executeAssistantAction = function(actionType, param) {
  switch (actionType) {
    case 'OPEN_REPORT_MODAL':
      if (typeof window.openReportModal === 'function') {
        window.openReportModal();
      } else {
        window.location.href = 'citizen.html?action=report';
      }
      break;

    case 'OPEN_TRACKING_MODAL':
      if (typeof window.openTrackingModal === 'function') {
        window.openTrackingModal(param);
      } else {
        window.location.href = `citizen.html?track=${param}`;
      }
      break;

    case 'NAVIGATE_MAP':
      window.location.href = 'map.html';
      break;

    case 'NAVIGATE_DASHBOARD':
      window.location.href = 'citizen.html';
      break;

    case 'FOCUS_TRACK_SEARCH':
      const input = document.getElementById('searchComplaintInput');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.location.href = 'citizen.html';
      }
      break;

    default:
      console.log('Action triggered:', actionType, param);
      break;
  }
};

window.sendAiChatPreset = function(presetText) {
  if (window.MargDrishtiChat) {
    window.MargDrishtiChat.sendUserMessage(presetText);
  }
};

export const MargDrishtiChat = new AiChatbotManager();
window.MargDrishtiChat = MargDrishtiChat;
