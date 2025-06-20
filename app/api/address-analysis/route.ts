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

    const analysisResult = await nebulaClient.getAddressAnalysis(address);
    console.log("Analysis data retrieved successfully");

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
