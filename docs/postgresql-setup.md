# PostgreSQL 配置说明

当前后端已支持两种存储模式：

- 未配置 `DATABASE_URL`：继续使用 `data/store.json`，适合本地演示。
- 配置 `DATABASE_URL`：使用 PostgreSQL，并在数据库为空时自动导入现有 `data/store.json`。

## PostgreSQL 是否需要登录验证

需要。正式环境必须使用数据库账号认证，不要把超级管理员账号给应用使用。

建议为本项目创建一个专用账号，例如：

```sql
create user customer_robot_app with password 'change_this_password';
create database customer_robot owner customer_robot_app;
grant all privileges on database customer_robot to customer_robot_app;
```

应用使用连接串访问数据库：

```text
DATABASE_URL=postgres://customer_robot_app:change_this_password@127.0.0.1:5432/customer_robot
```

如果云数据库要求 TLS：

```text
DATABASE_SSL=1
```

## 本项目自动创建的表

服务启动后会自动创建：

```sql
create table if not exists businesses (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_data_gin_idx on businesses using gin (data);

create table if not exists api_tokens (
  id text primary key,
  business_id text references businesses(id) on delete cascade,
  token_hash text not null unique,
  token_type text not null check (token_type in ('admin', 'portal', 'widget')),
  name text not null,
  scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
```

当前先用 `data jsonb` 保存完整企业配置、FAQ、线索、会话和统计数据，便于从 JSON 文件平滑迁移。后续做登录权限、多租户计费和审计时，再逐步拆成 `users`、`business_members`、`api_tokens`、`faqs`、`leads`、`conversations`、`messages` 等关系表。

## 启用步骤

1. 复制 `.env.example` 为 `.env`。
2. 修改 `.env` 里的 `DATABASE_URL`。
3. 运行：

```powershell
npm start
```

4. 访问健康检查：

```text
http://127.0.0.1:4173/api/health
```

返回中 `storage` 为 `postgresql` 即表示已使用 PostgreSQL。

后台管理 API 还需要配置：

```text
ADMIN_API_TOKEN=一段足够长的随机字符串
```

本地当前 token 保存在 `D:\CustomerRobot\ADMIN_API_TOKEN.txt`，只用于粘贴到后台页面或调试 API，不要提交到 GitHub。

企业工作台 Token 不写入 `.env`，由 `/admin` 页面为单个 `businessId` 生成或轮换。明文只在生成时返回一次，数据库只保存 `token_hash`。
