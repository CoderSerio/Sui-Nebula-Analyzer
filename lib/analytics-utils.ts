/**
 * 区块链交易关联性分析工具函数
 *
 * 这个文件包含所有用于分析地址关联性的算法和工具函数
 */

export interface RelatedAccountPair {
  addr1: string;
  addr2: string;
  relationshipScore: number;
  commonTransactions: number;
  amount: number;
  type: string;
}

export interface AddressPairStats {
  count: number;
  totalAmount: number;
}

/**
 * 计算两个地址之间的关联性评分
 *
 * @param transactionCount 交易次数
 * @param totalAmount 总交易金额
 * @param timespan 时间跨度（天）
 * @param options 额外选项
 * @returns 关联性评分 (0-1)
 */
export function calculateRelationshipScore(
  transactionCount: number,
  totalAmount: number,
  timespan: number = 30,
  options: {
    txWeight?: number;
    amountWeight?: number;
    maxTxForFullScore?: number;
    maxAmountLog?: number;
  } = {}
): number {
  const {
    txWeight = 0.7,
    amountWeight = 0.3,
    maxTxForFullScore = 5,
    maxAmountLog = 10,
  } = options;

  // 交易次数权重：交易次数越多，关联性越强
  const txScore = Math.min(transactionCount / maxTxForFullScore, 1) * txWeight;

  // 金额权重：使用对数缩放，避免极大值主导
  const amountScore =
    Math.min(Math.log10(Math.abs(totalAmount) + 1) / maxAmountLog, 1) *
    amountWeight;

  // 最终评分
  const score = Math.min(txScore + amountScore, 1);

  return score;
}

/**
 * 从交易边数据聚合地址对统计信息
 *
 * @param transactionData 交易边数据
 * @returns 地址对统计信息映射
 */
export function aggregateAddressPairs(transactionData: {
  addr1: string[];
  addr2: string[];
  amount: number[];
}): Map<string, AddressPairStats> {
  const addressPairs = new Map<string, AddressPairStats>();

  for (let i = 0; i < transactionData.addr1.length; i++) {
    const addr1 = transactionData.addr1[i];
    const addr2 = transactionData.addr2[i];
    const amount = transactionData.amount?.[i] || 0;

    // 创建标准化的地址对key（按字母顺序排序）
    const key = addr1 < addr2 ? `${addr1}:${addr2}` : `${addr2}:${addr1}`;

    if (addressPairs.has(key)) {
      const existing = addressPairs.get(key)!;
      existing.count += 1;
      existing.totalAmount += amount;
    } else {
      addressPairs.set(key, { count: 1, totalAmount: amount });
    }
  }

  return addressPairs;
}

/**
 * 将地址对统计信息转换为关联账户对列表
 *
 * @param addressPairs 地址对统计信息
 * @param minScore 最小关联分数阈值
 * @param scoreOptions 评分选项
 * @returns 关联账户对列表
 */
export function convertToRelatedAccountPairs(
  addressPairs: Map<string, AddressPairStats>,
  minScore: number = 0.1,
  scoreOptions?: Parameters<typeof calculateRelationshipScore>[3]
): RelatedAccountPair[] {
  const relationships: RelatedAccountPair[] = [];

  for (const [key, stats] of addressPairs.entries()) {
    const [addr1, addr2] = key.split(":");

    // 计算关联性评分
    const score = calculateRelationshipScore(
      stats.count,
      stats.totalAmount,
      30, // 默认30天时间跨度
      scoreOptions
    );

    if (score >= minScore) {
      relationships.push({
        addr1,
        addr2,
        relationshipScore: score,
        commonTransactions: stats.count,
        amount: stats.totalAmount,
        type: "inferred",
      });
    }
  }

  // 按关联强度排序
  relationships.sort((a, b) => b.relationshipScore - a.relationshipScore);

  return relationships;
}

/**
 * 批量处理交易数据并返回关联账户对
 *
 * @param transactionData 原始交易数据
 * @param minScore 最小关联分数
 * @param options 处理选项
 * @returns 关联账户对列表
 */
export function processTransactionDataToRelationships(
  transactionData: {
    addr1: string[];
    addr2: string[];
    amount: number[];
  },
  minScore: number = 0.1,
  options: {
    enableLogging?: boolean;
    scoreOptions?: Parameters<typeof calculateRelationshipScore>[3];
  } = {}
): RelatedAccountPair[] {
  const { enableLogging = false, scoreOptions } = options;

  if (enableLogging) {
    console.log("原始交易数据条数:", transactionData.addr1.length);
  }

  // 聚合地址对数据
  const addressPairs = aggregateAddressPairs(transactionData);

  if (enableLogging) {
    console.log("聚合后的地址对数量:", addressPairs.size);
  }

  // 转换为关联关系并评分
  const relationships = convertToRelatedAccountPairs(
    addressPairs,
    minScore,
    scoreOptions
  );

  if (enableLogging) {
    console.log("符合条件的关联关系数量:", relationships.length);

    // 详细日志
    relationships.slice(0, 5).forEach((rel, index) => {
      console.log(
        `关联关系 ${index + 1}: ${rel.addr1.slice(0, 8)}...${rel.addr2.slice(
          0,
          8
        )} - 交易${rel.commonTransactions}次, 金额${rel.amount.toFixed(
          2
        )}, 评分${rel.relationshipScore.toFixed(3)}`
      );
    });
  }

  return relationships;
}

/**
 * 关联强度分级
 */
export function getRelationshipLevel(score: number): {
  level: "strong" | "medium" | "weak" | "very_weak";
  label: string;
  color: string;
} {
  if (score >= 0.7) {
    return { level: "strong", label: "强关联", color: "red" };
  } else if (score >= 0.4) {
    return { level: "medium", label: "中关联", color: "orange" };
  } else if (score >= 0.2) {
    return { level: "weak", label: "弱关联", color: "yellow" };
  } else {
    return { level: "very_weak", label: "低关联", color: "gray" };
  }
}

/**
 * 格式化地址显示
 */
export function formatAddress(
  address: string,
  startLength: number = 8,
  endLength: number = 8
): string {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * 获取评分对应的Badge颜色类名
 */
export function getScoreBadgeColor(score: number): string {
  const level = getRelationshipLevel(score);
  switch (level.level) {
    case "strong":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-orange-100 text-orange-800";
    case "weak":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/* 
=== 评分算法说明 ===

当前实现的是基础版本的多因子评分模型：

1. **交易次数因子** (权重 0.7)
   - 两个地址之间的直接交易次数
   - 认为交易次数越多，关联性越强

2. **金额因子** (权重 0.3)  
   - 使用对数缩放处理交易金额
   - 避免极大金额交易过度影响评分

3. **可扩展性**
   - 可以轻松调整各因子权重
   - 可以添加时间模式、频率等新因子

=== 生产环境建议 ===

对于更复杂的生产环境，建议考虑以下算法：

1. **机器学习方法**
   - 使用历史标注数据训练分类模型
   - Random Forest / XGBoost 进行多特征学习

2. **图算法**
   - PageRank 计算节点重要性
   - Community Detection 发现地址聚类
   - Graph Embedding 学习地址向量表示

3. **时间序列分析**
   - 分析交易时间模式相似性
   - DTW (Dynamic Time Warping) 计算时间序列距离

4. **统计学方法**
   - Pearson/Spearman 相关系数
   - Kolmogorov-Smirnov 检验分布相似性
*/
