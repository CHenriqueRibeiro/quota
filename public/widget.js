(function () {
  "use strict";

  const script = document.currentScript;
  const publicKey = script?.dataset?.key;
  if (!publicKey) {
    console.error("[Quota Widget] data-key não informado");
    return;
  }

  const API_URL = script.dataset.api || "https://quota-api.up.railway.app";
  const ICON_URL = script.dataset.icon || "";

  const state = {
    sessionToken: null,
    widget: null,
    topics: [],
    messages: [],
    expandedTopicId: null,
    topicAnswers: {},
    open: false,
  };

  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');

    .qw-root, .qw-root * {
      box-sizing: border-box;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .qw-fab {
      position: fixed; right: 24px; bottom: 24px;
      width: 60px; height: 60px; border-radius: 30px;
      border: none; cursor: pointer; padding: 0;
      background: #6366f1;
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.45);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2147483000;
      display: flex; align-items: center; justify-content: center;
      color: #ffffff;
    }
    .qw-fab:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 40px rgba(99, 102, 241, 0.6);
    }
    .qw-fab:active { transform: scale(0.95); }
    .qw-fab img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .qw-fab-badge {
      position: absolute; top: 2px; right: 2px;
      width: 14px; height: 14px; background: #10b981;
      border: 2px solid #ffffff; border-radius: 50%;
    }

    .qw-panel {
      position: fixed; right: 24px; bottom: 96px;
      width: 380px; height: 600px; max-width: calc(100vw - 32px); max-height: calc(100vh - 120px);
      background: #ffffff; border-radius: 24px;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.06);
      overflow: hidden; z-index: 2147483000;
      opacity: 0; transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column;
    }
    .qw-panel.qw-open {
      opacity: 1; transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .qw-header {
      color: #ffffff; padding: 20px 20px 18px;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }
    .qw-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .qw-header-logo {
      width: 42px; height: 42px; border-radius: 14px;
      background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
      padding: 3px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: center;
    }
    .qw-header-logo img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
    .qw-title { font-weight: 700; font-size: 16px; line-height: 1.2; letter-spacing: -0.01em; }
    .qw-sub { font-size: 11px; opacity: 0.9; margin-top: 3px; display: flex; align-items: center; gap: 6px; }
    .qw-status-dot { width: 7px; height: 7px; background: #34d399; border-radius: 50%; display: inline-block; }

    .qw-icon-btn {
      border: none; background: rgba(255,255,255,0.15); color: #ffffff;
      cursor: pointer; font-size: 16px; width: 32px; height: 32px;
      border-radius: 10px; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    .qw-icon-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.05); }

    .qw-body {
      flex: 1; overflow-y: auto; padding: 20px;
      background: #f8fafc; display: flex; flex-direction: column; gap: 14px;
    }
    .qw-body::-webkit-scrollbar { width: 5px; }
    .qw-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

    .qw-section-title {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
      color: #64748b; font-weight: 700; margin-bottom: 2px;
    }

    .qw-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;
      padding: 14px 16px; cursor: pointer;
      display: flex; flex-direction: column; gap: 6px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .qw-card:hover {
      border-color: #818cf8; transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.12);
    }
    .qw-card-expanded {
      border-color: #6366f1; background: #ffffff;
      box-shadow: 0 10px 24px rgba(99, 102, 241, 0.15);
    }
    .qw-card-header-row {
      display: flex; items-center; justify-content: space-between; gap: 12px; width: 100%;
    }
    .qw-card-name { font-weight: 600; color: #0f172a; font-size: 14px; }
    .qw-card-desc { font-size: 12px; color: #64748b; line-height: 1.4; }
    .qw-card-arrow {
      width: 26px; height: 26px; border-radius: 50%;
      background: #e0e7ff; color: #4f46e5; font-size: 12px; font-weight: bold;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: transform 0.25s ease, background 0.2s;
    }
    .qw-card-arrow.qw-rotated { transform: rotate(180deg); background: #6366f1; color: #ffffff; }

    .qw-topic-answer {
      margin-top: 10px; padding: 12px 14px; border-radius: 12px;
      background: #f1f5f9; border-left: 3px solid #6366f1;
      font-size: 13px; color: #1e293b; line-height: 1.5;
      animation: qw-fade-down 0.25s ease-out forwards;
    }
    @keyframes qw-fade-down {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .qw-msg {
      max-width: 85%; padding: 12px 16px; border-radius: 18px;
      font-size: 13px; line-height: 1.5; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
    }
    .qw-msg-bot {
      background: #ffffff; border: 1px solid #e2e8f0; color: #0f172a;
      align-self: flex-start; border-top-left-radius: 4px;
    }
    .qw-msg-user {
      background: #6366f1; color: #ffffff;
      align-self: flex-end; border-top-right-radius: 4px;
    }

    .qw-center {
      height: 100%; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 12px; color: #64748b; font-size: 13px; text-align: center;
    }
    .qw-spinner {
      width: 38px; height: 38px; border-radius: 50%;
      border: 3px solid #e2e8f0; border-top-color: #6366f1;
      animation: qw-spin 0.8s linear infinite;
    }
    @keyframes qw-spin { to { transform: rotate(360deg); } }

    .qw-footer-form {
      padding: 12px 16px; background: #ffffff; border-top: 1px solid #e2e8f0;
      display: flex; items-center; gap: 8px;
    }
    .qw-input {
      flex: 1; height: 40px; border-radius: 12px; border: 1px solid #cbd5e1;
      padding: 0 14px; font-size: 13px; outline: none; background: #f8fafc;
      color: #0f172a; transition: all 0.2s;
    }
    .qw-input:focus { border-color: #6366f1; background: #ffffff; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
    .qw-send-btn {
      height: 40px; width: 40px; border-radius: 12px; border: none;
      background: #6366f1; color: #ffffff; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: all 0.2s;
    }
    .qw-send-btn:hover { background: #4f46e5; transform: scale(1.05); }

    .qw-branding {
      text-align: center; font-size: 11px; color: #94a3b8; padding: 6px; background: #ffffff; border-top: 1px solid #f1f5f9;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "qw-root";

  const fab = document.createElement("button");
  fab.className = "qw-fab";
  fab.setAttribute("aria-label", "Abrir Quopiloto");
  fab.innerHTML = ICON_URL
    ? `<img src="${ICON_URL}" alt=""><span class="qw-fab-badge"></span>`
    : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="qw-fab-badge"></span>`;

  const panel = document.createElement("div");
  panel.className = "qw-panel";

  root.appendChild(fab);
  root.appendChild(panel);
  document.body.appendChild(root);
  loadPublicWidget();

  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "onclick") el.onclick = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    children.flat().forEach((c) => {
      if (c == null) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  };

  const setPanel = (...nodes) => {
    panel.innerHTML = "";
    nodes.forEach((n) => panel.appendChild(n));
  };

  const headerGradient = () => {
    const c = state.widget?.primaryColor;
    return c
      ? `linear-gradient(135deg, ${c} 0%, ${c}dd 100%)`
      : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
  };

  const renderLoading = (label = "Conectando ao Quopiloto...") => {
    setPanel(
      h(
        "div",
        { class: "qw-center" },
        h("div", { class: "qw-spinner" }),
        h("div", { style: "font-weight: 500;" }, label)
      )
    );
  };

  const renderError = (msg) => {
    setPanel(h("div", { class: "qw-center" }, h("div", {}, msg)));
  };

  const buildHeader = (title, subtitle = "Online", opts = {}) => {
    const header = h("div", { class: "qw-header" });
    header.style.background = headerGradient();

    const left = h("div", { class: "qw-header-left" });
    if (opts.back) {
      const back = h("button", {
        class: "qw-icon-btn",
        "aria-label": "Voltar",
        html: "←",
        onclick: opts.back,
      });
      left.appendChild(back);
    } else {
      const logo = h(
        "div",
        { class: "qw-header-logo" },
        state.widget?.logo || ICON_URL
          ? h("img", { src: state.widget?.logo || ICON_URL, alt: "" })
          : h(
              "svg",
              { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "#fff", "stroke-width": "2" },
              h("path", { d: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" })
            )
      );
      left.appendChild(logo);
    }

    left.appendChild(
      h(
        "div",
        {},
        h("div", { class: "qw-title" }, title),
        h(
          "div",
          { class: "qw-sub" },
          h("span", { class: "qw-status-dot" }),
          subtitle
        )
      )
    );

    header.appendChild(left);
    header.appendChild(
      h("button", {
        class: "qw-icon-btn",
        "aria-label": "Fechar",
        html: "✕",
        onclick: close,
      })
    );
    return header;
  };

  const toggleTopic = async (topicId) => {
    if (state.expandedTopicId === topicId) {
      state.expandedTopicId = null;
      renderTopics();
      return;
    }

    state.expandedTopicId = topicId;

    if (!state.topicAnswers[topicId]) {
      try {
        const res = await fetch(`${API_URL}/widget/chat/select-topic`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: state.sessionToken, topicId }),
        });
        const data = await res.json();
        state.topicAnswers[topicId] = data.answer?.content || data.topic?.description || "Resposta do tópico processada com sucesso.";
      } catch {
        state.topicAnswers[topicId] = "Erro ao carregar resposta do tópico.";
      }
    }
    renderTopics();
  };

  const renderTopics = () => {
    const w = state.widget || {};
    const header = buildHeader(w.name || "Quopiloto IA", "Online");
    const body = h("div", { class: "qw-body" });

    // Render Chat Messages if any user query exists
    state.messages.forEach((m) => {
      body.appendChild(
        h(
          "div",
          { class: `qw-msg ${m.sender === "bot" ? "qw-msg-bot" : "qw-msg-user"}` },
          m.text
        )
      );
    });

    // Render Topics Section
    body.appendChild(h("div", { class: "qw-section-title" }, "Tópicos de Atendimento"));

    if (!state.topics.length) {
      body.appendChild(
        h(
          "div",
          { class: "qw-card", style: "cursor: default;" },
          h("div", { class: "qw-card-name" }, "Atendimento IA Ativo"),
          h("div", { class: "qw-card-desc" }, "Digite sua dúvida no campo abaixo para conversar com a IA.")
        )
      );
    } else {
      state.topics.forEach((topic) => {
        const isExpanded = state.expandedTopicId === topic.id;
        const answerText = state.topicAnswers[topic.id];

        const cardHeaderRow = h(
          "div",
          { class: "qw-card-header-row" },
          h("div", { class: "qw-card-name" }, topic.name || ""),
          h("div", { class: `qw-card-arrow ${isExpanded ? "qw-rotated" : ""}`, html: isExpanded ? "▲" : "▼" })
        );

        const cardNode = h(
          "div",
          {
            class: `qw-card ${isExpanded ? "qw-card-expanded" : ""}`,
            onclick: () => toggleTopic(topic.id),
          },
          cardHeaderRow,
          topic.description ? h("div", { class: "qw-card-desc" }, topic.description) : null,
          isExpanded
            ? h(
                "div",
                { class: "qw-topic-answer" },
                answerText || "Carregando resposta do tópico..."
              )
            : null
        );

        body.appendChild(cardNode);
      });
    }

    const branding = h("div", { class: "qw-branding" }, "Desenvolvido com Quota IA");
    setPanel(header, body, branding);
  };

  async function loadPublicWidget() {
    try {
      const res = await fetch(`${API_URL}/widget/public/${publicKey}`);
      if (!res.ok) return;
      const data = await res.json();

      state.widget = {
        ...state.widget,
        ...data,
      };

      if (data.primaryColor) {
        fab.style.backgroundColor = data.primaryColor;
        fab.style.boxShadow = `0 8px 32px ${data.primaryColor}66`;
      }

      if (data.logo) {
        fab.innerHTML = `<img src="${data.logo}" alt=""><span class="qw-fab-badge"></span>`;
      }
    } catch (error) {
      console.error("[Quota Widget] erro ao carregar identidade", error);
    }
  }

  async function loadWidget() {
    renderLoading();

    try {
      const res = await fetch(`${API_URL}/widget/init/${publicKey}`);
      const data = await res.json();

      if (!data.sessionToken) {
        return renderError("Assistente indisponível no momento.");
      }

      state.sessionToken = data.sessionToken;
      state.widget = {
        ...state.widget,
        ...(data.widget || {}),
      };

      state.topics = data.topics || [];

      if (state.widget?.primaryColor) {
        fab.style.backgroundColor = state.widget.primaryColor;
        fab.style.boxShadow = `0 8px 32px ${state.widget.primaryColor}66`;
      }

      renderTopics();
    } catch (e) {
      renderError("Erro ao conectar com o Quopiloto.");
    }
  }

  function open() {
    state.open = true;
    panel.classList.add("qw-open");
    if (!state.sessionToken) loadWidget();
  }

  function close() {
    state.open = false;
    panel.classList.remove("qw-open");
  }

  fab.addEventListener("click", () => (state.open ? close() : open()));
})();
