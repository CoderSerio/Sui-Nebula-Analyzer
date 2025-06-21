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
    const analysisResult = await gatewayClient.getAddressAnalysis(address);

    console.log("Address analysis retrieved successfully");
    return Response.json(analysisResult);
  } catch (error) {
    console.error("=== Address Analysis API Error ===");
    console.error("Error details:", error);

    // 返回默认分析结果而不是错误
    const fallbackAnalysis = {
      address: address,
      transactionCount: 0,
      totalAmount: 0,
      firstSeen: null,
      lastSeen: null,
      isContract: false,
      relationships: [],
      riskLevel: "unknown",
      analysisScore: 0,
      error: "Gateway connection failed, showing offline mode",
    };

    console.log("Returning fallback analysis due to error");
    return Response.json(fallbackAnalysis);
  }
}
