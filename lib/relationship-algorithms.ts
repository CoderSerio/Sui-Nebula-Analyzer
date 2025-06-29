/**
 * 地址关联性分析算法工具函数
 *
 * 注意：这里使用的是模拟算法，适用于MVP演示
 * 在生产环境中，建议使用更复杂的机器学习算法
 */

// 关联类型定义
export type RelationshipType = "strong" | "medium" | "weak";

// 关联分析结果接口
export interface RelationshipAnalysis {
  score: number;
  type: RelationshipType;
  factors: {
    commonTransactions: number;
    amountCorrelation: number;
    timePatternSimilarity: number;
    frequencyCorrelation: number;
  };
}

/**
 * 基础关联性评分算法（模拟版本）
 *
 * @param commonTransactions 共同交易次数
 * @param totalAmount 总交易金额
 * @param timespan 交互时间跨度（天）
 * @param frequency 交互频率
 * @returns 关联性评分 (0-1)
 */
export function calculateBasicRelationshipScore(
  commonTransactions: number,
  totalAmount: number,
  timespan: number = 30,
  frequency: number = 1
): number {
  // 模拟算法：基于多个因子的加权计算

  // 1. 交易次数因子 (0-0.4)
  const transactionFactor = Math.min(commonTransactions / 10, 1) * 0.4;

  // 2. 金额因子 (0-0.3)
  const amountFactor = Math.min(Math.log10(totalAmount + 1) / 4, 1) * 0.3;

  // 3. 时间因子 (0-0.2) - 时间跨度越短关联性越强
  const timeFactor = Math.max(0, (60 - timespan) / 60) * 0.2;

  // 4. 频率因子 (0-0.1)
  const frequencyFactor = Math.min(frequency / 5, 1) * 0.1;

  const score = transactionFactor + amountFactor + timeFactor + frequencyFactor;

  return Math.min(score, 1);
}

/**
 * 高级关联性分析（模拟版本）
 *
 * @param transactionData 交易数据
 * @returns 详细的关联性分析结果
 */
export function analyzeRelationship(transactionData: {
  commonTransactions: number;
  totalAmount: number;
  firstInteraction: Date;
  lastInteraction: Date;
  addresses: string[];
}): RelationshipAnalysis {
  const { commonTransactions, totalAmount, firstInteraction, lastInteraction } =
    transactionData;

  // 计算时间跨度
  const timespan = Math.ceil(
    (lastInteraction.getTime() - firstInteraction.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const frequency = timespan > 0 ? commonTransactions / timespan : 0;

  // 各种因子分析（模拟）
  const factors = {
    commonTransactions: Math.min(commonTransactions / 20, 1),
    amountCorrelation: Math.min(Math.log10(totalAmount + 1) / 6, 1),
    timePatternSimilarity: Math.random() * 0.8 + 0.1, // 模拟时间模式相似性
    frequencyCorrelation: Math.min(frequency, 1),
  };

  // 计算综合评分
  const score = calculateBasicRelationshipScore(
    commonTransactions,
    totalAmount,
    timespan,
    frequency
  );

  // 确定关联类型
  let type: RelationshipType;
  if (score >= 0.7) {
    type = "strong";
  } else if (score >= 0.4) {
    type = "medium";
  } else {
    type = "weak";
  }

  return {
    score,
    type,
    factors,
  };
}

/**
 * 批量关联性分析
 *
 * @param addressPairs 地址对数组
 * @param transactionData 交易数据映射
 * @returns 关联性分析结果数组
 */
export function batchAnalyzeRelationships(
  addressPairs: { addr1: string; addr2: string }[],
  transactionData: Map<string, any>
): RelationshipAnalysis[] {
  return addressPairs.map((pair) => {
    const key = `${pair.addr1}-${pair.addr2}`;
    const data = transactionData.get(key) || {
      commonTransactions: Math.floor(Math.random() * 10) + 1,
      totalAmount: Math.random() * 1000,
      firstInteraction: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ),
      lastInteraction: new Date(),
      addresses: [pair.addr1, pair.addr2],
    };

    return analyzeRelationship(data);
  });
}

/**
 * 地址聚类分析（模拟版本）
 * 根据关联性对地址进行聚类
 */
export function clusterAddresses(
  addresses: string[],
  relationshipMatrix: number[][]
): string[][] {
  // 简单的聚类算法实现（模拟）
  const clusters: string[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < addresses.length; i++) {
    if (visited.has(i)) continue;

    const cluster = [addresses[i]];
    visited.add(i);

    for (let j = i + 1; j < addresses.length; j++) {
      if (!visited.has(j) && relationshipMatrix[i][j] > 0.6) {
        cluster.push(addresses[j]);
        visited.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/* 
=== 生产环境推荐算法 ===

以下是一些生产环境中可以考虑的高级算法：

1. **机器学习方法**：
   - Random Forest / XGBoost: 多特征关联性预测
   - LSTM/GRU: 时间序列交易模式分析
   - Graph Neural Networks (GNN): 图结构关联学习

2. **图分析算法**：
   - PageRank: 节点重要性评估
   - Community Detection: 地址社区发现
   - Graph Embedding: 地址向量化表示

3. **统计学方法**：
   - Pearson/Spearman相关系数: 交易模式相关性
   - KS检验: 交易分布相似性测试
   - 时间序列分析: ARIMA, DTW等

4. **深度学习方法**：
   - Autoencoder: 异常交易检测
   - Transformer: 序列模式识别
   - GAT (Graph Attention Networks): 注意力机制图分析

5. **区块链专用方法**：
   - TxProbe: 交易探测算法
   - Heuristic Analysis: 启发式地址聚类
   - Change Address Detection: 找零地址识别

实施建议：
- 开始时使用简单的统计方法建立基线
- 收集足够的标注数据后引入机器学习
- 根据具体业务场景选择合适的算法组合
- 定期评估和调优算法效果
*/
