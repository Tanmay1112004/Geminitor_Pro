/**
 * app.js — Geminitor Pro frontend logic.
 * Vanilla JS, ES6+. Firebase Auth + Firestore for persistence.
 * Uses fetch() ReadableStream for SSE-style streaming.
 */

/* ── State ─────────────────────────────────────────────────────────────── */
let sessionId      = "";
let chatHistory    = [];
let isStreaming    = false;
let ragActive      = false;
let pendingImage   = null;
let settings       = {};

let currentUser    = null;
let currentChatId  = null;
let sessionStart   = Date.now();

// Per-session chart data
let _tokenHistory   = [];
let _responseHistory = [];
let _personaCounts  = {};

// Chart.js instances
let _chartTokens   = null;
let _chartResponse = null;
let _chartPersona  = null;

/* ── Auth Guard ─────────────────────────────────────────────────────────── */
onAuthChange(async (user) => {
  if (!user) {
    window.location.href = "/auth.html";
    return;
  }
  currentUser = user;
  initUserProfile(user);
  loadSettings();
  applySettings();
  updateModelBadge();
  sessionId   = user.uid;
  sessionStart = Date.now();
  await loadFirestoreHistory();
});

/* ── User Profile ───────────────────────────────────────────────────────── */
function initUserProfile(user) {
  const name    = user.displayName || user.email.split("@")[0] || "User";
  const initial = name.charAt(0).toUpperCase();
  document.getElementById("user-avatar").textContent = initial;
  document.getElementById("user-name").textContent   = name;
  document.getElementById("user-email").textContent  = user.email || "";

  // Color avatar based on initial
  const colors = ["#10a37f","#5436da","#e06c4e","#4a90d9","#9b59b6","#e74c3c","#2ecc71"];
  const idx    = initial.charCodeAt(0) % colors.length;
  document.getElementById("user-avatar").style.background = colors[idx];
}

async function doSignOut() {
  if (!confirm("Sign out of Geminitor Pro?")) return;
  await logout();
  window.location.href = "/auth.html";
}

/* ── Load Firestore Chat History ──────────────────────────────────────────── */
async function loadFirestoreHistory() {
  if (!currentUser) return;
  try {
    const chats = await loadChatHistory(currentUser.uid);
    const list  = document.getElementById("chat-history-list");
    if (!chats.length) {
      list.innerHTML = '<p class="empty-history">No history yet</p>';
      return;
    }
    list.innerHTML = chats.map(c => `
      <div class="history-item ${c.chatId === currentChatId ? 'active' : ''}"
           title="${escapeHtml(c.title || 'Chat')}"
           onclick="openChat('${c.chatId}')">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.title || 'Chat')}</span>
        <button class="history-delete" onclick="event.stopPropagation();deleteChatItem('${c.chatId}')" title="Delete">🗑️</button>
      </div>`).join("");
  } catch (e) { /* silent */ }
}

async function openChat(chatId) {
  if (!currentUser) return;
  currentChatId = chatId;

  // Clear UI
  document.getElementById("messages").innerHTML = "";
  chatHistory = [];
  const es = document.getElementById("empty-state");
  if (es) es.style.display = "none";

  try {
    const msgs = await loadChatMessages(currentUser.uid, chatId);
    msgs.forEach(m => {
      const ts = m.timestamp?.toDate ? formatTime(m.timestamp.toDate()) : "";
      if (m.role === "user") {
        appendUserMessage(m.content, ts);
        chatHistory.push({ role: "user", content: m.content, timestamp: ts });
      } else {
        appendBotMessage(m.content, { ts, response_time: m.responseTime, tokens: m.tokens });
        chatHistory.push({ role: "assistant", content: m.content, timestamp: ts });
      }
    });
    scrollToBottom();
  } catch (e) { /* silent */ }

  closeSidebar();
  await loadFirestoreHistory();
}

async function deleteChatItem(chatId) {
  if (!currentUser) return;
  if (!confirm("Delete this chat?")) return;
  await deleteChat(currentUser.uid, chatId);
  if (currentChatId === chatId) {
    currentChatId = null;
    newChat();
  }
  await loadFirestoreHistory();
}

