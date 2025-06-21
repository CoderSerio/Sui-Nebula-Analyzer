import type { NextRequest } from "next/server";
import GatewayClient from "@/lib/gateway-client";

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

  try {
    console.log("Creating GatewayClient...");
    const gatewayClient = new GatewayClient();

    console.log("Getting graph data from Gateway server...");
    const graphData = await gatewayClient.getGraphData(address);

    console.log("Graph data retrieved successfully");
    return Response.json(graphData);
  } catch (error) {
    console.error("=== Graph Data API Error ===");
    console.error("Error details:", error);

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
      error: "Gateway connection failed, showing offline mode",
    });
  }
}
