import { defaultAnswerRules, defaultState, defaultWidgetConfig } from "./defaults.js";

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function normalizeState(value) {
  const parsed = value || {};
  const company = parsed.company || {};
  return {
    ...clone(defaultState),
    ...parsed,
    publicToken: String(parsed.publicToken || defaultState.publicToken || ""),
    allowedOrigins: Array.isArray(parsed.allowedOrigins) ? parsed.allowedOrigins : [],
    company: {
      ...defaultState.company,
      ...company,
      widget: normalizeWidgetConfig(company.widget, {
        name: company.name || defaultState.company.name,
        welcome: company.welcome || defaultState.company.welcome
      })
    },
    settings: {
      ...defaultState.settings,
      ...(parsed.settings || {}),
      answerRules: parsed.settings && parsed.settings.answerRules ? parsed.settings.answerRules : defaultAnswerRules
    },
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs : clone(defaultState.faqs),
    leads: Array.isArray(parsed.leads) ? parsed.leads : [],
    unmatchedQuestions: Array.isArray(parsed.unmatchedQuestions) ? parsed.unmatchedQuestions : [],
    stats: { ...defaultState.stats, ...(parsed.stats || {}) }
  };
}

export function normalizeWidgetConfig(widget, fallback = {}) {
  const parsed = widget && typeof widget === "object" ? widget : {};
  const name = String(parsed.name || parsed.title || fallback.name || defaultWidgetConfig.name)
    .trim()
    .slice(0, 40);
  const welcome = String(parsed.welcome || fallback.welcome || defaultWidgetConfig.welcome)
    .trim()
    .slice(0, 220);
  const hasQuickQuestions =
    Object.prototype.hasOwnProperty.call(parsed, "quickQuestions") ||
    Object.prototype.hasOwnProperty.call(parsed, "quickReplies") ||
    Object.prototype.hasOwnProperty.call(parsed, "questions");
  const quickQuestions = normalizeWidgetQuickQuestions(parsed.quickQuestions || parsed.quickReplies || parsed.questions);

  return {
    name: name || defaultWidgetConfig.name,
    themeColor: normalizeThemeColor(parsed.themeColor || parsed.accent || parsed.color),
    position: normalizeWidgetPosition(parsed.position),
    welcome: welcome || defaultWidgetConfig.welcome,
    quickQuestions: hasQuickQuestions ? quickQuestions : clone(defaultWidgetConfig.quickQuestions)
  };
}

function normalizeThemeColor(value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return `#${text.slice(1).split("").map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }
  return defaultWidgetConfig.themeColor;
}

function normalizeWidgetPosition(value) {
  const text = String(value || "").trim();
  if (["bottom-right", "bottom-left"].includes(text)) return text;
  if (text === "right") return "bottom-right";
  if (text === "left") return "bottom-left";
  return defaultWidgetConfig.position;
}

function normalizeWidgetQuickQuestions(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[\n|,，、]+/);

  return list
    .map((item) => String(item || "").trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 6);
}

export function resolveApiBase() {
  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin;
  }
  return "http://127.0.0.1:4173";
}

export function getPublicBase(apiBase) {
  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin;
  }
  return apiBase;
}

export function getOrCreateVisitorId(key) {
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

export function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function seedMessages(company) {
  return [
    { id: createId(), role: "bot", text: company.welcome },
    {
      id: createId(),
      role: "system",
      text: "演示提示：你可以问“数智云智能客服机器人是什么”“怎么接入企业官网”“怎么收费”，或输入“我要预约演示”触发线索收集。"
    }
  ];
}

export function requestJson(apiBase, path, options = {}) {
  return fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  }).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      let message = errorText || `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        message = parsed.error || message;
      } catch (error) {
        // Keep the raw response text.
      }
      const requestError = new Error(message);
      requestError.status = response.status;
      throw requestError;
    }
    return response.json();
  });
}