/* ── Settings (localStorage) ───────────────────────────────────────────── */
function loadSettings() {
  const stored = localStorage.getItem("geminitor_settings");
  settings = stored ? JSON.parse(stored) : {};
  const { model = "gemini-2.5-flash", persona = "General Intelligence Agent",
          temperature = 0.7, max_tokens = 2048, theme = "dark" } = settings;

  document.getElementById("model-select").value   = model;
  document.getElementById("persona-select").value = persona;
  document.getElementById("temp-range").value     = temperature;
  document.getElementById("tokens-range").value   = max_tokens;
  document.getElementById("temp-val").textContent   = temperature;
  document.getElementById("tokens-val").textContent = max_tokens;

  document.body.className = theme === "light" ? "light" : "dark";
  document.getElementById("theme-btn").textContent = theme === "light" ? "☀️" : "🌙";
}

function saveSettings() {
  settings = {
    model:       document.getElementById("model-select").value,
    persona:     document.getElementById("persona-select").value,
    temperature: parseFloat(document.getElementById("temp-range").value),
    max_tokens:  parseInt(document.getElementById("tokens-range").value),
    theme:       document.body.classList.contains("light") ? "light" : "dark",
  };
  localStorage.setItem("geminitor_settings", JSON.stringify(settings));
  updateModelBadge();
}

function applySettings() { saveSettings(); }

function updateSlider(type) {
  if (type === "temp") {
    document.getElementById("temp-val").textContent = document.getElementById("temp-range").value;
  } else {
    document.getElementById("tokens-val").textContent = document.getElementById("tokens-range").value;
  }
  saveSettings();
}

function updateModelBadge() {
  const m = document.getElementById("model-select").value;
  document.getElementById("model-badge-header").textContent = m;
}

/* ── Input handling ────────────────────────────────────────────────────── */
function onInputChange() {
  const ta  = document.getElementById("msg-input");
  const btn = document.getElementById("send-btn");
  const cc  = document.getElementById("char-count");

  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 140) + "px";

  const len = ta.value.length;
  cc.textContent = len;
  cc.style.color = len > 3800 ? "#e57373" : "var(--subtext)";
  btn.disabled   = len === 0 || isStreaming;
  closeAttachMenu();
}

function onKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
}

function handleSend() {
  if (isStreaming) return;

  if (pendingImage) {
    const ta       = document.getElementById("msg-input");
    const question = ta.value.trim() || "Describe this image in detail.";
    ta.value = ""; ta.style.height = "auto";
    document.getElementById("char-count").textContent = "0";
    document.getElementById("send-btn").disabled = true;
    sendImageMessage(pendingImage.file, question);
    clearImagePreview();
    return;
  }

  const ta   = document.getElementById("msg-input");
  const text = ta.value.trim();
  if (!text) return;
  ta.value = ""; ta.style.height = "auto";
  document.getElementById("char-count").textContent = "0";
  document.getElementById("send-btn").disabled = true;
  sendMessage(text);
}

function sendSuggestion(text) {
  document.getElementById("msg-input").value = text;
  onInputChange();
  handleSend();
}

