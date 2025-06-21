import NebulaHttpClient from "@/lib/nebula-http-client";

export async function GET() {
  let nebulaClient: NebulaHttpClient | null = null;

  try {
    console.log("=== Stats API Called ===");
    console.log("Creating NebulaHttpClient...");

    nebulaClient = new NebulaHttpClient();

    // 并行执行多个查询来获取统计数据
    console.log("Executing stats queries...");
    const [addressesResult, transactionsResult, relatedGroupsResult] =
      await Promise.all([
        // 获取钱包地址总数
        nebulaClient.executeQuery("MATCH (n:wallet) RETURN count(n) as count"),
        // 获取交易边总数
        nebulaClient.executeQuery(
          "MATCH ()-[e:transaction]->() RETURN count(e) as count"
        ),
        // 获取关联关系总数
        nebulaClient.executeQuery(
          "MATCH ()-[r:related_to]->() RETURN count(r) as count"
        ),
      ]);

    console.log("Query results:", {
      addresses: addressesResult,
      transactions: transactionsResult,
      relatedGroups: relatedGroupsResult,
    });

    const stats = {
      totalAddresses: addressesResult?.rows?.[0]?.[0] || 0,
      totalTransactions: transactionsResult?.rows?.[0]?.[0] || 0,
      relatedGroups: relatedGroupsResult?.rows?.[0]?.[0] || 0,
      lastUpdate: new Date().toISOString(),
    };

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
      error: "Database connection failed, showing offline mode",
    };

    console.log("Returning fallback stats due to error");
    return Response.json(fallbackStats);
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
