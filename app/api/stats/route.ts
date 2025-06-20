export async function GET() {
  try {
    // 模拟从 NebulaGraph 获取统计数据
    // 实际实现中应该连接到 NebulaGraph 数据库
    const stats = {
      totalAddresses: 15420,
      totalTransactions: 89650,
      relatedGroups: 234,
      lastUpdate: new Date().toISOString(),
    }

    return Response.json(stats)
  } catch (error) {
    console.error("Failed to fetch stats:", error)
    return Response.json({ error: "Failed to fetch statistics" }, { status: 500 })
  }
}
