// 数据采集脚本 - 将 Sui 交易数据保存为 CSV 文件
import { SuiDataCollector } from './sui-data-collector.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 开始采集 Sui 交易数据...');

  // 1. 初始化采集器
  const collector = new SuiDataCollector();

  try {
    // 2. 配置采集参数
    const startBlock = 7000000;  // 起始区块号
    const endBlock = 7000500;    // 结束区块号（采集 500 个区块）

    console.log(`📊 开始采集区块 ${startBlock} 到 ${endBlock} 的交易数据...`);

    // 3. 采集交易数据
    const transactions = await collector.collectDataBatch(
      startBlock,
      endBlock,
      (progress) => {
        console.log(`📈 进度: ${progress.progress.toFixed(1)}% | 当前区块: ${progress.currentBlock} | 已处理交易: ${progress.processedTransactions}`);
      }
    );

    console.log(`✅ 数据采集完成，共获取 ${transactions.length} 条交易`);

    if (transactions.length === 0) {
      console.log('⚠️  没有找到交易数据，请检查区块范围是否正确');
      return;
    }

    // 4. 生成 CSV 文件
    console.log('💾 生成 CSV 文件...');

    // 创建数据目录
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 生成交易数据 CSV
    const transactionsCsv = generateTransactionsCsv(transactions);
    const transactionsFile = path.join(dataDir, `sui-transactions-${startBlock}-${endBlock}.csv`);
    fs.writeFileSync(transactionsFile, transactionsCsv);

    // 生成地址数据 CSV
    const addressesCsv = generateAddressesCsv(transactions);
    const addressesFile = path.join(dataDir, `sui-addresses-${startBlock}-${endBlock}.csv`);
    fs.writeFileSync(addressesFile, addressesCsv);

    console.log('✅ CSV 文件生成完成！');
    console.log(`📁 交易数据: ${transactionsFile}`);
    console.log(`📁 地址数据: ${addressesFile}`);
    console.log(`📊 统计信息:`);
    console.log(`   - 交易数量: ${transactions.length}`);
    console.log(`   - 唯一地址数量: ${getUniqueAddresses(transactions).length}`);

    // 5. 生成导入说明
    generateImportInstructions(dataDir, startBlock, endBlock);

  } catch (error) {
    console.error('❌ 数据采集过程中出现错误:', error);
  }
}

// 生成交易数据 CSV
function generateTransactionsCsv(transactions) {
  const headers = [
    'sender',
    'receiver',
    'amount',
    'timestamp',
    'tx_hash',
    'gas_used',
    'success',
    'coin_type'
  ];

  const csvRows = [headers.join(',')];

  transactions.forEach(tx => {
    const row = [
      `"${tx.sender}"`,
      `"${tx.receiver}"`,
      tx.amount,
      `"${tx.timestamp}"`,
      `"${tx.txHash}"`,
      tx.gasUsed,
      tx.success,
      `"${tx.coinType}"`
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

// 生成地址数据 CSV
function generateAddressesCsv(transactions) {
  const addresses = getUniqueAddresses(transactions);

  const headers = [
    'address',
    'first_seen',
    'last_seen',
    'transaction_count',
    'total_amount',
    'is_contract'
  ];

  const csvRows = [headers.join(',')];

  addresses.forEach(addr => {
    const addrTransactions = transactions.filter(tx =>
      tx.sender === addr.address || tx.receiver === addr.address
    );

    const timestamps = addrTransactions.map(tx => new Date(tx.timestamp));
    const firstSeen = new Date(Math.min(...timestamps)).toISOString();
    const lastSeen = new Date(Math.max(...timestamps)).toISOString();

    const totalAmount = addrTransactions.reduce((sum, tx) => {
      if (tx.sender === addr.address) return sum - tx.amount;
      if (tx.receiver === addr.address) return sum + tx.amount;
      return sum;
    }, 0);

    const row = [
      `"${addr.address}"`,
      `"${firstSeen}"`,
      `"${lastSeen}"`,
      addrTransactions.length,
      totalAmount,
      false // 简化处理，暂时都设为 false
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

// 获取唯一地址列表
function getUniqueAddresses(transactions) {
  const addresses = new Set();

  transactions.forEach(tx => {
    addresses.add(tx.sender);
    addresses.add(tx.receiver);
  });

  return Array.from(addresses).map(addr => ({ address: addr }));
}

// 生成导入说明文件
function generateImportInstructions(dataDir, startBlock, endBlock) {
  const instructions = `# NebulaGraph Studio 数据导入说明

## 文件说明
- \`sui-transactions-${startBlock}-${endBlock}.csv\`: 交易边数据
- \`sui-addresses-${startBlock}-${endBlock}.csv\`: 地址节点数据

## 导入步骤

### 1. 导入地址节点
1. 打开 NebulaGraph Studio
2. 进入 "Import" 页面
3. 选择 "Vertex" 类型
4. 上传 \`sui-addresses-${startBlock}-${endBlock}.csv\`
5. 配置映射：
   - VID: address
   - Tag: wallet
   - Properties: first_seen, last_seen, transaction_count, total_amount, is_contract

### 2. 导入交易边
1. 选择 "Edge" 类型
2. 上传 \`sui-transactions-${startBlock}-${endBlock}.csv\`
3. 配置映射：
   - Source VID: sender
   - Destination VID: receiver
   - Edge Type: transaction
   - Properties: amount, timestamp, tx_hash, gas_used, success, coin_type

### 3. 验证数据
在 Console 中执行：
\`\`\`ngql
USE sui_analysis;
MATCH (v:wallet) RETURN count(v);
MATCH ()-[e:transaction]->() RETURN count(e);
\`\`\`

## 注意事项
- 确保图空间 \`sui_analysis\` 已创建
- 确保 Tag \`wallet\` 和 Edge Type \`transaction\` 已定义
- 导入大量数据时可能需要较长时间
`;

  const instructionsFile = path.join(dataDir, 'IMPORT_INSTRUCTIONS.md');
  fs.writeFileSync(instructionsFile, instructions);
  console.log(`📖 导入说明: ${instructionsFile}`);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 