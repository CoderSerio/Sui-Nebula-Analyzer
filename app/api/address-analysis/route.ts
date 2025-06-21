import type { NextRequest } from "next/server";
import NebulaHttpClient from "@/lib/nebula-http-client";

export async function GET(request: NextRequest) {
  console.log("=== Address Analysis API Called ===");

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
    console.log("NebulaHttpClient created, getting address analysis...");

    // 查询地址的详细分析信息
    const query = `
      MATCH (target:wallet {address: "${address}"})
      OPTIONAL MATCH (target)-[r:related_to]-(related:wallet)
      RETURN target.address AS address,
             target.transaction_count AS tx_count,
             target.total_amount AS total_amount,
             target.first_seen AS first_seen,
             target.last_seen AS last_seen,
             target.is_contract AS is_contract,
             collect(DISTINCT {
               address: related.address,
               score: r.relationship_score,
               common_tx: r.common_transactions,
               relation_amount: r.total_amount,
               type: r.relationship_type,
               first_interaction: r.first_interaction,
               last_interaction: r.last_interaction
             }) AS relationships
    `;

    console.log("Executing address analysis query...");
    const result = await nebulaClient.executeQuery(query);

    const analysisResult = processAnalysisResult(result, address);
    console.log("Analysis data processed successfully");

    return Response.json(analysisResult);
  } catch (error) {
    console.error("=== Address Analysis API Error ===");
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

    // 如果查询失败，返回空分析结果而不是500错误
    console.log("Returning fallback data due to error");
    return Response.json({
      targetAddress: address,
      analysisTime: new Date().toISOString(),
      totalRelationships: 0,
      relatedAddresses: [],
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

// 处理地址分析查询结果
function processAnalysisResult(result: any, targetAddress: string) {
  try {
    if (result && result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      const address = row[0];
      const txCount = row[1] || 0;
      const totalAmount = row[2] || 0;
      const firstSeen = row[3] || null;
      const lastSeen = row[4] || null;
      const isContract = row[5] || false;
      const relationships = row[6] || [];

      // 过滤和处理关联地址
      const relatedAddresses = relationships
        .filter((rel: any) => rel.address && rel.address !== address)
        .map((rel: any) => ({
          address: rel.address,
          relationshipScore: rel.score || 0,
          commonTransactions: rel.common_tx || 0,
          relationAmount: rel.relation_amount || 0,
          relationshipType: rel.type || "unknown",
          firstInteraction: rel.first_interaction || null,
          lastInteraction: rel.last_interaction || null,
        }))
        .sort((a: any, b: any) => b.relationshipScore - a.relationshipScore);

      return {
        targetAddress: address,
        analysisTime: new Date().toISOString(),
        addressInfo: {
          transactionCount: txCount,
          totalAmount: totalAmount,
          firstSeen: firstSeen,
          lastSeen: lastSeen,
          isContract: isContract,
        },
        totalRelationships: relatedAddresses.length,
        relatedAddresses: relatedAddresses,
      };
    }
  } catch (error) {
    console.error("Error processing analysis result:", error);
  }

  // 返回默认结果
  return {
    targetAddress: targetAddress,
    analysisTime: new Date().toISOString(),
    addressInfo: {
      transactionCount: 0,
      totalAmount: 0,
      firstSeen: null,
      lastSeen: null,
      isContract: false,
    },
    totalRelationships: 0,
    relatedAddresses: [],
  };
}
