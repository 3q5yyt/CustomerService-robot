const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const https = require("node:https");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const DEEPSEEK_KEY_FILE = process.env.DEEPSEEK_API_KEY_FILE || path.join(ROOT_DIR, "..", "API KEY.txt");
let cachedDeepSeekApiKey;

const defaultCompany = {
  name: "数智云智能技术工作室",
  industry: "人工智能",
  tone: "专业简洁",
  serviceHours: "工作日 09:00-18:00，非工作时间自动收集线索",
  contact: "电话：18279169910 / 微信：zh101136 / QQ：481259634",
  welcome: "欢迎咨询数智云智能客服机器人，请问您想了解功能、价格、接入方式，还是预约演示？"
};

const defaultAnswerRules = [
  "不承诺具体价格，涉及价格时引导预约演示或人工确认。",
  "不回答与产品无关的问题，礼貌说明只处理数智云智能客服机器人相关咨询。",
  "优先引导客户预约演示或留下联系方式。",
  "回复不超过 120 字。",
  "不编造客户案例、合同承诺、上线时间或未确认功能。"
].join("\n");

const defaultBotSettings = {
  replyMode: "faq_ai",
  answerRules: defaultAnswerRules
};

const defaultFaqs = [
  {
    id: "faq-product",
    question: "数智云智能客服机器人是什么？",
    answer:
      "数智云智能客服机器人是一套面向中小企业的 AI 客服与销售线索收集系统，支持 FAQ 优先回答、DeepSeek AI 辅助回复、未命中问题沉淀、联系方式收集和网站嵌入，帮助企业降低重复咨询成本并提升获客转化。",
    tags: ["产品", "介绍", "AI客服", "线索收集"]
  },
  {
    id: "faq-integration",
    question: "怎么接入企业官网？",
    answer:
      "官网接入很轻量：企业只需要把后台生成的一段 script 代码复制到官网、落地页或网页模板中，就可以显示在线客服入口。普通官网通常 10-30 分钟可以完成首次接入测试。",
    tags: ["官网", "接入", "部署", "script"]
  },
  {
    id: "faq-platform",
    question: "支持哪些渠道？",
    answer:
      "当前版本优先支持官网、H5 活动页、营销落地页和自建 Web 页面。后续可扩展到公众号、小程序、企微客服、飞书、钉钉、CRM 或企业内部系统。",
    tags: ["渠道", "官网", "H5", "小程序", "企微", "CRM"]
  },
  {
    id: "faq-app-integration",
    question: "可以接入到我的 APP 中吗？",
    answer:
      "可以评估接入。当前版本最适合接入 Web 页面、H5 活动页或 App 内 WebView 页面；如果你的 App 有内嵌 H5 页面，可以先用脚本方式试点。原生 App SDK、账号体系打通和消息推送属于定制接入，建议先预约演示确认方案。",
    tags: ["APP", "移动端", "H5", "WebView", "定制接入"]
  },
  {
    id: "faq-price",
    question: "怎么收费？",
    answer:
      "当前可按试点合作方式沟通报价。建议套餐方向为：基础版包含网站客服组件、FAQ 知识库、AI 回复和线索收集；进阶版增加多渠道接入、会话分析、CRM/企微同步和运营报表。具体价格会根据接入渠道、知识库规模和是否需要定制开发确认。",
    tags: ["价格", "收费", "套餐", "报价"]
  },
  {
    id: "faq-trial",
    question: "可以免费试用吗？",
    answer:
      "可以提供试点体验。建议先用 7-14 天试用验证真实客户咨询效果，包括 FAQ 命中率、AI 回复质量、线索收集数量和销售跟进效率。体验结束后再决定是否正式付费上线。",
    tags: ["试用", "免费", "体验", "试点"]
  },
  {
    id: "faq-ai-control",
    question: "AI 会不会乱回答？",
    answer:
      "系统采用 FAQ 高置信优先、AI 基于知识库回答的策略。AI 不能确定时会提示人工确认，并引导客户留下联系方式。后续还可以配置禁答规则、回答字数、语气和必须转人工的场景，降低乱答风险。",
    tags: ["AI", "风控", "知识库", "转人工"]
  },
  {
    id: "faq-security",
    question: "数据安全吗？",
    answer:
      "本地测试版主要用于功能验证。正式部署时建议启用 HTTPS、数据库权限控制、企业数据隔离、操作日志、备份策略和敏感信息脱敏，避免客户联系方式与聊天内容泄露。",
    tags: ["安全", "隐私", "数据", "权限"]
  },
  {
    id: "faq-leads",
    question: "客户留下的联系方式在哪里查看？",
    answer:
      "客户在聊天中留下手机号、微信或邮箱后，会进入后台的销售线索列表。后台可以看到联系方式、客户需求、意向等级、关注点、提交时间和跟进摘要，后续还可以接入企微、飞书、钉钉、邮箱或 CRM 做实时提醒。",
    tags: ["线索", "联系方式", "后台", "CRM"]
  },
  {
    id: "faq-launch-time",
    question: "上线需要多久？",
    answer:
      "如果企业已经有官网，试点版通常当天就能完成接入：先配置企业资料和 10-30 条常见问题，再复制嵌入代码到网站，最后用真实问题测试并迭代答案。正式商用上线还需要补充登录权限、云数据库、域名和 HTTPS。",
    tags: ["上线", "周期", "实施", "配置"]
  },
  {
    id: "faq-support",
    question: "后续维护和售后怎么做？",
    answer:
      "试点阶段可以按周收集未命中问题，持续优化知识库。正式版可提供基础运维、问题排查、知识库更新建议、数据报表和接入支持；重要客户还可以提供人工配置服务和专属响应渠道。",
    tags: ["售后", "维护", "知识库", "服务"]
  }
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, requestUrl);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method Not Allowed");
      return;
    }

    await serveStatic(req, res, requestUrl);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "服务器内部错误" });
  }
});

