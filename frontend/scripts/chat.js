// ── module-scope globals (shared between DOMContentLoaded and Clerk load) ──
const API = 'http://localhost:3000';
let clerkUserId   = null;
let conversations = [];
let activeConvId  = null;

document.addEventListener('DOMContentLoaded', () => {

  /* ══════════════════════════════
     THEME SYSTEM
  ══════════════════════════════ */
  const html      = document.documentElement;
  const themePill = document.getElementById('themePill');
  const saved     = localStorage.getItem('iyomi-theme');

  // apply saved or system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initDark    = saved ? saved === 'dark' : prefersDark;
  if (initDark) html.setAttribute('data-theme', 'dark');

  if (themePill) {
    themePill.addEventListener('click', () => {
      const isDark = html.getAttribute('data-theme') === 'dark';
      if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('iyomi-theme', 'light');
      } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('iyomi-theme', 'dark');
      }
    });
  }

  lucide.createIcons();

  /* ── refs ── */
  const sidebarLeft    = document.getElementById('sidebarLeft');
  const sidebarRight   = document.getElementById('sidebarRight');
  const toggleLeft     = document.getElementById('toggleLeft');
  const toggleRight    = document.getElementById('toggleRight');
  const newChatBtn     = document.getElementById('newChatBtn');
  const chatInput      = document.getElementById('chatInput');
  const sendBtn        = document.getElementById('sendBtn');
  const messagesArea   = document.getElementById('messagesArea');
  const messagesInner  = document.getElementById('messagesInner');
  const welcomeState   = document.getElementById('welcomeState');
  const artifactsEmpty = document.getElementById('artifactsEmpty');
  const artifactList   = document.getElementById('artifactList');
  const topbarTitle    = document.getElementById('topbarTitle');
  const chatMain       = document.getElementById('chatMain');

  let msgCount = 0;
  let typing   = false;
  let conversationHistory = [];
  let selectedModel = 'llama-3.3-70b-versatile';


  /* ══════════════════════════════
     MODEL PICKER MODAL
  ══════════════════════════════ */
  const modelTrigger      = document.getElementById('modelTrigger');
  const modelTriggerLabel = document.getElementById('modelTriggerLabel');
  const modelModalOverlay = document.getElementById('modelModalOverlay');
  const modelModalClose   = document.getElementById('modelModalClose');
  const modelSearchInput  = document.getElementById('modelSearchInput');
  const modelOptions = document.querySelectorAll('#modelModalList .model-option');

  modelTrigger.addEventListener('click', () => {
    modelModalOverlay.classList.add('open');
    modelSearchInput.focus();
  });

  modelModalClose.addEventListener('click', closeModal);

  modelModalOverlay.addEventListener('click', e => {
    if (e.target === modelModalOverlay) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  modelSearchInput.addEventListener('input', () => {
    const q = modelSearchInput.value.toLowerCase();
    modelOptions.forEach(opt => {
      const label = opt.dataset.label.toLowerCase();
      opt.classList.toggle('hidden', !label.includes(q));
    });
    document.querySelectorAll('.model-group-label').forEach(label => {
      let next = label.nextElementSibling;
      let allHidden = true;
      while (next && !next.classList.contains('model-group-label')) {
        if (!next.classList.contains('hidden')) allHidden = false;
        next = next.nextElementSibling;
      }
      label.style.display = allHidden ? 'none' : '';
    });
  });

  modelOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedModel = opt.dataset.value;
      modelTriggerLabel.textContent = opt.dataset.label;
      modelOptions.forEach(o => o.classList.remove('model-option--active'));
      opt.classList.add('model-option--active');
      closeModal();
    });
  });

  function closeModal() {
    modelModalOverlay.classList.remove('open');
    modelSearchInput.value = '';
    modelOptions.forEach(opt => opt.classList.remove('hidden'));
    document.querySelectorAll('.model-group-label').forEach(l => l.style.display = '');
  }

  /* ══════════════════════════════
     ACTION MENU (+ button)
  ══════════════════════════════ */
  const actionMenuTrigger  = document.getElementById('actionMenuTrigger');
  const actionMenuDropdown = document.getElementById('actionMenuDropdown');
  const fileInput          = document.getElementById('fileInput');
  const photoInput         = document.getElementById('photoInput');
  const attachmentPreviews = document.getElementById('attachmentPreviews');

  let attachedFiles = [];

  actionMenuTrigger.addEventListener('click', e => {
    e.stopPropagation();
    actionMenuDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    actionMenuDropdown.classList.remove('open');
  });

  actionMenuDropdown.addEventListener('click', e => e.stopPropagation());

  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  photoInput.addEventListener('change', () => handleFiles(photoInput.files));

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const id = Date.now() + Math.random();
      attachedFiles.push({ id, file });
      renderAttachmentChip({ id, file });
    });
    updateSendBtn();
    actionMenuDropdown.classList.remove('open');
    fileInput.value = '';
    photoInput.value = '';
  }

  function renderAttachmentChip({ id, file }) {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.dataset.id = id;

    const isImage = file.type.startsWith('image/');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.className = 'attachment-chip-thumb';
        img.src = e.target.result;
        chip.prepend(img);
        lucide.createIcons();
      };
      reader.readAsDataURL(file);
    } else {
      const iconEl = document.createElement('div');
      iconEl.className = 'attachment-chip-icon';
      iconEl.innerHTML = `<i data-lucide="file-text"></i>`;
      chip.appendChild(iconEl);
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'attachment-chip-name';
    nameEl.textContent = file.name;
    chip.appendChild(nameEl);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'attachment-chip-remove';
    removeBtn.innerHTML = `<i data-lucide="x"></i>`;
    removeBtn.addEventListener('click', () => {
      attachedFiles = attachedFiles.filter(f => f.id !== id);
      chip.remove();
      updateSendBtn();
      lucide.createIcons();
    });
    chip.appendChild(removeBtn);

    attachmentPreviews.appendChild(chip);
    lucide.createIcons();
  }

  const inputPill = document.getElementById('inputPill');
  inputPill.addEventListener('dragover', e => { e.preventDefault(); inputPill.style.borderColor = 'var(--border-focus)'; });
  inputPill.addEventListener('dragleave', () => { inputPill.style.borderColor = ''; });
  inputPill.addEventListener('drop', e => {
    e.preventDefault();
    inputPill.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  /* ══════════════════════════════
     MICROPHONE — Web Speech API
  ══════════════════════════════ */
  const micBtn = document.getElementById('micBtn');
  let recognition = null;
  let isRecording = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let baseText = '';

    recognition.onstart = () => { baseText = chatInput.value; };

    recognition.onresult = e => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      chatInput.value = baseText + (baseText ? ' ' : '') + final + interim;
      if (final) baseText = chatInput.value.trim();
      chatInput.dispatchEvent(new Event('input'));
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch(e) { stopRecording(); }
      }
    };

    recognition.onerror = e => {
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone in your browser settings and refresh.');
      } else if (e.error === 'no-speech') {
        return;
      } else {
        console.error('Speech error:', e.error);
      }
      stopRecording();
    };

    micBtn.addEventListener('click', () => {
      if (isRecording) stopRecording();
      else startRecording();
    });
  } else {
    micBtn.title = 'Voice input not supported in this browser';
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
  }

  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        isRecording = true;
        micBtn.classList.add('recording');
        const icon = micBtn.querySelector('i');
        icon.setAttribute('data-lucide', 'mic-off');
        lucide.createIcons();
        try { recognition.start(); }
        catch(e) { console.error('Recognition start error:', e); stopRecording(); }
      })
      .catch(err => {
        console.error('Mic permission:', err);
        const note = document.querySelector('.input-disclaimer');
        const orig = note.textContent;
        note.textContent = '⚠️ Microphone blocked. Click the lock icon in address bar → Allow microphone → refresh.';
        note.style.color = '#dc2626';
        setTimeout(() => { note.textContent = orig; note.style.color = ''; }, 5000);
      });
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    const icon = micBtn.querySelector('i');
    icon.setAttribute('data-lucide', 'mic');
    lucide.createIcons();
    recognition.stop();
  }

  /* ══════════════════════════════
     SIDEBAR TOGGLES
  ══════════════════════════════ */
  toggleLeft.addEventListener('click', () => { sidebarLeft.classList.toggle('collapsed'); });
  toggleRight.addEventListener('click', () => { sidebarRight.classList.toggle('collapsed'); });

  /* ══════════════════════════════
     SIDEBAR NAV LINKS
  ══════════════════════════════ */
  // "New chat" link in sidebar top nav
  const newChatLink = document.getElementById('newChatLink');
  if (newChatLink) {
    newChatLink.addEventListener('click', () => {
      // trigger same action as newChatBtn
      newChatBtn.click();
    });
  }

  // "Search chats" inline toggle
  const searchChatsLink = document.getElementById('searchChatsLink');
  const slSearchRow     = document.getElementById('slSearchRow');
  const slSearchInline  = document.getElementById('slSearchInline');
  const slSearchClose   = document.getElementById('slSearchClose');
  const chatSearchInput = document.getElementById('chatSearch');

  function openSearch() {
    slSearchRow.classList.add('active');
    setTimeout(() => chatSearchInput.focus(), 50);
    lucide.createIcons();
  }

  function closeSearch() {
    slSearchRow.classList.remove('active');
    chatSearchInput.value = '';
    chatSearchInput.dispatchEvent(new Event('input'));
  }

  if (searchChatsLink) {
    searchChatsLink.addEventListener('click', openSearch);
  }
  if (slSearchClose) {
    slSearchClose.addEventListener('click', closeSearch);
  }
  if (chatSearchInput) {
    chatSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();
    });
  }

  // User popover toggle
  const slUserTrigger = document.getElementById('slUserTrigger');
  const slUserPopover = document.getElementById('slUserPopover');

  if (slUserTrigger && slUserPopover) {
    slUserTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      slUserPopover.classList.toggle('open');
      lucide.createIcons();
    });

    // close popover when clicking outside
    document.addEventListener('click', (e) => {
      if (!slUserPopover.contains(e.target) && !slUserTrigger.contains(e.target)) {
        slUserPopover.classList.remove('open');
      }
    });

    // close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') slUserPopover.classList.remove('open');
    });
  }

  /* ══════════════════════════════
     MODE SWITCHER
  ══════════════════════════════ */
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn--active'));
      btn.classList.add('mode-btn--active');
    });
  });

  /* ══════════════════════════════
     CHIPS
  ══════════════════════════════ */
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.text;
      chatInput.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  /* ══════════════════════════════
     PERSONA SYSTEM
  ══════════════════════════════ */
  const PERSONAS = {
    default: {
      label: 'Iyomi',
      prompt: `You are Iyomi, a warm and emotionally intelligent AI companion. You genuinely care about the person you're talking to. You listen deeply, respond thoughtfully, and make people feel understood. You're insightful without being preachy, supportive without being clingy, and honest without being harsh. Respond naturally and warmly.`
    },
    study: {
      label: 'Study Buddy',
      prompt: `You are a focused, academic study companion. Your job is to help the user learn effectively. Break down complex topics clearly. Use examples, analogies, and structured explanations. Ask clarifying questions to check understanding. Be encouraging but stay on topic. Use headers and bullet points to organize information. Always explain the "why" behind concepts, not just the "what".`
    },
    therapist: {
      label: 'Therapist',
      prompt: `You are a calm, empathetic, and reflective conversational companion in the style of a supportive therapist. You listen without judgment. You reflect back what you hear, ask open-ended questions, and help the user explore their own feelings and thoughts. You never rush to give advice — you help the user find their own answers. Use a gentle, warm tone. Never diagnose or prescribe. Always encourage professional help for serious issues.`
    },
    straight: {
      label: 'Straight Shooter',
      prompt: `You are brutally honest and direct. No sugarcoating, no filler, no flattery. You get straight to the point. If something is wrong, you say so clearly. If the user's idea is bad, you tell them why. You respect the user enough to give them the truth. Short sentences. No fluff. No "great question!" openers. Just facts, honest opinions, and actionable advice.`
    },
    hype: {
      label: 'Hype Man',
      prompt: `You are an incredibly energetic, motivational hype man. You genuinely believe in the user and make them feel like they can conquer anything. You're enthusiastic, positive, and pumped up. Use exclamation points. Celebrate wins big and small. Turn every obstacle into an opportunity. Be the most supportive, energetic voice in the room. Never be fake — your enthusiasm is real and infectious.`
    },
    storyteller: {
      label: 'Storyteller',
      prompt: `You are a creative, imaginative storyteller with a poetic soul. You see the world in metaphors and narratives. When you explain things, you weave them into stories. Your language is rich, vivid, and evocative — but never purple or overwrought. You find the human story in everything. You make even technical topics feel alive and meaningful. Inspire wonder in every response.`
    }
  };

  let selectedPersona = localStorage.getItem('iyomi-persona') || 'default';

  const personaTrigger      = document.getElementById('personaTrigger');
  const personaTriggerLabel = document.getElementById('personaTriggerLabel');
  const personaModalOverlay = document.getElementById('personaModalOverlay');
  const personaModalClose   = document.getElementById('personaModalClose');
  const personaSearchInput  = document.getElementById('personaSearchInput');
  const personaOptions      = document.querySelectorAll('#personaModalList [data-persona]');

  // init label
  personaTriggerLabel.textContent = PERSONAS[selectedPersona]?.label || 'Iyomi';

  // mark active
  personaOptions.forEach(opt => {
    if (opt.dataset.persona === selectedPersona) opt.classList.add('model-option--active');
  });

  personaTrigger.addEventListener('click', () => {
    personaModalOverlay.classList.add('open');
    personaSearchInput.focus();
    lucide.createIcons();
  });

  personaModalClose.addEventListener('click', () => personaModalOverlay.classList.remove('open'));
  personaModalOverlay.addEventListener('click', e => {
    if (e.target === personaModalOverlay) personaModalOverlay.classList.remove('open');
  });

  personaSearchInput.addEventListener('input', () => {
    const q = personaSearchInput.value.toLowerCase();
    personaOptions.forEach(opt => {
      const label = opt.dataset.label.toLowerCase();
      opt.style.display = label.includes(q) ? '' : 'none';
    });
  });

  personaOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedPersona = opt.dataset.persona;
      localStorage.setItem('iyomi-persona', selectedPersona);
      personaTriggerLabel.textContent = PERSONAS[selectedPersona].label;
      personaOptions.forEach(o => o.classList.remove('model-option--active'));
      opt.classList.add('model-option--active');
      personaModalOverlay.classList.remove('open');
    });
  });

  const slNav          = document.getElementById('slNav');
  const slEmptyHistory = document.getElementById('slEmptyHistory');

  function getTimeGroup(date) {
    const now      = new Date();
    const d        = new Date(date);
    const diffDays = (now - d) / (1000 * 60 * 60 * 24);
    if (diffDays < 1)  return 'Today';
    if (diffDays < 2)  return 'Yesterday';
    if (diffDays < 7)  return 'This Week';
    if (diffDays < 30) return 'This Month';
    return 'Older';
  }

  function makeTitle(text) {
    const clean = text.trim().replace(/\n/g, ' ');
    return clean.length > 50 ? clean.slice(0, 50) + '…' : clean;
  }

  // ── fetch history from DB ──
  async function fetchHistory() {
    if (!clerkUserId) return;
    try {
      const res  = await fetch(`${API}/api/conversations?userId=${clerkUserId}`);
      const data = await res.json();
      conversations = data; // [{_id, title, updatedAt}]
      renderHistory();
    } catch (err) {
      console.error('[history] fetch error:', err.message);
    }
  }
  window.fetchHistory = fetchHistory;

  // ── create new conversation (optimistic only — DB handled by backend) ──
  async function createConversation(firstMessage) {
    const title  = makeTitle(firstMessage);
    const tempId = 'temp-' + Date.now();
    activeConvId = tempId;
    conversations.unshift({ _id: tempId, title, updatedAt: new Date() });
    topbarTitle.textContent = title;
    renderHistory();
    return tempId;
  }

  function getActiveConv() {
    return conversations.find(c => c._id === activeConvId) || null;
  }

  window.renderHistory = renderHistory;
  let pinnedChats = JSON.parse(localStorage.getItem('iyomi-pinned') || '[]');
  let archivedChats = JSON.parse(localStorage.getItem('iyomi-archived') || '[]');

  function renderHistory() {
    slNav.querySelectorAll('.sl-section, .sl-item').forEach(el => el.remove());

    // filter out archived
    const visible = conversations.filter(c => !archivedChats.includes(c._id));

    if (visible.length === 0) {
      slEmptyHistory.style.display = 'flex';
      return;
    }
    slEmptyHistory.style.display = 'none';

    // separate pinned vs unpinned
    const pinned = visible.filter(c => pinnedChats.includes(c._id));
    const unpinned = visible.filter(c => !pinnedChats.includes(c._id));

    // render pinned section
    if (pinned.length > 0) {
      const label = document.createElement('p');
      label.className = 'sl-section';
      label.textContent = 'Pinned';
      slNav.appendChild(label);
      pinned.forEach(conv => slNav.appendChild(buildChatItem(conv, true)));
    }

    // render time-grouped unpinned
    const groups = {};
    unpinned.forEach(conv => {
      const group = getTimeGroup(conv.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(conv);
    });

    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
    order.forEach(groupName => {
      if (!groups[groupName]) return;
      const label = document.createElement('p');
      label.className = 'sl-section';
      label.textContent = groupName;
      slNav.appendChild(label);
      groups[groupName].forEach(conv => slNav.appendChild(buildChatItem(conv, false)));
    });
  }

  function buildChatItem(conv, isPinned) {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'sl-item' + (conv._id === activeConvId ? ' sl-item--active' : '') + (isPinned ? ' sl-item--pinned' : '');
    item.dataset.id = conv._id;
    item.textContent = conv.title;
    item.addEventListener('click', e => { e.preventDefault(); loadConversation(conv._id); });

    // three-dot button
    const moreBtn = document.createElement('button');
    moreBtn.className = 'sl-item-more';
    moreBtn.innerHTML = '<i data-lucide="ellipsis"></i>';
    moreBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openCtxMenu(e, conv._id);
    });
    item.appendChild(moreBtn);

    // right-click context menu
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      openCtxMenu(e, conv._id);
    });

    return item;
  }

  /* ── CONTEXT MENU ── */
  const ctxMenu = document.getElementById('ctxMenu');
  let ctxTargetId = null;

  function openCtxMenu(e, convId) {
    ctxTargetId = convId;
    const isPinned = pinnedChats.includes(convId);
    ctxMenu.querySelector('[data-action="pin"] span').textContent = isPinned ? 'Unpin chat' : 'Pin chat';
    ctxMenu.classList.add('open');

    // position near click
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';

    lucide.createIcons();
  }

  function closeCtxMenu() {
    ctxMenu.classList.remove('open');
    ctxTargetId = null;
  }

  document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) closeCtxMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCtxMenu();
  });

  ctxMenu.querySelectorAll('.ctx-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const id = ctxTargetId;
      closeCtxMenu();
      if (!id) return;

      if (action === 'rename') {
        const itemEl = slNav.querySelector(`[data-id="${id}"]`);
        if (!itemEl) return;
        const oldTitle = itemEl.textContent;
        const moreBtn = itemEl.querySelector('.sl-item-more');
        itemEl.textContent = '';
        const input = document.createElement('input');
        input.className = 'sl-rename-input';
        input.value = oldTitle;
        itemEl.appendChild(input);
        input.focus();
        input.select();

        function finishRename() {
          const newTitle = input.value.trim() || oldTitle;
          const conv = conversations.find(c => c._id === id);
          if (conv) conv.title = newTitle;
          renderHistory();
          lucide.createIcons();
        }
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { input.value = oldTitle; input.blur(); }
        });
      }

      if (action === 'pin') {
        if (pinnedChats.includes(id)) {
          pinnedChats = pinnedChats.filter(p => p !== id);
        } else {
          pinnedChats.push(id);
        }
        localStorage.setItem('iyomi-pinned', JSON.stringify(pinnedChats));
        renderHistory();
        lucide.createIcons();
      }

      if (action === 'archive') {
        if (confirm('Archive this chat?')) {
          archivedChats.push(id);
          localStorage.setItem('iyomi-archived', JSON.stringify(archivedChats));
          if (activeConvId === id) resetChat();
          renderHistory();
          lucide.createIcons();
        }
      }

      if (action === 'delete') {
        if (confirm('Delete this chat permanently?')) {
          conversations = conversations.filter(c => c._id !== id);
          pinnedChats = pinnedChats.filter(p => p !== id);
          localStorage.setItem('iyomi-pinned', JSON.stringify(pinnedChats));
          if (activeConvId === id) resetChat();
          renderHistory();
          lucide.createIcons();
        }
      }
    });
  });

  // ── load conversation from DB ──
  async function loadConversation(convId) {
    activeConvId = convId;
    renderHistory();

    messagesInner.innerHTML = '';
    chatMain.classList.add('chat-started');
    welcomeState.style.display = 'none';
    messagesArea.style.display = 'flex';
    messagesArea.style.flexDirection = 'column';

    try {
      const res  = await fetch(`${API}/api/conversations/${convId}`);
      const conv = await res.json();

      // rebuild conversationHistory for Groq context
      conversationHistory = conv.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      topbarTitle.textContent = conv.title;

      conv.messages.forEach(m => {
        if (m.role === 'system') return;
        const el   = document.createElement('div');
        el.className = `msg msg--${m.role === 'assistant' ? 'ai' : 'user'}`;
        const body = document.createElement('div');
        body.className = 'msg-body';
        if (m.role === 'assistant') body.innerHTML = parseMarkdown(m.content);
        else body.textContent = m.content;
        el.appendChild(body);
        messagesInner.appendChild(el);
      });

      scrollBottom();
    } catch (err) {
      console.error('[conv] load error:', err.message);
    }
  }

  document.getElementById('chatSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    slNav.querySelectorAll('.sl-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    slNav.querySelectorAll('.sl-section').forEach(label => {
      let next = label.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('sl-section')) {
        if (next.style.display !== 'none') anyVisible = true;
        next = next.nextElementSibling;
      }
      label.style.display = anyVisible ? '' : 'none';
    });
  });

  /* ══════════════════════════════
     NEW CHAT
  ══════════════════════════════ */
  newChatBtn.addEventListener('click', resetChat);

  /* ══════════════════════════════
     TEXTAREA RESIZE
  ══════════════════════════════ */
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    updateSendBtn();
  });

  function updateSendBtn() {
    sendBtn.disabled = chatInput.value.trim().length === 0 && attachedFiles.length === 0;
  }

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  /* ══════════════════════════════
     SEND
  ══════════════════════════════ */
  async function sendMessage() {
    const text = chatInput.value.trim();
    if ((!text && attachedFiles.length === 0) || typing) return;

    // create DB conversation on first message
    if (!activeConvId) {
      await createConversation(text || 'Attachment');
    }

    if (msgCount === 0) {
      chatMain.classList.add('chat-started');
      welcomeState.style.display = 'none';
      messagesArea.style.display = 'flex';
      messagesArea.style.flexDirection = 'column';
      topbarTitle.textContent = getActiveConv()?.title || 'Chat';
    }

    appendMsg('user', text || '[Attachment]');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    attachedFiles = [];
    attachmentPreviews.innerHTML = '';
    if (isRecording) stopRecording();
    simulateResponse(text || '[Attachment]');
  }

  function appendMsg(role, text, isMarkdown = false) {
    msgCount++;

    let groupEl;

    if (role === 'user') {
      groupEl = document.createElement('div');
      groupEl.className = 'msg-group';
      groupEl.dataset.groupId = msgCount;
      messagesInner.appendChild(groupEl);
    } else {
      groupEl = messagesInner.lastElementChild;
      if (!groupEl || !groupEl.classList.contains('msg-group')) {
        groupEl = document.createElement('div');
        groupEl.className = 'msg-group';
        messagesInner.appendChild(groupEl);
      }
    }

    const el = document.createElement('div');
    el.className = `msg msg--${role}`;
    const bodyEl = document.createElement('div');
    bodyEl.className = 'msg-body';

    if (isMarkdown) bodyEl.innerHTML = parseMarkdown(text);
    else bodyEl.textContent = text;

    el.appendChild(bodyEl);
    groupEl.appendChild(el);

    const conv = getActiveConv();
    if (conv) {
      if (!conv.messages) conv.messages = [];
      conv.messages.push({ role, text, isMarkdown });
      conv.updatedAt = Date.now();
      renderHistory();
    }

    scrollBottom();
  }

  /* ══════════════════════════════
     AI RESPONSE — GROQ STREAMING
  ══════════════════════════════ */
  async function simulateResponse(userText) {
    typing = true;

    let activeGroup = messagesInner.lastElementChild;
    if (!activeGroup || !activeGroup.classList.contains('msg-group')) {
      activeGroup = document.createElement('div');
      activeGroup.className = 'msg-group';
      messagesInner.appendChild(activeGroup);
    }

    const tyEl = document.createElement('div');
    tyEl.className = 'msg msg--ai';
    tyEl.innerHTML = `<div class="msg-body"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    activeGroup.appendChild(tyEl);
    scrollBottom();

    try {

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          conversationId: activeConvId,
          userId: clerkUserId,
          persona: selectedPersona,
          messages: [
            ...conversationHistory,
            { role: 'user', content: userText }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const errMsg = errData?.error?.message || `HTTP ${response.status}`;
        console.error('Groq error:', errData);
        tyEl.remove();
        appendMsg('ai', `API error: ${errMsg}`, false);
        typing = false;
        return;
      }

      // capture real conversation ID from backend
      const realConvId = response.headers.get('X-Conversation-Id');
      if (realConvId && activeConvId !== realConvId) {
        const idx = conversations.findIndex(c => c._id === activeConvId);
        if (idx !== -1) conversations[idx]._id = realConvId;
        activeConvId = realConvId;
        renderHistory();
      }

      tyEl.remove();
      msgCount++;

      let groupEl = messagesInner.lastElementChild;
      if (!groupEl || !groupEl.classList.contains('msg-group')) {
        groupEl = document.createElement('div');
        groupEl.className = 'msg-group';
        messagesInner.appendChild(groupEl);
      }

      const aiEl = document.createElement('div');
      aiEl.className = 'msg msg--ai';

      const bodyEl = document.createElement('div');
      bodyEl.className = 'msg-body';
      aiEl.appendChild(bodyEl);
      groupEl.appendChild(aiEl);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let renderQueue = '';
      let rendering = false;

      // show plain text + blinking cursor during stream
      bodyEl.classList.add('streaming');
      bodyEl.textContent = '';
      const cursor = document.createElement('span');
      cursor.className = 'stream-cursor';
      bodyEl.appendChild(cursor);

      // typewriter renderer — drains queue char by char
      async function drainQueue() {
        if (rendering) return;
        rendering = true;
        while (renderQueue.length > 0) {
          const char = renderQueue[0];
          renderQueue = renderQueue.slice(1);
          cursor.insertAdjacentText('beforebegin', char);
          scrollBottom();
          await new Promise(r => setTimeout(r, 8));
        }
        rendering = false;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              renderQueue += token;
              drainQueue();
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      // wait for queue to fully drain
      while (renderQueue.length > 0 || rendering) {
        await new Promise(r => setTimeout(r, 20));
      }

      // stream done — remove cursor, render full markdown
      bodyEl.classList.remove('streaming');
      bodyEl.innerHTML = parseMarkdown(fullText);

      // ── SOURCES COMPONENT ──
      const sources = extractSources(fullText);
      if (sources.length > 0) {
        const srcEl = buildSourcesComponent(sources);
        aiEl.appendChild(srcEl);
      }

      // ── SAVE CHECKPOINT BUTTON ──
      const checkpointBar = document.createElement('div');
      checkpointBar.className = 'msg-actions';
      checkpointBar.innerHTML = `
        <button class="save-checkpoint" title="Save checkpoint">
          <span class="cp-icon"><i data-lucide="bookmark"></i></span>
          <span class="cp-label">Save checkpoint</span>
        </button>
      `;
      aiEl.appendChild(checkpointBar);

      // checkpoint click handler
      const saveBtn = checkpointBar.querySelector('.save-checkpoint');
      saveBtn.addEventListener('click', () => {
        const isSaved = saveBtn.classList.toggle('saved');
        const iconWrap = saveBtn.querySelector('.cp-icon');
        const label = saveBtn.querySelector('.cp-label');
        if (isSaved) {
          iconWrap.innerHTML = '<i data-lucide="bookmark-check"></i>';
          label.textContent = 'Saved';
          lucide.createIcons();
          const id = addCheckpointToArtifacts(fullText, userText, saveBtn);
          saveBtn.dataset.artifactId = id;
        } else {
          iconWrap.innerHTML = '<i data-lucide="bookmark"></i>';
          label.textContent = 'Save checkpoint';
          lucide.createIcons();
          removeCheckpointFromArtifacts(saveBtn.dataset.artifactId);
          delete saveBtn.dataset.artifactId;
        }
      });

      lucide.createIcons();
      scrollBottom();

      conversationHistory.push({ role: 'user',      content: userText });
      conversationHistory.push({ role: 'assistant', content: fullText });

      const conv = getActiveConv();
      if (conv) {
        conv.history = [...conversationHistory];
        conv.messages.push({ role: 'ai', text: fullText, isMarkdown: true });
        conv.updatedAt = Date.now();
        renderHistory();
      }

    } catch (err) {
      console.error('Fetch error:', err);
      tyEl.remove();
      appendMsg('ai', `Something went wrong: ${err.message}`, false);
    }

    typing = false;
  }

  /* ══════════════════════════════
     SOURCES COMPONENT
  ══════════════════════════════ */
  function extractSources(text) {
    const sources = [];
    const seen = new Set();

    // match markdown links [text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let m;
    while ((m = linkRegex.exec(text)) !== null) {
      const url = m[2];
      if (!seen.has(url)) {
        seen.add(url);
        sources.push({ title: m[1], url });
      }
    }

    // match (Source: text, text) pattern
    const sourceRegex = /\(Source:\s*([^)]+)\)/gi;
    while ((m = sourceRegex.exec(text)) !== null) {
      const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        // check if it's a URL
        const urlMatch = p.match(/(https?:\/\/[^\s,]+)/);
        const title = p.replace(/(https?:\/\/[^\s,]+)/, '').trim() || p;
        const url = urlMatch ? urlMatch[1] : null;
        const key = url || title;
        if (!seen.has(key)) {
          seen.add(key);
          sources.push({ title: title || key, url });
        }
      });
    }

    // match bare URLs not already captured
    const bareUrlRegex = /(?<!\]\()https?:\/\/[^\s)>\]]+/g;
    while ((m = bareUrlRegex.exec(text)) !== null) {
      const url = m[0];
      if (!seen.has(url)) {
        seen.add(url);
        try {
          const hostname = new URL(url).hostname.replace('www.', '');
          sources.push({ title: hostname, url });
        } catch {
          sources.push({ title: url, url });
        }
      }
    }

    return sources;
  }

  function buildSourcesComponent(sources) {
    const wrap = document.createElement('div');
    wrap.className = 'sources-component';

    const header = document.createElement('button');
    header.className = 'sources-header';
    header.innerHTML = `
      <span class="sources-label">Used ${sources.length} source${sources.length > 1 ? 's' : ''}</span>
      <i data-lucide="chevron-down" class="sources-chevron"></i>
    `;
    wrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'sources-list';
    sources.forEach(s => {
      const item = document.createElement('a');
      item.className = 'source-item';
      item.href = s.url || '#';
      item.target = '_blank';
      item.rel = 'noopener';
      item.innerHTML = `<i data-lucide="file-text"></i><span>${s.title}</span>`;
      list.appendChild(item);
    });
    wrap.appendChild(list);

    header.addEventListener('click', () => {
      const open = wrap.classList.toggle('open');
      const chevron = header.querySelector('.sources-chevron');
      chevron.setAttribute('data-lucide', open ? 'chevron-up' : 'chevron-down');
      lucide.createIcons();
    });

    return wrap;
  }

  /* ══════════════════════════════
     SAVE CHECKPOINT → ARTIFACTS
  ══════════════════════════════ */
  let checkpointCounter = 0;

  function addCheckpointToArtifacts(responseText, queryText, triggerBtn) {
    checkpointCounter++;
    const id = 'checkpoint-' + checkpointCounter + '-' + Date.now();
    const title = queryText.length > 40 ? queryText.slice(0, 40) + '…' : queryText;

    artifactsEmpty.style.display = 'none';
    artifactList.style.display = 'flex';
    artifactList.style.flexDirection = 'column';

    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.dataset.checkpointId = id;
    card.innerHTML = `
      <div class="artifact-icon artifact-icon--checkpoint"><i data-lucide="bookmark-check"></i></div>
      <div class="artifact-info">
        <div class="artifact-name">${title}</div>
        <div class="artifact-meta">Checkpoint · just now</div>
      </div>`;

    // click card → scroll to the saved response
    card.addEventListener('click', () => {
      if (triggerBtn) {
        const msgEl = triggerBtn.closest('.msg--ai');
        if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    artifactList.appendChild(card);
    lucide.createIcons();

    // auto-open sidebar if collapsed
    if (sidebarRight.classList.contains('collapsed')) {
      sidebarRight.classList.remove('collapsed');
    }

    return id;
  }

  function removeCheckpointFromArtifacts(artifactId) {
    if (!artifactId) return;
    const card = artifactList.querySelector(`[data-checkpoint-id="${artifactId}"]`);
    if (card) card.remove();

    // if no more artifacts, show empty state
    if (artifactList.children.length === 0) {
      artifactsEmpty.style.display = 'flex';
      artifactList.style.display = 'none';
    }
  }

  /* ══════════════════════════════
     MARKDOWN PARSER
  ══════════════════════════════ */
  function parseMarkdown(text) {
    // 1. extract code blocks first
    const codeBlocks = [];
    text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: lang.trim(), code: code.trim() });
      return `\n\n%%CB_${idx}%%\n\n`;
    });

    // 2. split into lines for block-level parsing
    const lines = text.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // headings — also handle inline headings (## text### subtext on same line)
      const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (hMatch) {
        // check if content itself contains another heading
        const content = hMatch[2];
        const innerH = content.match(/^(.*?)(#{1,6}\s+.+)$/);
        if (innerH && innerH[1].trim()) {
          blocks.push({ type: 'heading', level: hMatch[1].length, content: innerH[1].trim() });
          blocks.push({ type: 'heading', level: hMatch[1].length + 1, content: innerH[2].replace(/^#+\s+/, '') });
        } else {
          blocks.push({ type: 'heading', level: hMatch[1].length, content: content });
        }
        i++; continue;
      }

      // table — model sometimes puts header row on same line after colon
      if (line.trim().startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          blocks.push({ type: 'table', lines: tableLines });
          continue;
        } else {
          // not a real table, treat as paragraph
          blocks.push({ type: 'para', content: tableLines.join(' ') });
          continue;
        }
      }

      // horizontal rule
      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        blocks.push({ type: 'hr' });
        i++; continue;
      }

      // blockquote
      if (line.startsWith('> ')) {
        let content = '';
        while (i < lines.length && lines[i].startsWith('> ')) {
          content += lines[i].slice(2) + '\n';
          i++;
        }
        blocks.push({ type: 'blockquote', content: content.trim() });
        continue;
      }

      // unordered list
      if (/^(\s*)[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^(\s*)[-*+]\s/.test(lines[i])) {
          const indent = lines[i].match(/^(\s*)/)[1].length;
          const content = lines[i].replace(/^(\s*)[-*+]\s/, '');
          items.push({ indent, content });
          i++;
        }
        blocks.push({ type: 'ul', items });
        continue;
      }

      // ordered list
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s/, ''));
          i++;
        }
        blocks.push({ type: 'ol', items });
        continue;
      }

      // code block placeholder
      if (/^%%CB_\d+%%$/.test(line.trim())) {
        blocks.push({ type: 'code', idx: parseInt(line.match(/%%CB_(\d+)%%/)[1]) });
        i++; continue;
      }

      // blank line
      if (line.trim() === '') { i++; continue; }

      // paragraph — collect until blank line or block element
      let para = '';
      while (i < lines.length && lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('|') &&
        !lines[i].match(/^#{1,6}\s/) &&
        !lines[i].startsWith('> ') &&
        !/^(\s*)[-*+]\s/.test(lines[i]) &&
        !/^\d+\.\s/.test(lines[i]) &&
        !/^%%CB_\d+%%$/.test(lines[i].trim()) &&
        !/^---+$/.test(lines[i].trim())) {
        para += (para ? ' ' : '') + lines[i];
        i++;
      }
      if (para) {
        // check if paragraph contains inline table (model put | on same line as text)
        if (para.includes('|') && para.split('|').length > 4) {
          // try to extract table portion
          const pipeIdx = para.search(/\|\s*\w+\s*\|/);
          if (pipeIdx !== -1) {
            const preText  = para.slice(0, pipeIdx).replace(/:\s*$/, '').trim();
            const tableRaw = para.slice(pipeIdx);
            // reconstruct table rows from inline pipes
            const cells = tableRaw.split('|').map(c => c.trim()).filter(c => c && !/^-+$/.test(c) && c !== '---');
            if (cells.length >= 3) {
              if (preText) blocks.push({ type: 'para', content: preText });
              // can't reliably determine columns — push as para with note
              blocks.push({ type: 'para', content: para });
              continue;
            }
          }
        }
        blocks.push({ type: 'para', content: para });
      }
    }

    // 3. inline formatting
    function inline(str) {
      return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    // 4. render blocks to HTML
    let html = '';
    blocks.forEach(block => {
      switch (block.type) {
        case 'table': {
          const isSeparator = row => /^\|[\s\-:|]+\|$/.test(row.trim());
          const parseCells  = row => row.split('|')
            .filter((_, i, a) => i > 0 && i < a.length - 1)
            .map(c => c.trim());

          const allRows  = block.lines.filter(l => l.trim());
          const dataRows = allRows.filter(l => !isSeparator(l));
          if (dataRows.length < 1) break;

          const header = parseCells(dataRows[0]);
          const body   = dataRows.slice(1);

          let thtml = `<div class="chat-table-wrapper"><table><thead><tr>`;
          header.forEach(h => { thtml += `<th>${inline(h)}</th>`; });
          thtml += `</tr></thead><tbody>`;
          body.forEach(row => {
            thtml += `<tr>`;
            parseCells(row).forEach(cell => { thtml += `<td>${inline(cell)}</td>`; });
            thtml += `</tr>`;
          });
          thtml += `</tbody></table></div>`;
          html += thtml;
          break;
        }
        case 'heading': {
          const tag = `h${block.level}`;
          const cls = `chat-h${block.level}`;
          html += `<${tag} class="${cls}">${inline(block.content)}</${tag}>`;
          break;
        }
        case 'para':
          html += `<p>${inline(block.content)}</p>`;
          break;
        case 'hr':
          html += `<hr class="chat-hr">`;
          break;
        case 'blockquote':
          html += `<blockquote class="chat-blockquote">${inline(block.content)}</blockquote>`;
          break;
        case 'ul': {
          let listHtml = '<ul class="chat-ul">';
          block.items.forEach(item => {
            const depth = Math.floor(item.indent / 2);
            if (depth > 0) listHtml += `<li class="chat-li chat-li--sub">${inline(item.content)}</li>`;
            else listHtml += `<li class="chat-li">${inline(item.content)}</li>`;
          });
          listHtml += '</ul>';
          html += listHtml;
          break;
        }
        case 'ol': {
          let listHtml = '<ol class="chat-ol">';
          block.items.forEach(item => {
            listHtml += `<li class="chat-li">${inline(item)}</li>`;
          });
          listHtml += '</ol>';
          html += listHtml;
          break;
        }
        case 'code': {
          const { lang, code } = codeBlocks[block.idx];
          const escaped = code
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const langLabel = lang || 'code';
          html += `<div class="chat-code-block">
            <div class="chat-code-header">
              <span class="chat-code-lang">${langLabel}</span>
              <button class="chat-code-copy" data-copy="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
            </div>
            <pre class="chat-code-pre"><code>${escaped}</code></pre>
          </div>`;
          break;
        }
      }
    });

    return html;
  }

  /* ══════════════════════════════
     ARTIFACT
  ══════════════════════════════ */
  function addArtifact() {
    const types = [
      { icon: 'file-text', name: 'Summary.md',  meta: 'Markdown · just now' },
      { icon: 'code-2',    name: 'snippet.js',  meta: 'JavaScript · just now' },
      { icon: 'list-todo', name: 'Task list',   meta: 'Checklist · just now' },
    ];
    const t = types[Math.floor(Math.random() * types.length)];

    artifactsEmpty.style.display = 'none';
    artifactList.style.display = 'flex';
    artifactList.style.flexDirection = 'column';

    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.innerHTML = `
      <div class="artifact-icon"><i data-lucide="${t.icon}"></i></div>
      <div class="artifact-info">
        <div class="artifact-name">${t.name}</div>
        <div class="artifact-meta">${t.meta}</div>
      </div>`;
    artifactList.appendChild(card);
    lucide.createIcons();
  }

  /* ══════════════════════════════
     COPY BUTTON DELEGATION
  ══════════════════════════════ */
  messagesInner.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy="true"]');
    if (!btn) return;
    const code = btn.closest('.chat-code-block')?.querySelector('code')?.innerText;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied`;
      setTimeout(() => {
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    });
  });

  /* ══════════════════════════════
     HELPERS
  ══════════════════════════════ */
  function scrollBottom() {
    messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
  }

  function resetChat() {
    msgCount  = 0;
    typing    = false;
    conversationHistory = [];
    activeConvId = null;
    attachedFiles = [];
    attachmentPreviews.innerHTML = '';
    if (isRecording) stopRecording();
    messagesInner.innerHTML = '';
    chatMain.classList.remove('chat-started');
    welcomeState.style.display   = 'flex';
    messagesArea.style.display   = 'none';
    artifactsEmpty.style.display = 'flex';
    artifactList.style.display   = 'none';
    artifactList.innerHTML = '';
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    topbarTitle.textContent = 'New Chat';
    renderHistory();
  }

  // init
  renderHistory();

});