/* ── Core send / stream ────────────────────────────────────────────────── */
async function sendMessage(text) {
  hideEmpty();
  isStreaming = true;
  saveSettings();

  // ── 1. Show user message IMMEDIATELY — no Firestore wait ──────────────
  const ts = formatTime(new Date());
  appendUserMessage(text, ts);
  chatHistory.push({ role: "user", content: text, timestamp: ts });
  updateLocalHistoryList(text);
  showTypingIndicator();

  // ── 2. Kick off Firestore chat creation in background (non-blocking) ──
  if (!currentChatId && currentUser) {
    createNewChat(currentUser.uid, settings.persona, settings.model)
      .then(id => {
        currentChatId = id;
        // backfill the user message now that we have a chatId
        saveMessage(currentUser.uid, id, { role: "user", content: text }).catch(() => {});
        loadFirestoreHistory().catch(() => {});
      })
      .catch(() => {});
  }

  // ── 3. Hit the API immediately ─────────────────────────────────────────
  const payload = {
    message:     text,
    model:       settings.model,
    persona:     settings.persona,
    temperature: settings.temperature,
    max_tokens:  settings.max_tokens,
    history:     chatHistory.slice(-20),
  };
  const headers  = { "Content-Type": "application/json", "X-Session-ID": sessionId || "anonymous" };
  const endpoint = ragActive ? "/api/rag/query" : "/api/chat/stream";

  try {
    if (ragActive) {
      const res  = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
      const json = await res.json();
      hideTypingIndicator();
      if (!json.success) throw new Error(json.error || "RAG error");
      const { response, response_time } = json.data;
      const botTs = formatTime(new Date());
      appendBotMessage(response, { response_time, tokens: null, follow_up: "", ts: botTs });
      chatHistory.push({ role: "assistant", content: response, timestamp: botTs });
      if (currentUser && currentChatId) {
        saveMessage(currentUser.uid, currentChatId, { role: "assistant", content: response, responseTime: response_time }).catch(() => {});
      }
    } else {
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      hideTypingIndicator();

      const { el, contentEl } = createBotMessageEl();
      let rawText  = "";
      let metadata = {};
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.error) throw new Error(evt.error);
            if (evt.chunk) {
              rawText += evt.chunk;
              contentEl.innerHTML = renderMarkdown(rawText);
              hljs.highlightAll();
              scrollToBottom();
            }
            if (evt.done) { metadata = evt; }
          } catch (e) { /* skip bad lines */ }
        }
      }

      const botTs = formatTime(new Date());
      finalizeBotMessage(el, contentEl, rawText, { ...metadata, ts: botTs });
      chatHistory.push({ role: "assistant", content: rawText, timestamp: botTs });

      // Persist to Firestore + update analytics (non-blocking)
      const rt  = metadata.response_time || 0;
      const tok = metadata.tokens || 0;
      if (currentUser && currentChatId) {
        saveMessage(currentUser.uid, currentChatId, { role: "assistant", content: rawText, responseTime: rt, tokens: tok }).catch(() => {});
        updateAnalytics(currentUser.uid, rt, tok, text).catch(() => {});
      }

      // Track local chart data
      _tokenHistory.push(tok);
      _responseHistory.push(rt);
      const p = settings.persona || "General Intelligence Agent";
      _personaCounts[p] = (_personaCounts[p] || 0) + 1;

      await loadFirestoreHistory();
    }
  } catch (err) {
    hideTypingIndicator();
    appendErrorMessage(err.message);
  }

  isStreaming = false;
  document.getElementById("send-btn").disabled =
    document.getElementById("msg-input").value.trim() === "";
}

/* ── Image message via Vision endpoint ─────────────────────────────────── */
async function sendImageMessage(file, question) {
  hideEmpty();
  isStreaming = true;

  const ts   = formatTime(new Date());
  const msgs = document.getElementById("messages");
  const userDiv = document.createElement("div");
  userDiv.className = "message";
  const initial = currentUser ? (currentUser.displayName || currentUser.email || "U").charAt(0).toUpperCase() : "U";
  userDiv.innerHTML = `
    <div class="msg-inner user-inner">
      <div class="avatar user-avatar">${initial}</div>
      <div class="msg-content">
        <div class="msg-role">You</div>
        <div class="user-bubble">
          <img src="${URL.createObjectURL(file)}" style="max-width:180px;max-height:120px;border-radius:8px;display:block;margin-bottom:6px;" />
          ${escapeHtml(question)}
        </div>
        <div class="msg-meta">${ts}</div>
      </div>
    </div>`;
  msgs.appendChild(userDiv);
  chatHistory.push({ role: "user", content: `[Image: ${file.name}] ${question}`, timestamp: ts });
  updateLocalHistoryList(`[Image] ${question}`);
  scrollToBottom();

  showTypingIndicator();
  const form = new FormData();
  form.append("file", file);
  try {
    const res  = await fetch(`/api/upload/image?question=${encodeURIComponent(question)}`,
                              { method: "POST", headers: { "X-Session-ID": sessionId }, body: form });
    const json = await res.json();
    if (!json.success) throw new Error(json.detail?.error || json.error || "Vision error");
    hideTypingIndicator();
    const botTs = formatTime(new Date());
    appendBotMessage(json.data.response, { ts: botTs });
    chatHistory.push({ role: "assistant", content: json.data.response, timestamp: botTs });
  } catch (err) {
    hideTypingIndicator();
    appendErrorMessage(err.message);
  }

  isStreaming = false;
  document.getElementById("send-btn").disabled =
    document.getElementById("msg-input").value.trim() === "";
}