server.listen(PORT, () => {
  console.log(`数智云智能客服机器人已启动：http://127.0.0.1:${PORT}`);
});

async function handleApi(req, res, requestUrl) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (req.method === "GET" && segments.length === 2 && segments[1] === "health") {
    sendJson(res, 200, {
      ok: true,
      service: "nimble-customer-service-bot",
      ai: {
        provider: "deepseek",
        model: DEEPSEEK_MODEL,
        configured: Boolean(await getDeepSeekApiKey())
      }
    });
    return;
  }

  if (segments[1] !== "businesses" || !segments[2]) {
    sendJson(res, 404, { error: "API 路径不存在" });
    return;
  }

  const businessId = sanitizeId(segments[2]);
  const resource = segments[3] || "";
  const store = await loadStore();
  const business = ensureBusiness(store, businessId);

    if (req.method === "GET" && !resource) {
    sendJson(res, 200, { business });
    return;
  }

  if (req.method === "GET" && resource === "public") {
    sendJson(res, 200, {
      businessId,
      company: business.company,
      faqs: business.faqs.slice(0, 50),
      settings: {
        replyMode: business.settings.replyMode
      }
    });
    return;
  }

  if (req.method === "POST" && resource === "reset") {
    store.businesses[businessId] = createBusiness(businessId);
    await saveStore(store);
    sendJson(res, 200, { business: store.businesses[businessId] });
    return;
  }

  if (resource === "company") {
    if (req.method === "GET") {
      sendJson(res, 200, { company: business.company });
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      business.company = normalizeCompany(body.company || body);
      if (body.settings) {
        business.settings = normalizeBotSettings(body.settings);
      }
      await saveStore(store);
      sendJson(res, 200, { business });
      return;
    }
  }

  if (resource === "settings") {
    if (req.method === "GET") {
      sendJson(res, 200, { settings: business.settings });
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      business.settings = normalizeBotSettings(body.settings || body);
      business.updatedAt = new Date().toISOString();
      await saveStore(store);
      sendJson(res, 200, { business });
      return;
    }
  }

  if (resource === "faqs") {
    if (req.method === "GET") {
      sendJson(res, 200, { faqs: business.faqs });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const question = String(body.question || "").trim();
      const answer = String(body.answer || "").trim();

      if (!question || !answer) {
        sendJson(res, 400, { error: "问题和答案不能为空" });
        return;
      }

      const faq = {
        id: createId("faq"),
        question,
        answer,
        tags: normalizeTags(body.tags)
      };

      business.faqs.unshift(faq);
      business.updatedAt = new Date().toISOString();
      await saveStore(store);
      sendJson(res, 201, { faq, business });
      return;
    }

    if ((req.method === "PUT" || req.method === "PATCH") && segments[4]) {
      const faqId = segments[4];
      const body = await readJsonBody(req);
      const faq = business.faqs.find((item) => item.id === faqId);

      if (!faq) {
        sendJson(res, 404, { error: "未找到该 FAQ" });
        return;
      }

      const question = String(body.question || "").trim();
      const answer = String(body.answer || "").trim();

      if (!question || !answer) {
        sendJson(res, 400, { error: "问题和答案不能为空" });
        return;
      }

      faq.question = question;
      faq.answer = answer;
      faq.tags = normalizeTags(body.tags);
      business.updatedAt = new Date().toISOString();
      await saveStore(store);
      sendJson(res, 200, { faq, business });
      return;
    }

    if (req.method === "DELETE" && segments[4]) {
      const faqId = segments[4];
      const before = business.faqs.length;
      business.faqs = business.faqs.filter((faq) => faq.id !== faqId);

      if (business.faqs.length === before) {
        sendJson(res, 404, { error: "未找到该 FAQ" });
        return;
      }

      business.updatedAt = new Date().toISOString();
      await saveStore(store);
      sendJson(res, 200, { business });
      return;
    }
  }

  if (resource === "unmatched") {
    if (req.method === "GET") {
      sendJson(res, 200, { unmatchedQuestions: business.unmatchedQuestions || [] });
      return;
    }

    if (req.method === "DELETE" && segments[4]) {
      const questionId = segments[4];
      const before = business.unmatchedQuestions.length;
      business.unmatchedQuestions = business.unmatchedQuestions.filter((item) => item.id !== questionId);

      if (business.unmatchedQuestions.length === before) {
        sendJson(res, 404, { error: "未找到该未命中问题" });
        return;
      }

      business.updatedAt = new Date().toISOString();
      await saveStore(store);
      sendJson(res, 200, { business });
      return;
    }
  }

  if (req.method === "GET" && resource === "leads" && segments[4] === "export") {
    const csv = buildLeadsCsv(business.leads);
    sendCsv(res, 200, csv, `sales-leads-${businessId}-${timestampForFilename()}.csv`);
    return;
  }

  if (req.method === "GET" && resource === "leads") {
    sendJson(res, 200, { leads: business.leads });
    return;
  }

  if (req.method === "GET" && resource === "conversations" && segments[4]) {
    const visitorId = sanitizeVisitorId(segments[4]);
    const conversation = business.conversations && business.conversations[visitorId];

    if (!conversation) {
      sendJson(res, 404, { error: "未找到该会话记录" });
      return;
    }

    sendJson(res, 200, { conversation: normalizeConversationForResponse(conversation) });
    return;
  }

  if (req.method === "GET" && resource === "stats") {
    sendJson(res, 200, { stats: business.stats });
    return;
  }

  if (req.method === "POST" && resource === "chat") {
    const body = await readJsonBody(req);
    const message = String(body.message || "").trim();

    if (!message) {
      sendJson(res, 400, { error: "消息不能为空" });
      return;
    }

    const visitorId = sanitizeVisitorId(body.visitorId) || createId("visitor");
    const conversation = ensureConversation(business, visitorId, body.source);
    business.stats.messages += 1;
    conversation.messages.push(createMessage("user", message));

    const reply = await buildBotReply(business, conversation, message);
    conversation.messages.push(createMessage("bot", reply.text));

    business.updatedAt = new Date().toISOString();
    await saveStore(store);

    sendJson(res, 200, {
      visitorId,
      reply,
      stats: business.stats,
      leads: business.leads.slice(0, 20),
      unmatchedQuestions: business.unmatchedQuestions.slice(0, 20)
    });
    return;
  }

  sendJson(res, 404, { error: "API 路径不存在" });
}

