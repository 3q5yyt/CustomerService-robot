import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
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
  Lock,
  Loader2,
  Mail,
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
  Users,
  Wand2,
  X,
  Zap
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
const AUTH_SESSION_STORAGE_KEY = "nimble-auth-session-v1";
const ADMIN_TOKEN_STORAGE_KEY = `nimble-admin-api-token-${BUSINESS_ID}`;
const PORTAL_TOKEN_STORAGE_KEY = `nimble-portal-api-token-${BUSINESS_ID}`;
const businessPath = `/api/admin/businesses/${encodeURIComponent(BUSINESS_ID)}`;
const portalBusinessPath = `/api/portal/businesses/${encodeURIComponent(BUSINESS_ID)}`;

const industries = ["通用服务", "互联网", "人工智能", "电商零售", "教育培训", "本地生活", "企业服务", "医疗健康"];
const tones = ["专业简洁", "热情亲和", "稳重可信"];
const replyModes = [
  { value: "faq_ai", label: "FAQ + AI", hint: "FAQ 精准命中时直接答，否则交给模型" },
  { value: "faq_first", label: "FAQ 优先", hint: "更保守，FAQ 未命中时引导人工" },
  { value: "lead_only", label: "仅收集线索", hint: "不自动回答复杂问题，优先留资" }
];
const widgetPositions = [
  { value: "bottom-right", label: "右下角" },
  { value: "bottom-left", label: "左下角" }
];
const widgetColorPresets = ["#1a73e8", "#0f8f7e", "#7c3aed", "#ea4335", "#202124"];

function LoginApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("请输入企业分配给你的邮箱和密码。");

  useEffect(() => {
    const session = readStoredAuthSession();
    if (!session) return;
    if (session.role === "admin") {
      window.location.replace("/admin");
      return;
    }
    if (session.role === "portal" && session.businessId) {
      window.location.replace(`/portal?businessId=${encodeURIComponent(session.businessId)}`);
    }
  }, []);

  async function submitLogin(event) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setMessage("请输入邮箱和密码");
      return;
    }

    setPending(true);
    setMessage("正在登录...");
    try {
      const payload = await requestJson(API_BASE, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      writeStoredAuthSession(payload.session);
      window.location.assign(payload.redirectTo || "/admin");
    } catch (error) {
      setMessage(error.message || "登录失败");
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-white text-[#111111]">
      <header className="mx-auto flex max-w-[1180px] items-center gap-3 px-5 py-4">
        <div className="grid size-10 place-items-center rounded-full bg-[#40b80b] text-white shadow-sm">
          <Zap className="size-6 fill-white" />
        </div>
        <span className="text-lg font-black uppercase tracking-[0.16em]">Customer Robot</span>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-[1180px] items-center gap-10 px-5 pb-4 lg:grid-cols-[minmax(0,560px)_minmax(340px,410px)] lg:gap-24">
        <section className="relative min-h-[600px] overflow-hidden rounded-[30px] bg-[#f6f6f4] px-6 pt-12 sm:px-12">
          <div className="mx-auto max-w-[420px] text-center">
            <h1 className="text-3xl font-black tracking-tight text-black sm:text-4xl">快速接入，稳定响应</h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#7a7d82]">
              把智能问答、知识库、销售线索和网站嵌入组件集中到一个企业工作台。
            </p>
          </div>

          <LoginProductPreview />
        </section>

        <section className="w-full">
          <p className="text-xs font-semibold text-[#7a7d82]">Fast, Secure & Reliable</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-black">登录智能客服工作台</h2>
          <p className="mt-2 text-sm font-semibold text-[#7a7d82]">开始管理企业知识库、客户咨询和销售线索。</p>

          <form className="mt-9 grid gap-4" onSubmit={submitLogin}>
            <label className="grid gap-2 text-sm font-bold text-black">
              企业邮箱
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#6f7378]" />
                <input
                  className="h-11 w-full rounded-lg border border-[#d7d7d7] bg-white px-4 pl-11 text-sm font-semibold text-black outline-none transition placeholder:text-[#9aa0a6] focus:border-[#40b80b] focus:ring-2 focus:ring-[#d8f5ce]"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </span>
            </label>

            <label className="grid gap-2 text-sm font-bold text-black">
              密码
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#6f7378]" />
                <input
                  className="h-11 w-full rounded-lg border border-[#d7d7d7] bg-white px-4 pl-11 text-sm font-semibold text-black outline-none transition placeholder:text-[#9aa0a6] focus:border-[#40b80b] focus:ring-2 focus:ring-[#d8f5ce]"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                />
              </span>
            </label>

            <p className="-mt-1 text-right text-sm font-semibold text-[#7a7d82]">忘记密码？请联系账号负责人</p>

            <button
              className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-black text-white transition hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              登录账号
            </button>
          </form>

          <p className="mt-4 rounded-lg bg-[#f6f6f4] px-4 py-3 text-sm font-bold text-[#5f6368]">{message}</p>

          <div className="mt-8">
            <h3 className="text-base font-black text-black">开通企业工作台</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#7a7d82]">
              企业账号由服务人员完成开通和初始配置，登录后即可维护问答、线索与网站嵌入代码。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function LoginProductPreview() {
  return (
    <div className="absolute left-12 top-[150px] w-[590px] max-w-none overflow-hidden rounded-[26px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] sm:left-[64px]">
      <div className="flex h-16 items-center justify-between border-b border-[#ececec] px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-full bg-[#40b80b] text-white">
            <Zap className="size-5 fill-white" />
          </div>
          <span className="text-sm font-black uppercase tracking-[0.14em]">Customer Robot</span>
        </div>
        <div className="flex items-center gap-5 text-xs font-black text-[#7a7d82]">
          <span className="rounded-full border border-[#40b80b] px-5 py-2 text-[#2a9408]">总览</span>
          <span>知识库</span>
          <span>线索</span>
        </div>
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)]">
        <aside className="bg-[#f8f8f7] px-3 py-5">
          <div className="mb-5 text-center">
            <p className="text-[10px] font-black uppercase text-[#9aa0a6]">Chat</p>
            <div className="mx-auto mt-2 grid size-11 place-items-center rounded-full bg-[#40b80b] text-white">
              <MessageSquare className="size-5" />
            </div>
          </div>
          <div className="grid gap-3">
            {["赵", "林", "周", "吴"].map((name, index) => (
              <div
                key={name}
                className="relative mx-auto grid size-9 place-items-center rounded-full text-xs font-black text-white"
                style={{ backgroundColor: ["#1a73e8", "#ea4335", "#7c3aed", "#fbbc04"][index] }}
              >
                {name}
                {index < 2 ? <span className="absolute right-0 top-0 size-2 rounded-full bg-[#ea4335] ring-2 ring-white" /> : null}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-6 grid size-10 place-items-center rounded-full bg-white text-xs font-black text-[#40b80b] shadow-sm">
            08
          </div>
        </aside>

        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#7a7d82]">数智云智能技术工作室</p>
              <h3 className="mt-1 text-2xl font-black leading-tight text-black">客服工作台总览</h3>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-[#d7d7d7] bg-white px-4 py-2 text-xs font-black text-black">
              新增问题
              <ArrowUpRight className="size-4" />
            </button>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-[#ecffd7] via-[#fbffe8] to-[#eef7ff] p-4">
            <div className="flex items-end gap-4">
              <span className="text-4xl font-black text-black">72%</span>
              <div className="pb-1">
                <p className="text-sm font-black text-black">自动解决率</p>
                <p className="text-xs font-semibold text-[#6f7378]">本周 316 次咨询，知识库命中率提升 18%</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full w-[72%] rounded-full bg-[#40b80b]" />
            </div>
            <div className="mt-3 flex gap-4 text-[11px] font-bold text-[#6f7378]">
              <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-[#40b80b]" />已解决</span>
              <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-[#fbbc04]" />待跟进</span>
              <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-[#1a73e8]" />人工接入</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h4 className="text-base font-black text-black">今日客户咨询</h4>
            <div className="flex gap-2 text-xs font-black">
              <span className="rounded-full border border-[#d7d7d7] px-3 py-1">今日</span>
              <span className="rounded-full border border-[#d7d7d7] px-3 py-1">本周</span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PreviewTicket
              icon={Users}
              title="报价咨询"
              owner="销售线索"
              status="高意向"
              color="#40b80b"
            />
            <PreviewTicket
              icon={BrainCircuit}
              title="知识库未命中"
              owner="待优化"
              status="需补充"
              color="#fbbc04"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTicket({ icon: Icon, title, owner, status, color }) {
  return (
    <div className="rounded-2xl bg-[#fbfbfa] p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-full bg-white text-[#5f6368] shadow-sm">
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-xs font-black text-black">{owner}</p>
            <p className="text-[11px] font-semibold text-[#9aa0a6]">自动归类</p>
          </div>
        </div>
        <ArrowUpRight className="size-4 text-[#5f6368]" />
      </div>
      <h5 className="text-base font-black text-black">{title}</h5>
      <p className="mt-2 text-xs font-semibold text-[#7a7d82]">机器人已生成摘要，等待负责人确认。</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-black text-[#6f7378]">优先级</span>
        <span className="rounded-full px-2 py-1 text-[11px] font-black text-black" style={{ backgroundColor: `${color}33` }}>
          {status}
        </span>
      </div>
    </div>
  );
}

function PlatformAdminApp() {
  const [adminToken, setAdminToken] = useState(() => readInitialAdminToken());
  const [adminTokenInput, setAdminTokenInput] = useState(() => readInitialAdminToken());
  const [authRequired, setAuthRequired] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [totals, setTotals] = useState({
    businesses: 0,
    messages: 0,
    resolved: 0,
    escalated: 0,
    leads: 0,
    faqs: 0,
    unmatched: 0,
    portalTokens: 0,
    resolveRate: 0
  });
  const [saveStatus, setSaveStatus] = useState("正在连接平台 API...");
  const [portalTokenResult, setPortalTokenResult] = useState({ businessId: "", token: "" });
  const publicBase = getPublicBase(API_BASE);

  useEffect(() => {
    initialize();
  }, []);

  function withAdminAuth(options = {}, token = adminToken) {
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
  }

  function requestAdminJson(path, options = {}, token = adminToken) {
    return requestJson(API_BASE, path, withAdminAuth(options, token));
  }

  function handleAuthError(error) {
    if (error && error.status === 401) {
      setAuthRequired(true);
      setSaveStatus("请先登录后继续");
      return true;
    }
    return false;
  }

  async function initialize(token = adminToken) {
    setSaveStatus("正在读取企业客户...");
    try {
      const payload = await requestAdminJson("/api/admin/businesses", {}, token);
      setBusinesses(Array.isArray(payload.businesses) ? payload.businesses : []);
      setTotals(payload.totals || {});
      setAuthRequired(false);
      setSaveStatus("平台 API 已连接");
    } catch (error) {
      if (handleAuthError(error)) return;
      setSaveStatus(error.message || "平台 API 连接失败");
    }
  }

  function saveAdminToken(event) {
    event.preventDefault();
    const token = adminTokenInput.trim();
    if (!token) {
      setSaveStatus("后台 API Token 不能为空");
      return;
    }
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    setAdminToken(token);
    setAuthRequired(false);
    initialize(token);
  }

  function clearAdminToken() {
    clearStoredAuthSession();
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken("");
    setAdminTokenInput("");
    setAuthRequired(true);
    setBusinesses([]);
    setSaveStatus("已退出登录");
  }

  async function issuePortalTokenForBusiness(businessId) {
    setSaveStatus(`正在为 ${businessId} 生成企业 Token...`);
    try {
      const payload = await requestAdminJson(`/api/admin/businesses/${encodeURIComponent(businessId)}/tokens/portal`, { method: "POST" });
      setPortalTokenResult({ businessId, token: payload.token || "" });
      await initialize();
      setSaveStatus("企业 Token 已生成，只会显示这一次。");
    } catch (error) {
      if (handleAuthError(error)) return;
      setSaveStatus(error.message || "企业 Token 生成失败");
    }
  }

  async function resetBusinessData(businessId) {
    if (!window.confirm(`确认重置企业 ${businessId} 的演示数据？此操作会清空当前配置、FAQ、线索和会话。`)) return;

    setSaveStatus(`正在重置 ${businessId}...`);
    try {
      await requestAdminJson(`/api/admin/businesses/${encodeURIComponent(businessId)}/reset`, { method: "POST" });
      setPortalTokenResult((current) => current.businessId === businessId ? { businessId: "", token: "" } : current);
      await initialize();
      setSaveStatus("企业数据已重置");
    } catch (error) {
      if (handleAuthError(error)) return;
      setSaveStatus(error.message || "企业数据重置失败");
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafd]">
      <header className="sticky top-0 z-20 border-b border-[#dadce0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[#202124] text-white shadow-sm">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="eyebrow">Platform Admin</p>
              <h1 className="text-2xl font-black text-[#202124]">平台运营后台</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-white">
              {authRequired ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
              {saveStatus}
            </span>
            <button className="btn-secondary" type="button" onClick={() => initialize()}>
              <RefreshCw className="size-4" />
              刷新企业
            </button>
            {adminToken ? (
              <button className="btn-secondary" type="button" onClick={clearAdminToken}>
                <ShieldCheck className="size-4" />
                退出登录
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-5">
        {(authRequired || !adminToken) ? (
          <section className="mb-5 rounded-2xl border border-[#f1d3a8] bg-[#fff8ec] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-[#202124]">需要登录后进入平台运营后台</p>
                <p className="mt-1 text-sm leading-6 text-[#5f6368]">运营管理员使用统一登录页登录，登录后会直接进入 `/admin`。</p>
              </div>
              <a className="btn-primary shrink-0" href="/login">
                <ShieldCheck className="size-4" />
                前往登录
              </a>
            </div>
          </section>
        ) : null}

        <section className="mb-5 overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-black text-[#1a73e8]">
                  <Database className="size-4" />
                  PostgreSQL 多企业数据
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e6f4ea] px-3 py-1 text-xs font-black text-[#188038]">
                  <ShieldCheck className="size-4" />
                  平台级控制台
                </span>
              </div>
              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-[#202124] sm:text-4xl">
                监控已存在企业客户，控制访问 Token 和演示数据。
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6368]">
                智能问答、企业后台、嵌入组件、知识库、销售线索、嵌入代码和运营可视化已经放到企业客户工作台。这里保留平台视角的企业监控和控制动作。
              </p>
            </div>
            <div className="border-t border-[#dadce0] bg-[#f8fafd] p-5 lg:border-l lg:border-t-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniMetric label="企业客户" value={totals.businesses || 0} />
                <MiniMetric label="工作台 Token" value={totals.portalTokens || 0} />
                <MiniMetric label="总消息" value={totals.messages || 0} />
                <MiniMetric label="总线索" value={totals.leads || 0} />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={UserCheck} label="企业客户" value={totals.businesses || 0} hint={`${totals.portalTokens || 0} 个已开通企业工作台`} color="#4285F4" />
          <MetricCard icon={MessageSquare} label="对话消息" value={totals.messages || 0} hint={`${totals.resolved || 0} 已解决 / ${totals.escalated || 0} 转人工`} color="#34A853" />
          <MetricCard icon={Database} label="知识库" value={totals.faqs || 0} hint={`未命中 ${totals.unmatched || 0} 条`} color="#FBBC04" />
          <MetricCard icon={TrendingUp} label="总销售线索" value={totals.leads || 0} hint={`整体解决率 ${totals.resolveRate || 0}%`} color="#EA4335" />
        </section>

        {portalTokenResult.token ? (
          <Panel className="mb-5 border-[#d2e3fc] bg-[#f8fbff]">
            <SectionHeader
              eyebrow="企业访问"
              title={`新企业 Token：${portalTokenResult.businessId}`}
              description="明文只在生成时返回一次，请交给对应企业用户保存。"
              icon={ShieldCheck}
            />
            <textarea className="field-textarea min-h-20 font-mono text-xs" value={portalTokenResult.token} readOnly />
            <label className="field-label mt-3">
              企业工作台地址
              <input className="field-control font-mono text-xs" value={`${publicBase}/portal?businessId=${encodeURIComponent(portalTokenResult.businessId)}`} readOnly />
            </label>
          </Panel>
        ) : null}

        <Panel>
          <SectionHeader
            eyebrow="企业监控"
            title="已存在企业客户"
            description="平台后台只保留企业级监控和控制。进入企业工作台后，企业用户自行管理问答、知识库、组件和线索。"
            icon={BarChart3}
          />

          {businesses.length === 0 ? (
            <EmptyState text="当前没有可展示的企业客户，或尚未连接后台 API Token。" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {businesses.map((business) => (
                <BusinessMonitorCard
                  key={business.id}
                  business={business}
                  portalUrl={`${publicBase}/portal?businessId=${encodeURIComponent(business.id)}`}
                  onIssueToken={() => issuePortalTokenForBusiness(business.id)}
                  onReset={() => resetBusinessData(business.id)}
                />
              ))}
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}

function AdminApp() {
  const [adminToken, setAdminToken] = useState(() => readInitialAdminToken());
  const [adminTokenInput, setAdminTokenInput] = useState(() => readInitialAdminToken());
  const [authRequired, setAuthRequired] = useState(false);
  const [portalToken, setPortalToken] = useState("");
  const [portalTokenStatus, setPortalTokenStatus] = useState("");
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
  const [messages, setMessages] = useState(() => seedMessages(getPreviewCompany(defaultState.company)));
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
  const portalUrl = `${publicBase}/portal?businessId=${encodeURIComponent(BUSINESS_ID)}`;
  const widgetConfig = state.company.widget || defaultState.company.widget;
  const widgetQuickReplies = Array.isArray(widgetConfig.quickQuestions)
    ? widgetConfig.quickQuestions
    : defaultState.company.widget.quickQuestions;
  const embedCode = `<script src="${escapeEmbedAttribute(publicBase)}/widget/nimble-widget.js"
  data-business-id="${escapeEmbedAttribute(BUSINESS_ID)}"
  data-api-base="${escapeEmbedAttribute(publicBase)}"
  data-public-token="${escapeEmbedAttribute(state.publicToken)}"
  data-reply-mode="${escapeEmbedAttribute(state.settings.replyMode)}"
  data-widget-name="${escapeEmbedAttribute(widgetConfig.name)}"
  data-color="${escapeEmbedAttribute(widgetConfig.themeColor)}"
  data-position="${escapeEmbedAttribute(widgetConfig.position)}"
  data-welcome="${escapeEmbedAttribute(widgetConfig.welcome)}"
  data-quick-questions="${escapeEmbedAttribute(widgetQuickReplies.join("|"))}"></script>`;
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

  async function initialize(token = adminToken) {
    setSaveStatus("正在连接 API...");
    await refreshAiStatus();

    try {
      const payload = await requestAdminJson(businessPath, {}, token);
      const nextState = normalizeState(payload.business);
      setState(nextState);
      setMessages(seedMessages(getPreviewCompany(nextState.company)));
      setApiOnline(true);
      setAuthRequired(false);
      setSaveStatus("API 已连接");
    } catch (error) {
      if (handleAuthError(error)) return;
      const localState = loadLocalState();
      setState(localState);
      setMessages(seedMessages(getPreviewCompany(localState.company)));
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

  function withAdminAuth(options = {}, token = adminToken) {
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
  }

  function requestAdminJson(path, options = {}, token = adminToken) {
    return requestJson(API_BASE, path, withAdminAuth(options, token));
  }

  function handleAuthError(error) {
    if (error && error.status === 401) {
      setAuthRequired(true);
      setApiOnline(false);
      setSaveStatus("请输入后台 API Token 后继续");
      return true;
    }
    return false;
  }

  function saveAdminToken(event) {
    event.preventDefault();
    const token = adminTokenInput.trim();
    if (!token) {
      setSaveStatus("后台 API Token 不能为空");
      return;
    }
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    setAdminToken(token);
    setAuthRequired(false);
    initialize(token);
  }

  function clearAdminToken() {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken("");
    setAdminTokenInput("");
    setAuthRequired(true);
    setApiOnline(false);
    setSaveStatus("后台 API Token 已清除");
  }

  async function issuePortalToken() {
    if (!adminToken) {
      setPortalTokenStatus("请先连接后台 API Token");
      setAuthRequired(true);
      return;
    }

    setPortalTokenStatus("正在生成企业 Token...");
    try {
      const payload = await requestAdminJson(`${businessPath}/tokens/portal`, { method: "POST" });
      setPortalToken(payload.token || "");
      setPortalTokenStatus("企业 Token 已生成，只会显示这一次。");
    } catch (error) {
      if (handleAuthError(error)) return;
      setPortalTokenStatus(error.message || "企业 Token 生成失败");
    }
  }

  function scheduleCompanySave(nextState) {
    window.clearTimeout(saveTimerRef.current);
    setSaveStatus(apiOnlineRef.current ? "保存中..." : "保存到本地...");
    saveTimerRef.current = window.setTimeout(() => saveCompany(nextState), 420);
  }

  async function saveCompany(nextState) {
    if (apiOnlineRef.current) {
      try {
        const response = await requestAdminJson(`${businessPath}/company`, {
          method: "PUT",
          body: JSON.stringify({ company: nextState.company, settings: nextState.settings })
        });
        const normalized = normalizeState(response.business);
        setState(normalized);
        setSaveStatus("企业配置已同步到 API");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
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
    if (field === "welcome") {
      setMessages((current) => (current.length <= 2 ? seedMessages(getPreviewCompany(nextState.company)) : current));
    }
    scheduleCompanySave(nextState);
  }

  function updateWidgetField(field, value) {
    const nextState = normalizeState({
      ...state,
      company: {
        ...state.company,
        widget: { ...widgetConfig, [field]: value }
      }
    });
    setState(nextState);
    scheduleCompanySave(nextState);
  }

  function updateWidgetQuickQuestion(index, value) {
    const quickQuestions = [...widgetQuickReplies];
    quickQuestions[index] = value;
    const nextState = {
      ...state,
      company: {
        ...state.company,
        widget: { ...widgetConfig, quickQuestions }
      }
    };
    setState(nextState);
    scheduleCompanySave(normalizeState(nextState));
  }

  function addWidgetQuickQuestion() {
    const nextState = normalizeState({
      ...state,
      company: {
        ...state.company,
        widget: {
          ...widgetConfig,
          quickQuestions: [...widgetQuickReplies, "我要预约演示"].slice(0, 6)
        }
      }
    });
    setState(nextState);
    scheduleCompanySave(nextState);
  }

  function removeWidgetQuickQuestion(index) {
    const nextState = normalizeState({
      ...state,
      company: {
        ...state.company,
        widget: {
          ...widgetConfig,
          quickQuestions: widgetQuickReplies.filter((_, itemIndex) => itemIndex !== index)
        }
      }
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
        const response = await requestAdminJson(`${businessPath}/faqs`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setState(normalizeState(response.business));
        setFaqDraft({ question: "", tags: "", answer: "" });
        setSaveStatus("知识库已同步到 API");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
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
        const response = await requestAdminJson(`${businessPath}/faqs/${encodeURIComponent(faqId)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setState(normalizeState(response.business));
        setEditingFaqId("");
        setSaveStatus("知识库已更新");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
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
        const response = await requestAdminJson(`${businessPath}/faqs/${encodeURIComponent(faqId)}`, {
          method: "DELETE"
        });
        setState(normalizeState(response.business));
        setSaveStatus("知识库已同步到 API");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
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
        const response = await requestAdminJson(`${businessPath}/unmatched/${encodeURIComponent(questionId)}`, {
          method: "DELETE"
        });
        setState(normalizeState(response.business));
        setSaveStatus("未命中问题已忽略");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
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
        const response = await requestAdminJson(`${businessPath}/reset`, { method: "POST" });
        const nextState = normalizeState(response.business);
        setState(nextState);
        setMessages(seedMessages(getPreviewCompany(nextState.company)));
        setLeadCapture({ awaiting: false, intent: "" });
        setBotMode("智能问答");
        setAiStatus((current) => ({ ...current, lastReplySource: "尚未对话" }));
        setSaveStatus("已重置 API 演示数据");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
        setApiOnline(false);
        setSaveStatus("API 重置失败，已切到本地演示");
      }
    }

    const nextState = clone(defaultState);
    setState(nextState);
    setMessages(seedMessages(getPreviewCompany(nextState.company)));
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
        const response = await fetch(`${API_BASE}${businessPath}/leads/export`, withAdminAuth());
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        const blob = await response.blob();
        const filename = getDownloadFilename(response.headers.get("Content-Disposition")) || fallbackFilename;
        downloadBlob(blob, filename);
        setSaveStatus(state.leads.length === 0 ? "暂无线索，已导出空 CSV" : "销售线索 CSV 已导出");
        return;
      } catch (error) {
        if (handleAuthError(error)) return;
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
      const response = await requestAdminJson(`${businessPath}/conversations/${encodeURIComponent(lead.conversationId)}`);
      setLeadDetail({
        lead,
        conversation: response.conversation,
        loading: false,
        error: ""
      });
    } catch (error) {
      if (handleAuthError(error)) return;
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
        const response = await requestAdminJson(`${businessPath}/chat`, {
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
        if (handleAuthError(error)) {
          setChatPending(false);
          return;
        }
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
            {adminToken ? (
              <button className="btn-secondary" type="button" onClick={clearAdminToken}>
                <ShieldCheck className="size-4" />
                清除 Token
              </button>
            ) : null}
            <button className="btn-primary" type="button" onClick={exportConfig}>
              <Download className="size-4" />
              导出配置
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-5">
        {(authRequired || !adminToken) ? (
          <section className="mb-5 rounded-2xl border border-[#f1d3a8] bg-[#fff8ec] p-4">
            <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={saveAdminToken}>
              <label className="field-label flex-1">
                后台 API Token
                <input
                  className="field-control"
                  type="password"
                  value={adminTokenInput}
                  onChange={(event) => setAdminTokenInput(event.target.value)}
                  placeholder="粘贴 D:\\CustomerRobot\\ADMIN_API_TOKEN.txt 中的 token"
                />
              </label>
              <button className="btn-primary shrink-0" type="submit">
                <ShieldCheck className="size-4" />
                连接后台
              </button>
            </form>
          </section>
        ) : null}

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
                eyebrow="嵌入组件"
                title="样式配置"
                description="配置客户网站右下角客服组件的品牌展示，保存后嵌入脚本会自动读取最新配置。"
                icon={Globe2}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="field-label">
                  客服名称
                  <input
                    className="field-control"
                    value={widgetConfig.name}
                    onChange={(event) => updateWidgetField("name", event.target.value)}
                    placeholder="例如：数智云在线客服"
                  />
                </label>
                <label className="field-label">
                  按钮位置
                  <select
                    className="field-control"
                    value={widgetConfig.position}
                    onChange={(event) => updateWidgetField("position", event.target.value)}
                  >
                    {widgetPositions.map((position) => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label md:col-span-2">
                  主题色
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[#dadce0] bg-white p-1"
                      type="color"
                      value={widgetConfig.themeColor}
                      onChange={(event) => updateWidgetField("themeColor", event.target.value)}
                      aria-label="选择组件主题色"
                    />
                    <input
                      className="field-control max-w-36 font-mono"
                      value={widgetConfig.themeColor}
                      readOnly
                      aria-label="当前组件主题色"
                    />
                    {widgetColorPresets.map((color) => (
                      <button
                        key={color}
                        className={cn(
                          "size-9 rounded-full border-2 transition",
                          widgetConfig.themeColor === color ? "border-[#202124]" : "border-white"
                        )}
                        style={{ backgroundColor: color }}
                        type="button"
                        onClick={() => updateWidgetField("themeColor", color)}
                        aria-label={`使用主题色 ${color}`}
                      />
                    ))}
                  </div>
                </label>
                <label className="field-label md:col-span-2">
                  组件欢迎语
                  <textarea
                    className="field-textarea min-h-20"
                    value={widgetConfig.welcome}
                    onChange={(event) => updateWidgetField("welcome", event.target.value)}
                    placeholder="客户打开组件后看到的第一句话"
                  />
                </label>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-[#5f6368]">快捷问题</p>
                  <button
                    className="btn-secondary min-h-9 px-3"
                    type="button"
                    onClick={addWidgetQuickQuestion}
                    disabled={widgetQuickReplies.length >= 6}
                  >
                    <Plus className="size-4" />
                    添加
                  </button>
                </div>
                <div className="grid gap-2">
                  {widgetQuickReplies.map((question, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        className="field-control"
                        value={question}
                        onChange={(event) => updateWidgetQuickQuestion(index, event.target.value)}
                        placeholder="例如：怎么收费？"
                      />
                      <button
                        className="btn-secondary shrink-0 px-3"
                        type="button"
                        onClick={() => removeWidgetQuickQuestion(index)}
                        aria-label="删除快捷问题"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
              <div className="border-b border-[#dadce0] p-4 text-white" style={{ backgroundColor: widgetConfig.themeColor }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-lg bg-white/15">
                      <Bot className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black">{widgetConfig.name}</h2>
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
                  {widgetQuickReplies.map((sample) => (
                    <button
                      key={sample}
                      className="rounded-full border border-[#dadce0] bg-white px-2.5 py-1.5 text-xs font-bold hover:bg-[#f8fafd]"
                      style={{ color: widgetConfig.themeColor }}
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
                eyebrow="企业访问"
                title="企业工作台 Token"
                description="给企业客户生成单独的访问 Token，用于登录 /portal 管理自己的配置、知识库和线索。"
                icon={ShieldCheck}
                action={
                  <button className="btn-primary" type="button" onClick={issuePortalToken}>
                    <ShieldCheck className="size-4" />
                    生成/轮换
                  </button>
                }
              />
              <label className="field-label">
                企业工作台地址
                <input className="field-control font-mono text-xs" value={portalUrl} readOnly />
              </label>
              {portalToken ? (
                <label className="field-label mt-3">
                  新企业 Token
                  <textarea className="field-textarea min-h-20 font-mono text-xs" value={portalToken} readOnly />
                </label>
              ) : null}
              {portalTokenStatus ? <p className="mt-3 text-xs font-bold text-[#5f6368]">{portalTokenStatus}</p> : null}
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

function PortalApp() {
  const [portalToken, setPortalToken] = useState(() => readInitialPortalToken());
  const [portalTokenInput, setPortalTokenInput] = useState(() => readInitialPortalToken());
  const [authRequired, setAuthRequired] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在连接企业 API...");
  const [state, setState] = useState(() => clone(defaultState));
  const [faqDraft, setFaqDraft] = useState({ question: "", tags: "", answer: "" });
  const [editingFaqId, setEditingFaqId] = useState("");
  const [editDraft, setEditDraft] = useState({ question: "", tags: "", answer: "" });
  const [leadDetail, setLeadDetail] = useState({
    lead: null,
    conversation: null,
    loading: false,
    error: ""
  });
  const [botMode, setBotMode] = useState("智能问答");
  const [messages, setMessages] = useState(() => seedMessages(getPreviewCompany(defaultState.company)));
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [activePortalSection, setActivePortalSection] = useState("overview");
  const visitorIdRef = useRef(getOrCreateVisitorId(`nimble-portal-preview-visitor-${BUSINESS_ID}`));
  const chatScrollRef = useRef(null);
  const faqEditorRef = useRef(null);
  const faqAnswerRef = useRef(null);

  const publicBase = getPublicBase(API_BASE);
  const widgetConfig = state.company.widget || defaultState.company.widget;
  const widgetQuickReplies = Array.isArray(widgetConfig.quickQuestions)
    ? widgetConfig.quickQuestions
    : defaultState.company.widget.quickQuestions;
  const embedCode = `<script src="${escapeEmbedAttribute(publicBase)}/widget/nimble-widget.js"
  data-business-id="${escapeEmbedAttribute(BUSINESS_ID)}"
  data-api-base="${escapeEmbedAttribute(publicBase)}"
  data-public-token="${escapeEmbedAttribute(state.publicToken)}"
  data-reply-mode="${escapeEmbedAttribute(state.settings.replyMode)}"
  data-widget-name="${escapeEmbedAttribute(widgetConfig.name)}"
  data-color="${escapeEmbedAttribute(widgetConfig.themeColor)}"
  data-position="${escapeEmbedAttribute(widgetConfig.position)}"
  data-welcome="${escapeEmbedAttribute(widgetConfig.welcome)}"
  data-quick-questions="${escapeEmbedAttribute(widgetQuickReplies.join("|"))}"></script>`;
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
      resolveRate: calculateResolveRate(state.stats),
      funnel: [
        { label: "对话消息", value: messagesCount, color: "#4285F4" },
        { label: "自动解决", value: resolvedCount, color: "#34A853" },
        { label: "转人工", value: escalatedCount, color: "#FBBC04" },
        { label: "销售线索", value: leadsCount, color: "#EA4335" }
      ]
    };
  }, [state.stats, state.leads, state.faqs.length, state.unmatchedQuestions.length]);
  const portalSections = [
    { id: "overview", label: "运营可视化", description: "数据总览", icon: BarChart3, badge: `${dashboard.resolveRate}%` },
    { id: "chat", label: "智能问答", description: "在线测试", icon: MessageSquare, badge: botMode },
    { id: "settings", label: "企业后台", description: "资料与知识库", icon: Settings2 },
    { id: "widget", label: "嵌入组件", description: "品牌样式", icon: Globe2 },
    { id: "embed", label: "客户网站嵌入代码", description: "复制脚本", icon: ClipboardCopy },
    { id: "leads", label: "销售线索", description: `${dashboard.leadsCount} 条线索`, icon: UserCheck }
  ];
  const activePortalItem = portalSections.find((section) => section.id === activePortalSection) || portalSections[0];
  const ActivePortalIcon = activePortalItem.icon;

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    const chatScroll = chatScrollRef.current;
    if (!chatScroll) return;

    window.requestAnimationFrame(() => {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    });
  }, [messages, activePortalSection]);

  function withPortalAuth(options = {}, token = portalToken) {
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
  }

  function requestPortalJson(path, options = {}, token = portalToken) {
    return requestJson(API_BASE, path, withPortalAuth(options, token));
  }

  function handlePortalAuthError(error) {
    if (error && error.status === 401) {
      setAuthRequired(true);
      setApiOnline(false);
      setSaveStatus("请先登录后继续");
      return true;
    }
    return false;
  }

  function savePortalToken(event) {
    event.preventDefault();
    const token = portalTokenInput.trim();
    if (!token) {
      setSaveStatus("企业 API Token 不能为空");
      return;
    }
    window.localStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, token);
    setPortalToken(token);
    setAuthRequired(false);
    initialize(token);
  }

  function clearPortalToken() {
    clearStoredAuthSession();
    window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
    setPortalToken("");
    setPortalTokenInput("");
    setAuthRequired(true);
    setApiOnline(false);
    setSaveStatus("已退出登录");
  }

  async function initialize(token = portalToken) {
    setSaveStatus("正在连接企业 API...");
    try {
      const payload = await requestPortalJson(portalBusinessPath, {}, token);
      const nextState = normalizeState(payload.business);
      setState(nextState);
      setMessages(seedMessages(getPreviewCompany(nextState.company)));
      setAuthRequired(false);
      setApiOnline(true);
      setSaveStatus("企业 API 已连接");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setApiOnline(false);
      setSaveStatus(error.message || "企业 API 连接失败");
    }
  }

  async function saveBusinessConfig(nextState = state) {
    try {
      setSaveStatus("正在保存企业配置...");
      const response = await requestPortalJson(`${portalBusinessPath}/company`, {
        method: "PUT",
        body: JSON.stringify({ company: nextState.company, settings: nextState.settings })
      });
      setState(normalizeState(response.business));
      setApiOnline(true);
      setSaveStatus("企业配置已保存");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setSaveStatus(error.message || "企业配置保存失败");
    }
  }

  function updateCompanyField(field, value) {
    setState((current) => ({
      ...current,
      company: {
        ...current.company,
        [field]: value
      }
    }));
  }

  function updateSettingField(field, value) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [field]: value
      }
    }));
  }

  function updateWidgetField(field, value) {
    setState((current) => {
      const currentWidget = current.company.widget || defaultState.company.widget;
      return {
        ...current,
        company: {
          ...current.company,
          widget: { ...currentWidget, [field]: value }
        }
      };
    });
  }

  function updateWidgetQuickQuestion(index, value) {
    const quickQuestions = [...widgetQuickReplies];
    quickQuestions[index] = value.slice(0, 40);
    setState((current) => ({
      ...current,
      company: {
        ...current.company,
        widget: { ...(current.company.widget || defaultState.company.widget), quickQuestions }
      }
    }));
  }

  function addWidgetQuickQuestion() {
    setState((current) => ({
      ...current,
      company: {
        ...current.company,
        widget: {
          ...(current.company.widget || defaultState.company.widget),
          quickQuestions: [...widgetQuickReplies, "我要预约演示"].slice(0, 6)
        }
      }
    }));
  }

  function removeWidgetQuickQuestion(index) {
    setState((current) => ({
      ...current,
      company: {
        ...current.company,
        widget: {
          ...(current.company.widget || defaultState.company.widget),
          quickQuestions: widgetQuickReplies.filter((_, itemIndex) => itemIndex !== index)
        }
      }
    }));
  }

  async function createFaq(event) {
    event.preventDefault();
    const question = faqDraft.question.trim();
    const answer = faqDraft.answer.trim();
    if (!question || !answer) {
      setSaveStatus("FAQ 问题和答案不能为空");
      return;
    }

    try {
      setSaveStatus("正在添加 FAQ...");
      const response = await requestPortalJson(`${portalBusinessPath}/faqs`, {
        method: "POST",
        body: JSON.stringify({ question, answer, tags: splitTags(faqDraft.tags) })
      });
      setState(normalizeState(response.business));
      setFaqDraft({ question: "", tags: "", answer: "" });
      setSaveStatus("FAQ 已添加");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setSaveStatus(error.message || "FAQ 添加失败");
    }
  }

  function startEditFaq(faq) {
    setEditingFaqId(faq.id);
    setEditDraft({
      question: faq.question,
      answer: faq.answer,
      tags: Array.isArray(faq.tags) ? faq.tags.join(", ") : ""
    });
  }

  async function updateFaq(faqId, event) {
    event.preventDefault();
    const question = editDraft.question.trim();
    const answer = editDraft.answer.trim();
    if (!question || !answer) {
      setSaveStatus("FAQ 问题和答案不能为空");
      return;
    }

    try {
      setSaveStatus("正在保存 FAQ...");
      const response = await requestPortalJson(`${portalBusinessPath}/faqs/${encodeURIComponent(faqId)}`, {
        method: "PUT",
        body: JSON.stringify({ question, answer, tags: splitTags(editDraft.tags) })
      });
      setState(normalizeState(response.business));
      setEditingFaqId("");
      setSaveStatus("FAQ 已保存");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setSaveStatus(error.message || "FAQ 保存失败");
    }
  }

  async function deleteFaq(faqId) {
    try {
      setSaveStatus("正在删除 FAQ...");
      const response = await requestPortalJson(`${portalBusinessPath}/faqs/${encodeURIComponent(faqId)}`, { method: "DELETE" });
      setState(normalizeState(response.business));
      setSaveStatus("FAQ 已删除");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setSaveStatus(error.message || "FAQ 删除失败");
    }
  }

  function fillFaqFromUnmatched(question) {
    setActivePortalSection("settings");
    setFaqDraft({
      question: question.question,
      tags: "未命中, 待优化",
      answer: ""
    });
    setSaveStatus("已填入 FAQ 表单，请补充标准答案");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        faqEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => {
          faqAnswerRef.current?.focus({ preventScroll: true });
        }, 250);
      });
    });
  }

  async function deleteUnmatched(questionId) {
    try {
      const response = await requestPortalJson(`${portalBusinessPath}/unmatched/${encodeURIComponent(questionId)}`, { method: "DELETE" });
      setState(normalizeState(response.business));
      setSaveStatus("未命中问题已忽略");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setSaveStatus(error.message || "未命中问题删除失败");
    }
  }

  async function exportLeadsCsv() {
    try {
      const response = await fetch(`${API_BASE}${portalBusinessPath}/leads/export`, withPortalAuth());
      if (!response.ok) {
        const error = new Error("线索导出失败");
        error.status = response.status;
        throw error;
      }
      const blob = await response.blob();
      downloadBlob(blob, getDownloadFilename(response.headers.get("content-disposition"), `sales-leads-${timestampForFilename()}.csv`));
      setSaveStatus("线索 CSV 已导出");
    } catch (error) {
      if (handlePortalAuthError(error)) return;
      setSaveStatus(error.message || "线索导出失败");
    }
  }

  async function openLeadDetail(lead) {
    setLeadDetail({ lead, conversation: null, loading: true, error: "" });
    if (!lead.conversationId) {
      setLeadDetail({ lead, conversation: null, loading: false, error: "这条线索没有关联会话 ID。" });
      return;
    }

    try {
      const response = await requestPortalJson(`${portalBusinessPath}/conversations/${encodeURIComponent(lead.conversationId)}`);
      setLeadDetail({ lead, conversation: response.conversation, loading: false, error: "" });
    } catch (error) {
      setLeadDetail({
        lead,
        conversation: null,
        loading: false,
        error: error.message || "聊天记录加载失败，先展示线索摘要。"
      });
    }
  }

  function closeLeadDetail() {
    setLeadDetail({ lead: null, conversation: null, loading: false, error: "" });
  }

  function changePortalSection(sectionId) {
    setActivePortalSection(sectionId);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 });
    });
  }

  async function copyEmbedCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setSaveStatus("嵌入代码已复制");
    } catch (error) {
      setSaveStatus("复制失败，请手动复制嵌入代码");
    }
  }

  async function sendPortalChatMessage(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || chatPending) return;

    const pendingId = createId();
    setChatInput("");
    setChatPending(true);
    setMessages((current) => [
      ...current,
      { id: createId(), role: "user", text },
      { id: pendingId, role: "bot", text: "正在生成回复...", loading: true }
    ]);

    try {
      const response = await requestPortalJson(`${portalBusinessPath}/chat`, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          visitorId: visitorIdRef.current,
          source: "portal-preview"
        })
      });
      setMessages((current) => current.map((message) => (
        message.id === pendingId
          ? { ...message, text: response.reply.text, loading: false }
          : message
      )));
      setBotMode(response.reply.mode || "智能问答");
      const refreshed = await requestPortalJson(portalBusinessPath);
      setState(normalizeState(refreshed.business));
      setSaveStatus("智能问答已记录");
    } catch (error) {
      setMessages((current) => current.map((message) => (
        message.id === pendingId
          ? { ...message, text: error.message || "发送失败，请稍后重试。", loading: false }
          : message
      )));
      if (!handlePortalAuthError(error)) {
        setSaveStatus(error.message || "智能问答发送失败");
      }
    } finally {
      setChatPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafd]">
      <header className="sticky top-0 z-30 border-b border-[#dadce0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-[#1a73e8] text-white shadow-sm">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-4 text-[#5f6368]">Business Portal</p>
              <h1 className="text-xl font-black leading-7 text-[#202124]">企业客户工作台</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-black text-[#5f6368] shadow-sm">
              <ActivePortalIcon className="size-3.5" />
              当前模块：{activePortalItem.label}
            </span>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-black text-[#5f6368] shadow-sm">
              {apiOnline ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              {saveStatus}
            </span>
            <button className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-2.5 py-1.5 text-xs font-black text-[#3c4043] transition hover:bg-[#f8fafd]" type="button" onClick={() => initialize()}>
              <RefreshCw className="size-3.5" />
              刷新
            </button>
            {portalToken ? (
              <button className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-2.5 py-1.5 text-xs font-black text-[#3c4043] transition hover:bg-[#f8fafd]" type="button" onClick={clearPortalToken}>
                <ShieldCheck className="size-3.5" />
                退出登录
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-5">
        {(authRequired || !portalToken) ? (
          <section className="mb-5 rounded-2xl border border-[#f1d3a8] bg-[#fff8ec] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-[#202124]">需要登录后进入企业工作台</p>
                <p className="mt-1 text-sm leading-6 text-[#5f6368]">企业用户使用统一登录页登录，登录后会直接进入自己的工作台。</p>
              </div>
              <a className="btn-primary shrink-0" href="/login">
                <ShieldCheck className="size-4" />
                前往登录
              </a>
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-[92px] lg:h-[calc(100vh-112px)]">
            <section className="flex h-full flex-col rounded-2xl border border-[#dadce0] bg-white p-4 shadow-sm">
              <div className="rounded-xl bg-[#f8fafd] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#e8f0fe] text-[#1a73e8]">
                    <Bot className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#202124]">{state.company.name || "企业客户"}</p>
                  </div>
                </div>
              </div>

              <nav className="mt-4 grid gap-2 overflow-y-auto pr-1">
                {portalSections.map((section) => {
                  const Icon = section.icon;
                  const active = activePortalSection === section.id;
                  return (
                    <button
                      key={section.id}
                      data-portal-section={section.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                        active
                          ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                          : "border-transparent bg-white text-[#3c4043] hover:border-[#dadce0] hover:bg-[#f8fafd]"
                      )}
                      type="button"
                      onClick={() => changePortalSection(section.id)}
                    >
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-white" : "bg-[#f8fafd]")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{section.label}</span>
                        <span className={cn("mt-0.5 block truncate text-xs font-bold", active ? "text-[#1a73e8]" : "text-[#5f6368]")}>
                          {section.description}
                        </span>
                      </span>
                      {section.badge ? (
                        <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", active ? "bg-white text-[#1a73e8]" : "bg-[#f1f3f4] text-[#5f6368]")}>
                          {section.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>

            </section>
          </aside>

          <section className="min-w-0">
            {activePortalSection === "overview" ? (
              <div className="space-y-5">
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard icon={MessageSquare} label="对话消息" value={dashboard.messagesCount} hint="来自当前企业机器人" color="#4285F4" />
                  <MetricCard icon={CheckCircle2} label="自动解决率" value={`${dashboard.resolveRate}%`} hint={`${dashboard.resolvedCount} 已解决 / ${dashboard.escalatedCount} 转人工`} tone="ok" color="#34A853" />
                  <MetricCard icon={Database} label="知识库" value={dashboard.faqCount} hint={`未命中 ${dashboard.unmatchedCount} 条`} color="#FBBC04" />
                  <MetricCard icon={UserCheck} label="销售线索" value={dashboard.leadsCount} hint={`知识覆盖 ${dashboard.coverageRate}%`} color="#EA4335" />
                </section>

                <Panel>
                  <SectionHeader
                    eyebrow="运营可视化"
                    title="运营可视化总览"
                    description="企业用户可以直接查看当前机器人在对话、自动解决、转人工、销售线索和知识覆盖上的表现。"
                    icon={BarChart3}
                    action={<span className="badge bg-[#e8f0fe] text-[#1a73e8]">当前企业数据</span>}
                  />
                  <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
                    <ResolutionDonut value={dashboard.resolveRate} resolved={dashboard.resolvedCount} escalated={dashboard.escalatedCount} />
                    <FunnelChart items={dashboard.funnel} />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                      <IntentBars counts={dashboard.intentCounts} />
                      <KnowledgeCoverage faqCount={dashboard.faqCount} unmatchedCount={dashboard.unmatchedCount} coverageRate={dashboard.coverageRate} />
                    </div>
                  </div>
                </Panel>
              </div>
            ) : null}

            {activePortalSection === "settings" ? (
              <div className="space-y-5">
                <Panel>
                  <SectionHeader
                    eyebrow="知识库说明"
                    title="AI 回答参考知识库"
                    description="当前页面的配置，是 AI 模型回答客户问题时需要参考的知识库介绍。"
                    icon={Database}
                  />
                  <div className="grid gap-2 text-sm text-[#3c4043] md:grid-cols-3">
                    <FeatureLine text="企业资料用于说明业务背景、服务范围和联系方式" />
                    <FeatureLine text="回复规则用于约束 AI 的回答语气、边界和转人工策略" />
                    <FeatureLine text="FAQ 和未命中问题用于沉淀高频问答与待补充知识" />
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader
                    eyebrow="企业配置"
                    title="资料与回复规则"
                    description="保存后会影响客户网站组件、AI 提示词和线索引导话术。"
                    icon={Settings2}
                    action={
                      <button className="btn-primary" type="button" onClick={() => saveBusinessConfig()}>
                        保存配置
                      </button>
                    }
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
                      className="field-textarea min-h-32"
                      value={state.settings.answerRules}
                      onChange={(event) => updateSettingField("answerRules", event.target.value)}
                    />
                  </label>
                </Panel>

                <div ref={faqEditorRef} className="scroll-mt-24">
                  <Panel>
                    <SectionHeader
                      eyebrow="知识库"
                      title="FAQ 编辑"
                      description={`${state.faqs.length} 条标准答案。企业可以一边测试问答，一边补充高频售前问题。`}
                      icon={Database}
                    />

                    <form className="grid gap-3 md:grid-cols-2" onSubmit={createFaq}>
                      <label className="field-label">
                        问题
                        <input className="field-control" value={faqDraft.question} onChange={(event) => setFaqDraft((draft) => ({ ...draft, question: event.target.value }))} />
                      </label>
                      <label className="field-label">
                        标签
                        <input className="field-control" value={faqDraft.tags} onChange={(event) => setFaqDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder="价格, 方案, 试用" />
                      </label>
                      <label className="field-label md:col-span-2">
                        标准答案
                        <textarea ref={faqAnswerRef} className="field-textarea" value={faqDraft.answer} onChange={(event) => setFaqDraft((draft) => ({ ...draft, answer: event.target.value }))} />
                      </label>
                      <button className="btn-primary md:col-span-2" type="submit">
                        <Plus className="size-4" />
                        添加到知识库
                      </button>
                    </form>

                    <div className="faq-scroll-panel mt-4 space-y-3">
                      {state.faqs.length === 0 ? (
                        <EmptyState text="还没有常见问题。先添加 5-10 条高频问题，就能开始试点。" />
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
                </div>

                <Panel>
                  <SectionHeader
                    eyebrow="知识优化"
                    title="未命中问题"
                    description={`${state.unmatchedQuestions.length} 条待补充。企业可以把真实问题转成 FAQ。`}
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

              </div>
            ) : null}

            {activePortalSection === "widget" ? (
              <Panel>
                <SectionHeader
                  eyebrow="嵌入组件"
                  title="品牌样式"
                  description="企业可以自行调整组件名称、主题色、位置、欢迎语和快捷问题。"
                  icon={Globe2}
                  action={
                    <button className="btn-primary" type="button" onClick={() => saveBusinessConfig()}>
                      保存样式
                    </button>
                  }
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="field-label">
                    客服名称
                    <input className="field-control" value={widgetConfig.name} onChange={(event) => updateWidgetField("name", event.target.value)} />
                  </label>
                  <label className="field-label">
                    按钮位置
                    <select className="field-control" value={widgetConfig.position} onChange={(event) => updateWidgetField("position", event.target.value)}>
                      {widgetPositions.map((position) => (
                        <option key={position.value} value={position.value}>
                          {position.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label md:col-span-2">
                    主题色
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="h-10 w-14 cursor-pointer rounded-lg border border-[#dadce0] bg-white p-1"
                        type="color"
                        value={widgetConfig.themeColor}
                        onChange={(event) => updateWidgetField("themeColor", event.target.value)}
                      />
                      <input className="field-control max-w-36 font-mono" value={widgetConfig.themeColor} readOnly />
                      {widgetColorPresets.map((color) => (
                        <button
                          key={color}
                          className={cn("size-9 rounded-full border-2 transition", widgetConfig.themeColor === color ? "border-[#202124]" : "border-white")}
                          style={{ backgroundColor: color }}
                          type="button"
                          onClick={() => updateWidgetField("themeColor", color)}
                          aria-label={`使用主题色 ${color}`}
                        />
                      ))}
                    </div>
                  </label>
                  <label className="field-label md:col-span-2">
                    组件欢迎语
                    <textarea className="field-textarea min-h-20" value={widgetConfig.welcome} onChange={(event) => updateWidgetField("welcome", event.target.value)} />
                  </label>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-[#5f6368]">快捷问题</p>
                    <button className="btn-secondary min-h-9 px-3" type="button" onClick={addWidgetQuickQuestion} disabled={widgetQuickReplies.length >= 6}>
                      <Plus className="size-4" />
                      添加
                    </button>
                  </div>
                  <div className="grid gap-2">
                    {widgetQuickReplies.map((question, index) => (
                      <div key={index} className="flex gap-2">
                        <input className="field-control" value={question} onChange={(event) => updateWidgetQuickQuestion(index, event.target.value)} />
                        <button className="btn-secondary shrink-0 px-3" type="button" onClick={() => removeWidgetQuickQuestion(index)} aria-label="删除快捷问题">
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

            ) : null}

            {activePortalSection === "chat" ? (
              <div className="flex justify-center">
                <Panel className="w-full max-w-[560px] overflow-hidden p-0">
                <div className="border-b border-[#dadce0] p-4 text-white" style={{ backgroundColor: widgetConfig.themeColor }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-lg bg-white/15">
                        <Bot className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-white/75">智能问答</p>
                        <h2 className="text-base font-black">{widgetConfig.name}</h2>
                      </div>
                    </div>
                    <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-black">{botMode}</span>
                  </div>
                </div>

                <div ref={chatScrollRef} className="h-[460px] overflow-y-auto overscroll-contain bg-[#f8fafd] p-4">
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <ChatBubble key={message.id} message={message} />
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#dadce0] bg-white p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {widgetQuickReplies.map((sample) => (
                      <button
                        key={sample}
                        className="rounded-full border border-[#dadce0] bg-white px-2.5 py-1.5 text-xs font-bold hover:bg-[#f8fafd]"
                        style={{ color: widgetConfig.themeColor }}
                        type="button"
                        onClick={() => setChatInput(sample)}
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                  <form className="grid gap-2" onSubmit={sendPortalChatMessage}>
                    <input
                      className="field-control"
                      value={chatInput}
                      disabled={chatPending}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder="输入客户问题，例如：怎么收费？"
                    />
                    <button className="btn-primary px-4" type="submit" disabled={chatPending}>
                      {chatPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      发送
                    </button>
                  </form>
                </div>
              </Panel>
              </div>
            ) : null}

            {activePortalSection === "embed" ? (
              <Panel>
                <SectionHeader
                  eyebrow="客户网站"
                  title="嵌入代码"
                  description="复制到企业官网、落地页或 H5 页面，即可展示在线客服入口。"
                  icon={Globe2}
                  action={
                    <button className="btn-secondary" type="button" onClick={copyEmbedCode}>
                      <ClipboardCopy className="size-4" />
                      复制
                    </button>
                  }
                />
                <textarea className="field-textarea min-h-72 font-mono text-xs" value={embedCode} readOnly />
              </Panel>
            ) : null}

            {activePortalSection === "leads" ? (
              <Panel>
                <SectionHeader
                  eyebrow="转化"
                  title="销售线索"
                  description="查看客户留下的联系方式、意向等级和跟进摘要。"
                  icon={UserCheck}
                  action={
                    <button className="btn-secondary" type="button" onClick={exportLeadsCsv}>
                      <Download className="size-4" />
                      导出 CSV
                    </button>
                  }
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniMetric label="对话消息" value={state.stats.messages} />
                  <MiniMetric label="自动解决率" value={`${dashboard.resolveRate}%`} />
                  <MiniMetric label="销售线索" value={state.leads.length} />
                </div>
                <div className="mt-4 space-y-3">
                  {state.leads.length === 0 ? (
                    <EmptyState text="暂无销售线索。客户留下联系方式后，会出现在这里。" />
                  ) : (
                    state.leads.slice(0, 8).map((lead) => <LeadItem key={lead.id} lead={lead} onOpen={() => openLeadDetail(lead)} />)
                  )}
                </div>
              </Panel>
            ) : null}
          </section>
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

export default function App() {
  const pathname = window.location.pathname.toLowerCase();
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return <LoginApp />;
  }
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    return <PortalApp />;
  }
  return <PlatformAdminApp />;
}

function getPreviewCompany(company) {
  const widget = company.widget || defaultState.company.widget;
  return {
    ...company,
    name: widget.name || company.name,
    welcome: widget.welcome || company.welcome
  };
}

function readInitialAdminToken() {
  const urlToken = new URLSearchParams(window.location.search).get("adminToken");
  if (urlToken) {
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, urlToken);
    return urlToken;
  }
  const session = readStoredAuthSession();
  if (session && session.role === "admin") return session.token;
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
}

function readInitialPortalToken() {
  const urlToken = new URLSearchParams(window.location.search).get("portalToken");
  if (urlToken) {
    window.localStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, urlToken);
    return urlToken;
  }
  const session = readStoredAuthSession();
  if (session && session.role === "admin") return session.token;
  if (session && session.role === "portal" && session.businessId === BUSINESS_ID) return session.token;
  return window.localStorage.getItem(PORTAL_TOKEN_STORAGE_KEY) || "";
}

function readStoredAuthSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || typeof session !== "object") return null;
    if (!session.token || !session.role || !session.expiresAt) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      clearStoredAuthSession();
      return null;
    }
    return {
      token: String(session.token),
      role: String(session.role),
      email: String(session.email || ""),
      name: String(session.name || ""),
      businessId: String(session.businessId || ""),
      expiresAt: String(session.expiresAt)
    };
  } catch (error) {
    clearStoredAuthSession();
    return null;
  }
}

function writeStoredAuthSession(session) {
  if (!session || !session.token) return;
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredAuthSession() {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function escapeEmbedAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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

function BusinessMonitorCard({ business, portalUrl, onIssueToken, onReset }) {
  return (
    <article className="rounded-2xl border border-[#dadce0] bg-[#f8fafd] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-[#202124]">{business.companyName}</h3>
            <span className="rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-black text-[#5f6368]">
              {business.id}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#5f6368]">
            {business.industry || "未设置行业"} · {getReplyModeLabel(business.replyMode)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-black",
              business.portalTokenActive
                ? "border-[#ceead6] bg-[#e6f4ea] text-[#188038]"
                : "border-[#f1d3a8] bg-[#fff8ec] text-[#9a5b05]"
            )}>
              {business.portalTokenActive ? "企业 Token 已开通" : "未开通企业 Token"}
            </span>
            <span className="rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-black text-[#5f6368]">
              域名白名单 {business.allowedOriginsCount || 0}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={portalUrl} target="_blank" rel="noreferrer">
            <Globe2 className="size-4" />
            企业工作台
          </a>
          <button className="btn-primary" type="button" onClick={onIssueToken}>
            <ShieldCheck className="size-4" />
            生成 Token
          </button>
          <button className="btn-danger" type="button" onClick={onReset}>
            <RefreshCw className="size-4" />
            重置
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MiniMetric label="消息" value={business.messages} />
        <MiniMetric label="解决率" value={`${business.resolveRate || 0}%`} />
        <MiniMetric label="线索" value={business.leads} />
        <MiniMetric label="FAQ" value={business.faqs} />
        <MiniMetric label="未命中" value={business.unmatched} />
        <MiniMetric label="转人工" value={business.escalated} />
      </div>

      <p className="mt-3 text-xs font-bold text-[#5f6368]">
        更新时间：{business.updatedAt || "未知"}
      </p>
    </article>
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
