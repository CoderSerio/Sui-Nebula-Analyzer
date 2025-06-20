export async function POST() {
  try {
    // 模拟停止数据采集任务
    console.log("Stopping data collection")

    return Response.json({
      success: true,
      message: "Data collection stopped",
    })
  } catch (error) {
    console.error("Failed to stop data collection:", error)
    return Response.json({ error: "Failed to stop data collection" }, { status: 500 })
  }
}