async function serveStatic(req, res, requestUrl) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(pathname);
  const filePath = await findStaticFile(decodedPath);

  if (!filePath) {
    sendText(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".js" || ext === ".css" ? "no-cache" : "no-store"
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

async function findStaticFile(decodedPath) {
  const roots = [DIST_DIR, ROOT_DIR];

  for (const root of roots) {
    const filePath = path.normalize(path.join(root, decodedPath));
    if (!filePath.startsWith(root)) return "";

    try {
      const stat = await fsp.stat(filePath);
      if (stat.isFile()) return filePath;
    } catch (error) {
      // Try the next static root.
    }
  }

  return "";
}

async function loadStore() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fsp.readFile(STORE_FILE, "utf8");
    const store = JSON.parse(raw);

    if (!store.businesses || typeof store.businesses !== "object") {
      return createStore();
    }

    return normalizeStore(store);
  } catch (error) {
    const store = createStore();
    await saveStore(store);
    return store;
  }
}

async function saveStore(store) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${STORE_FILE}.tmp`;
  await fsp.writeFile(tempFile, JSON.stringify(store, null, 2), "utf8");
  await fsp.rename(tempFile, STORE_FILE);
}

function createStore() {
  return {
    schemaVersion: 1,
    businesses: {
      demo: createBusiness("demo")
    }
  };
}

function normalizeStore(store) {
  const next = {
    schemaVersion: 1,
    businesses: {}
  };

  Object.entries(store.businesses).forEach(([id, business]) => {
    next.businesses[sanitizeId(id)] = normalizeBusiness(business, sanitizeId(id));
  });

  if (!next.businesses.demo) {
    next.businesses.demo = createBusiness("demo");
  }

  return next;
}

function ensureBusiness(store, businessId) {
  if (!store.businesses[businessId]) {
    store.businesses[businessId] = createBusiness(businessId);
  }
  return store.businesses[businessId];
}

function createBusiness(id) {
  const now = new Date().toISOString();
  return {
    id,
    company: clone(defaultCompany),
    settings: clone(defaultBotSettings),
    faqs: clone(defaultFaqs),
    leads: [],
    unmatchedQuestions: [],
    conversations: {},
    stats: {
      messages: 0,
      resolved: 0,
      escalated: 0
    },
    createdAt: now,
    updatedAt: now
  };
}

function normalizeBusiness(business, fallbackId) {
  return {
    id: sanitizeId(business.id || fallbackId || "demo"),
    company: normalizeCompany(business.company || {}),
    settings: normalizeBotSettings(business.settings || {}),
    faqs: Array.isArray(business.faqs) ? business.faqs.map(normalizeFaq).filter(Boolean) : clone(defaultFaqs),
    leads: Array.isArray(business.leads) ? business.leads.map(normalizeLead).filter(Boolean) : [],
    unmatchedQuestions: Array.isArray(business.unmatchedQuestions)
      ? business.unmatchedQuestions.map(normalizeUnmatchedQuestion).filter(Boolean)
      : [],
    conversations: business.conversations && typeof business.conversations === "object" ? business.conversations : {},
    stats: {
      messages: Number(business.stats && business.stats.messages) || 0,
      resolved: Number(business.stats && business.stats.resolved) || 0,
      escalated: Number(business.stats && business.stats.escalated) || 0
    },
    createdAt: business.createdAt || new Date().toISOString(),
    updatedAt: business.updatedAt || new Date().toISOString()
  };
}

function normalizeCompany(company) {
  return {
    name: String(company.name || defaultCompany.name).trim(),
    industry: String(company.industry || defaultCompany.industry).trim(),
    tone: String(company.tone || defaultCompany.tone).trim(),
    serviceHours: String(company.serviceHours || defaultCompany.serviceHours).trim(),
    contact: String(company.contact || defaultCompany.contact).trim(),
    welcome: String(company.welcome || defaultCompany.welcome).trim()
  };
}

function normalizeBotSettings(settings) {
  const replyMode = String(settings.replyMode || defaultBotSettings.replyMode);
  const answerRules = String(settings.answerRules || defaultBotSettings.answerRules)
    .trim()
    .slice(0, 1200);
  return {
    replyMode: ["faq_first", "faq_ai", "lead_only"].includes(replyMode) ? replyMode : defaultBotSettings.replyMode,
    answerRules: answerRules || defaultBotSettings.answerRules
  };
}

function normalizeFaq(faq) {
  if (!faq || !faq.question || !faq.answer) return null;
  return {
    id: String(faq.id || createId("faq")),
    question: String(faq.question).trim(),
    answer: String(faq.answer).trim(),
    tags: normalizeTags(faq.tags)
  };
}

function normalizeLead(lead) {
  if (!lead || !lead.contact) return null;
  return {
    id: String(lead.id || createId("lead")),
    contact: String(lead.contact),
    intent: String(lead.intent || "客户请求人工跟进"),
    transcript: String(lead.transcript || ""),
    summary: String(lead.summary || ""),
    intentLevel: normalizeIntentLevel(lead.intentLevel),
    focusAreas: Array.isArray(lead.focusAreas) ? lead.focusAreas.map((item) => String(item)).filter(Boolean) : [],
    status: String(lead.status || "未跟进"),
    source: String(lead.source || "unknown"),
    conversationId: String(lead.conversationId || ""),
    createdAt: String(lead.createdAt || formatTime())
  };
}

function normalizeUnmatchedQuestion(item) {
  if (!item || !item.question) return null;
  return {
    id: String(item.id || createId("miss")),
    question: String(item.question).trim(),
    count: Number(item.count) || 1,
    lastMode: String(item.lastMode || "未命中"),
    source: String(item.source || "unknown"),
    createdAt: String(item.createdAt || formatTime()),
    lastAskedAt: String(item.lastAskedAt || item.createdAt || formatTime())
  };
}

function normalizeConversationForResponse(conversation) {
  return {
    visitorId: String(conversation.visitorId || ""),
    source: String(conversation.source || "unknown"),
    createdAt: String(conversation.createdAt || ""),
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map(normalizeConversationMessage).filter(Boolean).slice(-200)
      : []
  };
}

function normalizeConversationMessage(message) {
  if (!message || !message.text) return null;
  return {
    role: message.role === "user" ? "user" : "bot",
    text: String(message.text),
    createdAt: String(message.createdAt || "")
  };
}

function ensureConversation(business, visitorId, source) {
  if (!business.conversations || typeof business.conversations !== "object") {
    business.conversations = {};
  }

  if (!business.conversations[visitorId]) {
    business.conversations[visitorId] = {
      visitorId,
      source: String(source || "widget"),
      awaitingLead: false,
      intent: "",
      messages: [],
      createdAt: new Date().toISOString()
    };
  }

  return business.conversations[visitorId];
}

async function buildBotReply(business, conversation, input) {
  const normalized = normalize(input);
  const replyMode = business.settings && business.settings.replyMode ? business.settings.replyMode : defaultBotSettings.replyMode;

  if (conversation.awaitingLead) {
    const contact = extractContact(input);
    if (contact) {
      const lead = {
        id: createId("lead"),
        contact,
        intent: conversation.intent || "客户请求人工跟进",
        transcript: input,
        ...buildLeadInsights(conversation.intent || "客户请求人工跟进", contact, conversation),
        source: conversation.source || "widget",
        conversationId: conversation.visitorId,
        createdAt: formatTime()
      };
      business.leads.unshift(lead);
      conversation.awaitingLead = false;
      conversation.intent = "";
      return {
        mode: "已收集线索",
        text: `收到，我已经记录联系方式：${contact}。\n${business.company.contact ? `我们的人工同事会通过 ${business.company.contact} 跟进。` : "人工同事会尽快跟进。"}`
      };
    }

    if (replyMode === "lead_only") {
      return {
        mode: "等待联系方式",
        text: "我先帮你记录需求。请留下手机号、微信、QQ 或邮箱，方便人工同事继续跟进。"
      };
    }

    const pendingMatch = findBestFaq(input, business.faqs);
    if (shouldAnswerWithFaq(pendingMatch, input)) {
      business.stats.resolved += 1;
      return {
        mode: "知识库命中",
        text: `${pendingMatch.faq.answer}\n\n如果你仍希望人工同事跟进，也可以继续留下手机号、微信或邮箱。`
      };
    }

    const pendingAiReply = replyMode === "faq_ai" ? await buildAiReply(business, conversation, input) : null;
    if (pendingAiReply && pendingAiReply.ok) {
      business.stats.resolved += 1;
      recordUnmatchedQuestion(business, input, "AI 回复", conversation.source);
      return {
        mode: "AI 回复",
        text: `${pendingAiReply.text}\n\n如果你仍希望人工同事跟进，也可以继续留下手机号、微信或邮箱。`
      };
    }
    if (pendingAiReply && pendingAiReply.error) {
      return buildAiFallbackReply(business, conversation, input, pendingAiReply.error);
    }

    return {
      mode: "等待联系方式",
      text: "我可以继续帮你转给人工同事。请留下手机号、微信号或邮箱，方便销售顾问跟进。"
    };
  }

  if (isGreeting(normalized)) {
    return {
      mode: "欢迎引导",
      text: `${business.company.welcome}\n\n你也可以直接问我：价格、接入渠道、上线周期、数据安全。`
    };
  }

  if (replyMode === "lead_only") {
    business.stats.escalated += 1;
    conversation.awaitingLead = true;
    conversation.intent = input;
    return {
      mode: "线索收集",
      text: `可以，我先帮你记录需求。\n请留下手机号、微信、QQ 或邮箱，方便人工同事进一步沟通。${business.company.serviceHours ? `\n服务时间：${business.company.serviceHours}` : ""}`
    };
  }

  if (shouldCaptureLeadNow(normalized)) {
    business.stats.escalated += 1;
    conversation.awaitingLead = true;
    conversation.intent = input;
    return {
      mode: "线索收集",
      text:
        `可以，我先帮你登记需求。\n` +
        `为了让销售顾问给你准确报价，请留下手机号、微信或邮箱。${business.company.serviceHours ? `\n服务时间：${business.company.serviceHours}` : ""}`
    };
  }

  const match = findBestFaq(input, business.faqs);
  if (shouldAnswerWithFaq(match, input)) {
    business.stats.resolved += 1;
    return {
      mode: "知识库命中",
      text: `${match.faq.answer}\n\n如果你希望我安排人工进一步沟通，可以回复“转人工”。`
    };
  }

  const aiReply = replyMode === "faq_ai" ? await buildAiReply(business, conversation, input) : null;
  if (aiReply && aiReply.ok) {
    business.stats.resolved += 1;
    recordUnmatchedQuestion(business, input, "AI 回复", conversation.source);
    return {
      mode: "AI 回复",
      text: `${aiReply.text}\n\n如果你希望我安排人工进一步沟通，可以回复“转人工”。`
    };
  }
  if (aiReply && aiReply.error) {
    return buildAiFallbackReply(business, conversation, input, aiReply.error);
  }

  if (shouldCaptureLead(normalized)) {
    business.stats.escalated += 1;
    conversation.awaitingLead = true;
    conversation.intent = input;
    recordUnmatchedQuestion(business, input, "线索收集", conversation.source);
    return {
      mode: "线索收集",
      text: "我可以安排销售顾问进一步沟通。请留下手机号、微信或邮箱，方便人工同事跟进。"
    };
  }

  business.stats.escalated += 1;
  conversation.awaitingLead = true;
  conversation.intent = input;
  recordUnmatchedQuestion(business, input, "兜底转人工", conversation.source);
  return {
    mode: "兜底转人工",
    text:
      "这个问题我还需要人工同事确认，避免给你不准确的信息。\n请留下手机号、微信或邮箱，我会把问题和联系方式一起记录下来。"
  };
}

function buildAiFallbackReply(business, conversation, input, errorType) {
  business.stats.escalated += 1;
  conversation.awaitingLead = true;
  conversation.intent = input;
  recordUnmatchedQuestion(business, input, `AI 服务异常：${errorType}`, conversation.source);

  return {
    mode: "AI 服务暂时繁忙",
    text:
      "当前智能回复服务暂时繁忙，我先帮你把问题转给人工同事，避免耽误沟通。\n" +
      `请留下手机号、微信、QQ 或邮箱，人工同事会尽快跟进。${business.company.contact ? `\n也可以直接联系：${business.company.contact}` : ""}`
  };
}

function buildLeadInsights(intent, contact, conversation) {
  const transcriptText = (conversation.messages || [])
    .map((message) => message.text)
    .join(" ");
  const combined = `${intent} ${transcriptText}`;
  const focusAreas = extractFocusAreas(combined);
  const intentLevel = classifyIntentLevel(combined);
  const focusText = focusAreas.length > 0 ? focusAreas.join("、") : "人工跟进";
  const summary = `客户关注${focusText}；需求：${truncate(intent, 80)}；已留下联系方式 ${contact}。`;

  return {
    summary,
    intentLevel,
    focusAreas,
    status: "未跟进"
  };
}

function buildLeadsCsv(leads) {
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
        if (key === "source") return formatLeadSource(lead.source);
        return lead[key] || "";
      })
    )
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatLeadSource(value) {
  const text = String(value || "");
  if (text === "admin-preview") return "后台预览";
  if (text === "widget") return "网站组件";
  if (text === "local-preview") return "本地预览";
  if (text.startsWith("http")) return "客户网站";
  return text || "未知";
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
  const matches = [];
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

  rules.forEach(([label, words]) => {
    if (words.some((word) => normalizedText.includes(normalize(word)))) {
      matches.push(label);
    }
  });

  return Array.from(new Set(matches)).slice(0, 4);
}

function normalizeIntentLevel(value) {
  return ["高", "中", "低"].includes(value) ? value : "中";
}

function recordUnmatchedQuestion(business, question, mode, source) {
  const text = String(question || "").trim();
  if (!text) return;

  if (!Array.isArray(business.unmatchedQuestions)) {
    business.unmatchedQuestions = [];
  }

  const normalizedQuestion = normalize(text);
  const existing = business.unmatchedQuestions.find((item) => normalize(item.question) === normalizedQuestion);
  const now = formatTime();

  if (existing) {
    existing.count = (Number(existing.count) || 1) + 1;
    existing.lastMode = mode;
    existing.source = String(source || existing.source || "unknown");
    existing.lastAskedAt = now;
  } else {
    business.unmatchedQuestions.unshift({
      id: createId("miss"),
      question: text,
      count: 1,
      lastMode: mode,
      source: String(source || "unknown"),
      createdAt: now,
      lastAskedAt: now
    });
  }

  business.unmatchedQuestions = business.unmatchedQuestions.slice(0, 100);
}

async function buildAiReply(business, conversation, input) {
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) return { ok: false, error: "未配置 API Key" };
  const answerRules = business.settings && business.settings.answerRules
    ? business.settings.answerRules
    : defaultBotSettings.answerRules;

  const faqContext = business.faqs
    .slice(0, 12)
    .map((faq, index) => `${index + 1}. Q: ${faq.question}\nA: ${faq.answer}\nTags: ${(faq.tags || []).join(", ")}`)
    .join("\n\n");

  const recentMessages = (conversation.messages || [])
    .slice(-6)
    .map((message) => `${message.role === "user" ? "客户" : "客服"}：${message.text}`)
    .join("\n");

  const messages = [
    {
      role: "system",
      content:
        `你是${business.company.name}的在线客服，服务产品是“数智云智能客服机器人”。` +
        `请用中文回答，语气${business.company.tone}、可信。只能基于企业资料和知识库回答。` +
        `资料不足时，请说明暂未确认，并引导客户留下联系方式或提出一个澄清问题。\n\n` +
        `客服回答规则：\n${answerRules}`
    },
    {
      role: "user",
      content:
        `企业资料：\n` +
        `企业名称：${business.company.name}\n` +
        `行业：${business.company.industry}\n` +
        `服务时间：${business.company.serviceHours}\n` +
        `人工联系方式：${business.company.contact}\n\n` +
        `知识库：\n${faqContext}\n\n` +
        `最近对话：\n${recentMessages || "无"}\n\n` +
        `客户当前问题：${input}`
    }
  ];

  try {
    const completion = await createDeepSeekChatCompletion({
      model: DEEPSEEK_MODEL,
      messages,
      thinking: {
        type: "enabled",
        reasoning_effort: "high"
      },
      stream: false,
      temperature: 0.2,
      max_tokens: 220
    });

    const text = String(completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content || "")
      .trim()
      .slice(0, 800);
    if (!text) {
      return { ok: false, error: "空响应" };
    }
    return { ok: true, text };
  } catch (error) {
    console.warn(`DeepSeek 调用失败：${error.message}`);
    return { ok: false, error: classifyAiError(error) };
  }
}

async function createDeepSeekChatCompletion(payload) {
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) throw new Error("DeepSeek API Key 未配置");
  if (process.env.DEEPSEEK_FORCE_ERROR === "1") {
    throw new Error("FORCED_DEEPSEEK_ERROR");
  }

  return requestJsonOverHttps(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    timeoutMs: 60000
  });
}

function classifyAiError(error) {
  const message = String(error && error.message ? error.message : error);
  if (message.includes("FORCED_DEEPSEEK_ERROR")) return "本地测试错误";
  if (message.includes("超时") || message.includes("timeout")) return "请求超时";
  if (message.includes("insufficient") || message.includes("quota") || message.includes("balance") || message.includes("余额")) return "余额不足";
  if (message.includes("401") || message.includes("403") || message.includes("API Key")) return "鉴权失败";
  return "接口异常";
}

function requestJsonOverHttps(url, options) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = options.body || "";
    const req = https.request(
      {
        method: options.method || "GET",
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        port: target.port || 443,
        headers: {
          ...options.headers,
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (error) {
            reject(new Error(`DeepSeek 返回了非 JSON 响应，状态码 ${res.statusCode}`));
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            const message = parsed.error && parsed.error.message ? parsed.error.message : `HTTP ${res.statusCode}`;
            reject(new Error(message));
            return;
          }

          resolve(parsed);
        });
      }
    );

    req.setTimeout(options.timeoutMs || 20000, () => {
      req.destroy(new Error("DeepSeek 请求超时"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function getDeepSeekApiKey() {
  const envKey = parseApiKey(process.env.DEEPSEEK_API_KEY || "");
  if (envKey) return envKey;

  if (cachedDeepSeekApiKey !== undefined) {
    return cachedDeepSeekApiKey;
  }

  try {
    const raw = await fsp.readFile(DEEPSEEK_KEY_FILE, "utf8");
    cachedDeepSeekApiKey = parseApiKey(raw);
  } catch (error) {
    cachedDeepSeekApiKey = "";
  }

  return cachedDeepSeekApiKey;
}

function parseApiKey(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  const keyMatch = text.match(/sk-[a-zA-Z0-9_-]+/);
  if (keyMatch) return keyMatch[0];

  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#"));

  if (!line) return "";
  return line.includes("=") ? line.split("=").pop().trim() : line;
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

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[？?。！!，,、]/g, "");
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function sanitizeId(value) {
  return String(value || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "demo";
}

function sanitizeVisitorId(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

function createId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createMessage(role, text) {
  return {
    role,
    text,
    createdAt: new Date().toISOString()
  };
}

function formatTime() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function timestampForFilename() {
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 1024 * 1024) {
      throw new Error("Request body too large");
    }
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendCsv(res, statusCode, csv, filename) {
  setCorsHeaders(res);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.writeHead(statusCode, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`
  });
  res.end(csv);
}
