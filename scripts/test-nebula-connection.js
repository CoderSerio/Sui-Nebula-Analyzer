import { createClient } from '@nebula-contrib/nebula-nodejs';

async function testNebulaConnection() {
  console.log('=== Testing NebulaGraph Connection ===');

  const config = {
    servers: ['localhost:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'sui_analysis',
    poolSize: 5,
    executeTimeout: 30000,
  };

  console.log('Config:', {
    ...config,
    password: '***'
  });

  let client = null;

  try {
    console.log('Creating client...');
    client = createClient(config);

    console.log('Client created, executing test query...');

    // 测试基本连接
    const testQuery = `USE ${config.space}; SHOW HOSTS;`;
    console.log('Executing query:', testQuery);

    const result = await client.execute(testQuery);
    console.log('Query executed successfully!');
    console.log('Result type:', typeof result);
    console.log('Result keys:', result ? Object.keys(result) : 'null');

    if (result && result.records) {
      console.log('Records found:', result.records.length);
    }

    // 测试空间查询
    const spaceQuery = `SHOW SPACES;`;
    console.log('Testing space query:', spaceQuery);

    const spaceResult = await client.execute(spaceQuery);
    console.log('Space query result:', spaceResult);

  } catch (error) {
    console.error('=== Connection Test Failed ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
  } finally {
    if (client) {
      try {
        console.log('Closing client...');
        await client.close();
        console.log('Client closed successfully');
      } catch (closeError) {
        console.error('Error closing client:', closeError);
      }
    }
  }
}

// 运行测试
testNebulaConnection().then(() => {
  console.log('=== Test Complete ===');
  process.exit(0);
}).catch((error) => {
  console.error('=== Test Failed ===', error);
  process.exit(1);
}); 