export function splitTags(value) {
  return String(value || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function getReplyModeLabel(mode) {
  if (mode === "faq_first") return "FAQ 优先";
  if (mode === "lead_only") return "仅收集线索";
  return "FAQ + AI";
}

export function normalizeReplySource(mode) {
  if (mode === "知识库命中") return "FAQ";
  if (mode === "AI 回复") return "AI";
  if (["线索收集", "等待联系方式", "已收集线索", "兜底转人工", "AI 服务暂时繁忙"].includes(mode)) {
    return "转人工";
  }
  if (mode === "欢迎引导") return "欢迎引导";
  return mode || "未知";
}

export function formatSource(value) {
  const text = String(value || "");
  if (text === "admin-preview") return "后台预览";
  if (text === "portal-preview") return "企业工作台预览";
  if (text === "widget") return "网站组件";
  if (text === "local-preview") return "本地预览";
  if (text.startsWith("http")) return "客户网站";
  return text || "未知";
}

export function buildLeadsCsv(leads) {
  const columns = [
    ["createdAt", "创建时间"],
    ["contact", "联系方式"],
    ["intentLevel", "意向等级"],
    ["intent", "客户需求"],
    ["summary", "跟进摘要"],
    ["focusAreas", "关注点"],
    ["status", "状态"],
    ["source", "来源"],
    ["conversationId", "会话ID"],
    ["transcript", "原始留言"]
  ];

  const rows = [
    columns.map(([, label]) => label),
    ...leads.map((lead) =>
      columns.map(([key]) => {
        if (key === "focusAreas") return (lead.focusAreas || []).join("、");
        if (key === "source") return formatSource(lead.source);
        return lead[key] || "";
      })
    )
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}

export function getDownloadFilename(disposition) {
  const text = String(disposition || "");
  const encodedMatch = text.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = text.match(/filename="?([^";]+)"?/i);
  const filename = encodedMatch ? encodedMatch[1] : plainMatch && plainMatch[1];
  if (!filename) return "";

  try {
    return decodeURIComponent(filename);
  } catch (error) {
    return filename;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function timestampForFilename() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

export function calculateResolveRate(stats) {
  const totalHandled = (Number(stats.resolved) || 0) + (Number(stats.escalated) || 0);
  return totalHandled === 0 ? 0 : Math.round(((Number(stats.resolved) || 0) / totalHandled) * 100);
}

export function buildLocalBotReply(input, currentState, leadCapture) {
  const nextState = clone(currentState);
  let nextLeadCapture = { ...leadCapture };
  const normalized = normalize(input);
  const replyMode = nextState.settings && nextState.settings.replyMode ? nextState.settings.replyMode : "faq_ai";

  if (nextLeadCapture.awaiting) {
    const contact = extractContact(input);
    if (contact) {
      nextState.leads.unshift({
        id: createId(),
        contact,
        intent: nextLeadCapture.intent || "客户请求人工跟进",
        transcript: input,
        ...buildLocalLeadInsights(nextLeadCapture.intent || "客户请求人工跟进", contact),
        source: "local-preview",
        createdAt: formatTime()
      });
      nextLeadCapture = { awaiting: false, intent: "" };
      return {
        nextState,
        nextLeadCapture,
        reply: {
          mode: "已收集线索",
          text: `收到，我已经记录联系方式：${contact}。\n${nextState.company.contact ? `我们的人工同事会通过 ${nextState.company.contact} 跟进。` : "人工同事会尽快跟进。"}`
        }
      };
    }

    return {
      nextState,
      nextLeadCapture,
      reply: {
        mode: "等待联系方式",
        text:
          replyMode === "lead_only"
            ? "我先帮你记录需求。请留下手机号、微信、QQ 或邮箱，方便人工同事继续跟进。"
            : "我可以继续帮你转给人工同事。请留下手机号、微信号或邮箱，方便销售顾问跟进。"
      }
    };
  }

  if (isGreeting(normalized)) {
    return {
      nextState,
      nextLeadCapture,
      reply: {
        mode: "欢迎引导",
        text: `${nextState.company.welcome}\n\n你也可以直接问我：价格、接入渠道、上线周期、数据安全。`
      }
    };
  }

  if (replyMode === "lead_only") {
    nextState.stats.escalated += 1;
    nextLeadCapture = { awaiting: true, intent: input };
    return {
      nextState,
      nextLeadCapture,
      reply: {
        mode: "线索收集",
        text:
          `可以，我先帮你记录需求。\n` +
          `请留下手机号、微信、QQ 或邮箱，方便人工同事进一步沟通。${nextState.company.serviceHours ? `\n服务时间：${nextState.company.serviceHours}` : ""}`
      }
    };
  }

  if (shouldCaptureLeadNow(normalized)) {
    nextState.stats.escalated += 1;
    nextLeadCapture = { awaiting: true, intent: input };
    return {
      nextState,
      nextLeadCapture,
      reply: {
        mode: "线索收集",
        text:
          `可以，我先帮你登记需求。\n` +
          `为了让销售顾问给你准确报价，请留下手机号、微信或邮箱。${nextState.company.serviceHours ? `\n服务时间：${nextState.company.serviceHours}` : ""}`
      }
    };
  }

  const match = findBestFaq(input, nextState.faqs);
  if (shouldAnswerWithFaq(match, input)) {
    nextState.stats.resolved += 1;
    return {
      nextState,
      nextLeadCapture,
      reply: {
        mode: "知识库命中",
        text: `${match.faq.answer}\n\n如果你希望我安排人工进一步沟通，可以回复“转人工”。`
      }
    };
  }

  if (shouldCaptureLead(normalized)) {
    nextState.stats.escalated += 1;
    nextLeadCapture = { awaiting: true, intent: input };
    return {
      nextState,
      nextLeadCapture,
      reply: {
        mode: "线索收集",
        text: "我可以安排销售顾问进一步沟通。请留下手机号、微信或邮箱，方便人工同事跟进。"
      }
    };
  }

  nextState.stats.escalated += 1;
  nextLeadCapture = { awaiting: true, intent: input };
  recordLocalUnmatched(nextState, input, "兜底转人工");
  return {
    nextState,
    nextLeadCapture,
    reply: {
      mode: "兜底转人工",
      text:
        "这个问题我还需要人工同事确认，避免给你不准确的信息。\n请留下手机号、微信或邮箱，我会把问题和联系方式一起记录下来。"
    }
  };
}

function buildLocalLeadInsights(intent, contact) {
  const focusAreas = extractFocusAreas(intent);
  const intentLevel = classifyIntentLevel(intent);
  const focusText = focusAreas.length > 0 ? focusAreas.join("、") : "人工跟进";

  return {
    summary: `客户关注${focusText}；需求：${truncate(intent, 80)}；已留下联系方式 ${contact}。`,
    intentLevel,
    focusAreas,
    status: "未跟进"
  };
}

function recordLocalUnmatched(state, question, mode) {
  const text = String(question || "").trim();
  if (!text) return;
  const existing = state.unmatchedQuestions.find((item) => normalize(item.question) === normalize(text));
  const now = formatTime();

  if (existing) {
    existing.count = (Number(existing.count) || 1) + 1;
    existing.lastMode = mode;
    existing.lastAskedAt = now;
  } else {
    state.unmatchedQuestions.unshift({
      id: createId(),
      question: text,
      count: 1,
      lastMode: mode,
      source: "local-preview",
      createdAt: now,
      lastAskedAt: now
    });
  }
}

function findBestFaq(query, faqs) {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(normalizedQuery);

  return faqs
    .map((faq) => {
      const haystack = normalize([faq.question, faq.answer, ...(faq.tags || [])].join(" "));
      let score = 0;

      if (haystack.includes(normalizedQuery)) score += 8;
      if (normalizedQuery.includes(normalize(faq.question))) score += 8;

      queryTokens.forEach((token) => {
        if (haystack.includes(token)) {
          score += token.length >= 3 ? 2 : 1;
        }
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
  const nearSameQuestion =
    lengthGap <= 4 && (normalizedQuery.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedQuery));
  if (nearSameQuestion) return true;

  const queryTokens = tokenize(normalizedQuery).filter(isStrongToken);
  const questionTokens = tokenize(normalizedQuestion).filter(isStrongToken);
  if (queryTokens.length === 0 || questionTokens.length === 0) return false;

  const overlapCount = questionTokens.filter((token) => normalizedQuery.includes(token)).length;
  const overlapRatio = overlapCount / questionTokens.length;

  return (
    normalizedQuery.length <= normalizedQuestion.length + 4 &&
    match.score >= 10 &&
    overlapCount >= Math.min(3, questionTokens.length) &&
    overlapRatio >= 0.7
  );
}

function isStrongToken(token) {
  return token.length >= 2 && !["可以", "我的", "你们", "我们", "请问", "一下", "什么", "方式"].includes(token);
}

function tokenize(text) {
  const tokens = new Set();
  const latin = text.match(/[a-z0-9]+/g) || [];
  latin.forEach((item) => tokens.add(item));

  const cjkGroups = text.match(/[\u4e00-\u9fa5]+/g) || [];
  cjkGroups.forEach((group) => {
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

  return Array.from(tokens).filter((token) => !["请问", "一下", "可以", "你们", "我们"].includes(token));
}

function shouldCaptureLead(text) {
  return hasAny(text, [
    "报价",
    "价格",
    "收费",
    "多少钱",
    "购买",
    "试用",
    "演示",
    "demo",
    "合作",
    "咨询",
    "人工",
    "转人工",
    "电话",
    "联系",
    "销售",
    "方案"
  ]);
}

function shouldCaptureLeadNow(text) {
  return hasAny(text, [
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
    "销售联系",
    "电话联系"
  ]);
}

function isGreeting(text) {
  return ["你好", "您好", "在吗", "hello", "hi"].some((word) => text === word || text.includes(word));
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
  if (!hasChinese && !asksQuestion && /^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/.test(raw)) {
    return raw;
  }

  return "";
}

function classifyIntentLevel(text) {
  const normalizedText = normalize(text);
  if (hasAny(normalizedText, ["我要报价", "预约", "购买", "马上", "今天", "联系销售", "电话联系", "演示", "demo", "试用"])) {
    return "高";
  }
  if (hasAny(normalizedText, ["价格", "收费", "接入", "上线", "功能", "安全", "方案", "合作"])) {
    return "中";
  }
  return "低";
}

function extractFocusAreas(text) {
  const normalizedText = normalize(text);
  const rules = [
    ["价格", ["价格", "收费", "报价", "套餐", "多少钱"]],
    ["接入", ["接入", "网站", "官网", "部署", "script", "代码"]],
    ["试用", ["试用", "体验", "demo", "演示"]],
    ["数据安全", ["安全", "隐私", "数据", "权限"]],
    ["样式定制", ["样式", "定制", "主题色", "品牌", "logo"]],
    ["线索收集", ["线索", "联系方式", "手机号", "微信", "邮箱"]],
    ["平台支持", ["平台", "h5", "小程序", "企微", "crm"]],
    ["售后维护", ["售后", "维护", "更新", "报表"]]
  ];

  return rules
    .filter(([, words]) => words.some((word) => normalizedText.includes(normalize(word))))
    .map(([label]) => label)
    .slice(0, 4);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatTime() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function truncate(text, maxLength) {
  const value = String(text || "");
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[？?。！!，,、]/g, "");
}
