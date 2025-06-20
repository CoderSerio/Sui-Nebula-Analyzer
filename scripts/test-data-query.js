import { createClient } from '@nebula-contrib/nebula-nodejs';

async function testDataQuery() {
  console.log('=== Testing Data Queries ===');

  const config = {
    servers: ['localhost:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'sui_analysis',
    poolSize: 5,
    executeTimeout: 30000,
  };

  let client = null;

  try {
    console.log('Creating client...');
    client = createClient(config);

    // 测试1: 检查图空间和数据
    console.log('\n=== Test 1: Check Space and Data ===');
    const useSpaceQuery = `USE ${config.space};`;
    await client.execute(useSpaceQuery);
    console.log('Space switched successfully');

    // 测试2: 检查标签和边类型
    console.log('\n=== Test 2: Check Tags and Edges ===');
    const showTagsQuery = `SHOW TAGS;`;
    const tagsResult = await client.execute(showTagsQuery);
    console.log('Tags:', tagsResult.data);

    const showEdgesQuery = `SHOW EDGES;`;
    const edgesResult = await client.execute(showEdgesQuery);
    console.log('Edges:', edgesResult.data);

    // 测试3: 检查wallet节点数量
    console.log('\n=== Test 3: Check Wallet Nodes ===');
    const countWalletsQuery = `MATCH (v:wallet) RETURN count(v) AS wallet_count;`;
    const walletCountResult = await client.execute(countWalletsQuery);
    console.log('Wallet count result:', walletCountResult.data);

    // 测试4: 获取几个wallet示例
    console.log('\n=== Test 4: Get Sample Wallets ===');
    const sampleWalletsQuery = `MATCH (v:wallet) RETURN v.wallet.address AS address LIMIT 5;`;
    const sampleResult = await client.execute(sampleWalletsQuery);
    console.log('Sample wallets:', sampleResult.data);

    // 测试5: 检查transaction边数量
    console.log('\n=== Test 5: Check Transaction Edges ===');
    const countTransactionsQuery = `MATCH ()-[e:transaction]-() RETURN count(e) AS transaction_count;`;
    const transactionCountResult = await client.execute(countTransactionsQuery);
    console.log('Transaction count result:', transactionCountResult.data);

    // 测试6: 检查related_to边数量
    console.log('\n=== Test 6: Check Related_to Edges ===');
    const countRelatedQuery = `MATCH ()-[e:related_to]-() RETURN count(e) AS related_count;`;
    const relatedCountResult = await client.execute(countRelatedQuery);
    console.log('Related_to count result:', relatedCountResult.data);

    // 测试7: 使用具体地址测试查询
    if (sampleResult.data && sampleResult.data.rows && sampleResult.data.rows.length > 0) {
      const testAddress = sampleResult.data.rows[0][0]; // 第一个地址
      console.log(`\n=== Test 7: Query for specific address: ${testAddress} ===`);

      const specificQuery = `
        MATCH (v1:wallet {address: "${testAddress}"})-[e:transaction]-(v2:wallet)
        RETURN v1.wallet.address AS source_address,
               v2.wallet.address AS target_address,
               v1.wallet.transaction_count AS source_tx_count,
               v2.wallet.transaction_count AS target_tx_count,
               v1.wallet.total_amount AS source_amount,
               v2.wallet.total_amount AS target_amount,
               e.amount AS edge_amount
        LIMIT 10;
      `;

      const specificResult = await client.execute(specificQuery);
      console.log('Specific query result:', {
        error_code: specificResult.error_code,
        column_names: specificResult.data?.column_names,
        row_count: specificResult.data?.rows?.length || 0
      });

      if (specificResult.data?.rows?.length > 0) {
        console.log('First row:', specificResult.data.rows[0]);
      }
    }

  } catch (error) {
    console.error('=== Test Failed ===');
    console.error('Error:', error);
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('Client closed');
      } catch (closeError) {
        console.error('Error closing client:', closeError);
      }
    }
  }
}

testDataQuery().then(() => {
  console.log('\n=== All Tests Complete ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
}); 