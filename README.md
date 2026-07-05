# 数智云智能客服机器人 MVP

这是一个面向中小企业售卖的客服机器人最小可行产品原型。当前版本已经升级为“React 管理后台 + 企业工作台 + Express API + PostgreSQL + 可嵌入 widget”的试用版。

## 已实现

- 登录页：`/login` 统一承载运营管理员和企业用户登录，后端根据账号角色跳转到对应页面。
- 平台运营后台：`/admin` 只用于监控已存在企业客户、生成企业 Token、打开企业工作台和重置企业演示数据。
- 企业工作台：`/portal` 面向企业客户，用企业 Token 管理智能问答、企业后台、嵌入组件、知识库、销售线索、客户网站嵌入代码和运营可视化。
- 企业后台：企业用户在 `/portal` 配置企业名称、行业、回复语气、服务时间、人工联系方式和开场欢迎语。
- AI 状态：展示 DeepSeek 是否连接、当前模型和最近一次回复来源。
- 回复模式：支持 FAQ + AI、FAQ 优先、仅收集线索。
- 客服回答规则：可配置模型提示词规则，例如不承诺具体价格、优先引导预约演示、限制字数。
- 知识库：新增、编辑、删除常见问题，通过 API 持久化到本地数据文件。
- 客户聊天端：模拟客户咨询、快捷问题、知识库命中、兜底转人工。
- 线索收集：客户询价、预约演示、转人工或机器人无法回答时，收集手机号、微信或邮箱，并生成意向等级、关注点和跟进摘要。
- 数据看板：展示对话消息数、自动解决率、销售线索数量。
- 数据导出：支持导出销售线索 CSV。
- 网站嵌入：生成 `<script>` 代码，通过 `data-business-id` 读取企业配置。
- 服务端 API：使用 Express 统一处理企业配置、FAQ、线索、聊天状态和会话记录。
- 数据库存储：使用 PostgreSQL 保存企业数据和 API token hash，本地 JSON 仅作为无数据库时的回退。
- 未命中问题：FAQ 规则没有直接命中的问题会进入后台列表，可一键填入 FAQ 表单补充答案。
- FAQ 编辑：支持在后台直接编辑、保存和删除已有知识库问题。

## 运行方式

需要先安装 Node.js。首次运行需要安装依赖并构建 React 页面：

```powershell
cd D:\CustomerRobot\CustomerService-robot
npm install
npm run build
npm start
```

然后访问登录页：

```text
http://127.0.0.1:4173/login
```

平台运营后台：

```text
http://127.0.0.1:4173/admin
```

企业客户工作台：

```text
http://127.0.0.1:4173/portal?businessId=demo
```

客户网站嵌入演示页：

```text
http://127.0.0.1:4173/demo-site.html
```

后端会优先服务 `dist/` 中的 React 构建产物。开发前端页面时也可以运行：

```powershell
npm run dev
```

Vite 开发服务默认地址是 `http://127.0.0.1:5173`，API 会代理到 `http://127.0.0.1:4173`。

## DeepSeek 模型接入

后端已经支持 DeepSeek Chat Completions API。机器人会先匹配本地 FAQ；FAQ 命中不足时，再调用 DeepSeek 生成回复。API Key 只在后端读取，不会发送到前端页面或嵌入脚本。

默认读取顺序：

1. 环境变量 `DEEPSEEK_API_KEY`
2. 本地文件 `D:\CustomerRobot\API KEY.txt`

可选环境变量：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek Key"
$env:DEEPSEEK_MODEL="deepseek-v4-flash"
$env:DEEPSEEK_BASE_URL="https://api.deepseek.com"
npm start
```

默认模型是 `deepseek-v4-flash`。如果需要更强回答质量，可以改为 `deepseek-v4-pro`。

## 数据位置

当前优先使用 PostgreSQL：

```text
postgres://customer_robot_app:***@127.0.0.1:5432/customer_robot
```

无 `DATABASE_URL` 时才会回退到本地 JSON 文件：

```text
D:\CustomerRobot\CustomerService-robot\data\store.json
```

管理员 API Token 保存在本地环境变量或 `.env`，当前本机辅助文件为 `D:\CustomerRobot\ADMIN_API_TOKEN.txt`。登录页会使用后端签发的 session token；旧的 API Token 方式仍保留用于调试。企业工作台 Token 由 `/admin` 页面生成，数据库只保存 hash。

## 嵌入代码

后台会生成类似这样的嵌入代码：

```html
<script src="http://127.0.0.1:4173/widget/nimble-widget.js"
  data-business-id="demo"
  data-api-base="http://127.0.0.1:4173"
  data-public-token="pk_xxx"
  data-reply-mode="faq_ai"></script>
```

上线后只需要把域名换成你的 HTTPS 域名，例如：

```html
<script src="https://bot.example.com/widget/nimble-widget.js"
  data-business-id="demo"
  data-api-base="https://bot.example.com"
  data-public-token="pk_xxx"
  data-reply-mode="faq_ai"></script>
```

## API 摘要

- `GET /api/health`：健康检查。
- `POST /api/auth/login`：统一登录接口，返回 admin 或 portal session。
- `GET /api/admin/businesses`：平台管理员查看企业客户列表和汇总指标，需要 `ADMIN_API_TOKEN`。
- `GET /api/admin/businesses/demo`：平台管理员读取企业完整配置，需要 `ADMIN_API_TOKEN`。
- `POST /api/admin/businesses/demo/tokens/portal`：平台管理员生成或轮换企业工作台 Token。
- `GET /api/portal/businesses/demo`：企业客户读取自己的企业配置，需要企业 Token。
- `PUT /api/portal/businesses/demo/company`：企业客户更新企业资料、回复规则和组件样式。
- `POST /api/portal/businesses/demo/faqs`：企业客户新增 FAQ。
- `GET /api/portal/businesses/demo/leads/export`：企业客户导出销售线索 CSV。
- `GET /api/widget/businesses/demo/public`：widget 读取公开配置，需要 public token。
- `POST /api/widget/businesses/demo/chat`：widget 发送客户消息，返回机器人回复，需要 public token。

## 推荐演示话术

1. 先展示右侧聊天端，输入“怎么收费？”证明能回答售前高频问题。
2. 再输入“我要预约演示”，机器人会主动收集联系方式。
3. 输入一个手机号或邮箱，回到左侧后台，展示线索已经进入列表。
4. 添加一个企业自己的 FAQ，例如“你们支持上门安装吗？”，再到聊天端测试命中。
5. 展示嵌入代码，说明企业复制到官网即可试点。

## 当前边界

- 当前检索是轻量规则匹配，适合演示高频 FAQ；正式版建议接入 RAG 知识库。
- 当前是 API Token 登录，还没有账号密码、短信/邮箱验证、套餐计费和审计日志。
- 当前企业数据仍先以 JSONB 保存，正式多租户上线前建议逐步拆成 users、business_members、faqs、leads、conversations、messages 等关系表。

## 下一步产品路线

- 增加多租户后台、账号权限、套餐计费、企业独立配置空间。
- 支持文档导入、网页抓取、FAQ 自动生成和人工审核。
- 接入企微、飞书、钉钉、CRM 或邮箱，把线索实时推送给销售。
- 增加会话质检、未命中问题列表、知识库优化建议和转化漏斗。
