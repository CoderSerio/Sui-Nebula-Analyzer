import GatewayClient from "@/lib/gateway-client";

export async function GET() {
  try {
    console.log("=== Stats API Called ===");
    console.log("Creating GatewayClient...");

    const gatewayClient = new GatewayClient();

    console.log("Getting stats from Gateway server...");
    const stats = await gatewayClient.getStats();

    console.log("Stats retrieved successfully:", stats);
    return Response.json(stats);
  } catch (error) {
    console.error("=== Stats API Error ===");
    console.error("Error details:", error);

    // 返回默认统计数据而不是错误，确保前端能正常显示
    const fallbackStats = {
      totalAddresses: 0,
      totalTransactions: 0,
      relatedGroups: 0,
      lastUpdate: new Date().toISOString(),
      error: "Gateway connection failed, showing offline mode",
    };

    console.log("Returning fallback stats due to error");
    return Response.json(fallbackStats);
  }
}
