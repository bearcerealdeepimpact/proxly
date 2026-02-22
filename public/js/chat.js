(function () {
  'use strict';

  var MAX_LENGTH = 200;
  var BUBBLE_DURATION = 6000; // ms before speech bubble fades
  var BUBBLE_FADE = 1000;     // ms fade-out duration
  var MAX_LOG_MESSAGES = 50;

  // Speech bubbles: playerId → { text, startTime }
  var speechBubbles = {};

  // Chat log entries: [{ name, text, time }]
  var chatLog = [];

  var chatInputFocused = false;

  function init() {
    var input = document.getElementById('chatInput');
    if (!input) return;

    input.addEventListener('focus', function () {
      chatInputFocused = true;
    });

    input.addEventListener('blur', function () {
      chatInputFocused = false;
    });

    input.addEventListener('keydown', function (e) {
      // Stop propagation so WASD doesn't move player while typing
      e.stopPropagation();

      if (e.key === 'Enter') {
        e.preventDefault();
        var text = input.value.trim();
        if (text.length > 0) {
          if (text.length > MAX_LENGTH) {
            text = text.substring(0, MAX_LENGTH);
          }
          // Send via network
          if (window.Network && Network.sendChat) {
            Network.sendChat(text);
          }
          input.value = '';
        }
        input.blur();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        input.value = '';
        input.blur();
      }
    });

    // Global Enter key to focus chat input
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !chatInputFocused) {
        // Don't focus if a modal is open or entrance overlay is visible
        if (window.Interaction && Interaction.isModalOpen()) return;
        var entrance = document.getElementById('entranceOverlay');
        if (entrance && entrance.style.display !== 'none') return;

        e.preventDefault();
        input.focus();
      }
    });
  }

  function receiveMessage(playerId, playerName, text) {
    // Add speech bubble
    speechBubbles[playerId] = {
      text: text,
      startTime: Date.now()
    };

    // Add to chat log
    chatLog.push({
      name: playerName,
      text: text,
      time: Date.now()
    });

    // Trim log
    if (chatLog.length > MAX_LOG_MESSAGES) {
      chatLog.shift();
    }

    // Update chat log UI
    updateChatLogUI();
  }

  function showError(errorText) {
    // Show as system message in chat log
    chatLog.push({
      name: '',
      text: errorText,
      time: Date.now(),
      isSystem: true
    });
    updateChatLogUI();
  }

  function updateChatLogUI() {
    var logEl = document.getElementById('chatLog');
    if (!logEl) return;

    var entry = chatLog[chatLog.length - 1];
    var msgEl = document.createElement('div');
    msgEl.className = 'chat-message';

    if (entry.isSystem) {
      msgEl.className += ' chat-system';
      msgEl.textContent = entry.text;
    } else {
      var nameSpan = document.createElement('span');
      nameSpan.className = 'chat-name';
      nameSpan.textContent = entry.name + ': ';
      msgEl.appendChild(nameSpan);
      msgEl.appendChild(document.createTextNode(entry.text));
    }

    logEl.appendChild(msgEl);

    // Auto-scroll to bottom
    logEl.scrollTop = logEl.scrollHeight;
  }

  function getBubble(playerId) {
    var bubble = speechBubbles[playerId];
    if (!bubble) return null;

    var elapsed = Date.now() - bubble.startTime;
    if (elapsed > BUBBLE_DURATION + BUBBLE_FADE) {
      delete speechBubbles[playerId];
      return null;
    }

    var alpha = 1;
    if (elapsed > BUBBLE_DURATION) {
      alpha = 1 - (elapsed - BUBBLE_DURATION) / BUBBLE_FADE;
    }

    return {
      text: bubble.text,
      alpha: alpha
    };
  }

  function isChatFocused() {
    return chatInputFocused;
  }

  function show() {
    var panel = document.getElementById('chatPanel');
    if (panel) panel.style.display = 'flex';
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });

  window.Chat = {
    receiveMessage: receiveMessage,
    showError: showError,
    getBubble: getBubble,
    isChatFocused: isChatFocused,
    show: show
  };
})();
