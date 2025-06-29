import { NextRequest } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3002";

// 时间处理
function formatNebulaDatetime(ts: number) {
  return new Date(ts).toISOString().replace("T", " ").split(".")[0];
}

// Nebula VID：补齐 64 位
const clean = (addr: string) => addr.replace(/^0x/, "").padStart(64, "0");

// 基础 RPC 调用
const rpc = async (method: string, params: any[] = [], rpcUrl: string) => {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method} → ${JSON.stringify(j.error)}`);
  return j.result;
};

// 解析接收者地址
function resolveRecipient(arg: any, inputs: any[]) {
  if (!arg) return null;
  if (arg.Input !== undefined) return inputs[arg.Input]?.value ?? null;
  if (arg.AddressOwner) return arg.AddressOwner;
  return null;
}

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

// 获取账户余额
const getAccountBalance = async (address: string, rpcUrl: string) => {
  try {
    const balance = await rpc("suix_getBalance", [address], rpcUrl);
    return Number(balance.totalBalance) / 1_000_000_000; // 转换为 SUI
  } catch (err) {
    console.warn(`获取账户 ${address.slice(0, 8)}... 余额失败:`, err);
    return 0;
  }
};

// 获取账户拥有的对象数量
const getOwnedObjectsCount = async (address: string, rpcUrl: string) => {
  try {
    const objects = await rpc(
      "suix_getOwnedObjects",
      [
        address,
        {
          showType: true,
          showOwner: false,
          showPreviousTransaction: false,
          showDisplay: false,
          showContent: false,
          showBcs: false,
          showStorageRebate: false,
        },
      ],
      rpcUrl
    );
    return objects.data?.length || 0;
  } catch (err) {
    console.warn(`获取账户 ${address.slice(0, 8)}... 对象数量失败:`, err);
    return 0;
  }
};

// 检查是否为合约地址
const checkIsContract = async (address: string, rpcUrl: string) => {
  try {
    // 尝试获取对象信息来判断是否为合约
    const objects = await rpc(
      "suix_getOwnedObjects",
      [
        address,
        {
          filter: {
            StructType: "0x2::package::Package",
          },
          showType: true,
        },
      ],
      rpcUrl
    );
    return objects.data?.length > 0;
  } catch (err) {
    return false;
  }
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // 解析请求参数
  const body = await request.json();
  const {
    checkpointCount = 10,
    rpcUrl = "https://fullnode.mainnet.sui.io:443",
    useEnhancedScript = false,
  } = body;

  const stream = new ReadableStream({
    start(controller) {
      const sendMessage = (type: string, message: string, data?: any) => {
        const chunk =
          JSON.stringify({
            type,
            message,
            data,
            timestamp: new Date().toISOString(),
          }) + "\n";
        controller.enqueue(encoder.encode(chunk));
      };

      const processData = async () => {
        try {
          sendMessage(
            "info",
            `🚀 开始数据采集，处理 ${checkpointCount} 个checkpoint ${
              useEnhancedScript ? "(增强模式)" : "(标准模式)"
            }`
          );

          // 获取最新的checkpoint
          sendMessage("info", "📡 获取最新checkpoint信息...");
          const latest = Number(
            await rpc("sui_getLatestCheckpointSequenceNumber", [], rpcUrl)
          );
          const start = Math.max(0, latest - checkpointCount + 1);

          sendMessage("info", `📊 处理范围: ${start} - ${latest}`);

          // 重新初始化图空间以确保正确的VID类型
          sendMessage("info", "🗑️ 重新初始化图空间...");
          try {
            // 删除并重新创建图空间以确保VID类型正确
            await executeNebulaQuery("DROP SPACE IF EXISTS sui_analysis");
            sendMessage("info", "已删除旧图空间");

            await executeNebulaQuery(
              "CREATE SPACE IF NOT EXISTS sui_analysis (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(64))"
            );
            sendMessage("info", "已创建新图空间");

            // 等待图空间初始化
            sendMessage("info", "等待图空间初始化...");
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // 创建标签和边类型（包含增强字段）
            const walletSchema = useEnhancedScript
              ? "USE sui_analysis; CREATE TAG IF NOT EXISTS wallet (address string NOT NULL, first_seen datetime, last_seen datetime, transaction_count int DEFAULT 0, total_amount double DEFAULT 0.0, is_contract bool DEFAULT false, sui_balance double DEFAULT 0.0, owned_objects_count int DEFAULT 0, last_activity datetime)"
              : "USE sui_analysis; CREATE TAG IF NOT EXISTS wallet (address string NOT NULL, first_seen datetime, last_seen datetime, transaction_count int DEFAULT 0, total_amount double DEFAULT 0.0, is_contract bool DEFAULT false)";

            await executeNebulaQuery(walletSchema);
            sendMessage(
              "info",
              `已创建wallet标签 ${
                useEnhancedScript ? "(增强模式)" : "(标准模式)"
              }`
            );

            const transactionSchema = useEnhancedScript
              ? "USE sui_analysis; CREATE EDGE IF NOT EXISTS transaction (amount double NOT NULL, tx_timestamp datetime NOT NULL, tx_hash string NOT NULL, gas_used int DEFAULT 0, success bool DEFAULT true, transaction_type string DEFAULT 'unknown')"
              : "USE sui_analysis; CREATE EDGE IF NOT EXISTS transaction (amount double NOT NULL, tx_timestamp datetime NOT NULL, tx_hash string NOT NULL, gas_used int DEFAULT 0, success bool DEFAULT true)";

            await executeNebulaQuery(transactionSchema);
            sendMessage("info", "已创建transaction边类型");

            const relatedSchema = useEnhancedScript
              ? 'USE sui_analysis; CREATE EDGE IF NOT EXISTS related_to (relationship_score double NOT NULL, common_transactions int DEFAULT 0, total_amount double DEFAULT 0.0, first_interaction datetime, last_interaction datetime, relationship_type string DEFAULT "unknown", avg_gas_used double DEFAULT 0.0)'
              : 'USE sui_analysis; CREATE EDGE IF NOT EXISTS related_to (relationship_score double NOT NULL, common_transactions int DEFAULT 0, total_amount double DEFAULT 0.0, first_interaction datetime, last_interaction datetime, relationship_type string DEFAULT "unknown")';

            await executeNebulaQuery(relatedSchema);
            sendMessage("info", "已创建related_to边类型");

            sendMessage("success", "✅ 图空间初始化完成");
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            sendMessage("error", `❌ 图空间初始化失败: ${errorMessage}`);
            sendMessage("error", "🛑 由于图空间初始化失败，停止数据采集流程");
            throw new Error(`图空间初始化失败: ${errorMessage}`); // 抛出错误来停止整个流程
          }

          const wallets = new Map();
          const edges: any[] = [];

          // 更新钱包信息
          const updateWallet = (addr: string, ts: number) => {
            const tsFormatted = formatNebulaDatetime(ts);
            const w = wallets.get(addr) ?? {
              address: addr,
              first_seen: tsFormatted,
              last_seen: tsFormatted,
              transaction_count: 0,
              total_amount: 0,
              is_contract: false,
              ...(useEnhancedScript && {
                sui_balance: 0,
                owned_objects_count: 0,
                last_activity: tsFormatted,
              }),
            };

            const prevFirst = new Date(w.first_seen).getTime();
            const prevLast = new Date(w.last_seen).getTime();

            w.first_seen = formatNebulaDatetime(Math.min(prevFirst, ts));
            w.last_seen = formatNebulaDatetime(Math.max(prevLast, ts));
            w.transaction_count += 1;

            if (useEnhancedScript) {
              w.last_activity = formatNebulaDatetime(ts);
            }

            wallets.set(addr, w);
          };

          // 处理每个checkpoint
          sendMessage("info", "🔍 开始处理checkpoint数据...");
          for (let seq = start; seq <= latest; seq++) {
            const progress = Math.round(((seq - start) / checkpointCount) * 30); // 30% for data processing
            sendMessage("progress", `处理 checkpoint ${seq}/${latest}`, {
              progress,
            });

            try {
              const cp = await rpc("sui_getCheckpoint", [String(seq)], rpcUrl);
              const ts = Number(cp.timestampMs);

              let txCount = 0;
              for (const digest of cp.transactions) {
                try {
                  const tx = await rpc(
                    "sui_getTransactionBlock",
                    [
                      digest,
                      {
                        showInput: true,
                        showRawInput: true,
                        showEffects: true,
                      },
                    ],
                    rpcUrl
                  );

                  const senderRaw = tx.transaction?.data?.sender;
                  if (!senderRaw) continue;
                  const sender = clean(senderRaw);
                  const gas = Number(tx.effects?.gasUsed?.computationCost ?? 0);
                  const ok = tx.effects?.status?.status === "success";

                  const pt = tx.transaction?.data?.transaction;
                  if (pt?.kind !== "ProgrammableTransaction") continue;

                  const { inputs = [], transactions: cmds = [] } = pt;

                  for (const cmd of cmds) {
                    // TransferObjects
                    if (cmd.TransferObjects) {
                      const [, recipientSpec] = cmd.TransferObjects;
                      const recRaw = resolveRecipient(recipientSpec, inputs);
                      if (!recRaw) continue;

                      const recipient = clean(recRaw);
                      if (recipient === sender) continue;

                      updateWallet(sender, ts);
                      updateWallet(recipient, ts);

                      edges.push({
                        src: sender,
                        dst: recipient,
                        amount: 0,
                        timestamp: formatNebulaDatetime(ts),
                        tx_hash: digest,
                        gas_used: gas,
                        success: ok,
                        ...(useEnhancedScript && {
                          transaction_type: "TransferObjects",
                        }),
                      });
                      txCount++;
                    }

                    // TransferSui
                    if (cmd.TransferSui) {
                      const recipientSpec = cmd.TransferSui.at(-1);
                      const recRaw = resolveRecipient(recipientSpec, inputs);
                      if (!recRaw) continue;

                      const recipient = clean(recRaw);
                      if (recipient === sender) continue;

                      updateWallet(sender, ts);
                      updateWallet(recipient, ts);

                      edges.push({
                        src: sender,
                        dst: recipient,
                        amount: 0,
                        timestamp: formatNebulaDatetime(ts),
                        tx_hash: digest,
                        gas_used: gas,
                        success: ok,
                        ...(useEnhancedScript && {
                          transaction_type: "TransferSui",
                        }),
                      });
                      txCount++;
                    }
                  }
                } catch (txError) {
                  sendMessage(
                    "warning",
                    `跳过交易 ${digest}: ${
                      txError instanceof Error
                        ? txError.message
                        : String(txError)
                    }`
                  );
                }
              }

              if (txCount > 0) {
                sendMessage(
                  "info",
                  `✅ Checkpoint ${seq} 处理完成，发现 ${txCount} 笔交易`
                );
              }
            } catch (cpError) {
              sendMessage(
                "error",
                `❌ 处理 checkpoint ${seq} 失败: ${
                  cpError instanceof Error ? cpError.message : String(cpError)
                }`
              );
            }
          }

          sendMessage(
            "info",
            `📊 数据处理完成，钱包数: ${wallets.size}, 交易数: ${edges.length}`
          );

          // 增强模式：获取重要钱包的详细信息
          if (useEnhancedScript && wallets.size > 0) {
            sendMessage("info", "💰 增强模式：获取钱包详细信息...");

            const sortedWallets = Array.from(wallets.values())
              .sort((a, b) => b.transaction_count - a.transaction_count)
              .slice(0, Math.min(20, wallets.size)); // 最多获取前20个活跃钱包

            for (let i = 0; i < sortedWallets.length; i++) {
              const wallet = sortedWallets[i];
              const originalAddr = wallet.address.startsWith("0x")
                ? wallet.address
                : `0x${wallet.address}`;

              try {
                sendMessage(
                  "info",
                  `🔍 获取钱包 ${i + 1}/${
                    sortedWallets.length
                  }: ${originalAddr.slice(0, 12)}...`
                );

                wallet.sui_balance = await getAccountBalance(
                  originalAddr,
                  rpcUrl
                );
                wallet.owned_objects_count = await getOwnedObjectsCount(
                  originalAddr,
                  rpcUrl
                );
                wallet.is_contract = await checkIsContract(
                  originalAddr,
                  rpcUrl
                );

                sendMessage(
                  "info",
                  `   余额: ${wallet.sui_balance.toFixed(2)} SUI, 对象: ${
                    wallet.owned_objects_count
                  }, 合约: ${wallet.is_contract}`
                );

                // 更新进度
                const progress =
                  30 + Math.round(((i + 1) / sortedWallets.length) * 10); // 30-40%
                sendMessage(
                  "progress",
                  `获取钱包信息 ${i + 1}/${sortedWallets.length}`,
                  { progress }
                );

                // 避免API调用过快
                if (i < sortedWallets.length - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 200));
                }
              } catch (error) {
                sendMessage(
                  "warning",
                  `获取钱包 ${originalAddr} 信息失败: ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            }

            sendMessage(
              "success",
              `✅ 完成 ${sortedWallets.length} 个钱包的增强信息获取`
            );
          }

          // 插入钱包数据
          if (wallets.size > 0) {
            sendMessage("info", "💾 开始插入钱包数据...");
            const walletList = Array.from(wallets.values());
            let walletInserted = 0;

            for (const wallet of walletList) {
              try {
                // 根据是否启用增强模式构建不同的插入语句
                let insertWalletQuery;
                if (useEnhancedScript) {
                  insertWalletQuery = `USE sui_analysis; INSERT VERTEX wallet(address, first_seen, last_seen, transaction_count, total_amount, is_contract, sui_balance, owned_objects_count, last_activity) VALUES "${
                    wallet.address
                  }": ("${wallet.address}", datetime("${
                    wallet.first_seen
                  }"), datetime("${wallet.last_seen}"), ${
                    wallet.transaction_count
                  }, ${wallet.total_amount}, ${wallet.is_contract}, ${
                    wallet.sui_balance || 0
                  }, ${wallet.owned_objects_count || 0}, datetime("${
                    wallet.last_activity || wallet.last_seen
                  }"))`;
                } else {
                  insertWalletQuery = `USE sui_analysis; INSERT VERTEX wallet(address, first_seen, last_seen, transaction_count, total_amount, is_contract) VALUES "${wallet.address}": ("${wallet.address}", datetime("${wallet.first_seen}"), datetime("${wallet.last_seen}"), ${wallet.transaction_count}, ${wallet.total_amount}, ${wallet.is_contract})`;
                }

                sendMessage(
                  "info",
                  `插入钱包: ${wallet.address.substring(0, 16)}... ${
                    useEnhancedScript
                      ? `(余额: ${(wallet.sui_balance || 0).toFixed(2)} SUI)`
                      : ""
                  }`
                );
                const result = await executeNebulaQuery(insertWalletQuery);
                walletInserted++;

                const progressStart = useEnhancedScript ? 40 : 30;
                const progress =
                  progressStart +
                  Math.round((walletInserted / walletList.length) * 25); // 40-65% 或 30-55%
                sendMessage(
                  "progress",
                  `插入钱包 ${walletInserted}/${walletList.length}`,
                  { progress }
                );
              } catch (error) {
                sendMessage(
                  "warning",
                  `插入钱包失败: ${wallet.address} - ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            }
            sendMessage("success", `✅ 成功插入 ${walletInserted} 个钱包`);
          }

          // 插入交易数据
          if (edges.length > 0) {
            sendMessage("info", "🔗 开始插入交易数据...");
            sendMessage("info", `总共需要插入 ${edges.length} 条交易边`);
            let txInserted = 0;
            let txFailed = 0;

            for (const edge of edges) {
              try {
                // 先检查两个节点是否存在
                const checkSrcQuery = `USE sui_analysis; MATCH (n:wallet) WHERE id(n) == "${edge.src}" RETURN count(n) as count`;
                const checkDstQuery = `USE sui_analysis; MATCH (n:wallet) WHERE id(n) == "${edge.dst}" RETURN count(n) as count`;

                if (txInserted < 3) {
                  sendMessage(
                    "info",
                    `检查节点存在性: ${edge.src.substring(
                      0,
                      8
                    )} 和 ${edge.dst.substring(0, 8)}`
                  );

                  const srcResult = await executeNebulaQuery(checkSrcQuery);
                  const dstResult = await executeNebulaQuery(checkDstQuery);

                  sendMessage(
                    "info",
                    `源节点检查结果: ${JSON.stringify(srcResult.data.data)}`
                  );
                  sendMessage(
                    "info",
                    `目标节点检查结果: ${JSON.stringify(dstResult.data.data)}`
                  );
                }

                // 插入交易边（根据模式决定是否包含交易类型）
                let insertTxQuery;
                if (useEnhancedScript && edge.transaction_type) {
                  insertTxQuery = `USE sui_analysis; INSERT EDGE transaction(amount, tx_timestamp, tx_hash, gas_used, success, transaction_type) VALUES "${edge.src}" -> "${edge.dst}": (${edge.amount}, datetime("${edge.timestamp}"), "${edge.tx_hash}", ${edge.gas_used}, ${edge.success}, "${edge.transaction_type}")`;
                } else {
                  insertTxQuery = `USE sui_analysis; INSERT EDGE transaction(amount, tx_timestamp, tx_hash, gas_used, success) VALUES "${edge.src}" -> "${edge.dst}": (${edge.amount}, datetime("${edge.timestamp}"), "${edge.tx_hash}", ${edge.gas_used}, ${edge.success})`;
                }

                if (txInserted < 5) {
                  sendMessage(
                    "info",
                    `插入交易: ${edge.src.substring(
                      0,
                      8
                    )} -> ${edge.dst.substring(0, 8)} ${
                      useEnhancedScript && edge.transaction_type
                        ? `(${edge.transaction_type})`
                        : ""
                    }`
                  );
                  sendMessage(
                    "info",
                    `交易查询: ${insertTxQuery.substring(0, 100)}...`
                  );
                }

                const result = await executeNebulaQuery(insertTxQuery);

                if (txInserted < 3) {
                  sendMessage(
                    "info",
                    `交易插入结果: ${JSON.stringify(result)}`
                  );
                }

                txInserted++;

                if (txInserted % 10 === 0) {
                  const progress =
                    60 + Math.round((txInserted / edges.length) * 25);
                  sendMessage(
                    "progress",
                    `插入交易 ${txInserted}/${edges.length}`,
                    { progress }
                  );
                }
              } catch (error) {
                txFailed++;
                const errorMsg =
                  error instanceof Error ? error.message : String(error);
                sendMessage(
                  "warning",
                  `插入交易失败: ${edge.tx_hash.substring(
                    0,
                    16
                  )}... - ${errorMsg}`
                );

                if (txFailed < 5) {
                  sendMessage(
                    "warning",
                    `失败的查询可能是: INSERT EDGE transaction(...) VALUES "${edge.src}" -> "${edge.dst}": (...)`
                  );
                }
              }
            }
            sendMessage(
              "success",
              `✅ 成功插入 ${txInserted} 条交易，失败 ${txFailed} 条`
            );

            if (txFailed > 0) {
              sendMessage(
                "warning",
                `⚠️ 有 ${txFailed} 条交易插入失败，可能是节点VID不匹配问题`
              );
            }
          }

          // 构建关联关系
          sendMessage("info", "🔗 计算关联关系...");
          const relatedMap = new Map();
          for (const tx of edges) {
            const [a, b] = [tx.src, tx.dst].sort();
            const key = `${a}-${b}`;

            const r = relatedMap.get(key) ?? {
              src: a,
              dst: b,
              relationship_score: 0,
              common_transactions: 0,
              total_amount: 0,
              first_interaction: tx.timestamp,
              last_interaction: tx.timestamp,
              relationship_type: "unknown",
              ...(useEnhancedScript && {
                avg_gas_used: 0,
                total_gas: 0,
              }),
            };

            r.common_transactions += 1;
            r.total_amount += tx.amount;

            // 计算平均Gas（增强模式）
            if (useEnhancedScript) {
              r.total_gas = (r.total_gas || 0) + tx.gas_used;
              r.avg_gas_used = r.total_gas / r.common_transactions;
            }

            const oldFirst = new Date(r.first_interaction).getTime();
            const oldLast = new Date(r.last_interaction).getTime();
            const now = new Date(tx.timestamp).getTime();

            r.first_interaction = formatNebulaDatetime(Math.min(oldFirst, now));
            r.last_interaction = formatNebulaDatetime(Math.max(oldLast, now));

            relatedMap.set(key, r);
          }

          // 插入关联关系
          if (relatedMap.size > 0) {
            sendMessage("info", "💫 开始插入关联关系...");
            let relInserted = 0;
            const relList = Array.from(relatedMap.values());

            for (const r of relList) {
              try {
                r.relationship_score = Math.log(r.common_transactions + 1);

                // 根据模式构建不同的插入语句
                let insertRelQuery;
                if (useEnhancedScript) {
                  insertRelQuery = `USE sui_analysis; INSERT EDGE related_to(relationship_score, common_transactions, total_amount, first_interaction, last_interaction, relationship_type, avg_gas_used) VALUES "${
                    r.src
                  }" -> "${r.dst}": (${r.relationship_score}, ${
                    r.common_transactions
                  }, ${r.total_amount}, datetime("${
                    r.first_interaction
                  }"), datetime("${r.last_interaction}"), "${
                    r.relationship_type
                  }", ${r.avg_gas_used || 0})`;
                } else {
                  insertRelQuery = `USE sui_analysis; INSERT EDGE related_to(relationship_score, common_transactions, total_amount, first_interaction, last_interaction, relationship_type) VALUES "${r.src}" -> "${r.dst}": (${r.relationship_score}, ${r.common_transactions}, ${r.total_amount}, datetime("${r.first_interaction}"), datetime("${r.last_interaction}"), "${r.relationship_type}")`;
                }

                if (relInserted < 3) {
                  // 只对前几条显示详细日志
                  sendMessage(
                    "info",
                    `插入关系: ${r.src.substring(0, 8)} -> ${r.dst.substring(
                      0,
                      8
                    )} (分数: ${r.relationship_score.toFixed(2)}${
                      useEnhancedScript
                        ? `, 平均Gas: ${(r.avg_gas_used || 0).toFixed(0)}`
                        : ""
                    })`
                  );
                }

                await executeNebulaQuery(insertRelQuery);
                relInserted++;

                if (relInserted % 5 === 0) {
                  // 每5条更新一次进度
                  const progressStart = useEnhancedScript ? 85 : 80;
                  const progress =
                    progressStart +
                    Math.round((relInserted / relList.length) * 15); // 85-100% 或 80-95%
                  sendMessage(
                    "progress",
                    `插入关联关系 ${relInserted}/${relList.length}`,
                    { progress }
                  );
                }
              } catch (error) {
                sendMessage(
                  "warning",
                  `插入关联关系失败: ${r.src}-${r.dst} - ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            }
            sendMessage("success", `✅ 成功插入 ${relInserted} 条关联关系`);
          }

          // 完成
          sendMessage("progress", "数据采集完成", { progress: 100 });
          sendMessage("complete", "🎉 数据采集成功完成！", {
            stats: {
              checkpointsProcessed: checkpointCount,
              walletsInserted: wallets.size,
              transactionsInserted: edges.length,
              relationshipsInserted: relatedMap.size,
            },
          });
        } catch (error) {
          sendMessage(
            "error",
            `❌ 数据采集失败: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } finally {
          controller.close();
        }
      };

      // 开始处理
      processData().catch((error) => {
        sendMessage(
          "error",
          `💥 严重错误: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