/* ── Message DOM helpers ───────────────────────────────────────────────── */
function hideEmpty() {
  const es = document.getElementById("empty-state");
  if (es) es.style.display = "none";
}

function getInitial() {
  if (!currentUser) return "U";
  return (currentUser.displayName || currentUser.email || "U").charAt(0).toUpperCase();
}

function appendUserMessage(text, ts) {
  const msgs = document.getElementById("messages");
  const div  = document.createElement("div");
  div.className = "message";
  div.innerHTML = `
    <div class="msg-inner user-inner">
      <div class="avatar user-avatar">${getInitial()}</div>
      <div class="msg-content">
        <div class="msg-role">You</div>
        <div class="user-bubble">${escapeHtml(text)}</div>
        <div class="msg-meta">${ts}</div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollToBottom();
}

function createBotMessageEl() {
  const msgs    = document.getElementById("messages");
  const div     = document.createElement("div");
  div.className = "message";
  div.innerHTML = `
    <div class="msg-inner bot-inner">
      <div class="avatar bot-avatar">🤖</div>
      <div class="msg-content">
        <div class="msg-role">Geminitor</div>
        <div class="bot-bubble" id="streaming-content"></div>
        <div class="msg-meta bot-meta" id="streaming-meta"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollToBottom();
  return { el: div, contentEl: div.querySelector("#streaming-content") };
}

function finalizeBotMessage(el, contentEl, rawText, meta) {
  contentEl.removeAttribute("id");
  contentEl.innerHTML = renderMarkdown(rawText);
  hljs.highlightAll();

  const metaEl = el.querySelector("#streaming-meta");
  if (metaEl) { metaEl.removeAttribute("id"); }

  const timeStr  = meta.response_time ? `⏱️ ${meta.response_time}s` : "";
  const tokenStr = meta.tokens        ? `🔢 ~${meta.tokens} tokens` : "";
  const ts       = meta.ts            ? meta.ts : "";

  const copyId = `copy-${Date.now()}`;
  if (metaEl) {
    metaEl.innerHTML = `
      ${timeStr} ${tokenStr} ${ts}
      <button class="copy-btn" id="${copyId}" onclick="copyText(this, event)">📋 Copy</button>
      <button class="feedback-btn" onclick="sendFeedback(this,'positive')" title="Good response">👍</button>
      <button class="feedback-btn" onclick="sendFeedback(this,'negative')" title="Bad response">👎</button>`;
    const copyBtn = document.getElementById(copyId);
    if (copyBtn) copyBtn.dataset.raw = rawText;
  }

  if (meta.follow_up) {
    const chip    = document.createElement("div");
    chip.className = "follow-up-chip";
    chip.textContent = `💡 ${meta.follow_up}`;
    chip.onclick   = () => sendSuggestion(meta.follow_up);
    contentEl.parentElement.appendChild(chip);
  }

  scrollToBottom();
}

function appendBotMessage(text, meta) {
  const { el, contentEl } = createBotMessageEl();
  finalizeBotMessage(el, contentEl, text, meta);
}