/* ══════════════════════════════
   CLERK AUTH — runs after all scripts load
══════════════════════════════ */
window.addEventListener('load', async function () {

  // wait for Clerk to be injected (defer means timing isn't guaranteed)
  const waitForClerk = () => new Promise(resolve => {
    if (window.Clerk) return resolve();
    const iv = setInterval(() => {
      if (window.Clerk) { clearInterval(iv); resolve(); }
    }, 50);
  });

  await waitForClerk();
  await Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });

  // not logged in → redirect
  if (!Clerk.user) {
    window.location.href = '../pages/auth/login.html';
    return;
  }

  // populate user info — trigger row + popover
  const user     = Clerk.user;
  clerkUserId    = user.id;  // set global for DB calls
  const name     = user.fullName || user.firstName || user.username || 'User';
  const email    = user.primaryEmailAddress?.emailAddress || '';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // helper to set avatar
  function setAvatar(el) {
    if (!el) return;
    if (user.imageUrl) {
      el.innerHTML = `<img src="${user.imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    } else {
      el.textContent = initials;
    }
  }

  // trigger row (bottom of sidebar)
  setAvatar(document.getElementById('slUserAvatar'));
  const slName = document.getElementById('slUserName');
  if (slName) slName.textContent = name;

  // popover (expanded menu)
  setAvatar(document.getElementById('slPopoverAvatar'));
  const popName  = document.getElementById('slPopoverName');
  const popEmail = document.getElementById('slPopoverEmail');
  if (popName)  popName.textContent  = name;
  if (popEmail) popEmail.textContent = email;

  // update welcome heading with real first name
  const welcomeName = document.querySelector('.welcome-name');
  if (welcomeName) welcomeName.textContent = user.firstName || name.split(' ')[0];

  // now load chat history (clerkUserId is set)
  if (window.fetchHistory) window.fetchHistory();

  // sign out
  document.getElementById('slSignOutBtn').addEventListener('click', async function (e) {
    e.preventDefault();
    if (confirm('Sign out of Iyomi?')) {
      await Clerk.signOut();
      window.location.href = '../pages/auth/login.html';
    }
  });

  // stubs
  /* ══════════════════════════════
     SETTINGS MODAL
  ══════════════════════════════ */
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsClose   = document.getElementById('settingsClose');
  const helpOverlay     = document.getElementById('helpOverlay');
  const helpClose       = document.getElementById('helpClose');
  const confirmOverlay  = document.getElementById('confirmOverlay');
  const confirmCancel   = document.getElementById('confirmCancel');
  const confirmOk       = document.getElementById('confirmOk');
  const confirmInput    = document.getElementById('confirmInput');
  let confirmCallback   = null;

  // open / close
  function openModal(overlay) { overlay.classList.add('open'); lucide.createIcons(); }
  function closeModal2(overlay) { overlay.classList.remove('open'); }

  document.getElementById('slSettingsBtn').addEventListener('click', e => {
    e.preventDefault();
    populateSettingsAccount();
    openModal(settingsOverlay);
  });

  document.getElementById('slHelpBtn').addEventListener('click', e => {
    e.preventDefault();
    openModal(helpOverlay);
  });

  settingsClose.addEventListener('click', () => closeModal2(settingsOverlay));
  helpClose.addEventListener('click',     () => closeModal2(helpOverlay));

  // close on backdrop click
  settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeModal2(settingsOverlay); });
  helpOverlay.addEventListener('click',     e => { if (e.target === helpOverlay)     closeModal2(helpOverlay);     });
  confirmOverlay.addEventListener('click',  e => { if (e.target === confirmOverlay)  closeModal2(confirmOverlay);  });

  // Esc closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (settingsOverlay.classList.contains('open')) closeModal2(settingsOverlay);
    else if (helpOverlay.classList.contains('open')) closeModal2(helpOverlay);
    else if (confirmOverlay.classList.contains('open')) closeModal2(confirmOverlay);
  });

  // keyboard shortcut: Ctrl+,
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      populateSettingsAccount();
      openModal(settingsOverlay);
    }
  });

  // ── NAV panel switching ──
  document.querySelectorAll('.iy-nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.iy-nav-item').forEach(b => b.classList.remove('iy-nav-item--active'));
      btn.classList.add('iy-nav-item--active');
      document.querySelectorAll('.iy-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById('panel-' + btn.dataset.panel);
      if (panel) panel.style.display = 'flex';
    });
  });

  // ── ACCOUNT: populate from Clerk ──
  function populateSettingsAccount() {
    if (!window.Clerk?.user) return;
    const u = Clerk.user;
    const name     = u.fullName || u.firstName || u.username || '';
    const email    = u.primaryEmailAddress?.emailAddress || '';
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    const avatarEl = document.getElementById('settingsAvatar');
    if (avatarEl) {
      if (u.imageUrl) {
        avatarEl.innerHTML = `<img src="${u.imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
      } else {
        avatarEl.textContent = initials;
      }
    }
    const nameEl  = document.getElementById('settingsName');
    const emailEl = document.getElementById('settingsEmail');
    if (nameEl)  nameEl.value  = name;
    if (emailEl) emailEl.value = email;
  }

  // change password / manage account → Clerk user profile
  document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
    if (window.Clerk?.user) Clerk.openUserProfile();
  });
  document.getElementById('manageAccountBtn')?.addEventListener('click', () => {
    if (window.Clerk?.user) Clerk.openUserProfile();
  });

  // ── APPEARANCE: theme segmented ──
  const themeSegs = document.querySelectorAll('#themeSegmented .iy-seg-btn');
  const savedTheme = localStorage.getItem('iyomi-theme') || 'system';
  themeSegs.forEach(btn => {
    if (btn.dataset.val === savedTheme) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      themeSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      const val = btn.dataset.val;
      localStorage.setItem('iyomi-theme', val);
      const html = document.documentElement;
      if (val === 'dark') {
        html.setAttribute('data-theme', 'dark');
      } else if (val === 'light') {
        html.removeAttribute('data-theme');
      } else {
        // system
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        prefersDark ? html.setAttribute('data-theme', 'dark') : html.removeAttribute('data-theme');
      }
      // sync sidebar pill
      const pill = document.getElementById('themePill');
      if (pill && html.getAttribute('data-theme') === 'dark') {
        // pill state auto-follows data-theme via CSS
      }
    });
  });

  // ── APPEARANCE: font size ──
  const fontSizes = { compact: '13px', default: '15px', relaxed: '17px' };
  const savedFontSize = localStorage.getItem('iyomi-font-size') || 'default';
  document.documentElement.style.setProperty('--msg-font', fontSizes[savedFontSize]);
  const fontSegs = document.querySelectorAll('#fontSizeSegmented .iy-seg-btn');
  fontSegs.forEach(btn => {
    if (btn.dataset.val === savedFontSize) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      fontSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      const val = btn.dataset.val;
      localStorage.setItem('iyomi-font-size', val);
      document.documentElement.style.setProperty('--msg-font', fontSizes[val]);
    });
  });

  // ── APPEARANCE: sidebar default ──
  const savedSidebarDefault = localStorage.getItem('iyomi-sidebar-default') || 'open';
  const sidebarDefSegs = document.querySelectorAll('#sidebarDefaultSegmented .iy-seg-btn');
  sidebarDefSegs.forEach(btn => {
    if (btn.dataset.val === savedSidebarDefault) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      sidebarDefSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      localStorage.setItem('iyomi-sidebar-default', btn.dataset.val);
    });
  });

  // ── PREFERENCES: tone ──
  const savedTone = localStorage.getItem('iyomi-tone') || 'friendly';
  const toneSegs  = document.querySelectorAll('#toneSegmented .iy-seg-btn');
  toneSegs.forEach(btn => {
    if (btn.dataset.val === savedTone) btn.classList.add('iy-seg-btn--active');
    btn.addEventListener('click', () => {
      toneSegs.forEach(b => b.classList.remove('iy-seg-btn--active'));
      btn.classList.add('iy-seg-btn--active');
      localStorage.setItem('iyomi-tone', btn.dataset.val);
    });
  });

  // ── PREFERENCES: default model ──
  const defaultModelSelect = document.getElementById('defaultModelSelect');
  if (defaultModelSelect) {
    const savedModel = localStorage.getItem('iyomi-default-model') || 'llama-3.3-70b-versatile';
    defaultModelSelect.value = savedModel;
    defaultModelSelect.addEventListener('change', () => {
      localStorage.setItem('iyomi-default-model', defaultModelSelect.value);
    });
  }

  // ── PREFERENCES: auto-title toggle ──
  function initToggle(id, storageKey, defaultVal) {
    const toggle = document.getElementById(id);
    if (!toggle) return;
    const saved = localStorage.getItem(storageKey);
    const on    = saved !== null ? saved === 'true' : defaultVal;
    toggle.dataset.on    = on;
    toggle.ariaChecked   = on;
    toggle.addEventListener('click', () => {
      const next = toggle.dataset.on !== 'true';
      toggle.dataset.on  = next;
      toggle.ariaChecked = next;
      localStorage.setItem(storageKey, next);
    });
  }

  initToggle('autoTitleToggle',   'iyomi-auto-title',    true);
  initToggle('saveHistoryToggle', 'iyomi-save-history',  true);

  // ── PRIVACY: export data ──
  document.getElementById('exportDataBtn')?.addEventListener('click', () => {
    const data = {
      exportedAt: new Date().toISOString(),
      conversations: typeof conversations !== 'undefined' ? conversations : []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `iyomi-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── CONFIRM DIALOG helper ──
  function showConfirm(title, sub, requireTyping, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmSub').textContent   = sub;
    const wrap = document.getElementById('confirmInputWrap');
    if (requireTyping) {
      wrap.style.display = 'block';
      confirmInput.value = '';
      confirmOk.disabled = true;
      confirmInput.oninput = () => {
        confirmOk.disabled = confirmInput.value.trim() !== 'DELETE';
      };
    } else {
      wrap.style.display = 'none';
      confirmOk.disabled = false;
    }
    confirmCallback = onConfirm;
    openModal(confirmOverlay);
  }

  confirmCancel.addEventListener('click', () => closeModal2(confirmOverlay));
  confirmOk.addEventListener('click', () => {
    closeModal2(confirmOverlay);
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  // ── PRIVACY: delete all conversations ──
  document.getElementById('deleteAllChatsBtn')?.addEventListener('click', () => {
    showConfirm(
      'Delete all conversations?',
      'This permanently removes all your chat history and cannot be undone.',
      true,
      async () => {
        if (clerkUserId) {
          await fetch(`${API}/api/conversations?userId=${clerkUserId}`, { method: 'DELETE' });
        }
        conversations = [];
        activeConvId  = null;
        conversationHistory = [];
        renderHistory();
        messagesInner.innerHTML = '';
        chatMain.classList.remove('chat-started');
        welcomeState.style.display   = 'flex';
        messagesArea.style.display   = 'none';
        topbarTitle.textContent      = 'New Chat';
        closeModal2(settingsOverlay);
      }
    );
  });

  // ── PRIVACY: delete account ──
  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
    showConfirm(
      'Delete your account?',
      'This permanently deletes your account and all associated data. Type DELETE to confirm.',
      true,
      async () => {
        if (window.Clerk?.user) {
          await Clerk.user.delete();
          window.location.href = '../index.html';
        }
      }
    );
  });

  // ── SETTINGS SEARCH (basic filter) ──
  document.getElementById('settingsSearch')?.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    document.querySelectorAll('.iy-nav-item[data-panel]').forEach(btn => {
      btn.style.display = !q || btn.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  lucide.createIcons();

  // load chat history from DB
  window.fetchHistory();
});``