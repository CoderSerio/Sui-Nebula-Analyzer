import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3002";

// 执行Nebula查询
async function executeNebulaQuery(query: string) {
  const response = await fetch(`${GATEWAY_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gateway request failed: ${response.status} - ${errorText}`
    );
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Query failed");
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      queries: {},
    };

    // 检查图空间
    try {
      const spaceResult = await executeNebulaQuery("SHOW SPACES");
      debugInfo.queries.spaces = spaceResult;
    } catch (error) {
      debugInfo.queries.spaces = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 检查标签
    try {
      const tagResult = await executeNebulaQuery("USE sui_analysis; SHOW TAGS");
      debugInfo.queries.tags = tagResult;
    } catch (error) {
      debugInfo.queries.tags = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 检查边类型
    try {
      const edgeResult = await executeNebulaQuery(
        "USE sui_analysis; SHOW EDGES"
      );
      debugInfo.queries.edges = edgeResult;
    } catch (error) {
      debugInfo.queries.edges = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 统计钱包数量
    try {
      const walletCountResult = await executeNebulaQuery(
        "USE sui_analysis; MATCH (n:wallet) RETURN count(n) as count"
      );
      debugInfo.queries.walletCount = walletCountResult;
    } catch (error) {
      debugInfo.queries.walletCount = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 统计交易边数量
    try {
      const txCountResult = await executeNebulaQuery(
        "USE sui_analysis; MATCH ()-[e:transaction]->() RETURN count(e) as count"
      );
      debugInfo.queries.transactionCount = txCountResult;
    } catch (error) {
      debugInfo.queries.transactionCount = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 统计关联关系数量
    try {
      const relCountResult = await executeNebulaQuery(
        "USE sui_analysis; MATCH ()-[r:related_to]->() RETURN count(r) as count"
      );
      debugInfo.queries.relationshipCount = relCountResult;
    } catch (error) {
      debugInfo.queries.relationshipCount = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 获取一些示例数据
    try {
      const sampleWalletsResult = await executeNebulaQuery(
        "USE sui_analysis; MATCH (n:wallet) RETURN n LIMIT 3"
      );
      debugInfo.queries.sampleWallets = sampleWalletsResult;
    } catch (error) {
      debugInfo.queries.sampleWallets = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 获取一些示例交易
    try {
      const sampleTxResult = await executeNebulaQuery(
        "USE sui_analysis; MATCH ()-[e:transaction]->() RETURN e LIMIT 3"
      );
      debugInfo.queries.sampleTransactions = sampleTxResult;
    } catch (error) {
      debugInfo.queries.sampleTransactions = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // 检查是否有孤立的钱包（没有边连接的钱包）
    try {
      const isolatedWalletsResult = await executeNebulaQuery(`
        USE sui_analysis; 
        MATCH (n:wallet) 
        WHERE NOT (n)-[:transaction]-() AND NOT ()-[:transaction]-(n)
        RETURN count(n) as isolated_count
      `);
      debugInfo.queries.isolatedWallets = isolatedWalletsResult;
    } catch (error) {
      debugInfo.queries.isolatedWallets = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return NextResponse.json({
      success: true,
      debugInfo,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
