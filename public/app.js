// === Theme ===
function initTheme() {
  const saved = localStorage.getItem('csp-theme');
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefers ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('csp-theme', next);
}

// === Character accent colors ===
const characterColors = {
  'takamatsu-tomori': '#7a9cb5',
  'chihaya-anon':      '#e8a0bf',
  'togawa-sakiko':     '#8b9dc3',
  'mutsumi-wakaba':    '#9cbe9c'
};

const defaultColor = '#b0a0c8';

function getColor(slug) {
  return characterColors[slug] || defaultColor;
}

// === Character-specific opening lines ===
const characterGreetings = {
  'takamatsu-tomori': `……你好。我是高松灯。

（低头翻着笔记本，声音很小）

那个……你想聊什么？我可能不太会说话，但是……我会认真听的。`,

  'chihaya-anon': `啊，你好呀~ 我是千早爱音！

（撩了一下头发，笑起来）

你是来找我聊天的吗？太好了~ 最近都没有什么人来找我玩呢。你想聊什么呢？`,

  'togawa-sakiko': `你好。我是丰川祥子。

（端正地坐着，语气温和但带着一丝距离）

既然你来了，想必不是毫无缘由。你想谈什么？`,

  'mutsumi-wakaba': `……你好。

（沉默了几秒）

我是若叶睦。嗯。你想说什么就说吧。……我在听。`
};

function getGreeting(slug, name) {
  return characterGreetings[slug] || `…你好。我是${name}。`;
}

// === API helpers ===
async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// === Avatar URL ===
function avatarUrl(slug, hasAvatar) {
  return hasAvatar ? `/api/characters/${slug}/avatar` : null;
}

// === Chat history (multi-conversation) ===
function loadConversations(slug) {
  try {
    const data = JSON.parse(localStorage.getItem(`csp-chats-${slug}`));
    if (Array.isArray(data)) return data;
    // Migrate old single-conversation format
    const old = JSON.parse(localStorage.getItem(`csp-chat-${slug}`));
    if (Array.isArray(old) && old.length > 0) {
      localStorage.removeItem(`csp-chat-${slug}`);
      const firstUser = old.find(m => m.role === 'user');
      const conv = { id: Date.now().toString(36), title: firstUser ? firstUser.content.slice(0, 40) : '', messages: old, createdAt: old[0]?.timestamp || Date.now() };
      saveConversations(slug, [conv]);
      return [conv];
    }
    return [];
  } catch {
    return [];
  }
}

function saveConversations(slug, conversations) {
  localStorage.setItem(`csp-chats-${slug}`, JSON.stringify(conversations));
}

function createConversation(slug) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', messages: [], createdAt: Date.now() };
}

function deleteConversation(slug, convId) {
  const convs = loadConversations(slug).filter(c => c.id !== convId);
  saveConversations(slug, convs);
  return convs;
}

function getConversation(slug, convId) {
  return loadConversations(slug).find(c => c.id === convId) || null;
}

function updateConversation(slug, convId, messages) {
  const convs = loadConversations(slug);
  const idx = convs.findIndex(c => c.id === convId);
  if (idx === -1) return;
  if (!convs[idx].title && messages.length > 0) {
    const firstUser = messages.find(m => m.role === 'user');
    if (firstUser) convs[idx].title = firstUser.content.slice(0, 40);
  }
  convs[idx].messages = messages;
  saveConversations(slug, convs);
}

// === Time formatting ===
function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateFull(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

initTheme();
