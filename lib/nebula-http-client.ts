// HTTP-based NebulaGraph 客户端
class NebulaHttpClient {
  private config: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };

  constructor() {
    this.config = {
      host: process.env.NEBULA_HOST || "localhost",
      port: Number(process.env.NEBULA_HTTP_PORT) || 19669, // HTTP端口通常是19669
      username: process.env.NEBULA_USERNAME || "root",
      password: process.env.NEBULA_PASSWORD || "nebula",
      space: process.env.NEBULA_SPACE || "sui_analysis",
    };

    console.log("NebulaHttpClient config:", {
      ...this.config,
      password: "***", // 隐藏密码
    });
  }

  // 执行 nGQL 查询通过HTTP API
  async executeQuery(query: string) {
    try {
      console.log("Executing NebulaGraph HTTP query:", query);

      const url = `http://${this.config.host}:${this.config.port}/api/query`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gql: query,
          space: this.config.space,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("HTTP query response received");
      console.log("Response structure:", {
        error_code: result?.error_code,
        has_data: !!result?.data,
        data_keys: result?.data ? Object.keys(result.data) : null,
      });

      // 检查查询是否成功
      if (result.error_code !== 0) {
        throw new Error(`NebulaGraph query failed: ${result.error_msg}`);
      }

      return result;
    } catch (error) {
      console.error("NebulaGraph HTTP query execution failed:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error,
      });
      throw error;
    }
  }

  // 获取地址的交易网络数据
  async getAddressNetwork(address: string, depth: number = 2) {
    const query = `
      USE ${this.config.space};
      MATCH (v1:wallet {address: "${address}"})-[e:transaction]-(v2:wallet)
      RETURN v1.wallet.address AS source_address,
             v2.wallet.address AS target_address,
             v1.wallet.transaction_count AS source_tx_count,
             v2.wallet.transaction_count AS target_tx_count,
             v1.wallet.total_amount AS source_amount,
             v2.wallet.total_amount AS target_amount,
             e.amount AS edge_amount,
             count(e) AS transaction_count
      LIMIT 50
    `;

    try {
      console.log(`Getting address network for: ${address}`);
      const result = await this.executeQuery(query);
      console.log("Processing network result...");

      return this.processNetworkResult(result, address);
    } catch (error) {
      console.error("Failed to get address network:", error);

      // 返回包含目标地址的基本结构，而不是抛出错误
      return {
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
      };
    }
  }

  // 获取地址的关联分析数据
  async getAddressAnalysis(address: string) {
    const query = `
      USE ${this.config.space};
      MATCH (target:wallet {address: "${address}"})-[r:related_to]-(related:wallet)
      RETURN related.wallet.address AS related_address,
             r.relationship_score AS relationship_score,
             r.common_transactions AS common_transactions,
             r.total_amount AS total_amount,
             r.first_interaction AS first_interaction,
             r.last_interaction AS last_interaction,
             r.relationship_type AS relationship_type
      ORDER BY r.relationship_score DESC
      LIMIT 20
    `;

    try {
      console.log(`Getting address analysis for: ${address}`);
      const result = await this.executeQuery(query);
      console.log("Processing analysis result...");

      return this.processAnalysisResult(result, address);
    } catch (error) {
      console.error("Failed to get address analysis:", error);

      // 返回空分析结果，而不是抛出错误
      return {
        targetAddress: address,
        analysisTime: new Date().toISOString(),
        totalRelationships: 0,
        relatedAddresses: [],
      };
    }
  }

  // 处理网络查询结果
  private processNetworkResult(result: any, targetAddress: string) {
    console.log("Processing network result, result type:", typeof result);

    const nodes = new Map();
    const links: any[] = [];

    // 添加目标节点
    nodes.set(targetAddress, {
      id: targetAddress,
      address: targetAddress,
      type: "target",
      transactionCount: 0,
      totalAmount: 0,
    });

    // 处理从 NebulaGraph 返回的实际数据
    try {
      // NebulaGraph返回的数据结构: { error_code: 0, data: { column_names: [...], rows: [...] } }
      if (
        result &&
        result.data &&
        result.data.rows &&
        result.data.rows.length > 0
      ) {
        console.log(`Found ${result.data.rows.length} rows`);
        console.log("Column names:", result.data.column_names);

        const columns = result.data.column_names || [];
        const sourceAddrIndex = columns.indexOf("source_address");
        const targetAddrIndex = columns.indexOf("target_address");
        const sourceTxCountIndex = columns.indexOf("source_tx_count");
        const targetTxCountIndex = columns.indexOf("target_tx_count");
        const sourceAmountIndex = columns.indexOf("source_amount");
        const targetAmountIndex = columns.indexOf("target_amount");
        const edgeAmountIndex = columns.indexOf("edge_amount");
        const transactionCountIndex = columns.indexOf("transaction_count");

        result.data.rows.forEach((row: any[], index: number) => {
          console.log(`Processing row ${index + 1}:`, row);

          try {
            const sourceAddr =
              sourceAddrIndex >= 0 ? row[sourceAddrIndex] : null;
            const targetAddr =
              targetAddrIndex >= 0 ? row[targetAddrIndex] : null;
            const sourceTxCount =
              sourceTxCountIndex >= 0 ? row[sourceTxCountIndex] || 0 : 0;
            const targetTxCount =
              targetTxCountIndex >= 0 ? row[targetTxCountIndex] || 0 : 0;
            const sourceAmount =
              sourceAmountIndex >= 0 ? row[sourceAmountIndex] || 0 : 0;
            const targetAmount =
              targetAmountIndex >= 0 ? row[targetAmountIndex] || 0 : 0;
            const edgeAmount =
              edgeAmountIndex >= 0 ? row[edgeAmountIndex] || 0 : 0;
            const transactionCount =
              transactionCountIndex >= 0 ? row[transactionCountIndex] || 1 : 1;

            // 添加源节点
            if (sourceAddr && !nodes.has(sourceAddr)) {
              nodes.set(sourceAddr, {
                id: sourceAddr,
                address: sourceAddr,
                type: sourceAddr === targetAddress ? "target" : "related",
                transactionCount: sourceTxCount,
                totalAmount: sourceAmount,
              });
            }

            // 添加目标节点
            if (targetAddr && !nodes.has(targetAddr)) {
              nodes.set(targetAddr, {
                id: targetAddr,
                address: targetAddr,
                type: targetAddr === targetAddress ? "target" : "related",
                transactionCount: targetTxCount,
                totalAmount: targetAmount,
              });
            }

            // 添加边
            if (sourceAddr && targetAddr) {
              links.push({
                source: sourceAddr,
                target: targetAddr,
                transactionCount: transactionCount,
                totalAmount: edgeAmount,
              });
            }
          } catch (rowError) {
            console.error(`Error processing row ${index + 1}:`, rowError);
          }
        });
      } else {
        console.log("No rows found in result");
      }
    } catch (processingError) {
      console.error("Error processing network result:", processingError);
    }

    const finalResult = {
      nodes: Array.from(nodes.values()),
      links: links,
    };

    console.log("Final network result:", {
      nodeCount: finalResult.nodes.length,
      linkCount: finalResult.links.length,
    });

    return finalResult;
  }

  // 处理关联分析查询结果
  private processAnalysisResult(result: any, targetAddress: string) {
    console.log("Processing analysis result, result type:", typeof result);

    const relatedAddresses: any[] = [];

    try {
      // NebulaGraph返回的数据结构: { error_code: 0, data: { column_names: [...], rows: [...] } }
      if (
        result &&
        result.data &&
        result.data.rows &&
        result.data.rows.length > 0
      ) {
        console.log(`Found ${result.data.rows.length} analysis rows`);
        console.log("Column names:", result.data.column_names);

        const columns = result.data.column_names || [];
        const relatedAddrIndex = columns.indexOf("related_address");
        const relationshipScoreIndex = columns.indexOf("relationship_score");
        const commonTransactionsIndex = columns.indexOf("common_transactions");
        const totalAmountIndex = columns.indexOf("total_amount");
        const firstInteractionIndex = columns.indexOf("first_interaction");
        const lastInteractionIndex = columns.indexOf("last_interaction");
        const relationshipTypeIndex = columns.indexOf("relationship_type");

        result.data.rows.forEach((row: any[], index: number) => {
          console.log(`Processing analysis row ${index + 1}:`, row);

          try {
            const relationshipScore =
              relationshipScoreIndex >= 0
                ? row[relationshipScoreIndex] || 0
                : 0;
            let relationshipType = "weak";

            if (relationshipScore >= 0.7) {
              relationshipType = "strong";
            } else if (relationshipScore >= 0.4) {
              relationshipType = "medium";
            }

            const relatedAddress =
              relatedAddrIndex >= 0 ? row[relatedAddrIndex] : null;
            if (relatedAddress) {
              relatedAddresses.push({
                address: relatedAddress,
                relationshipScore: relationshipScore,
                commonTransactions:
                  commonTransactionsIndex >= 0
                    ? row[commonTransactionsIndex] || 0
                    : 0,
                totalAmount:
                  totalAmountIndex >= 0 ? row[totalAmountIndex] || 0 : 0,
                firstInteraction:
                  firstInteractionIndex >= 0
                    ? row[firstInteractionIndex] || new Date().toISOString()
                    : new Date().toISOString(),
                lastInteraction:
                  lastInteractionIndex >= 0
                    ? row[lastInteractionIndex] || new Date().toISOString()
                    : new Date().toISOString(),
                relationshipType:
                  relationshipTypeIndex >= 0
                    ? row[relationshipTypeIndex] || relationshipType
                    : relationshipType,
              });
            }
          } catch (rowError) {
            console.error(
              `Error processing analysis row ${index + 1}:`,
              rowError
            );
          }
        });
      } else {
        console.log("No analysis rows found in result");
      }
    } catch (processingError) {
      console.error("Error processing analysis result:", processingError);
    }

    const finalResult = {
      targetAddress: targetAddress,
      analysisTime: new Date().toISOString(),
      totalRelationships: relatedAddresses.length,
      relatedAddresses: relatedAddresses,
    };

    console.log("Final analysis result:", {
      targetAddress: finalResult.targetAddress,
      relationshipCount: finalResult.totalRelationships,
    });

    return finalResult;
  }

  // 关闭连接（HTTP客户端不需要特殊关闭操作）
  async close() {
    console.log("NebulaHttpClient closed");
  }
}

export default NebulaHttpClient;
