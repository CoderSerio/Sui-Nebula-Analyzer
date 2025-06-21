# Sui Nebula 分析器

一个基于 NebulaGraph 的 Sui 区块链交易分析工具，提供钱包地址关系分析、交易网络可视化和风险评估功能。

## 🏗️ 项目架构

本项目采用分离式架构设计：

```
┌─────────────────┐    HTTP API    ┌──────────────────┐    Native TCP    ┌─────────────────┐
│   Next.js Web   │ ────────────── │  Gateway Server  │ ──────────────── │  NebulaGraph    │
│   Application   │                │  (Port 3002)     │                  │   Database      │
│   (Port 3001)   │                │                  │                  │  (Port 9669)    │
└─────────────────┘                └──────────────────┘                  └─────────────────┘
```

### 核心组件

1. **Next.js Web 应用** - 前端界面和 API 路由
2. **Gateway 服务器** - 独立的 NebulaGraph 查询服务
3. **NebulaGraph 数据库** - 图数据库存储交易关系

## 🚀 快速开始

### 前置要求

- Node.js 18+ 
- Docker 和 Docker Compose
- pnpm (推荐) 或 npm

### 1. 启动 NebulaGraph 数据库

确保你的 NebulaGraph Docker 容器正在运行：

```bash
# 检查容器状态
docker ps | grep nebula

# 如果没有运行，启动 NebulaGraph 集群
docker-compose up -d
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动项目

#### 方式一：一键启动（推荐）

```bash
# 同时启动 Gateway 服务器和 Web 应用
pnpm run start:full
```

#### 方式二：分别启动

```bash
# 终端 1：启动 Gateway 服务器
pnpm run gateway

# 终端 2：启动 Web 应用
pnpm run dev
```

### 4. 访问应用

- **Web 界面**: http://localhost:3001
- **Gateway API**: http://localhost:3002
- **健康检查**: http://localhost:3002/health

## 📋 可用脚本

```bash
# 开发相关
pnpm run dev              # 启动 Next.js 开发服务器
pnpm run gateway          # 启动 Gateway 服务器
pnpm run gateway:dev      # 启动 Gateway 服务器（自动重启）
pnpm run start:full       # 同时启动 Gateway 和 Web 应用

# 生产相关
pnpm run build            # 构建生产版本
pnpm run start            # 启动生产服务器

# 测试相关
pnpm run test:api         # 测试 Next.js API 端点
pnpm run test:gateway     # 测试 Gateway 服务器
pnpm run lint             # 代码检查
```

## 🔌 API 端点

### Next.js API (Port 3001)

- `GET /api/stats` - 获取数据库统计信息
- `GET /api/graph-data?address=<address>` - 获取地址交易网络图
- `GET /api/address-analysis?address=<address>` - 获取地址详细分析
- `GET /api/related-accounts?address=<address>&limit=20` - 获取相关账户

### Gateway API (Port 3002)

- `GET /health` - 健康检查
- `POST /query` - 执行自定义 Cypher 查询
- `GET /stats` - 数据库统计
- `GET /graph-data` - 图数据查询
- `GET /address-analysis` - 地址分析
- `GET /related-accounts` - 相关账户查询

## 🔍 使用示例

### 1. 获取统计数据

```bash
curl http://localhost:3001/api/stats
```

### 2. 查询地址交易网络

```bash
curl "http://localhost:3001/api/graph-data?address=b834552bcfda793f70282a199618266d778cc7c21a206309ad192526129006ed"
```

### 3. 地址风险分析

```bash
curl "http://localhost:3001/api/address-analysis?address=b834552bcfda793f70282a199618266d778cc7c21a206309ad192526129006ed"
```

### 4. 查找相关账户

```bash
curl "http://localhost:3001/api/related-accounts?address=b834552bcfda793f70282a199618266d778cc7c21a206309ad192526129006ed&limit=10"
```

## 🛠️ 技术栈

### 前端
- **Next.js 15** - React 全栈框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Shadcn/ui** - UI 组件库

### 后端
- **Express.js** - Gateway 服务器框架
- **@nebula-contrib/nebula-nodejs** - NebulaGraph 原生客户端
- **CORS** - 跨域支持

### 数据库
- **NebulaGraph** - 分布式图数据库
- **Docker** - 容器化部署

## 📊 数据结构

### 节点类型
- `wallet` - 钱包地址节点

### 边类型
- `transaction` - 交易关系
- `related_to` - 关联关系

### 属性示例
```cypher
# 钱包节点属性
(wallet {
  address: "0x123...",
  transaction_count: 42,
  total_amount: 1000000,
  first_seen: datetime("2025-01-01T00:00:00"),
  last_seen: datetime("2025-06-21T00:00:00"),
  is_contract: false
})

# 交易边属性
-[transaction {
  amount: 1000,
  tx_hash: "0xabc...",
  timestamp: datetime("2025-06-21T00:00:00")
}]->
```

## 🔧 配置

### 环境变量

创建 `.env.local` 文件：

```env
# NebulaGraph 配置
NEBULA_HOST=localhost
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_SPACE=sui_analysis

# Gateway 配置
GATEWAY_URL=http://localhost:3002
GATEWAY_PORT=3002
```

### Gateway 服务器配置

Gateway 服务器会自动连接到 NebulaGraph 数据库，支持以下配置：

- **连接池大小**: 5 个连接
- **缓冲区大小**: 2000
- **执行超时**: 15 秒
- **心跳间隔**: 60 秒

## 🚨 故障排除

### 1. Gateway 连接失败

```bash
# 检查 NebulaGraph 是否运行
docker ps | grep nebula

# 检查网络连接
curl http://localhost:3002/health
```

### 2. 数据查询错误

```bash
# 测试基础查询
pnpm run test:gateway

# 检查数据库连接
curl -X POST http://localhost:3002/query \
  -H "Content-Type: application/json" \
  -d '{"query":"SHOW SPACES"}'
```

### 3. 端口冲突

如果端口被占用，修改以下配置：
- Next.js: 自动选择其他端口（如 3001）
- Gateway: 修改 `GATEWAY_PORT` 环境变量

## 📈 性能优化

### 1. 数据库索引

为提高查询性能，建议创建索引：

```cypher
USE sui_analysis;
CREATE TAG INDEX wallet_address_index ON wallet(address);
```

### 2. 连接池调优

根据负载调整 Gateway 服务器的连接池配置：

```typescript
const nebulaConfig = {
  poolSize: 10,        // 增加连接池大小
  bufferSize: 4000,    // 增加缓冲区
  executeTimeout: 30000 // 增加超时时间
};
```

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可证

MIT License

