import type { NextRequest } from "next/server";
import NebulaHttpClient from "@/lib/nebula-http-client";

export async function GET(request: NextRequest) {
  console.log("=== Related Accounts API Called ===");

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const minScore = parseFloat(searchParams.get("minScore") || "0");

  const offset = (page - 1) * limit;

  let nebulaClient: NebulaHttpClient | null = null;

  try {
    console.log("Creating NebulaHttpClient...");
    nebulaClient = new NebulaHttpClient();

    // 查询关联账户对，按关联分数排序
    const query = `
      USE sui_analysis;
      MATCH (v1:wallet)-[r:related_to]-(v2:wallet)
      WHERE r.relationship_score >= ${minScore}
      RETURN v1.wallet.address AS address1,
             v2.wallet.address AS address2,
             v1.wallet.transaction_count AS tx_count1,
             v2.wallet.transaction_count AS tx_count2,
             v1.wallet.total_amount AS total_amount1,
             v2.wallet.total_amount AS total_amount2,
             r.relationship_score AS score,
             r.common_transactions AS common_tx,
             r.total_amount AS relation_amount,
             r.relationship_type AS type,
             r.first_interaction AS first_interaction,
             r.last_interaction AS last_interaction
      ORDER BY r.relationship_score DESC
      LIMIT ${limit}
      SKIP ${offset}
    `;

    console.log("Executing related accounts query...");
    const result = await nebulaClient.executeQuery(query);

    const relatedAccounts = processRelatedAccountsResult(result);

    console.log(`Found ${relatedAccounts.length} related account pairs`);

    return Response.json({
      data: relatedAccounts,
      pagination: {
        page,
        limit,
        total: relatedAccounts.length,
        hasMore: relatedAccounts.length === limit,
      },
    });
  } catch (error) {
    console.error("=== Related Accounts API Error ===");
    console.error("Error details:", error);

    return Response.json({
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        hasMore: false,
      },
      error: "Failed to fetch related accounts",
    });
  } finally {
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

// 处理关联账户查询结果
function processRelatedAccountsResult(result: any) {
  const accounts: any[] = [];

  try {
    if (
      result &&
      result.data &&
      result.data.rows &&
      result.data.rows.length > 0
    ) {
      const columns = result.data.column_names || [];

      const address1Index = columns.indexOf("address1");
      const address2Index = columns.indexOf("address2");
      const txCount1Index = columns.indexOf("tx_count1");
      const txCount2Index = columns.indexOf("tx_count2");
      const totalAmount1Index = columns.indexOf("total_amount1");
      const totalAmount2Index = columns.indexOf("total_amount2");
      const scoreIndex = columns.indexOf("score");
      const commonTxIndex = columns.indexOf("common_tx");
      const relationAmountIndex = columns.indexOf("relation_amount");
      const typeIndex = columns.indexOf("type");
      const firstInteractionIndex = columns.indexOf("first_interaction");
      const lastInteractionIndex = columns.indexOf("last_interaction");

      result.data.rows.forEach((row: any[], index: number) => {
        try {
          const account = {
            id: `${row[address1Index]}-${row[address2Index]}`,
            address1: address1Index >= 0 ? row[address1Index] : "",
            address2: address2Index >= 0 ? row[address2Index] : "",
            transactionCount1: txCount1Index >= 0 ? row[txCount1Index] || 0 : 0,
            transactionCount2: txCount2Index >= 0 ? row[txCount2Index] || 0 : 0,
            totalAmount1:
              totalAmount1Index >= 0 ? row[totalAmount1Index] || 0 : 0,
            totalAmount2:
              totalAmount2Index >= 0 ? row[totalAmount2Index] || 0 : 0,
            relationshipScore: scoreIndex >= 0 ? row[scoreIndex] || 0 : 0,
            commonTransactions:
              commonTxIndex >= 0 ? row[commonTxIndex] || 0 : 0,
            relationAmount:
              relationAmountIndex >= 0 ? row[relationAmountIndex] || 0 : 0,
            relationshipType:
              typeIndex >= 0 ? row[typeIndex] || "unknown" : "unknown",
            firstInteraction:
              firstInteractionIndex >= 0
                ? row[firstInteractionIndex] || null
                : null,
            lastInteraction:
              lastInteractionIndex >= 0
                ? row[lastInteractionIndex] || null
                : null,
          };

          accounts.push(account);
        } catch (rowError) {
          console.error(`Error processing row ${index + 1}:`, rowError);
        }
      });
    }
  } catch (processingError) {
    console.error("Error processing related accounts result:", processingError);
  }

  return accounts;
}