function appendErrorMessage(msg) {
  const msgs = document.getElementById("messages");
  const div  = document.createElement("div");
  div.className = "message";
  div.innerHTML = `
    <div class="msg-inner bot-inner">
      <div class="avatar bot-avatar">🤖</div>
      <div class="msg-content">
        <div class="bot-bubble" style="color:#e57373;border-left-color:#e57373">
          ❌ Error: ${escapeHtml(msg)}
        </div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollToBottom();
}

function showTypingIndicator() {
  let ind = document.getElementById("typing-indicator");
  if (!ind) {
    ind = document.createElement("div");
    ind.id = "typing-indicator";
    ind.innerHTML = `
      <div class="typing-inner">
        <div class="avatar bot-avatar">🤖</div>
        <div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
      </div>`;
    document.getElementById("messages").appendChild(ind);
  }
  ind.style.display = "block";
  scrollToBottom();
}

function hideTypingIndicator() {
  const ind = document.getElementById("typing-indicator");
  if (ind) ind.style.display = "none";
}

/* ── Local sidebar history (session) ───────────────────────────────────── */
function updateLocalHistoryList(text) {
  const title = text.length > 36 ? text.slice(0, 36) + "…" : text;
  const list  = document.getElementById("chat-history-list");
  // Only update if no Firestore chat loaded yet (first message)
  if (currentChatId) return;
  list.innerHTML = `<div class="history-item active">${escapeHtml(title)}</div>`;
}

/* ── Actions ───────────────────────────────────────────────────────────── */
function newChat() {
  chatHistory   = [];
  currentChatId = null;
  isStreaming   = false;
  document.getElementById("messages").innerHTML = "";
  const list = document.getElementById("chat-history-list");
  list.innerHTML = '<p class="empty-history">No history yet</p>';
  const es = document.getElementById("empty-state");
  if (es) es.style.display = "flex";
  ragActive    = false;
  pendingImage = null;
  _tokenHistory    = [];
  _responseHistory = [];
  updateRagBadge(false);
  hideTypingIndicator();
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) sendBtn.disabled = document.getElementById("msg-input").value.trim() === "";
  closeSidebar();
  loadFirestoreHistory();
}

function clearChat() {
  if (!confirm("Clear this conversation?")) return;
  newChat();
  fetch("/api/history", { method: "DELETE", headers: { "X-Session-ID": sessionId } });
}

async function exportChat(format) {
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: chatHistory, format }),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `geminitor_chat.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { alert("Export error: " + e.message); }
}

/* ── Theme ─────────────────────────────────────────────────────────────── */
function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  document.body.classList.toggle("dark", !isLight);
  document.getElementById("theme-btn").textContent = isLight ? "☀️" : "🌙";
  saveSettings();
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("active");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("active");
}

/* ── File uploads ──────────────────────────────────────────────────────── */
function triggerPdfUpload()   { document.getElementById("pdf-input").click();   closeAttachMenu(); }
function triggerImageUpload() { document.getElementById("image-input").click(); closeAttachMenu(); }

function toggleAttachMenu() {
  document.getElementById("attach-menu").classList.toggle("hidden");
}
function closeAttachMenu() {
  document.getElementById("attach-menu").classList.add("hidden");
}

async function onPdfSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = "";

  setBanner("loading", `<span class="spinner">⏳</span> Indexing <strong>${escapeHtml(file.name)}</strong>…`);

  const form = new FormData();
  form.append("file", file);
  try {
    const res  = await fetch("/api/upload/pdf", { method: "POST", headers: { "X-Session-ID": sessionId }, body: form });
    const json = await res.json();
    if (!json.success) throw new Error(json.detail?.error || json.error || "Upload failed");
    ragActive = true;
    setBanner("active", `📄 <strong>${escapeHtml(file.name)}</strong> loaded — Document Q&amp;A active`);
    updateRagBadge(true, file.name);
    document.getElementById("msg-input").placeholder = `Ask anything about ${file.name}…`;
  } catch (e) {
    setBanner("error", `❌ ${escapeHtml(e.message)}`);
    ragActive = false;
  }
}

function onImageSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = "";

  pendingImage = { file };

  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("img-thumb").src          = ev.target.result;
    document.getElementById("img-thumb-name").textContent = file.name;
    document.getElementById("image-preview-area").classList.remove("hidden");
  };
  reader.readAsDataURL(file);

  const ta = document.getElementById("msg-input");
  ta.placeholder = "Ask about this image… (or press Send for a full description)";
  ta.focus();
  document.getElementById("send-btn").disabled = false;
}

function clearImagePreview() {
  pendingImage = null;
  document.getElementById("image-preview-area").classList.add("hidden");
  document.getElementById("img-thumb").src          = "";
  document.getElementById("img-thumb-name").textContent = "";
  document.getElementById("msg-input").placeholder  = "Message Geminitor Pro…";
  onInputChange();
}

/* ── Upload banner helpers ─────────────────────────────────────────────── */
function setBanner(state, html) {
  const el = document.getElementById("upload-banner");
  el.className = state === "active" ? "active" : state === "loading" ? "active loading" : "active error";
  document.getElementById("upload-banner-text").innerHTML = html;
  document.getElementById("upload-banner-dismiss").style.display = state === "loading" ? "none" : "";
}

function dismissUpload() {
  ragActive = false;
  document.getElementById("upload-banner").className = "";
  document.getElementById("msg-input").placeholder  = "Message Geminitor Pro…";
  updateRagBadge(false);
  fetch("/api/history", { method: "DELETE", headers: { "X-Session-ID": sessionId } });
}

function updateRagBadge(active, filename) {
  const label = document.getElementById("rag-label");
  const btn   = document.getElementById("rag-status-btn");
  if (active && filename) {
    label.textContent = filename.slice(0, 18) + (filename.length > 18 ? "…" : "");
    btn.style.color   = "var(--accent)";
  } else {
    label.textContent = "Upload Doc";
    btn.style.color   = "";
  }
}

/* ── Analytics modal (Chart.js) ────────────────────────────────────────── */
const CHART_DEFAULTS = {
  color:      "#10a37f",
  gridColor:  "rgba(255,255,255,.06)",
  textColor:  "#8e8ea0",
  bg:         "#1a1a1a",
};

function destroyCharts() {
  [_chartTokens, _chartResponse, _chartPersona].forEach(c => { if (c) c.destroy(); });
  _chartTokens = _chartResponse = _chartPersona = null;
}

