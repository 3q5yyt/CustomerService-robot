import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  ChartPie,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  FileQuestion,
  Gauge,
  Globe2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  UserCheck,
  Wand2,
  X
} from "lucide-react";
import { DEFAULT_BUSINESS_ID, STORE_KEY, defaultState } from "./defaults.js";
import {
  buildLeadsCsv,
  buildLocalBotReply,
  calculateResolveRate,
  clone,
  cn,
  createId,
  downloadBlob,
  formatSource,
  getDownloadFilename,
  getOrCreateVisitorId,
  getPublicBase,
  getReplyModeLabel,
  normalizeReplySource,
  normalizeState,
  requestJson,
  resolveApiBase,
  seedMessages,
  splitTags,
  timestampForFilename
} from "./utils.js";

const API_BASE = resolveApiBase();
const BUSINESS_ID = new URLSearchParams(window.location.search).get("businessId") || DEFAULT_BUSINESS_ID;
const businessPath = `/api/businesses/${encodeURIComponent(BUSINESS_ID)}`;

const industries = ["通用服务", "互联网", "人工智能", "电商零售", "教育培训", "本地生活", "企业服务", "医疗健康"];
const tones = ["专业简洁", "热情亲和", "稳重可信"];
const replyModes = [
  { value: "faq_ai", label: "FAQ + AI", hint: "FAQ 精准命中时直接答，否则交给模型" },
  { value: "faq_first", label: "FAQ 优先", hint: "更保守，FAQ 未命中时引导人工" },
  { value: "lead_only", label: "仅收集线索", hint: "不自动回答复杂问题，优先留资" }
];
const quickReplies = ["数智云智能客服机器人是什么？", "怎么接入企业官网？", "怎么收费？", "我要预约演示"];

