import express from "express";
import cors from "cors";
import { createClient } from "@nebula-contrib/nebula-nodejs";

const app = express();
const PORT = process.env.GATEWAY_PORT || 3002;

// 中间件
app.use(cors());
app.use(express.json());

// Nebula客户端配置
const nebulaConfig = {
  servers: [
    process.env.NEBULA_HOST
      ? `${process.env.NEBULA_HOST}:9669`
      : "localhost:9669",
  ],
  userName: process.env.NEBULA_USERNAME || "root",
  password: process.env.NEBULA_PASSWORD || "nebula",
  space: process.env.NEBULA_SPACE || "sui_analysis",
  poolSize: 5,
  bufferSize: 2000,
  executeTimeout: 15000,
  pingInterval: 60000,
};

console.log("Nebula Gateway Server config:", {
  ...nebulaConfig,
  password: "***",
});

// 创建Nebula客户端
const nebulaClient = createClient(nebulaConfig);

// 设置事件监听器
nebulaClient.on("ready", ({ sender }: any) => {
  console.log("Nebula client ready");
});

nebulaClient.on("error", ({ sender, error }: any) => {
  console.error("Nebula client error:", error);
});

nebulaClient.on("connected", ({ sender }: any) => {
  console.log("Nebula client connected");
});

nebulaClient.on("authorized", ({ sender }: any) => {
  console.log("Nebula client authorized");
});

