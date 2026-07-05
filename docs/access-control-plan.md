# 基础权限与多企业路由规划

当前已落地的基础分层：

## 页面与脚本

- `/admin`：平台运营后台，只做已存在企业客户的监控和控制。
- `/portal`：企业客户工作台，企业用户用企业 Token 管理智能问答、企业配置、嵌入组件、知识库、销售线索、客户网站嵌入代码和运营可视化。
- `/login`：统一登录页面，运营管理员和企业用户都从这里登录。
- `/widget/nimble-widget.js`：客户网站嵌入脚本。
- `/nimble-widget.js`：旧脚本地址，暂时保留兼容。

## API

- `/api/admin/businesses`：平台管理员查看已存在企业客户列表和汇总指标，需要后台 API Token。
- `/api/admin/businesses/:businessId/*`：平台管理员控制单个企业，例如生成 Token、重置演示数据，需要后台 API Token。
- `/api/admin/businesses/:businessId/tokens/portal`：平台管理员生成或轮换企业工作台 Token。
- `/api/portal/businesses/:businessId/*`：企业客户 API，需要当前企业的 portal token。
- `/api/widget/businesses/:businessId/public`：widget 读取公开配置，需要 public token。
- `/api/widget/businesses/:businessId/chat`：widget 发起对话，需要 public token。
- `/api/businesses/:businessId/*`：旧 API 地址，暂时保留兼容。
- `/api/auth/login`：登录接口，校验演示账号后返回后端签发的 session token。

## Token 规则

后台 API 支持两类凭证：

- `/login` 返回的 admin session token。
- `ADMIN_API_TOKEN` 兼容旧调试方式。

旧 secret token 方式：

```http
Authorization: Bearer <ADMIN_API_TOKEN>
```

也兼容：

```http
X-API-Token: <ADMIN_API_TOKEN>
```

企业工作台支持两类凭证：

- `/login` 返回的 portal session token。
- business-scoped portal token 兼容旧调试方式。

旧 portal token 方式：

```http
Authorization: Bearer <PORTAL_TOKEN>
```

`PORTAL_TOKEN` 由 `/admin` 页面生成，数据库只保存 hash。企业 Token 只能访问对应 `businessId` 下允许开放的资源，例如企业资料、回复规则、FAQ、未命中问题、线索、会话和统计数据，不能重置企业数据或生成其他 token。

widget API 使用 public token：

```http
X-Widget-Token: <business.publicToken>
```

public token 会出现在嵌入代码里，不应当作为真正秘密。它用于识别合法嵌入脚本，后续还需要配合域名白名单和限流。

## PostgreSQL 结构

当前已创建：

- `businesses`：保存企业配置、FAQ、线索、会话等 JSONB 数据。
- `api_tokens`：保存 admin、portal、widget token hash、类型、scope、吊销状态，为后续后台账号和企业级 token 做准备。

后续建议逐步拆表：

- `users`
- `business_members`
- `allowed_origins`
- `faqs`
- `leads`
- `conversations`
- `messages`
- `audit_logs`

## 下一步

1. 增加正式 `users` 表，把当前演示账号迁移到数据库。
2. 用 `business_members` 做企业成员权限，支持 owner、admin、viewer 等角色。
3. 给 widget 增加域名白名单 UI。
4. 给公开 API 增加 IP 或 businessId 级限流。
5. 将 FAQ、线索、会话从 JSONB 逐步拆为关系表。