async function showAnalytics() {
  document.getElementById("analytics-modal").classList.remove("hidden");

  // Session duration
  const elapsed = Math.round((Date.now() - sessionStart) / 60000);
  document.getElementById("stat-session").textContent = elapsed + "m";

  // Fetch backend analytics (session-level)
  let backendData = null;
  try {
    const res  = await fetch("/api/analytics", { headers: { "X-Session-ID": sessionId } });
    const json = await res.json();
    if (json.success) backendData = json.data;
  } catch (e) { /* silent */ }

  // Fetch Firestore analytics (global totals)
  let fsData = null;
  if (currentUser) {
    try { fsData = await getAnalytics(currentUser.uid); } catch (e) { /* silent */ }
  }

  const totalMsgs   = backendData?.total_messages   || 0;
  const avgTime     = backendData?.avg_response_time || 0;
  const totalTokens = fsData?.totalTokens            || backendData?.total_tokens || 0;
  const tokenHist   = _tokenHistory.length ? _tokenHistory : (backendData?.token_history || []);
  const respHist    = _responseHistory.length ? _responseHistory : (backendData?.response_times || []);

  document.getElementById("stat-msgs").textContent   = totalMsgs;
  document.getElementById("stat-time").textContent   = avgTime + "s";
  document.getElementById("stat-tokens").textContent = totalTokens.toLocaleString();

  // Destroy old charts before recreating
  destroyCharts();

  // ── Chart 1: Token Usage Line Chart ──────────────────────────────────
  const ctxTokens = document.getElementById("chart-tokens").getContext("2d");
  _chartTokens = new Chart(ctxTokens, {
    type: "line",
    data: {
      labels:   tokenHist.map((_, i) => i + 1),
      datasets: [{
        label:           "Tokens",
        data:            tokenHist,
        borderColor:     "#10a37f",
        backgroundColor: "rgba(16,163,127,.12)",
        tension:         0.4,
        fill:            true,
        pointRadius:     3,
        pointBackgroundColor: "#10a37f",
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.textColor, maxTicksLimit: 8 }, grid: { color: CHART_DEFAULTS.gridColor } },
        y: { ticks: { color: CHART_DEFAULTS.textColor }, grid: { color: CHART_DEFAULTS.gridColor } },
      },
    },
  });

  // ── Chart 2: Response Time Bar Chart ─────────────────────────────────
  const last10 = respHist.slice(-10);
  const ctxResp = document.getElementById("chart-response").getContext("2d");
  _chartResponse = new Chart(ctxResp, {
    type: "bar",
    data: {
      labels:   last10.map((_, i) => i + 1),
      datasets: [{
        label:           "Response Time (s)",
        data:            last10,
        backgroundColor: "rgba(16,163,127,.6)",
        borderColor:     "#10a37f",
        borderWidth:     1,
        borderRadius:    4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.textColor }, grid: { color: CHART_DEFAULTS.gridColor } },
        y: { ticks: { color: CHART_DEFAULTS.textColor }, grid: { color: CHART_DEFAULTS.gridColor } },
      },
    },
  });

  // ── Chart 3: Persona Usage Pie Chart ─────────────────────────────────
  const personaLabels = Object.keys(_personaCounts);
  const personaValues = Object.values(_personaCounts);
  const pieColors = ["#10a37f","#5436da","#e06c4e","#4a90d9","#9b59b6"];
  const ctxPersona = document.getElementById("chart-persona").getContext("2d");
  _chartPersona = new Chart(ctxPersona, {
    type: "doughnut",
    data: {
      labels:   personaLabels.length ? personaLabels : ["No data"],
      datasets: [{
        data:            personaValues.length ? personaValues : [1],
        backgroundColor: personaLabels.length ? pieColors.slice(0, personaLabels.length) : ["#2f2f2f"],
        borderWidth:     0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: CHART_DEFAULTS.textColor, font: { size: 10 }, boxWidth: 10, padding: 8 } },
      },
    },
  });

  // ── Top Keywords ────────────────────────────────────────────────────
  const chipsEl = document.getElementById("keywords-chips");
  const topWords = fsData?.topWords || {};
  const sorted   = Object.entries(topWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length) {
    chipsEl.innerHTML = sorted.map(([w, c]) =>
      `<span class="keyword-chip">${escapeHtml(w)}<span class="kw-count">${c}</span></span>`
    ).join("");
  } else {
    const kw = backendData?.top_keywords || [];
    chipsEl.innerHTML = kw.length
      ? kw.map(w => `<span class="keyword-chip">${escapeHtml(w)}</span>`).join("")
      : '<span style="font-size:.8rem;color:var(--subtext)">No data yet</span>';
  }
}

function closeAnalytics(e) {
  if (!e || e.target === document.getElementById("analytics-modal")) {
    document.getElementById("analytics-modal").classList.add("hidden");
    destroyCharts();
  }
}

/* ── Feedback ───────────────────────────────────────────────────────────── */
async function sendFeedback(btn, type) {
  btn.textContent = type === "positive" ? "✅" : "❌";
  btn.disabled    = true;
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
      body: JSON.stringify({ message_index: 0, feedback: type }),
    });
  } catch (e) { /* silent */ }
}

/* ── Utility ────────────────────────────────────────────────────────────── */
function scrollToBottom() {
  const mc = document.getElementById("messages-container");
  if (mc) mc.scrollTop = mc.scrollHeight;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text) {
  if (typeof marked === "undefined") return escapeHtml(text);
  return marked.parse(text, { breaks: true, gfm: true });
}

function copyText(btn, e) {
  e.stopPropagation();
  const text = btn.dataset.raw || btn.closest(".msg-content")?.querySelector(".bot-bubble")?.textContent || "";
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "✅ Copied";
    setTimeout(() => { btn.textContent = "📋 Copy"; }, 2000);
  });
}
