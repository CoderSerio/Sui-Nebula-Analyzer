import express from "express";
import cors from "cors";
import { createClient } from "@nebula-contrib/nebula-nodejs";

const app = express();
const PORT = process.env.GATEWAY_PORT || 3002;

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
  poolSize: 2,
  bufferSize: 1000,
  executeTimeout: 60000,
  pingInterval: 30000,
};

console.log("Nebula Gateway Server config:", {
  ...nebulaConfig,
  password: "***",
});

// 创建Nebula客户端
const nebulaClient = createClient(nebulaConfig);

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

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Nebula Gateway Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Query endpoint: http://localhost:${PORT}/query`);
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