export default function App() {
  const [state, setState] = useState(() => clone(defaultState));
  const [apiOnline, setApiOnline] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在连接 API...");
  const [aiStatus, setAiStatus] = useState({
    configured: false,
    model: "-",
    provider: "DeepSeek",
    lastReplySource: "尚未对话"
  });
  const [botMode, setBotMode] = useState("智能问答");
  const [messages, setMessages] = useState(() => seedMessages(defaultState.company));
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [leadCapture, setLeadCapture] = useState({ awaiting: false, intent: "" });
  const [faqDraft, setFaqDraft] = useState({ question: "", tags: "", answer: "" });
  const [editingFaqId, setEditingFaqId] = useState("");
  const [editDraft, setEditDraft] = useState({ question: "", tags: "", answer: "" });
  const [leadDetail, setLeadDetail] = useState({
    lead: null,
    conversation: null,
    loading: false,
    error: ""
  });

  const initializedRef = useRef(false);
  const apiOnlineRef = useRef(false);
  const saveTimerRef = useRef(0);
  const visitorIdRef = useRef(getOrCreateVisitorId("nimble-admin-preview-visitor"));
  const chatScrollRef = useRef(null);

  const resolveRate = useMemo(() => calculateResolveRate(state.stats), [state.stats]);
  const publicBase = getPublicBase(API_BASE);
  const embedCode = `<script src="${publicBase}/nimble-widget.js"
  data-business-id="${BUSINESS_ID}"
  data-api-base="${publicBase}"
  data-reply-mode="${state.settings.replyMode}"></script>`;
  const dashboard = useMemo(() => {
    const messagesCount = Number(state.stats.messages) || 0;
    const resolvedCount = Number(state.stats.resolved) || 0;
    const escalatedCount = Number(state.stats.escalated) || 0;
    const leadsCount = state.leads.length;
    const faqCount = state.faqs.length;
    const unmatchedCount = state.unmatchedQuestions.length;
    const coverageRate = faqCount + unmatchedCount === 0 ? 100 : Math.round((faqCount / (faqCount + unmatchedCount)) * 100);
    const leadRate = messagesCount === 0 ? 0 : Math.round((leadsCount / messagesCount) * 100);
    const intentCounts = state.leads.reduce(
      (acc, lead) => {
        const level = ["高", "中", "低"].includes(lead.intentLevel) ? lead.intentLevel : "中";
        acc[level] += 1;
        return acc;
      },
      { 高: 0, 中: 0, 低: 0 }
    );

    return {
      messagesCount,
      resolvedCount,
      escalatedCount,
      leadsCount,
      faqCount,
      unmatchedCount,
      coverageRate,
      leadRate,
      intentCounts,
      funnel: [
        { label: "对话消息", value: messagesCount, color: "#4285F4" },
        { label: "自动解决", value: resolvedCount, color: "#34A853" },
        { label: "转人工", value: escalatedCount, color: "#FBBC04" },
        { label: "销售线索", value: leadsCount, color: "#EA4335" }
      ]
    };
  }, [state.stats, state.leads, state.faqs.length, state.unmatchedQuestions.length]);

  useEffect(() => {
    apiOnlineRef.current = apiOnline;
  }, [apiOnline]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initialize();
  }, []);

  useEffect(() => {
    const chatScroll = chatScrollRef.current;
    if (!chatScroll) return;

    window.requestAnimationFrame(() => {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    });
  }, [messages]);

  async function initialize() {
    setSaveStatus("正在连接 API...");
    await refreshAiStatus();

    try {
      const payload = await requestJson(API_BASE, businessPath);
      const nextState = normalizeState(payload.business);
      setState(nextState);
      setMessages(seedMessages(nextState.company));
      setApiOnline(true);
      setSaveStatus("API 已连接");
    } catch (error) {
      const localState = loadLocalState();
      setState(localState);
      setMessages(seedMessages(localState.company));
      setApiOnline(false);
      setSaveStatus("API 未连接，使用本地演示");
    }
  }

  async function refreshAiStatus() {
    try {
      const health = await requestJson(API_BASE, "/api/health");
      setAiStatus((current) => ({
        configured: Boolean(health.ai && health.ai.configured),
        model: health.ai && health.ai.model ? health.ai.model : "-",
        provider: health.ai && health.ai.provider ? health.ai.provider : "DeepSeek",
        lastReplySource: current.lastReplySource || "尚未对话"
      }));
    } catch (error) {
      setAiStatus((current) => ({
        ...current,
        configured: false,
        model: "-",
        lastReplySource: current.lastReplySource || "尚未对话"
      }));
    }
  }

  function loadLocalState() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return clone(defaultState);
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      return clone(defaultState);
    }
  }

  function saveLocalState(nextState) {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
  }

  function scheduleCompanySave(nextState) {
    window.clearTimeout(saveTimerRef.current);
    setSaveStatus(apiOnlineRef.current ? "保存中..." : "保存到本地...");
    saveTimerRef.current = window.setTimeout(() => saveCompany(nextState), 420);
  }

  async function saveCompany(nextState) {
    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/company`, {
          method: "PUT",
          body: JSON.stringify({ company: nextState.company, settings: nextState.settings })
        });
        const normalized = normalizeState(response.business);
        setState(normalized);
        setSaveStatus("企业配置已同步到 API");
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 保存失败，已切到本地演示");
      }
    }

    saveLocalState(nextState);
    setSaveStatus("已保存到本地");
  }

  function updateCompanyField(field, value) {
    const nextState = normalizeState({
      ...state,
      company: { ...state.company, [field]: value }
    });
    setState(nextState);
    scheduleCompanySave(nextState);
  }

  function updateSettingField(field, value) {
    const nextState = normalizeState({
      ...state,
      settings: { ...state.settings, [field]: value }
    });
    setState(nextState);
    scheduleCompanySave(nextState);
  }

  async function createFaq(event) {
    event.preventDefault();
    const question = faqDraft.question.trim();
    const answer = faqDraft.answer.trim();
    const tags = splitTags(faqDraft.tags);

    if (!question || !answer) {
      setSaveStatus("请填写问题和答案");
      return;
    }

    const payload = { question, answer, tags };
    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/faqs`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setState(normalizeState(response.business));
        setFaqDraft({ question: "", tags: "", answer: "" });
        setSaveStatus("知识库已同步到 API");
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 写入失败，已切到本地演示");
      }
    }

    const nextState = normalizeState({
      ...state,
      faqs: [{ id: createId(), ...payload }, ...state.faqs]
    });
    setState(nextState);
    saveLocalState(nextState);
    setFaqDraft({ question: "", tags: "", answer: "" });
    setSaveStatus("知识库已保存到本地");
  }

  async function updateFaq(faqId, event) {
    event.preventDefault();
    const question = editDraft.question.trim();
    const answer = editDraft.answer.trim();
    const tags = splitTags(editDraft.tags);

    if (!question || !answer) {
      setSaveStatus("请填写问题和答案");
      return;
    }

    const payload = { question, answer, tags };
    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/faqs/${encodeURIComponent(faqId)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setState(normalizeState(response.business));
        setEditingFaqId("");
        setSaveStatus("知识库已更新");
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 更新失败，已切到本地演示");
      }
    }

    const nextState = normalizeState({
      ...state,
      faqs: state.faqs.map((faq) => (faq.id === faqId ? { ...faq, ...payload } : faq))
    });
    setState(nextState);
    saveLocalState(nextState);
    setEditingFaqId("");
    setSaveStatus("知识库已保存到本地");
  }

  async function deleteFaq(faqId) {
    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/faqs/${encodeURIComponent(faqId)}`, {
          method: "DELETE"
        });
        setState(normalizeState(response.business));
        setSaveStatus("知识库已同步到 API");
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 删除失败，已切到本地演示");
      }
    }

    const nextState = normalizeState({ ...state, faqs: state.faqs.filter((faq) => faq.id !== faqId) });
    setState(nextState);
    saveLocalState(nextState);
    setSaveStatus("知识库已保存到本地");
  }

  async function deleteUnmatched(questionId) {
    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/unmatched/${encodeURIComponent(questionId)}`, {
          method: "DELETE"
        });
        setState(normalizeState(response.business));
        setSaveStatus("未命中问题已忽略");
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 删除失败，已切到本地演示");
      }
    }

    const nextState = normalizeState({
      ...state,
      unmatchedQuestions: state.unmatchedQuestions.filter((item) => item.id !== questionId)
    });
    setState(nextState);
    saveLocalState(nextState);
    setSaveStatus("未命中问题已忽略");
  }

  async function resetDemoData() {
    if (!window.confirm("确定重置为默认演示数据吗？当前配置、线索和对话记录会被清空。")) return;

    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/reset`, { method: "POST" });
        const nextState = normalizeState(response.business);
        setState(nextState);
        setMessages(seedMessages(nextState.company));
        setLeadCapture({ awaiting: false, intent: "" });
        setBotMode("智能问答");
        setAiStatus((current) => ({ ...current, lastReplySource: "尚未对话" }));
        setSaveStatus("已重置 API 演示数据");
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 重置失败，已切到本地演示");
      }
    }

    const nextState = clone(defaultState);
    setState(nextState);
    setMessages(seedMessages(nextState.company));
    setLeadCapture({ awaiting: false, intent: "" });
    setBotMode("智能问答");
    setAiStatus((current) => ({ ...current, lastReplySource: "尚未对话" }));
    saveLocalState(nextState);
    setSaveStatus("已重置本地演示数据");
  }

  function exportConfig() {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `nimble-bot-config-${Date.now()}.json`);
    setSaveStatus("配置已导出");
  }

  async function exportLeadsCsv() {
    const fallbackFilename = `sales-leads-${timestampForFilename()}.csv`;

    if (apiOnlineRef.current) {
      try {
        const response = await fetch(`${API_BASE}${businessPath}/leads/export`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const filename = getDownloadFilename(response.headers.get("Content-Disposition")) || fallbackFilename;
        downloadBlob(blob, filename);
        setSaveStatus(state.leads.length === 0 ? "暂无线索，已导出空 CSV" : "销售线索 CSV 已导出");
        return;
      } catch (error) {
        setSaveStatus("API 导出失败，已导出当前页面线索");
      }
    }

    const csv = buildLeadsCsv(state.leads || []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, fallbackFilename);
    setSaveStatus(state.leads.length === 0 ? "暂无线索，已导出空 CSV" : "销售线索 CSV 已导出");
  }

  async function copyEmbedCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setSaveStatus("嵌入代码已复制");
    } catch (error) {
      setSaveStatus("请手动选中并复制嵌入代码");
    }
  }

  function fillFaqFromUnmatched(question) {
    setFaqDraft({ question: question.question, tags: "未命中, 待完善", answer: "" });
    setSaveStatus("已填入 FAQ 表单，请补充标准答案");
    window.setTimeout(() => document.querySelector("#faqAnswer")?.focus(), 50);
  }

  function startEditFaq(faq) {
    setEditingFaqId(faq.id);
    setEditDraft({
      question: faq.question,
      answer: faq.answer,
      tags: (faq.tags || []).join(", ")
    });
  }

  async function openLeadDetail(lead) {
    setLeadDetail({
      lead,
      conversation: buildFallbackConversation(lead),
      loading: Boolean(apiOnlineRef.current && lead.conversationId),
      error: lead.conversationId ? "" : "这条线索没有绑定会话 ID，仅展示线索摘要。"
    });

    if (!apiOnlineRef.current || !lead.conversationId) return;

    try {
      const response = await requestJson(API_BASE, `${businessPath}/conversations/${encodeURIComponent(lead.conversationId)}`);
      setLeadDetail({
        lead,
        conversation: response.conversation,
        loading: false,
        error: ""
      });
    } catch (error) {
      setLeadDetail({
        lead,
        conversation: buildFallbackConversation(lead),
        loading: false,
        error: "没有找到完整会话记录，已展示该线索的摘要信息。"
      });
    }
  }

  function closeLeadDetail() {
    setLeadDetail({ lead: null, conversation: null, loading: false, error: "" });
  }

  function updatePendingMessage(messageId, text) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, text, loading: false } : message))
    );
  }

  function updateLastReplySource(mode) {
    setAiStatus((current) => ({ ...current, lastReplySource: normalizeReplySource(mode) }));
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || chatPending) return;

    const pendingId = createId();
    setChatInput("");
    setMessages((current) => [
      ...current,
      { id: createId(), role: "user", text },
      { id: pendingId, role: "bot", text: "正在整理回复，请稍候...", loading: true }
    ]);
    setChatPending(true);

    if (apiOnlineRef.current) {
      try {
        const response = await requestJson(API_BASE, `${businessPath}/chat`, {
          method: "POST",
          body: JSON.stringify({
            message: text,
            visitorId: visitorIdRef.current,
            source: "admin-preview"
          })
        });
        updatePendingMessage(pendingId, response.reply.text);
        setBotMode(response.reply.mode);
        updateLastReplySource(response.reply.mode);
        setState((current) =>
          normalizeState({
            ...current,
            stats: response.stats || current.stats,
            leads: response.leads || current.leads,
            unmatchedQuestions: response.unmatchedQuestions || current.unmatchedQuestions
          })
        );
        setSaveStatus("对话已记录");
        setChatPending(false);
        return;
      } catch (error) {
        setApiOnline(false);
        setSaveStatus("API 对话失败，已切到本地演示");
      }
    }

    const localBase = normalizeState({
      ...state,
      stats: { ...state.stats, messages: (Number(state.stats.messages) || 0) + 1 }
    });
    const result = buildLocalBotReply(text, localBase, leadCapture);
    setState(result.nextState);
    setLeadCapture(result.nextLeadCapture);
    saveLocalState(result.nextState);
    updatePendingMessage(pendingId, result.reply.text);
    setBotMode(result.reply.mode);
    updateLastReplySource(result.reply.mode);
    setChatPending(false);
  }

  return (
    <div className="min-h-screen bg-[#f8fafd]">
      <header className="sticky top-0 z-20 border-b border-[#dadce0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[#1a73e8] text-white shadow-sm">
              <Bot className="size-6" />
            </div>
            <div>
              <p className="eyebrow">Workspace Console</p>
              <h1 className="text-2xl font-black text-[#202124]">智能客服机器人运营后台</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-white">
              {apiOnline ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
              {saveStatus}
            </span>
            <button className="btn-secondary" type="button" onClick={refreshAiStatus}>
              <RefreshCw className="size-4" />
              刷新状态
            </button>
            <button className="btn-secondary" type="button" onClick={resetDemoData}>
              <Wand2 className="size-4" />
              重置示例
            </button>
            <button className="btn-primary" type="button" onClick={exportConfig}>
              <Download className="size-4" />
              导出配置
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-5">
        <section className="mb-5 overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-black text-[#1a73e8]">
                  <Sparkles className="size-4" />
                  Material Dashboard
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e6f4ea] px-3 py-1 text-xs font-black text-[#188038]">
                  <CheckCircle2 className="size-4" />
                  {apiOnline ? "API 在线" : "本地演示"}
                </span>
              </div>
              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-[#202124] sm:text-4xl">
                用一个清爽的运营台，看清机器人回答、获客和知识库表现。
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6368]">
                当前页面采用 Google 风格的信息密度：白色画布、蓝色主操作、四色状态提示和实时数据可视化。客服规则、FAQ、线索导出和聊天预览都可以在同一屏完成。
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <HeroPill label="自动解决" value={`${resolveRate}%`} color="#34A853" />
                <HeroPill label="知识覆盖" value={`${dashboard.coverageRate}%`} color="#4285F4" />
                <HeroPill label="留资转化" value={`${dashboard.leadRate}%`} color="#EA4335" />
              </div>
            </div>
            <HeroVisual dashboard={dashboard} />
          </div>
        </section>

        <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={BrainCircuit} label="DeepSeek" value={aiStatus.configured ? "已连接" : "未连接"} hint={aiStatus.provider} tone={aiStatus.configured ? "ok" : "warn"} color="#4285F4" />
          <MetricCard icon={Gauge} label="当前模型" value={aiStatus.model || "-"} hint="思考模式已启用" color="#34A853" />
          <MetricCard icon={MessageSquare} label="最近回复来源" value={aiStatus.lastReplySource || "尚未对话"} hint={`当前模式：${getReplyModeLabel(state.settings.replyMode)}`} color="#FBBC04" />
          <MetricCard icon={UserCheck} label="销售线索" value={state.leads.length} hint={`自动解决率 ${resolveRate}%`} color="#EA4335" />
        </section>

        <Panel className="mb-5">
          <SectionHeader
            eyebrow="Visual Overview"
            title="运营可视化总览"
            description="用当前测试数据生成图表，帮助客户更快看懂机器人价值：节省了多少重复问答、沉淀了多少问题、捕获了多少销售机会。"
            icon={BarChart3}
            action={<span className="badge bg-[#fef7e0] text-[#b06000]">实时读取本地数据</span>}
          />
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <ResolutionDonut value={resolveRate} resolved={dashboard.resolvedCount} escalated={dashboard.escalatedCount} />
            <FunnelChart items={dashboard.funnel} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <IntentBars counts={dashboard.intentCounts} />
              <KnowledgeCoverage faqCount={dashboard.faqCount} unmatchedCount={dashboard.unmatchedCount} coverageRate={dashboard.coverageRate} />
            </div>
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
          <div className="space-y-5">
            <Panel>
              <SectionHeader
                eyebrow="企业后台"
                title="机器人配置"
                description="配置企业资料、回复模式和客服回答规则，保存后立即影响聊天预览与嵌入组件。"
                icon={Settings2}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="field-label">
                  企业名称
                  <input className="field-control" value={state.company.name} onChange={(event) => updateCompanyField("name", event.target.value)} />
                </label>
                <label className="field-label">
                  行业
                  <select className="field-control" value={state.company.industry} onChange={(event) => updateCompanyField("industry", event.target.value)}>
                    {industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  回复语气
                  <select className="field-control" value={state.company.tone} onChange={(event) => updateCompanyField("tone", event.target.value)}>
                    {tones.map((tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  服务时间
                  <input className="field-control" value={state.company.serviceHours} onChange={(event) => updateCompanyField("serviceHours", event.target.value)} />
                </label>
                <label className="field-label md:col-span-2">
                  人工/销售联系方式
                  <input className="field-control" value={state.company.contact} onChange={(event) => updateCompanyField("contact", event.target.value)} />
                </label>
                <label className="field-label md:col-span-2">
                  开场欢迎语
                  <textarea className="field-textarea min-h-20" value={state.company.welcome} onChange={(event) => updateCompanyField("welcome", event.target.value)} />
                </label>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {replyModes.map((mode) => (
                  <button
                    key={mode.value}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      state.settings.replyMode === mode.value
                        ? "border-[#1a73e8] bg-[#e8f0fe]"
                        : "border-[#dadce0] bg-white hover:bg-[#f8fafd]"
                    )}
                    type="button"
                    onClick={() => updateSettingField("replyMode", mode.value)}
                  >
                    <span className="block text-sm font-black text-[#202124]">{mode.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#5f6368]">{mode.hint}</span>
                  </button>
                ))}
              </div>

              <label className="field-label mt-5">
                客服回答规则
                <textarea
                  className="field-textarea min-h-36"
                  value={state.settings.answerRules}
                  onChange={(event) => updateSettingField("answerRules", event.target.value)}
                  placeholder="例如：不承诺具体价格；不回答与产品无关问题；优先引导预约演示；回复不超过 120 字。"
                />
              </label>
            </Panel>

            <Panel>
              <SectionHeader
                eyebrow="知识库"
                title="FAQ 编辑"
                description={`${state.faqs.length} 条标准答案。高置信 FAQ 会优先回答，降低 AI 乱答风险。`}
                icon={Database}
              />

              <form className="grid gap-3 md:grid-cols-2" onSubmit={createFaq}>
                <label className="field-label">
                  问题
                  <input
                    className="field-control"
                    value={faqDraft.question}
                    onChange={(event) => setFaqDraft((draft) => ({ ...draft, question: event.target.value }))}
                    placeholder="例如：怎么收费？"
                  />
                </label>
                <label className="field-label">
                  标签
                  <input
                    className="field-control"
                    value={faqDraft.tags}
                    onChange={(event) => setFaqDraft((draft) => ({ ...draft, tags: event.target.value }))}
                    placeholder="价格, 方案, 试用"
                  />
                </label>
                <label className="field-label md:col-span-2">
                  标准答案
                  <textarea
                    id="faqAnswer"
                    className="field-textarea"
                    value={faqDraft.answer}
                    onChange={(event) => setFaqDraft((draft) => ({ ...draft, answer: event.target.value }))}
                    placeholder="写一段客服可以直接发给客户的答案"
                  />
                </label>
                <button className="btn-primary md:col-span-2" type="submit">
                  <Plus className="size-4" />
                  添加到知识库
                </button>
              </form>

              <div className="faq-scroll-panel mt-4 space-y-3">
                {state.faqs.length === 0 ? (
                  <EmptyState text="还没有常见问题。先添加 5-10 条高频售前问题，就能开始试点。" />
                ) : (
                  state.faqs.map((faq) => (
                    <FaqItem
                      key={faq.id}
                      faq={faq}
                      editing={editingFaqId === faq.id}
                      editDraft={editDraft}
                      onEditDraftChange={setEditDraft}
                      onStartEdit={() => startEditFaq(faq)}
                      onCancelEdit={() => setEditingFaqId("")}
                      onDelete={() => deleteFaq(faq.id)}
                      onSubmit={(event) => updateFaq(faq.id, event)}
                    />
                  ))
                )}
              </div>
            </Panel>

            <Panel>
              <SectionHeader
                eyebrow="知识优化"
                title="未命中问题"
                description={`${state.unmatchedQuestions.length} 条待补充。可一键填入 FAQ 表单继续沉淀知识库。`}
                icon={FileQuestion}
              />

              <div className="space-y-3">
                {state.unmatchedQuestions.length === 0 ? (
                  <EmptyState text="暂无未命中问题。客户问到 FAQ 覆盖不足的问题后，会自动出现在这里。" />
                ) : (
                  state.unmatchedQuestions.slice(0, 8).map((question) => (
                    <div key={question.id} className="rounded-xl border border-[#dadce0] bg-[#f8fafd] p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-black text-[#202124]">{question.question}</h3>
                          <p className="mt-1 text-xs text-[#5f6368]">
                            {question.count || 1} 次 · {question.lastMode || "未命中"} · 最近：{question.lastAskedAt || question.createdAt}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-primary min-h-9 px-3" type="button" onClick={() => fillFaqFromUnmatched(question)}>
                            转成 FAQ
                          </button>
                          <button className="btn-secondary min-h-9 px-3" type="button" onClick={() => deleteUnmatched(question.id)}>
                            忽略
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel>
              <SectionHeader
                eyebrow="转化"
                title="销售线索"
                description="导出 CSV 后，客户能直观看到试用期间捕获了哪些真实商机。"
                icon={UserCheck}
                action={
                  <button className="btn-secondary" type="button" onClick={exportLeadsCsv}>
                    <Download className="size-4" />
                    导出线索 CSV
                  </button>
                }
              />

              <div className="grid gap-3 md:grid-cols-3">
                <MiniMetric label="对话消息" value={state.stats.messages} />
                <MiniMetric label="自动解决率" value={`${resolveRate}%`} />
                <MiniMetric label="销售线索" value={state.leads.length} />
              </div>

              <div className="mt-4 space-y-3">
                {state.leads.length === 0 ? (
                  <EmptyState text="暂无销售线索。试着在右侧输入“我要报价”或“转人工”。" />
                ) : (
                  state.leads.slice(0, 6).map((lead) => <LeadItem key={lead.id} lead={lead} onOpen={() => openLeadDetail(lead)} />)
                )}
              </div>
            </Panel>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5">
            <Panel className="overflow-hidden p-0">
              <div className="border-b border-[#dadce0] bg-[#1a73e8] p-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-lg bg-white/15">
                      <Bot className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black">{state.company.name}</h2>
                      <p className="text-xs text-white/85">
                        {state.company.industry} · {state.company.tone} · {getReplyModeLabel(state.settings.replyMode)}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-black">{botMode}</span>
                </div>
              </div>

              <div ref={chatScrollRef} className="h-[520px] overflow-y-auto overscroll-contain bg-[#f8fafd] p-4">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <ChatBubble key={message.id} message={message} />
                  ))}
                </div>
              </div>

              <div className="border-t border-[#dadce0] bg-white p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickReplies.map((sample) => (
                    <button
                      key={sample}
                      className="rounded-full border border-[#dadce0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1a73e8] hover:bg-[#f8fafd]"
                      type="button"
                      onClick={() => setChatInput(sample)}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
                <form className="flex gap-2" onSubmit={sendChatMessage}>
                  <input
                    className="field-control"
                    value={chatInput}
                    disabled={chatPending}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="输入客户问题，例如：怎么收费？"
                  />
                  <button className="btn-primary shrink-0 px-4" type="submit" disabled={chatPending}>
                    {chatPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    发送
                  </button>
                </form>
              </div>
            </Panel>

            <Panel>
              <SectionHeader
                eyebrow="客户网站"
                title="嵌入代码"
                description="复制到客户网站、落地页或 H5 页面，即可展示在线客服入口。"
                icon={Globe2}
                action={
                  <button className="btn-secondary" type="button" onClick={copyEmbedCode}>
                    <ClipboardCopy className="size-4" />
                    复制
                  </button>
                }
              />
              <textarea className="field-textarea min-h-32 font-mono text-xs" value={embedCode} readOnly />
            </Panel>

            <Panel>
              <SectionHeader
                eyebrow="试点价值"
                title="当前演示覆盖"
                description="页面重建后仍保留 AI 状态、回复模式、提示词规则、FAQ 编辑、未命中沉淀和线索导出。"
                icon={ShieldCheck}
              />
              <div className="grid gap-2 text-sm text-[#3c4043]">
                <FeatureLine text="FAQ 精准命中优先，避免答非所问" />
                <FeatureLine text="未命中问题进入优化列表" />
                <FeatureLine text="线索带意向等级和跟进摘要" />
                <FeatureLine text="DeepSeek 异常时友好转人工" />
              </div>
            </Panel>
          </aside>
        </div>
      </main>
      {leadDetail.lead ? (
        <LeadConversationModal
          detail={leadDetail}
          onClose={closeLeadDetail}
        />
      ) : null}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return <section className={cn("section-card p-4", className)}>{children}</section>;
}

function SectionHeader({ eyebrow, title, description, icon: Icon, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] text-[#1a73e8]">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-title">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5f6368]">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function HeroPill({ label, value, color }) {
  return (
    <div className="rounded-xl border border-[#dadce0] bg-[#f8fafd] p-3">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold text-[#5f6368]">{label}</span>
      </div>
      <strong className="mt-2 block text-2xl font-black text-[#202124]">{value}</strong>
    </div>
  );
}

function HeroVisual({ dashboard }) {
  const maxValue = Math.max(...dashboard.funnel.map((item) => item.value), 1);

  return (
    <div className="relative min-h-[280px] border-t border-[#dadce0] bg-[#f8fafd] p-5 lg:border-l lg:border-t-0">
      <div className="absolute right-5 top-5 flex gap-1.5">
        <span className="size-3 rounded-full bg-[#4285F4]" />
        <span className="size-3 rounded-full bg-[#EA4335]" />
        <span className="size-3 rounded-full bg-[#FBBC04]" />
        <span className="size-3 rounded-full bg-[#34A853]" />
      </div>
      <div className="mt-7 rounded-2xl border border-[#dadce0] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-[#5f6368]">Conversation Flow</p>
            <h3 className="mt-1 text-lg font-black text-[#202124]">试用转化路径</h3>
          </div>
          <Activity className="size-5 text-[#1a73e8]" />
        </div>
        <div className="space-y-3">
          {dashboard.funnel.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-[#5f6368]">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
              <div className="h-3 rounded-full bg-[#eef2f7]">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.max(8, Math.round((item.value / maxValue) * 100))}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#dadce0] bg-white p-3">
          <p className="text-xs font-bold text-[#5f6368]">知识覆盖</p>
          <strong className="mt-2 block text-xl font-black text-[#1a73e8]">{dashboard.coverageRate}%</strong>
        </div>
        <div className="rounded-xl border border-[#dadce0] bg-white p-3">
          <p className="text-xs font-bold text-[#5f6368]">留资转化</p>
          <strong className="mt-2 block text-xl font-black text-[#ea4335]">{dashboard.leadRate}%</strong>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone = "neutral", color = "#1a73e8" }) {
  return (
    <div className="rounded-2xl border border-[#dadce0] bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#5f6368]">{label}</p>
          <strong className={cn("mt-2 block text-xl font-black", tone === "ok" && "text-[#188038]", tone === "warn" && "text-[#b06000]", tone === "neutral" && "text-[#202124]")}>{value}</strong>
          <p className="mt-1 text-xs text-[#5f6368]">{hint}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-xl text-white" style={{ backgroundColor: color }}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-[#dadce0] bg-[#f8fafd] p-3">
      <strong className="block text-2xl font-black text-[#202124]">{value}</strong>
      <span className="mt-1 block text-xs font-bold text-[#5f6368]">{label}</span>
    </div>
  );
}

function ResolutionDonut({ value, resolved, escalated }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = clamp(value, 0, 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="rounded-2xl border border-[#dadce0] bg-[#f8fafd] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-[#5f6368]">自动解决率</p>
          <h3 className="mt-1 text-sm font-black text-[#202124]">FAQ / AI 处理效果</h3>
        </div>
        <ChartPie className="size-5 text-[#1a73e8]" />
      </div>
      <div className="grid place-items-center">
        <div className="relative size-40">
          <svg className="size-40 -rotate-90" viewBox="0 0 140 140" aria-label={`自动解决率 ${progress}%`}>
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#e8eaed" strokeWidth="14" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#1a73e8"
              strokeLinecap="round"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <strong className="block text-3xl font-black text-[#202124]">{progress}%</strong>
              <span className="text-xs font-bold text-[#5f6368]">resolved</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white p-3">
          <span className="block font-bold text-[#5f6368]">已解决</span>
          <strong className="mt-1 block text-lg font-black text-[#188038]">{resolved}</strong>
        </div>
        <div className="rounded-xl bg-white p-3">
          <span className="block font-bold text-[#5f6368]">转人工</span>
          <strong className="mt-1 block text-lg font-black text-[#b06000]">{escalated}</strong>
        </div>
      </div>
    </div>
  );
}

function FunnelChart({ items }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-[#dadce0] bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-[#5f6368]">转化漏斗</p>
          <h3 className="mt-1 text-sm font-black text-[#202124]">从咨询到线索</h3>
        </div>
        <TrendingUp className="size-5 text-[#34a853]" />
      </div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const width = Math.max(10, Math.round((item.value / maxValue) * 100));
          return (
            <div key={item.label} className="grid gap-2 sm:grid-cols-[88px_minmax(0,1fr)_44px] sm:items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-[#5f6368]">
                <span className="grid size-5 place-items-center rounded-full bg-[#f1f3f4] text-[10px] text-[#202124]">{index + 1}</span>
                {item.label}
              </div>
              <div className="h-8 rounded-full bg-[#f1f3f4] p-1">
                <div className="h-6 rounded-full" style={{ width: `${width}%`, backgroundColor: item.color }} />
              </div>
              <strong className="text-right text-sm font-black text-[#202124]">{item.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntentBars({ counts }) {
  const levels = [
    { label: "高意向", key: "高", color: "#EA4335" },
    { label: "中意向", key: "中", color: "#FBBC04" },
    { label: "低意向", key: "低", color: "#34A853" }
  ];
  const total = levels.reduce((sum, level) => sum + counts[level.key], 0);
  const maxValue = Math.max(...levels.map((level) => counts[level.key]), 1);

  return (
    <div className="rounded-2xl border border-[#dadce0] bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-[#5f6368]">意向等级</p>
          <h3 className="mt-1 text-sm font-black text-[#202124]">线索质量分布</h3>
        </div>
        <Target className="size-5 text-[#ea4335]" />
      </div>
      <div className="space-y-3">
        {levels.map((level) => {
          const width = Math.max(8, Math.round((counts[level.key] / maxValue) * 100));
          return (
            <div key={level.key}>
              <div className="mb-1 flex justify-between text-xs font-bold text-[#5f6368]">
                <span>{level.label}</span>
                <span>{counts[level.key]}</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#f1f3f4]">
                <div className="h-2.5 rounded-full" style={{ width: `${width}%`, backgroundColor: level.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[#5f6368]">合计 {total} 条线索</p>
    </div>
  );
}

function KnowledgeCoverage({ faqCount, unmatchedCount, coverageRate }) {
  const total = Math.max(faqCount + unmatchedCount, 1);
  const faqWidth = Math.max(4, Math.round((faqCount / total) * 100));
  const unmatchedWidth = Math.max(4, Math.round((unmatchedCount / total) * 100));

  return (
    <div className="rounded-2xl border border-[#dadce0] bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-[#5f6368]">知识覆盖</p>
          <h3 className="mt-1 text-sm font-black text-[#202124]">FAQ 与未命中</h3>
        </div>
        <Database className="size-5 text-[#1a73e8]" />
      </div>
      <strong className="text-3xl font-black text-[#202124]">{coverageRate}%</strong>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#f1f3f4]">
        <div className="bg-[#4285F4]" style={{ width: `${faqWidth}%` }} />
        <div className="bg-[#FBBC04]" style={{ width: `${unmatchedWidth}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-[#f8fafd] p-3">
          <span className="block font-bold text-[#5f6368]">FAQ</span>
          <strong className="mt-1 block text-lg font-black text-[#1a73e8]">{faqCount}</strong>
        </div>
        <div className="rounded-xl bg-[#f8fafd] p-3">
          <span className="block font-bold text-[#5f6368]">未命中</span>
          <strong className="mt-1 block text-lg font-black text-[#b06000]">{unmatchedCount}</strong>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ faq, editing, editDraft, onEditDraftChange, onStartEdit, onCancelEdit, onDelete, onSubmit }) {
  if (editing) {
    return (
      <form className="rounded-xl border border-[#1a73e8] bg-[#e8f0fe] p-3" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field-label">
            问题
            <input className="field-control" value={editDraft.question} onChange={(event) => onEditDraftChange((draft) => ({ ...draft, question: event.target.value }))} />
          </label>
          <label className="field-label">
            标签
            <input className="field-control" value={editDraft.tags} onChange={(event) => onEditDraftChange((draft) => ({ ...draft, tags: event.target.value }))} />
          </label>
          <label className="field-label md:col-span-2">
            标准答案
            <textarea className="field-textarea" value={editDraft.answer} onChange={(event) => onEditDraftChange((draft) => ({ ...draft, answer: event.target.value }))} />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button className="btn-primary" type="submit">
              保存
            </button>
            <button className="btn-secondary" type="button" onClick={onCancelEdit}>
              <X className="size-4" />
              取消
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <article className="rounded-xl border border-[#dadce0] bg-[#f8fafd] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-[#202124]">{faq.question}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5f6368]">{faq.answer}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-secondary min-h-9 px-3" type="button" onClick={onStartEdit}>
            <Pencil className="size-4" />
            编辑
          </button>
          <button className="btn-danger" type="button" onClick={onDelete}>
            <Trash2 className="size-4" />
            删除
          </button>
        </div>
      </div>
      {faq.tags && faq.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {faq.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-[#dadce0] bg-white px-2 py-1 text-xs font-bold text-[#5f6368]">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function LeadItem({ lead, onOpen }) {
  const levelClass = {
    高: "border-[#fad2cf] bg-[#fce8e6] text-[#c5221f]",
    中: "border-[#f1d3a8] bg-[#fff8ec] text-[#9a5b05]",
    低: "border-[#ceead6] bg-[#e6f4ea] text-[#188038]"
  };

  return (
    <article
      className="group rounded-xl border border-[#dadce0] bg-[#f8fafd] p-3 transition hover:border-[#1a73e8] hover:bg-[#f1f6ff] hover:shadow-sm"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-[#202124]">{lead.contact}</h3>
          <p className="mt-1 text-xs text-[#5f6368]">{lead.createdAt}</p>
        </div>
        <span className={cn("inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-black", levelClass[lead.intentLevel] || levelClass["中"])}>
          {lead.intentLevel || "中"}意向
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#3c4043]">客户需求：{lead.intent}</p>
      <p className="mt-1 text-sm leading-6 text-[#5f6368]">跟进摘要：{lead.summary || "暂无摘要"}</p>
      {Array.isArray(lead.focusAreas) && lead.focusAreas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lead.focusAreas.map((tag) => (
            <span key={tag} className="rounded-full border border-[#dadce0] bg-white px-2 py-1 text-xs font-bold text-[#5f6368]">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs font-bold text-[#5f6368]">
        状态：{lead.status || "未跟进"} · 来源：{formatSource(lead.source)}
      </p>
      <p className="mt-2 text-xs font-black text-[#1a73e8] opacity-0 transition group-hover:opacity-100">
        点击查看聊天记录
      </p>
    </article>
  );
}

function LeadConversationModal({ detail, onClose }) {
  const lead = detail.lead;
  const conversation = detail.conversation || buildFallbackConversation(lead);
  const messages = conversation.messages || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202124]/40 px-4 py-6 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#dadce0] bg-white shadow-2xl">
        <header className="border-b border-[#dadce0] bg-[#f8fafd] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Lead Conversation</p>
              <h2 className="mt-1 text-xl font-black text-[#202124]">{lead.contact}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5f6368]">
                客户需求：{lead.intent || "未记录"} · 来源：{formatSource(lead.source)}
              </p>
            </div>
            <button className="btn-secondary min-h-9 px-3" type="button" onClick={onClose} aria-label="关闭线索详情">
              <X className="size-4" />
              关闭
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="意向等级" value={`${lead.intentLevel || "中"}意向`} />
            <MiniMetric label="会话消息" value={messages.length} />
            <MiniMetric label="状态" value={lead.status || "未跟进"} />
          </div>
        </header>

        {detail.error ? (
          <div className="mx-5 mt-4 rounded-xl border border-[#f1d3a8] bg-[#fff8ec] px-3 py-2 text-sm font-bold text-[#9a5b05]">
            {detail.error}
          </div>
        ) : null}

        <div className="overflow-y-auto overscroll-contain bg-white p-5">
          {detail.loading ? (
            <div className="grid min-h-40 place-items-center text-sm font-bold text-[#5f6368]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-[#1a73e8]" />
                正在加载聊天记录...
              </span>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState text="这条线索暂时没有可展示的聊天记录。" />
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <ConversationMessage key={`${message.createdAt || "message"}-${index}`} message={message} />
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-[#dadce0] bg-[#f8fafd] p-5">
          <p className="text-sm leading-6 text-[#5f6368]">跟进摘要：{lead.summary || "暂无摘要"}</p>
          {Array.isArray(lead.focusAreas) && lead.focusAreas.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.focusAreas.map((tag) => (
                <span key={tag} className="rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-bold text-[#5f6368]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function ConversationMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[82%] rounded-2xl px-3 py-2 shadow-sm", isUser ? "bg-[#1a73e8] text-white" : "border border-[#d2e3fc] bg-[#e8f0fe] text-[#202124]")}>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
        {message.createdAt ? (
          <p className={cn("mt-1 text-[11px] font-bold", isUser ? "text-white/75" : "text-[#5f6368]")}>
            {formatConversationTime(message.createdAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[88%] rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-center text-xs leading-5 text-[#5f6368]">
        {message.text}
      </div>
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm",
          isUser ? "bg-[#1a73e8] text-white" : "border border-[#d2e3fc] bg-[#e8f0fe] text-[#202124]"
        )}
      >
        {message.loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {message.text}
          </span>
        ) : (
          message.text
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-[#dadce0] bg-[#f8fafd] p-4 text-sm leading-6 text-[#5f6368]">
      {text}
    </div>
  );
}

function FeatureLine({ text }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#dadce0] bg-[#f8fafd] px-3 py-2">
      <Sparkles className="size-4 text-[#1a73e8]" />
      <span>{text}</span>
    </div>
  );
}

function buildFallbackConversation(lead) {
  if (!lead) return { messages: [] };
  const messages = [];

  if (lead.intent) {
    messages.push({
      role: "user",
      text: lead.intent,
      createdAt: lead.createdAt || ""
    });
  }

  if (lead.transcript && lead.transcript !== lead.intent) {
    messages.push({
      role: "user",
      text: lead.transcript,
      createdAt: lead.createdAt || ""
    });
  }

  if (lead.summary) {
    messages.push({
      role: "bot",
      text: `线索摘要：${lead.summary}`,
      createdAt: lead.createdAt || ""
    });
  }

  return {
    visitorId: lead.conversationId || "",
    source: lead.source || "unknown",
    createdAt: lead.createdAt || "",
    messages
  };
}

function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