// 健康检查端点
app.get("/health", (req: any, res: any) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 查询端点
app.post("/query", async (req: any, res: any) => {
  try {
    const { query, returnOriginal = false } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log("Executing query:", query);
    const result = await nebulaClient.execute(query, returnOriginal);
    console.log("Query executed successfully");

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Query execution failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// 统计数据端点
app.get("/stats", async (req: any, res: any) => {
  try {
    console.log("Getting stats...");

    const [addressesResult, transactionsResult, relatedGroupsResult] =
      await Promise.all([
        nebulaClient.execute(
          "USE sui_analysis; MATCH (n:wallet) RETURN count(n) as count"
        ),
        nebulaClient.execute(
          "USE sui_analysis; MATCH ()-[e:transaction]->() RETURN count(e) as count"
        ),
        nebulaClient.execute(
          "USE sui_analysis; MATCH ()-[r:related_to]->() RETURN count(r) as count"
        ),
      ]);

    const stats = {
      totalAddresses: addressesResult?.data?.count?.[0] || 0,
      totalTransactions: transactionsResult?.data?.count?.[0] || 0,
      relatedGroups: relatedGroupsResult?.data?.count?.[0] || 0,
      lastUpdate: new Date().toISOString(),
    };

    res.json(stats);
  } catch (error) {
    console.error("Stats query failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// 图数据端点
app.get("/graph-data", async (req: any, res: any) => {
  try {
    const address = req.query.address as string;

    if (!address) {
      return res.status(400).json({ error: "Address parameter is required" });
    }

    console.log("Getting graph data for address:", address);

    // 简化查询，分步获取数据
    const centerQuery = `USE sui_analysis; MATCH (center:wallet) WHERE id(center) == hash("${address}") RETURN center.wallet.address AS center_address, center.wallet.transaction_count AS center_tx_count, center.wallet.total_amount AS center_amount`;

    const centerResult = await nebulaClient.execute(centerQuery);

    if (!centerResult?.data?.center_address?.[0]) {
      return res.json({ nodes: [], links: [] });
    }

    // 获取连接的钱包
    const connectionsQuery = `USE sui_analysis; MATCH (center:wallet)-[r:transaction]-(connected:wallet) WHERE id(center) == hash("${address}") RETURN connected.wallet.address AS connected_address, connected.wallet.transaction_count AS connected_tx_count, connected.wallet.total_amount AS connected_amount, r.amount AS edge_amount LIMIT 50`;

    const connectionsResult = await nebulaClient.execute(connectionsQuery);

    const graphData = processSimpleGraphResult(
      centerResult,
      connectionsResult,
      address
    );

    res.json(graphData);
  } catch (error) {
    console.error("Graph data query failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// 地址分析端点
app.get("/address-analysis", async (req: any, res: any) => {
  try {
    const address = req.query.address as string;

    if (!address) {
      return res.status(400).json({ error: "Address parameter is required" });
    }

    console.log("Getting address analysis for:", address);

    // 简化查询
    const query = `USE sui_analysis; MATCH (target:wallet) WHERE id(target) == hash("${address}") RETURN target.wallet.address AS address, target.wallet.transaction_count AS tx_count, target.wallet.total_amount AS total_amount, target.wallet.first_seen AS first_seen, target.wallet.last_seen AS last_seen, target.wallet.is_contract AS is_contract`;

    const result = await nebulaClient.execute(query);
    const analysisResult = processSimpleAnalysisResult(result, address);

    res.json(analysisResult);
  } catch (error) {
    console.error("Address analysis query failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// 相关账户端点
app.get("/related-accounts", async (req: any, res: any) => {
  try {
    const address = req.query.address as string;
    const limit = parseInt((req.query.limit as string) || "20");

    if (!address) {
      return res.status(400).json({ error: "Address parameter is required" });
    }

    console.log("Getting related accounts for:", address);

    // 简化查询
    const query = `USE sui_analysis; MATCH (target:wallet)-[r:related_to]-(related:wallet) WHERE id(target) == hash("${address}") RETURN related.wallet.address AS address, r.relationship_score AS score, r.common_transactions AS common_tx, r.total_amount AS total_amount, r.relationship_type AS type LIMIT ${limit}`;

    const result = await nebulaClient.execute(query);
    const relatedAccounts = processSimpleRelatedAccountsResult(result);

    res.json({
      targetAddress: address,
      totalFound: relatedAccounts.length,
      accounts: relatedAccounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Related accounts query failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// 辅助函数
function processGraphResult(result: any, targetAddress: string) {
  const nodes: any[] = [];
  const links: any[] = [];

  if (!result?.data) {
    return { nodes, links };
  }

  const data = result.data;

  if (data.center_address && data.center_address.length > 0) {
    nodes.push({
      id: data.center_address[0],
      address: data.center_address[0],
      type: "target",
      transactionCount: data.center_tx_count?.[0] || 0,
      totalAmount: data.center_amount?.[0] || 0,
    });

    if (data.connections && data.connections[0]) {
      const connections = data.connections[0];

      connections.forEach((conn: any) => {
        if (conn.address) {
          nodes.push({
            id: conn.address,
            address: conn.address,
            type: "connected",
            transactionCount: conn.tx_count || 0,
            totalAmount: conn.amount || 0,
          });

          links.push({
            source: data.center_address[0],
            target: conn.address,
            amount: conn.edge_amount || 0,
            txHash: conn.tx_hash || "",
            timestamp: conn.timestamp || "",
          });
        }
      });
    }
  }

  return { nodes, links };
}

function processAnalysisResult(result: any, targetAddress: string) {
  if (!result?.data) {
    return {
      address: targetAddress,
      transactionCount: 0,
      totalAmount: 0,
      firstSeen: null,
      lastSeen: null,
      isContract: false,
      relationships: [],
      riskLevel: "unknown",
      analysisScore: 0,
    };
  }

  const data = result.data;

  const relationships: Array<{
    address: string;
    relationshipScore: number;
    commonTransactions: number;
    totalAmount: number;
    relationshipType: string;
    firstInteraction: any;
    lastInteraction: any;
  }> = [];

  if (data.relationships && data.relationships[0]) {
    const relations = data.relationships[0];
    relations.forEach((rel: any) => {
      if (rel.address) {
        relationships.push({
          address: rel.address,
          relationshipScore: rel.score || 0,
          commonTransactions: rel.common_tx || 0,
          totalAmount: rel.relation_amount || 0,
          relationshipType: rel.type || "unknown",
          firstInteraction: rel.first_interaction || null,
          lastInteraction: rel.last_interaction || null,
        });
      }
    });
  }

  const txCount = data.tx_count?.[0] || 0;
  const totalAmount = data.total_amount?.[0] || 0;
  const relationshipCount = relationships.length;

  let riskLevel = "low";
  let analysisScore = 0;

  if (txCount > 100 || totalAmount > 1000000 || relationshipCount > 10) {
    riskLevel = "high";
    analysisScore = 0.8;
  } else if (txCount > 50 || totalAmount > 100000 || relationshipCount > 5) {
    riskLevel = "medium";
    analysisScore = 0.5;
  } else {
    riskLevel = "low";
    analysisScore = 0.2;
  }

  return {
    address: data.address?.[0] || targetAddress,
    transactionCount: txCount,
    totalAmount: totalAmount,
    firstSeen: data.first_seen?.[0] || null,
    lastSeen: data.last_seen?.[0] || null,
    isContract: data.is_contract?.[0] || false,
    relationships: relationships,
    riskLevel: riskLevel,
    analysisScore: analysisScore,
  };
}

function processRelatedAccountsResult(result: any) {
  const accounts: Array<{
    address: string;
    relationshipScore: number;
    commonTransactions: number;
    totalAmount: number;
    relationshipType: string;
    firstInteraction: any;
    lastInteraction: any;
    transactionCount: number;
    walletAmount: number;
  }> = [];

  if (!result?.data) {
    return accounts;
  }

  const data = result.data;

  if (data.address && Array.isArray(data.address)) {
    for (let i = 0; i < data.address.length; i++) {
      accounts.push({
        address: data.address[i],
        relationshipScore: data.score?.[i] || 0,
        commonTransactions: data.common_tx?.[i] || 0,
        totalAmount: data.total_amount?.[i] || 0,
        relationshipType: data.type?.[i] || "unknown",
        firstInteraction: data.first_interaction?.[i] || null,
        lastInteraction: data.last_interaction?.[i] || null,
        transactionCount: data.tx_count?.[i] || 0,
        walletAmount: data.wallet_amount?.[i] || 0,
      });
    }
  }

  return accounts;
}

function processSimpleGraphResult(
  centerResult: any,
  connectionsResult: any,
  targetAddress: string
) {
  const nodes: any[] = [];
  const links: any[] = [];

  if (!centerResult?.data || !connectionsResult?.data) {
    return { nodes, links };
  }

  const centerData = centerResult.data;
  const connectionsData = connectionsResult.data;

  if (centerData.center_address && centerData.center_address.length > 0) {
    nodes.push({
      id: centerData.center_address[0],
      address: centerData.center_address[0],
      type: "target",
      transactionCount: centerData.center_tx_count?.[0] || 0,
      totalAmount: centerData.center_amount?.[0] || 0,
    });

    if (
      connectionsData.connected_address &&
      connectionsData.connected_address.length > 0
    ) {
      connectionsData.connected_address.forEach((connAddress: string) => {
        nodes.push({
          id: connAddress,
          address: connAddress,
          type: "connected",
          transactionCount: 0,
          totalAmount: 0,
        });

        links.push({
          source: centerData.center_address[0],
          target: connAddress,
          amount: 0,
          txHash: "",
          timestamp: "",
        });
      });
    }
  }

  return { nodes, links };
}

function processSimpleAnalysisResult(result: any, targetAddress: string) {
  if (!result?.data) {
    return {
      address: targetAddress,
      transactionCount: 0,
      totalAmount: 0,
      firstSeen: null,
      lastSeen: null,
      isContract: false,
      riskLevel: "unknown",
      analysisScore: 0,
    };
  }

  const data = result.data;

  const txCount = data.tx_count?.[0] || 0;
  const totalAmount = data.total_amount?.[0] || 0;

  let riskLevel = "low";
  let analysisScore = 0;

  if (txCount > 100 || totalAmount > 1000000) {
    riskLevel = "high";
    analysisScore = 0.8;
  } else if (txCount > 50 || totalAmount > 100000) {
    riskLevel = "medium";
    analysisScore = 0.5;
  } else {
    riskLevel = "low";
    analysisScore = 0.2;
  }

  return {
    address: data.address?.[0] || targetAddress,
    transactionCount: txCount,
    totalAmount: totalAmount,
    firstSeen: data.first_seen?.[0] || null,
    lastSeen: data.last_seen?.[0] || null,
    isContract: data.is_contract?.[0] || false,
    riskLevel: riskLevel,
    analysisScore: analysisScore,
  };
}

function processSimpleRelatedAccountsResult(result: any) {
  const accounts: Array<{
    address: string;
    relationshipScore: number;
    commonTransactions: number;
    totalAmount: number;
    relationshipType: string;
  }> = [];

  if (!result?.data) {
    return accounts;
  }

  const data = result.data;

  if (data.address && Array.isArray(data.address)) {
    for (let i = 0; i < data.address.length; i++) {
      accounts.push({
        address: data.address[i],
        relationshipScore: data.score?.[i] || 0,
        commonTransactions: data.common_tx?.[i] || 0,
        totalAmount: data.total_amount?.[i] || 0,
        relationshipType: data.type?.[i] || "unknown",
      });
    }
  }

  return accounts;
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Nebula Gateway Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on("SIGINT", async () => {
  console.log("Shutting down Nebula Gateway Server...");
  try {
    await nebulaClient.close();
    console.log("Nebula client closed");
  } catch (error) {
    console.error("Error closing Nebula client:", error);
  }
  process.exit(0);
});
