// Sui GraphQL API 数据采集脚本
import { GraphQLClient } from "graphql-request";

const SUI_GRAPHQL_ENDPOINT = "https://sui-mainnet.mystenlabs.com/graphql";

class SuiDataCollector {
  constructor() {
    this.client = new GraphQLClient(SUI_GRAPHQL_ENDPOINT);
    this.batchSize = 100;
  }

  // 获取指定区块范围内的交易
  async getTransactionsByBlockRange(startBlock, endBlock) {
    const query = `
      query GetTransactions($first: Int, $after: String) {
        transactionBlocks(
          first: $first
          after: $after
          filter: {
            afterCheckpoint: ${startBlock}
            beforeCheckpoint: ${endBlock}
          }
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            digest
            sender {
              address
            }
            gasInput {
              gasPrice
              gasBudget
            }
            effects {
              status {
                status
              }
              gasUsed {
                computationCost
                storageCost
                storageRebate
              }
            }
            timestamp
            balanceChanges {
              owner {
                ... on AddressOwner {
                  address
                }
              }
              amount
              coinType {
                repr
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.client.request(query, {
        first: this.batchSize,
      });

      return this.processTransactionData(data.transactionBlocks.nodes);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }

  // 处理交易数据，提取发送方、接收方、金额信息
  processTransactionData(transactions) {
    const processedData = [];

    transactions.forEach((tx) => {
      const sender = tx.sender.address;
      const timestamp = tx.timestamp;
      const txHash = tx.digest;
      const gasUsed = tx.effects?.gasUsed?.computationCost || 0 + tx.effects?.gasUsed?.storageCost || 0 + tx.effects?.gasUsed?.storageRebate || 0;
      const success = tx.effects?.status?.status === "success";

      // 处理余额变化，识别接收方
      tx.balanceChanges?.forEach((change) => {
        if (change.owner?.address && change.owner.address !== sender) {
          const receiver = change.owner.address;
          const amount = Math.abs(Number.parseFloat(change.amount) / 1000000000); // 转换为 SUI

          processedData.push({
            sender,
            receiver,
            amount,
            timestamp,
            txHash,
            gasUsed,
            success,
            coinType: change.coinType.repr,
          });
        }
      });
    });

    return processedData;
  }

  // 批量采集数据
  async collectDataBatch(startBlock, endBlock, onProgress) {
    const totalBlocks = endBlock - startBlock;
    let processedBlocks = 0;
    let allTransactions = [];

    for (let currentBlock = startBlock; currentBlock < endBlock; currentBlock += 1000) {
      const batchEndBlock = Math.min(currentBlock + 1000, endBlock);

      try {
        const transactions = await this.getTransactionsByBlockRange(currentBlock, batchEndBlock);
        allTransactions = allTransactions.concat(transactions);

        processedBlocks += batchEndBlock - currentBlock;
        const progress = (processedBlocks / totalBlocks) * 100;

        if (onProgress) {
          onProgress({
            progress,
            currentBlock: batchEndBlock,
            processedTransactions: allTransactions.length,
            totalTransactions: allTransactions.length,
          });
        }

        // 避免请求过于频繁
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing blocks ${currentBlock}-${batchEndBlock}:`, error);
      }
    }

    return allTransactions;
  }
}

// 关联地址分析算法
class AddressAnalyzer {
  constructor() {
    this.minCommonTransactions = 3; // 最少共同交易次数
    this.timeWindowHours = 24; // 时间窗口（小时）
  }

  // 分析地址关联性
  analyzeAddressRelationships(transactions, targetAddress) {
    const addressInteractions = new Map();
    const targetTransactions = transactions.filter((tx) => tx.sender === targetAddress || tx.receiver === targetAddress);

    // 统计与目标地址的交互
    targetTransactions.forEach((tx) => {
      const otherAddress = tx.sender === targetAddress ? tx.receiver : tx.sender;

      if (!addressInteractions.has(otherAddress)) {
        addressInteractions.set(otherAddress, {
          address: otherAddress,
          transactions: [],
          totalAmount: 0,
          firstInteraction: tx.timestamp,
          lastInteraction: tx.timestamp,
        });
      }

      const interaction = addressInteractions.get(otherAddress);
      interaction.transactions.push(tx);
      interaction.totalAmount += tx.amount;

      if (new Date(tx.timestamp) < new Date(interaction.firstInteraction)) {
        interaction.firstInteraction = tx.timestamp;
      }
      if (new Date(tx.timestamp) > new Date(interaction.lastInteraction)) {
        interaction.lastInteraction = tx.timestamp;
      }
    });

    // 计算关联度分数
    const relatedAddresses = [];
    addressInteractions.forEach((interaction) => {
      if (interaction.transactions.length >= this.minCommonTransactions) {
        const relationshipScore = this.calculateRelationshipScore(interaction);
        const relationshipType = this.getRelationshipType(relationshipScore);

        relatedAddresses.push({
          address: interaction.address,
          relationshipScore,
          commonTransactions: interaction.transactions.length,
          totalAmount: interaction.totalAmount,
          firstInteraction: interaction.firstInteraction,
          lastInteraction: interaction.lastInteraction,
          relationshipType,
        });
      }
    });

    // 按关联度排序
    relatedAddresses.sort((a, b) => b.relationshipScore - a.relationshipScore);

    return {
      targetAddress,
      relatedAddresses,
      analysisTime: new Date().toISOString(),
      totalRelationships: relatedAddresses.length,
    };
  }

  // 计算关联度分数
  calculateRelationshipScore(interaction) {
    const transactionCount = interaction.transactions.length;
    const totalAmount = interaction.totalAmount;
    const timeSpan = new Date(interaction.lastInteraction) - new Date(interaction.firstInteraction);
    const daySpan = timeSpan / (1000 * 60 * 60 * 24);

    // 综合考虑交易次数、金额、时间跨度
    let score = 0;

    // 交易次数权重 (40%)
    score += Math.min(transactionCount / 20, 1) * 0.4;

    // 交易金额权重 (30%)
    score += Math.min(totalAmount / 10000, 1) * 0.3;

    // 时间跨度权重 (30%) - 时间跨度越长，关联性越强
    score += Math.min(daySpan / 365, 1) * 0.3;

    return Math.min(score, 1);
  }

  // 确定关联类型
  getRelationshipType(score) {
    if (score >= 0.7) return "strong";
    if (score >= 0.4) return "medium";
    return "weak";
  }
}

export { SuiDataCollector, AddressAnalyzer };
