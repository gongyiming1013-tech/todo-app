# 待办清单 (Todo App)

一个支持多设备同步的待办事项管理应用，使用 Supabase 作为后端。

## 功能特性

- 📝 待办事项的增删改查
- 🔐 用户注册/登录（邮箱+密码）
- 🔑 忘记密码 — 通过邮箱重置
- 🔄 多设备实时同步
- 🖼️ 图片附件上传
- 📱 拖拽排序（支持桌面和手机触摸）
- 🏷️ 优先级标签（P0-P3）
- 📊 状态管理（未开始/进行中/已完成/暂停）

## 项目结构

```
todo-app/
├── index.html              # HTML 页面结构
├── css/
│   └── style.css           # 样式表
├── js/
│   ├── config.js           # Supabase 配置（URL、Key）
│   ├── supabase.js         # Supabase 客户端初始化
│   ├── auth.js             # 认证模块（登录/注册/重置密码）
│   ├── todos.js            # 待办 CRUD + 渲染
│   ├── dragdrop.js         # 拖拽排序
│   ├── imageUpload.js      # 图片上传/预览
│   └── app.js              # 主入口 + 事件绑定
├── worker/
│   ├── worker.js           # Cloudflare Worker 反向代理
│   └── wrangler.toml       # Wrangler 部署配置
└── README.md
```

## 部署 Cloudflare Worker（解决中国访问问题）

由于 Supabase 在中国大陆可能无法直接访问，需要通过 Cloudflare Workers 反向代理。

### 前置条件

- 一个 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
- 安装 Node.js（v16+）

### 部署步骤

1. **安装 Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **进入 worker 目录并部署**
   ```bash
   cd worker
   wrangler deploy
   ```

4. **获取 Worker URL**

   部署成功后会输出类似：
   ```
   Published supabase-proxy (1.0s)
     https://supabase-proxy.your-subdomain.workers.dev
   ```

5. **更新前端配置**

   编辑 `js/config.js`，将 `SUPABASE_URL` 替换为你的 Worker URL：
   ```javascript
   export const SUPABASE_URL = 'https://supabase-proxy.your-subdomain.workers.dev';
   ```

### 可选：绑定自定义域名

如果你有自己的域名并已托管在 Cloudflare：

1. 在 Cloudflare Dashboard → Workers → 你的 Worker → Triggers
2. 添加 Custom Domain，例如 `api.yourdomain.com`
3. 更新 `js/config.js` 中的 URL

### 免费额度

Cloudflare Workers 免费套餐包含：
- 每天 100,000 次请求
- 每次请求 10ms CPU 时间

对于个人待办应用完全足够。

## 本地开发

直接用浏览器打开 `index.html` 即可（需要通过 HTTP 服务器，因为使用了 ES modules）：

```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

然后访问 `http://localhost:8080`

## Supabase 数据库配置

如果需要创建新的 Supabase 项目，需要在 Supabase Dashboard 中创建以下表：

### todos 表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 自动生成 |
| user_id | uuid | 关联 auth.users |
| text | text | 待办内容 |
| status | text | 状态（未开始/进行中/已完成/暂停）|
| priority | text | 优先级（P0/P1/P2/P3）|
| sort_order | integer | 排序顺序 |
| image_url | text | 图片附件 URL |
| source_text | text | 来源文本 |
| created_at | timestamptz | 创建时间 |

### Storage Bucket

创建名为 `todo-images` 的公开 bucket 用于存储图片附件。
