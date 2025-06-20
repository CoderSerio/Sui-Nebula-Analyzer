# Sui 区块链交易关联分析系统

基于 NebulaGraph 的智能地址关联识别平台，通过交易模式分析发现 Sui 区块链上的潜在关联地址。

## 🚀 项目特色

- **多技术栈整合**: Next.js + NebulaGraph + Sui GraphQL API + D3.js
- **智能关联分析**: 基于交易频次、金额、时间模式的多维度分析
- **实时数据可视化**: 交互式网络图谱展示地址关系
- **高性能图数据库**: 利用 NebulaGraph 处理复杂图查询
- **模块化架构**: 易于扩展和维护的代码结构

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 15**: React 全栈框架
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS**: 现代化 CSS 框架
- **shadcn/ui**: 高质量 UI 组件库
- **D3.js**: 数据可视化和图谱渲染

### 后端技术栈
- **Next.js API Routes**: 服务端 API 接口
- **NebulaGraph**: 分布式图数据库
- **Sui GraphQL API**: 区块链数据源
- **nebula-js**: NebulaGraph JavaScript 客户端

### 数据处理
- **GraphQL**: 高效的数据查询语言
- **批处理**: 大规模数据采集和处理
- **实时分析**: 动态关联度计算

## 📊 核心功能

### 1. 数据采集模块
- 从 Sui GraphQL API 获取交易数据
- 支持指定区块范围的批量采集
- 实时显示采集进度和统计信息
- 错误处理和重试机制

### 2. 图数据库建模
- 钱包地址作为图节点
- 交易关系作为图边
- 关联关系的多维度属性存储
- 高效的图查询索引

### 3. 关联性分析算法
- **交易频次分析**: 统计共同交易次数
- **金额模式识别**: 分析交易金额特征
- **时间序列分析**: 考虑交易时间分布
- **综合评分机制**: 多因子关联度计算

### 4. 可视化展示
- 交互式网络图谱
- 节点大小反映交易活跃度
- 边粗细表示关联强度
- 颜色编码区分地址类型

## 🔧 安装和部署

### 环境要求
- Node.js 18+
- NebulaGraph 3.0+
- 8GB+ RAM (推荐)

### 快速开始

以下指南旨在用最短的时间跑通整套系统（前后端 + 图数据库）：

### 1. 准备依赖  
- Node.js 18 及以上版本  
- Docker & Docker Compose（用于一键启动 NebulaGraph）

### 2. 克隆并安装  
```bash
git clone <repository-url>
cd sui-nebula-analyzer
pnpm install     # 或 npm install / yarn
```

### 3. 启动 NebulaGraph  
最快的方式是使用官方 Docker 镜像：  
```bash
docker run -d --name nebula-graph \
  -p 9669:9669 -p 19669:19669 -p 19670:19670 \
  vesoft/nebula-graph:latest
```
等待服务完全就绪后，执行数据库初始化脚本：  
```bash
nebula-console -addr localhost -port 9669 -u root -p nebula -f scripts/nebula-schema.sql
```

### 4. 配置环境变量  
```bash
cp .env.example .env.local
```
然后根据实际情况修改 `.env.local` 中的 NebulaGraph 地址、账号密码与 Sui GraphQL 端点。

### 5. 启动开发服务器  
```bash
pnpm dev          # 默认监听 http://localhost:3000
```

### 6. 在浏览器体验  
1. 访问 `http://localhost:3000`  
2. 切换到「数据采集」标签页，填写区块范围后点击「开始采集」  
3. 采集完成后在「地址分析」输入任意 Sui 地址并点击「分析」  
4. 查看交互式图谱与侧边统计信息

> 如果需要重新采集，可在「数据采集」页面点击「重置」或「停止」按钮。

一切顺利的话，你已经能够在本地完成数据采集、图数据库写入，并通过前端界面实时探索交易网络！

## 📈 使用指南

### 数据采集
1. 进入"数据采集"标签页
2. 设置起始和结束区块号
3. 配置批处理大小
4. 点击"开始采集"启动数据收集

### 地址分析
1. 在搜索框输入 Sui 地址
2. 点击"分析"按钮
3. 查看交易网络图谱
4. 浏览关联地址列表

### 图谱交互
- 拖拽节点调整布局
- 鼠标悬停查看详细信息
- 点击节点查看地址详情
- 导出图谱为 PNG 格式

## 🧮 关联算法详解

### 关联度计算公式
\`\`\`
关联度 = 0.4 × 交易频次权重 + 0.3 × 金额权重 + 0.3 × 时间权重
\`\`\`

### 分类标准
- **强关联** (≥0.7): 高频交易，大额转账，长期互动
- **中等关联** (0.4-0.7): 中等频次，规律性交易
- **弱关联** (0.3-0.4): 偶发交易，小额转账

### 识别规则
- 共同交易次数 ≥ 3 次
- 交易时间跨度 > 24 小时
- 排除明显的合约交互

## 🔍 API 接口

### 获取统计信息
\`\`\`
GET /api/stats
\`\`\`

### 查询图数据
\`\`\`
GET /api/graph-data?address={address}
\`\`\`

### 地址关联分析
\`\`\`
GET /api/address-analysis?address={address}
\`\`\`

### 数据采集控制
\`\`\`
POST /api/data-collection/start
POST /api/data-collection/stop
GET /api/data-collection/status
\`\`\`

## 🎯 项目亮点

### 技术整合能力
- 区块链数据处理
- 图数据库应用
- 前端可视化
- 全栈开发

### 实际应用价值
- 反洗钱合规
- 风险控制
- 链上分析
- 安全审计

### 可扩展性
- 支持其他区块链
- 算法优化空间
- 功能模块化
- 部署灵活性

## 📝 开发计划

- [ ] 支持更多区块链网络
- [ ] 机器学习算法集成
- [ ] 实时监控和告警
- [ ] 移动端适配
- [ ] API 接口文档
- [ ] 性能优化

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- GitHub Issues
- Email: [your-email@example.com]

---

**注意**: 这是一个技术演示项目，实际部署时请确保遵守相关法律法规和隐私保护要求。
