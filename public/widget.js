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
    open: false,
  };

  const style = document.createElement("style");
  style.textContent = `
    .qw-root, .qw-root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    .qw-fab {
      position: fixed; right: 20px; bottom: 20px;
      width: 62px; height: 62px; border-radius: 50%;
      border: none; cursor: pointer; padding: 0;
      background: transparent;
      box-shadow: 0 10px 30px rgba(80, 60, 200, .28);
      transition: transform .25s ease, box-shadow .25s ease;
      z-index: 2147483000;
    }
    .qw-fab:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 14px 36px rgba(80, 60, 200, .38); }
    .qw-fab img { width: 100%; height: 100%; display: block; object-fit: contain; }
    .qw-panel {
      position: fixed; right: 20px; bottom: 95px;
      width: 370px; height: 580px;
      background: #fff; border-radius: 20px;
      box-shadow: 0 20px 60px rgba(20, 20, 60, .25);
      overflow: hidden; z-index: 2147483000;
      opacity: 0; transform: translateY(16px) scale(.96);
      pointer-events: none;
      transition: opacity .22s ease, transform .22s ease;
      display: flex; flex-direction: column;
    }
    .qw-panel.qw-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .qw-header {
      color: #fff; padding: 18px 18px 20px;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
    }
    .qw-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .qw-header-logo { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.15); padding: 4px; flex-shrink: 0; }
    .qw-header-logo img { width: 100%; height: 100%; object-fit: contain; }
    .qw-title { font-weight: 600; font-size: 15px; line-height: 1.2; }
    .qw-sub { font-size: 12px; opacity: .85; margin-top: 2px; }
    .qw-icon-btn {
      border: none; background: transparent; color: #fff;
      cursor: pointer; font-size: 18px; padding: 6px 8px;
      border-radius: 8px; transition: background .15s;
    }
    .qw-icon-btn:hover { background: rgba(255,255,255,.15); }
    .qw-body { flex: 1; overflow-y: auto; padding: 18px; background: #fafafb; }
    .qw-body h3 { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; font-weight: 600; }
    .qw-card {
      background: #fff; border: 1px solid #eceef3; border-radius: 12px;
      padding: 14px 16px; margin-bottom: 10px; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      transition: border-color .15s, transform .15s, box-shadow .15s;
    }
    .qw-card:hover { border-color: #c7c9f5; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(80,60,200,.08); }
    .qw-card-name { font-weight: 600; color: #111827; font-size: 14px; }
    .qw-card-desc { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .qw-card-arrow { color: #9ca3af; font-size: 18px; flex-shrink: 0; }
    .qw-panel-card { background: #fff; border: 1px solid #eceef3; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .qw-panel-label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; font-weight: 600; margin-bottom: 6px; }
    .qw-panel-text { color: #111827; font-size: 14px; line-height: 1.5; }
    .qw-center { height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: #6b7280; font-size: 13px; }
    .qw-spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid #eceef3; border-top-color: #4F46E5; animation: qw-spin .8s linear infinite; }
    @keyframes qw-spin { to { transform: rotate(360deg); } }
    .qw-footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 10px; border-top: 1px solid #eceef3; background: #fff; }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "qw-root";

  const fab = document.createElement("button");
  fab.className = "qw-fab";
  fab.setAttribute("aria-label", "Abrir assistente");
  fab.innerHTML = `<img src="${ICON_URL}" alt="">`;

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
    children.flat().forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  };

  const setPanel = (...nodes) => {
    panel.innerHTML = "";
    nodes.forEach(n => panel.appendChild(n));
  };

  const headerGradient = () => {
    const c = state.widget?.primaryColor;
    return c ? `linear-gradient(135deg, ${c}, #312E81)` : "linear-gradient(135deg, #4F46E5, #7C3AED)";
  };

  const renderLoading = (label = "Carregando...") => {
    setPanel(h("div", { class: "qw-center" },
      h("div", { class: "qw-spinner" }),
      h("div", {}, label),
    ));
  };

  const renderError = (msg) => {
    setPanel(h("div", { class: "qw-center" }, h("div", {}, msg)));
  };

  const buildHeader = (title, subtitle, opts = {}) => {
    const header = h("div", { class: "qw-header" });
    header.style.background = headerGradient();

    const left = h("div", { class: "qw-header-left" });
    if (opts.back) {
      const back = h("button", { class: "qw-icon-btn", "aria-label": "Voltar", html: "←", onclick: opts.back });
      left.appendChild(back);
    } else {
      const logo = h("div", { class: "qw-header-logo" },
        h("img", { src: state.widget?.logo || ICON_URL, alt: "" }),
      );
      left.appendChild(logo);
    }
    left.appendChild(h("div", {},
      h("div", { class: "qw-title" }, title),
      subtitle ? h("div", { class: "qw-sub" }, subtitle) : null,
    ));

    header.appendChild(left);
    header.appendChild(h("button", { class: "qw-icon-btn", "aria-label": "Fechar", html: "✕", onclick: close }));
    return header;
  };

  const renderTopics = () => {
    const w = state.widget || {};
    const header = buildHeader(w.name || "Assistente", w.welcomeMessage || "Como posso ajudar?");
    const body = h("div", { class: "qw-body" });
    body.appendChild(h("h3", {}, "Escolha um assunto"));

    if (!state.topics.length) {
      body.appendChild(h("div", { class: "qw-panel-text" }, "Nenhum tópico disponível."));
    } else {
      state.topics.forEach(topic => {
        const card = h("div", { class: "qw-card", onclick: () => selectTopic(topic.id) },
          h("div", {},
            h("div", { class: "qw-card-name" }, topic.name || ""),
            topic.description ? h("div", { class: "qw-card-desc" }, topic.description) : null,
          ),
          h("div", { class: "qw-card-arrow", html: "→" }),
        );
        body.appendChild(card);
      });
    }
    setPanel(header, body, h("div", { class: "qw-footer" }, "Desenvolvido por Quota"));
  };

  const renderTopic = (data) => {
    const header = buildHeader(data.topic?.name || "Tópico", null, { back: renderTopics });
    const body = h("div", { class: "qw-body" });

    if (data.topic?.description) {
      body.appendChild(h("div", { class: "qw-panel-card" },
        h("div", { class: "qw-panel-label" }, "Descrição"),
        h("div", { class: "qw-panel-text" }, data.topic.description),
      ));
    }
    if (data.answer?.content) {
  body.appendChild(
    h(
      "div",
      { class: "qw-panel-card" },
      h("div", { class: "qw-panel-label" }, "Resposta"),
      h("div", { class: "qw-panel-text" }, data.answer.content),
    )
  );
}
    body.appendChild(h("div", { class: "qw-footer", style: "border:0;background:transparent;margin-top:8px;" },
      "Em breve este tópico será respondido automaticamente pela IA."));

    setPanel(header, body);
  };
  async function loadPublicWidget(){

  try {

    const res = await fetch(
      `${API_URL}/widget/public/${publicKey}`
    );


    if(!res.ok){
      return;
    }


    const data = await res.json();


    state.widget = {
      ...state.widget,
      ...data
    };


    if(data.logo){

      const img =
        fab.querySelector("img");


      if(img){

        img.src = data.logo;

      }

    }


  } catch(error){

    console.error(
      "[Quota Widget] erro ao carregar identidade",
      error
    );

  }

}
  async function loadWidget() {
  renderLoading();

  try {
    const res = await fetch(`${API_URL}/widget/init/${publicKey}`);
    const data = await res.json();

    if (!data.sessionToken) {
      return renderError("Assistente indisponível");
    }

    state.sessionToken = data.sessionToken;
    state.widget = {
  ...state.widget,
  ...(data.widget || {})
};
    state.topics = data.topics || [];

    renderTopics();

  } catch (e) {
    renderError("Erro ao conectar.");
  }
}

  async function selectTopic(topicId) {
    renderLoading();
    try {
      const res = await fetch(`${API_URL}/widget/chat/select-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: state.sessionToken, topicId }),
      });
      const data = await res.json();
      renderTopic(data);
    } catch {
      renderError("Erro ao carregar tópico.");
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
