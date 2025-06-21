import type { NextRequest } from "next/server";
import GatewayClient from "@/lib/gateway-client";

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

  try {
    console.log("Creating GatewayClient...");
    const gatewayClient = new GatewayClient();

    console.log("Getting address analysis from Gateway server...");
    const gatewayResult = await gatewayClient.getAddressAnalysis(address);

    // 同时获取相关账户数据
    const relatedAccountsResult = await gatewayClient.getRelatedAccounts(
      address,
      20
    );

    // 转换数据格式以匹配前端期望
    const analysisResult = {
      targetAddress: gatewayResult.address,
      relatedAddresses:
        relatedAccountsResult.accounts?.map((account: any) => ({
          address: account.address,
          relationshipScore: account.relationshipScore || 0,
          commonTransactions: account.commonTransactions || 0,
          totalAmount: account.totalAmount || 0,
          firstInteraction: new Date().toISOString(), // 默认值
          lastInteraction: new Date().toISOString(), // 默认值
          relationshipType:
            account.relationshipScore > 0.8
              ? "strong"
              : account.relationshipScore > 0.5
              ? "medium"
              : "weak",
        })) || [],
      analysisTime: new Date().toISOString(),
      totalRelationships: relatedAccountsResult.totalFound || 0,
      // 保留原始数据用于调试
      rawData: gatewayResult,
    };

    console.log("Address analysis retrieved successfully");
    return Response.json(analysisResult);
  } catch (error) {
    console.error("=== Address Analysis API Error ===");
    console.error("Error details:", error);

    // 返回默认分析结果而不是错误
    const fallbackAnalysis = {
      targetAddress: address,
      relatedAddresses: [],
      analysisTime: new Date().toISOString(),
      totalRelationships: 0,
      error: "Gateway connection failed, showing offline mode",
    };

    console.log("Returning fallback analysis due to error");
    return Response.json(fallbackAnalysis);
  }
}
