import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get("address")

  if (!address) {
    return Response.json({ error: "Address parameter is required" }, { status: 400 })
  }

  try {
    // 模拟从 NebulaGraph 查询图数据
    // 实际实现中应该执行 nGQL 查询
    const mockGraphData = {
      nodes: [
        {
          id: address,
          address: address,
          type: "target",
          transactionCount: 25,
          totalAmount: 1250.5,
        },
        {
          id: "0x1234567890abcdef1234567890abcdef12345678",
          address: "0x1234567890abcdef1234567890abcdef12345678",
          type: "related",
          transactionCount: 15,
          totalAmount: 750.2,
        },
        {
          id: "0xabcdef1234567890abcdef1234567890abcdef12",
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
          type: "related",
          transactionCount: 8,
          totalAmount: 420.1,
        },
        {
          id: "0x9876543210fedcba9876543210fedcba98765432",
          address: "0x9876543210fedcba9876543210fedcba98765432",
          type: "normal",
          transactionCount: 3,
          totalAmount: 150.0,
        },
      ],
      links: [
        {
          source: address,
          target: "0x1234567890abcdef1234567890abcdef12345678",
          transactionCount: 12,
          totalAmount: 600.0,
        },
        {
          source: address,
          target: "0xabcdef1234567890abcdef1234567890abcdef12",
          transactionCount: 5,
          totalAmount: 250.0,
        },
        {
          source: "0x1234567890abcdef1234567890abcdef12345678",
          target: "0xabcdef1234567890abcdef1234567890abcdef12",
          transactionCount: 8,
          totalAmount: 400.0,
        },
        {
          source: address,
          target: "0x9876543210fedcba9876543210fedcba98765432",
          transactionCount: 2,
          totalAmount: 100.0,
        },
      ],
    }

    return Response.json(mockGraphData)
  } catch (error) {
    console.error("Failed to fetch graph data:", error)
    return Response.json({ error: "Failed to fetch graph data" }, { status: 500 })
  }
}
