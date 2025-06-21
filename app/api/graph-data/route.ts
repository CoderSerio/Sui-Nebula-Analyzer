import type { NextRequest } from "next/server";
import NebulaHttpClient from "@/lib/nebula-http-client";

export async function GET(request: NextRequest) {
  console.log("=== Graph Data API Called ===");

  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  console.log("Request address:", address);

  if (!address) {
    console.log("Missing address parameter");
    return Response.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  let nebulaClient: NebulaHttpClient | null = null;

  try {
    console.log("Creating NebulaHttpClient...");

    // 检查环境变量
    console.log("Environment variables:", {
      NEBULA_HOST: process.env.NEBULA_HOST || "not set",
      NEBULA_HTTP_PORT: process.env.NEBULA_HTTP_PORT || "not set",
      NEBULA_USERNAME: process.env.NEBULA_USERNAME || "not set",
      NEBULA_PASSWORD: process.env.NEBULA_PASSWORD ? "***" : "not set",
      NEBULA_SPACE: process.env.NEBULA_SPACE || "not set",
    });

    nebulaClient = new NebulaHttpClient();
    console.log("NebulaHttpClient created, getting address network...");

    // 查询目标地址及其相关的交易网络
    const query = `
      MATCH (center:wallet {address: "${address}"})
      OPTIONAL MATCH (center)-[r:transaction]-(connected:wallet)
      RETURN center.address AS center_address,
             center.transaction_count AS center_tx_count,
             center.total_amount AS center_amount,
             collect(DISTINCT {
               address: connected.address,
               tx_count: connected.transaction_count,
               amount: connected.total_amount,
               edge_amount: r.amount,
               tx_hash: r.tx_hash,
               timestamp: r.timestamp
             }) AS connections
      LIMIT 100
    `;

    console.log("Executing graph query...");
    const result = await nebulaClient.executeQuery(query);

    const graphData = processGraphResult(result, address);
    console.log("Graph data processed successfully");

    // 如果没有找到数据，返回包含目标地址的基本结构
    if (graphData.nodes.length === 0) {
      console.log("No data found, returning empty structure");
      return Response.json({
        nodes: [
          {
            id: address,
            address: address,
            type: "target",
            transactionCount: 0,
            totalAmount: 0,
          },
        ],
        links: [],
      });
    }

    console.log(
      "Returning graph data with",
      graphData.nodes.length,
      "nodes and",
      graphData.links.length,
      "links"
    );
    return Response.json(graphData);
  } catch (error) {
    console.error("=== Graph Data API Error ===");
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error?.constructor?.name);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // 尝试提取更多错误信息
    if (error && typeof error === "object") {
      console.error("Error object keys:", Object.keys(error));
      console.error("Error object:", error);
    }

    // 如果查询失败，返回基本的目标地址节点而不是500错误
    console.log("Returning fallback data due to error");
    return Response.json({
      nodes: [
        {
          id: address,
          address: address,
          type: "target",
          transactionCount: 0,
          totalAmount: 0,
        },
      ],
      links: [],
      error: "Database connection failed, showing offline mode",
    });
  } finally {
    // 确保客户端连接被正确关闭
    if (nebulaClient) {
      try {
        await nebulaClient.close();
        console.log("NebulaHttpClient connection closed");
      } catch (closeError) {
        console.error("Error closing NebulaHttpClient:", closeError);
      }
    }
  }
}

// 处理图数据查询结果
function processGraphResult(result: any, targetAddress: string) {
  const nodes: any[] = [];
  const links: any[] = [];

  try {
    if (result && result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      const centerAddress = row[0];
      const centerTxCount = row[1] || 0;
      const centerAmount = row[2] || 0;
      const connections = row[3] || [];

      // 添加中心节点
      nodes.push({
        id: centerAddress,
        address: centerAddress,
        type: "target",
        transactionCount: centerTxCount,
        totalAmount: centerAmount,
      });

      // 处理连接的节点和边
      connections.forEach((conn: any, index: number) => {
        if (conn.address && conn.address !== centerAddress) {
          // 添加连接的节点
          const nodeId = conn.address;
          if (!nodes.find((n) => n.id === nodeId)) {
            nodes.push({
              id: nodeId,
              address: conn.address,
              type: "connected",
              transactionCount: conn.tx_count || 0,
              totalAmount: conn.amount || 0,
            });
          }

          // 添加边
          links.push({
            source: centerAddress,
            target: nodeId,
            amount: conn.edge_amount || 0,
            txHash: conn.tx_hash || "",
            timestamp: conn.timestamp || null,
          });
        }
      });
    }
  } catch (error) {
    console.error("Error processing graph result:", error);
  }

  return { nodes, links };
}
