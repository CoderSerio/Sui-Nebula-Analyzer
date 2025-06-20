export async function GET() {
  try {
    // 模拟采集状态
    // 实际实现中应该从任务队列或数据库获取真实状态
    const mockStatus = {
      isRunning: Math.random() > 0.7, // 随机模拟运行状态
      progress: Math.min(100, Math.random() * 100),
      currentBlock: 1000000 + Math.floor(Math.random() * 1000),
      totalTransactions: 50000 + Math.floor(Math.random() * 10000),
      processedTransactions: 30000 + Math.floor(Math.random() * 15000),
      errors: Math.floor(Math.random() * 5),
    }

    return Response.json(mockStatus)
  } catch (error) {
    console.error("Failed to get collection status:", error)
    return Response.json({ error: "Failed to get collection status" }, { status: 500 })
  }
}
