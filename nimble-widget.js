(function () {
  const defaultQuickQuestions = ["数智云智能客服机器人是什么？", "怎么接入企业官网？", "怎么收费？", "我要预约演示"];
  const script = document.currentScript;
  const config = readConfig(script);
  let faqs = readFaqs(script);
  let open = false;
  let awaitingLead = false;
  let currentIntent = "";
  const visitorId = getOrCreateVisitorId(`nimble-widget-visitor-${config.businessId}`);

  injectStyles();

  const root = document.createElement("div");
  root.className = "nw-root";
  root.innerHTML = [
    '<button class="nw-launcher" type="button" aria-label="打开客服">客服</button>',
    '<section class="nw-panel" aria-label="在线客服">',
    '  <header class="nw-header">',
    "    <strong></strong>",
    '    <button class="nw-close" type="button" aria-label="关闭">×</button>',
    "  </header>",
    '  <div class="nw-messages"></div>',
    '  <div class="nw-quick"></div>',
    '  <form class="nw-form">',
    '    <input type="text" autocomplete="off" placeholder="请输入你的问题">',
    '    <button type="submit">发送</button>',
    "  </form>",
    "</section>"
  ].join("");

  document.body.append(root);

  const launcher = root.querySelector(".nw-launcher");
  const panel = root.querySelector(".nw-panel");
  const close = root.querySelector(".nw-close");
  const title = root.querySelector(".nw-header strong");
  const messages = root.querySelector(".nw-messages");
  const quick = root.querySelector(".nw-quick");
  const form = root.querySelector(".nw-form");
  const input = root.querySelector("input");

  applyWidgetConfig();
  boot();

  launcher.addEventListener("click", () => setOpen(!open));
  close.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMessage("user", text);
    input.disabled = true;
    form.querySelector("button").disabled = true;
    const pendingMessage = addMessage("bot", "正在整理回复，请稍候...");
    pendingMessage.classList.add("nw-loading");
    const reply = await getReply(text);
    window.setTimeout(() => {
      updateMessage(pendingMessage, reply);
      input.disabled = false;
      form.querySelector("button").disabled = false;
      input.focus();
    }, 120);
  });

  async function boot() {
    await loadRemoteConfig();
    applyWidgetConfig();
    addMessage("bot", config.welcome);
    renderQuickReplies();
  }

  async function loadRemoteConfig() {
    if (!config.apiBase) return;

    try {
      const remote = await requestJson(`/api/widget/businesses/${encodeURIComponent(config.businessId)}/public`);
      const remoteCompany = remote.company || {};
      const remoteWidget = remoteCompany.widget || {};
      config.company = remoteWidget.name || remoteCompany.name || config.company;
      config.industry = remoteCompany.industry || config.industry;
      config.contact = remoteCompany.contact || config.contact;
      config.welcome = remoteWidget.welcome || remoteCompany.welcome || config.welcome;
      config.accent = normalizeThemeColor(remoteWidget.themeColor || remoteWidget.accent || remoteWidget.color || config.accent);
      config.position = normalizePosition(remoteWidget.position || config.position);
      config.quickQuestions = normalizeQuickQuestions(remoteWidget.quickQuestions, config.quickQuestions);
      config.replyMode = normalizeReplyMode(remote.settings && remote.settings.replyMode ? remote.settings.replyMode : config.replyMode);
      faqs = Array.isArray(remote.faqs) && remote.faqs.length > 0 ? remote.faqs : faqs;
    } catch (error) {
      // Keep the script-configured fallback so the widget can still answer basic questions.
    }
  }

  function applyWidgetConfig() {
    root.style.setProperty("--nw-accent", config.accent);
    root.classList.remove("nw-position-bottom-right", "nw-position-bottom-left");
    root.classList.add(`nw-position-${config.position}`);
    title.textContent = config.company;
  }

  function setOpen(nextOpen) {
    open = nextOpen;
    panel.classList.toggle("is-open", open);
    if (open) input.focus();
  }

  function renderQuickReplies() {
    quick.innerHTML = "";
    const questions = normalizeQuickQuestions(config.quickQuestions, []);
    quick.hidden = questions.length === 0;
    questions.forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        input.value = label;
        input.focus();
      });
      quick.append(button);
    });
  }

  function addMessage(role, text) {
    const node = document.createElement("div");
    node.className = `nw-message nw-${role}`;
    node.textContent = text;
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function updateMessage(node, text) {
    node.classList.remove("nw-loading");
    node.textContent = text;
    messages.scrollTop = messages.scrollHeight;
  }

  async function getReply(text) {
    if (config.apiBase) {
      try {
        const response = await requestJson(`/api/widget/businesses/${encodeURIComponent(config.businessId)}/chat`, {
          method: "POST",
          body: JSON.stringify({
            message: text,
            visitorId,
            source: window.location.href
          })
        });
        return response.reply.text;
      } catch (error) {
        return replyLocally(text);
      }
    }

    return replyLocally(text);
  }

  function replyLocally(text) {
    const normalized = normalize(text);

    if (awaitingLead) {
      const contact = extractContact(text);
      if (contact) {
        awaitingLead = false;
        return `收到联系方式：${contact}。\n我们会尽快跟进。${config.contact ? `也可以直接联系：${config.contact}` : ""}`;
      }
      if (config.replyMode === "lead_only") {
        return "我先帮你记录需求。请留下手机号、微信、QQ 或邮箱，方便人工同事继续跟进。";
      }
      return "请留下手机号、微信号或邮箱，我会转给人工同事。";
    }

    if (config.replyMode === "lead_only") {
      awaitingLead = true;
      currentIntent = text;
      return `可以，我先记录你的需求：${currentIntent}\n请留下手机号、微信、QQ 或邮箱，方便人工同事跟进。`;
    }

    if (shouldCaptureLeadNow(normalized)) {
      awaitingLead = true;
      currentIntent = text;
      return `可以，我先记录你的需求：${currentIntent}\n请留下手机号、微信或邮箱，方便人工同事跟进。`;
    }

    const match = findBestFaq(text);
    if (shouldAnswerWithFaq(match, text)) {
      return `${match.faq.answer}\n\n需要人工协助的话，可以回复“转人工”。`;
    }

    if (shouldCaptureLead(normalized)) {
      awaitingLead = true;
      currentIntent = text;
      return "我可以安排人工同事进一步沟通。请留下手机号、微信或邮箱。";
    }

    awaitingLead = true;
    currentIntent = text;
    return "这个问题我需要人工同事确认。请留下联系方式，我会把问题一起转过去。";
  }

  function findBestFaq(query) {
    const normalizedQuery = normalize(query);
    const queryTokens = tokenize(normalizedQuery);

    return faqs
      .map((faq) => {
        const haystack = normalize([faq.question, faq.answer, ...(faq.tags || [])].join(" "));
        let score = 0;
        if (haystack.includes(normalizedQuery)) score += 8;
        if (normalizedQuery.includes(normalize(faq.question))) score += 8;
        queryTokens.forEach((token) => {
          if (haystack.includes(token)) score += token.length >= 3 ? 2 : 1;
        });
        return { faq, score };
      })
      .sort((a, b) => b.score - a.score)[0];
  }

  function shouldAnswerWithFaq(match, query) {
    if (!match || !match.faq || match.score < 4) return false;

    const normalizedQuery = normalize(query);
    const normalizedQuestion = normalize(match.faq.question);
    if (!normalizedQuery || !normalizedQuestion) return false;

    if (normalizedQuery === normalizedQuestion) return true;

    const lengthGap = Math.abs(normalizedQuery.length - normalizedQuestion.length);
    const nearSameQuestion = lengthGap <= 4 &&
      (normalizedQuery.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedQuery));
    if (nearSameQuestion) return true;

    const queryTokens = tokenize(normalizedQuery).filter(isStrongToken);
    const questionTokens = tokenize(normalizedQuestion).filter(isStrongToken);
    if (queryTokens.length === 0 || questionTokens.length === 0) return false;

    const overlapCount = questionTokens.filter((token) => normalizedQuery.includes(token)).length;
    const overlapRatio = overlapCount / questionTokens.length;

    return normalizedQuery.length <= normalizedQuestion.length + 4 &&
      match.score >= 10 &&
      overlapCount >= Math.min(3, questionTokens.length) &&
      overlapRatio >= 0.7;
  }

  function isStrongToken(token) {
    return token.length >= 2 && !["可以", "我的", "你们", "我们", "请问", "一下", "什么", "方式"].includes(token);
  }

  function readConfig(currentScript) {
    const dataset = currentScript ? currentScript.dataset : {};
    const hasQuickQuestions = Object.prototype.hasOwnProperty.call(dataset, "quickQuestions");
    const quickQuestions = hasQuickQuestions
      ? dataset.quickQuestions
      : dataset.quickReplies;
    return {
      businessId: dataset.businessId || "demo",
      apiBase: normalizeBaseUrl(dataset.apiBase || inferApiBase(currentScript)),
      publicToken: dataset.publicToken || "",
      company: dataset.widgetName || dataset.company || "在线客服",
      industry: dataset.industry || "通用服务",
      contact: dataset.contact || "",
      welcome: dataset.welcome || "你好，我是智能客服。请问有什么可以帮你？",
      replyMode: normalizeReplyMode(dataset.replyMode || "faq_ai"),
      accent: normalizeThemeColor(dataset.themeColor || dataset.color || "#0f8f7e"),
      position: normalizePosition(dataset.position || "bottom-right"),
      quickQuestions: normalizeQuickQuestions(hasQuickQuestions && !String(quickQuestions || "").trim() ? [] : quickQuestions, defaultQuickQuestions)
    };
  }

  function readFaqs(currentScript) {
    const fallback = [
      {
        question: "怎么收费？",
        answer: "请留下联系方式，我们会根据你的业务规模给出报价。",
        tags: ["价格", "报价", "收费"]
      }
    ];
    if (!currentScript || !currentScript.dataset.faq) return fallback;
    try {
      const parsed = JSON.parse(currentScript.dataset.faq);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function shouldCaptureLead(text) {
    return [
      "报价",
      "价格",
      "收费",
      "多少钱",
      "购买",
      "试用",
      "演示",
      "demo",
      "合作",
      "人工",
      "转人工",
      "联系",
      "电话"
    ].some((word) => text.includes(word));
  }

  function shouldCaptureLeadNow(text) {
    return [
      "我要报价",
      "发报价",
      "预约",
      "演示",
      "demo",
      "购买",
      "合作",
      "人工",
      "转人工",
      "联系销售",
      "电话联系"
    ].some((word) => text.includes(word));
  }

  function extractContact(text) {
    const raw = String(text || "").trim();
    const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) return email[0];
    const phone = raw.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/);
    if (phone) return phone[0];
    const wechat = raw.match(/(?:微信|vx|wechat|微|v)[:：\s]*([a-zA-Z][-_a-zA-Z0-9]{5,19})\b/i);
    if (wechat) return wechat[1];
    const hasChinese = /[\u4e00-\u9fa5]/.test(raw);
    const asksQuestion = /[?？]/.test(raw) || /(吗|呢|什么|怎么|如何|能不能|可以|是否)/.test(raw);
    if (!hasChinese && !asksQuestion && /^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/.test(raw)) return raw;
    return "";
  }

  function tokenize(text) {
    const tokens = new Set();
    (text.match(/[a-z0-9]+/g) || []).forEach((item) => tokens.add(item));
    (text.match(/[\u4e00-\u9fa5]+/g) || []).forEach((group) => {
      if (group.length <= 2) {
        tokens.add(group);
        return;
      }
      for (let size = 2; size <= 4; size += 1) {
        for (let index = 0; index <= group.length - size; index += 1) {
          tokens.add(group.slice(index, index + size));
        }
      }
    });
    return Array.from(tokens);
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[？?。！!，,、]/g, "");
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(`${config.apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(config.publicToken ? { "X-Widget-Token": config.publicToken } : {}),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function inferApiBase(currentScript) {
    if (!currentScript || !currentScript.src) return "";
    try {
      const url = new URL(currentScript.src, window.location.href);
      return url.origin === "null" ? "" : url.origin;
    } catch (error) {
      return "";
    }
  }

  function normalizeBaseUrl(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function normalizeThemeColor(value) {
    const text = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
      return `#${text.slice(1).split("").map((char) => `${char}${char}`).join("")}`.toLowerCase();
    }
    return "#0f8f7e";
  }

  function normalizePosition(value) {
    const text = String(value || "").trim();
    if (["bottom-right", "bottom-left"].includes(text)) return text;
    if (text === "right") return "bottom-right";
    if (text === "left") return "bottom-left";
    return "bottom-right";
  }

  function normalizeQuickQuestions(value, fallback = defaultQuickQuestions) {
    const hasExplicitValue = Array.isArray(value) || (value !== undefined && value !== null && String(value).trim() !== "");
    const source = Array.isArray(value)
      ? value
      : String(value || "")
        .split(/[\n|,，、]+/);
    const questions = source
      .map((item) => String(item || "").trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 6);

    if (questions.length > 0) return questions;
    return hasExplicitValue ? [] : fallback.slice(0, 6);
  }

  function normalizeReplyMode(value) {
    return ["faq_first", "faq_ai", "lead_only"].includes(value) ? value : "faq_ai";
  }

  function getOrCreateVisitorId(key) {
    try {
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const next = createId();
      window.localStorage.setItem(key, next);
      return next;
    } catch (error) {
      return createId();
    }
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .nw-root { --nw-accent: #0f8f7e; position: fixed; z-index: 2147483000; display: flex; flex-direction: column; align-items: flex-end; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; color: #15231f; }
      .nw-position-bottom-right { right: 20px; bottom: 20px; }
      .nw-position-bottom-left { left: 20px; bottom: 20px; align-items: flex-start; }
      .nw-launcher { width: 62px; height: 62px; border: 0; border-radius: 50%; background: var(--nw-accent); color: #fff; font-weight: 800; box-shadow: 0 14px 34px rgba(24, 62, 53, .22); cursor: pointer; }
      .nw-panel { display: none; width: min(360px, calc(100vw - 32px)); height: min(560px, calc(100vh - 110px)); margin-bottom: 12px; border: 1px solid #dce8e3; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 18px 48px rgba(24, 62, 53, .18); }
      .nw-panel.is-open { display: grid; grid-template-rows: auto 1fr auto auto; }
      .nw-header { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; background: #f6fbf9; border-bottom: 1px solid #dce8e3; }
      .nw-close { border: 0; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: #64736d; }
      .nw-messages { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding: 14px; }
      .nw-message { max-width: 86%; border-radius: 8px; padding: 9px 11px; line-height: 1.55; white-space: pre-wrap; font-size: 14px; }
      .nw-loading { color: #64736d; }
      .nw-loading::after { content: ""; display: inline-block; width: 1.2em; text-align: left; animation: nw-dots 1.2s steps(4, end) infinite; }
      .nw-bot { align-self: flex-start; background: #ddf6f1; }
      .nw-user { align-self: flex-end; background: var(--nw-accent); color: #fff; }
      .nw-quick { display: flex; flex-wrap: wrap; gap: 7px; padding: 10px 12px; border-top: 1px solid #dce8e3; }
      .nw-quick[hidden] { display: none; }
      .nw-quick button { border: 1px solid #dce8e3; border-radius: 999px; padding: 6px 9px; background: #fff; color: var(--nw-accent); font-weight: 700; cursor: pointer; }
      .nw-form { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; border-top: 1px solid #dce8e3; }
      .nw-form input { min-width: 0; border: 1px solid #dce8e3; border-radius: 8px; padding: 0 10px; min-height: 38px; outline: none; }
      .nw-form button { border: 0; border-radius: 8px; padding: 0 12px; background: var(--nw-accent); color: #fff; font-weight: 800; cursor: pointer; }
      .nw-form input:disabled, .nw-form button:disabled { opacity: .62; cursor: wait; }
      @keyframes nw-dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75%, 100% { content: "..."; } }
      @media (max-width: 520px) { .nw-position-bottom-right { right: 12px; bottom: 12px; } .nw-position-bottom-left { left: 12px; bottom: 12px; } .nw-panel { width: calc(100vw - 24px); } }
    `;
    document.head.append(style);
  }
})();
