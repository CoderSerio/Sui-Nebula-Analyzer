export async function POST(request: Request) {
  try {
    const { startBlock, endBlock, batchSize } = await request.json()

    // 验证参数
    if (!startBlock || !endBlock || startBlock >= endBlock) {
      return Response.json({ error: "Invalid block range" }, { status: 400 })
    }

    // 模拟启动数据采集任务
    // 实际实现中应该：
    // 1. 连接到 Sui GraphQL API
    // 2. 启动后台任务采集交易数据
    // 3. 将数据存储到 NebulaGraph

    console.log(`Starting data collection from block ${startBlock} to ${endBlock}`)

    return Response.json({
      success: true,
      message: "Data collection started",
      startBlock,
      endBlock,
      batchSize,
    })
  } catch (error) {
    console.error("Failed to start data collection:", error)
    return Response.json({ error: "Failed to start data collection" }, { status: 500 })
  }
}
