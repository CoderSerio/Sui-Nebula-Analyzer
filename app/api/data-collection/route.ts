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
    throw new Error(`Gateway request failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Query failed");
  }

  return result;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // 解析请求参数
  const body = await request.json();
  const {
    checkpointCount = 10,
    rpcUrl = "https://fullnode.mainnet.sui.io:443",
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
            `🚀 开始数据采集，处理 ${checkpointCount} 个checkpoint`
          );

          // 获取最新的checkpoint
          sendMessage("info", "📡 获取最新checkpoint信息...");
          const latest = Number(
            await rpc("sui_getLatestCheckpointSequenceNumber", [], rpcUrl)
          );
          const start = Math.max(0, latest - checkpointCount + 1);

          sendMessage("info", `📊 处理范围: ${start} - ${latest}`);

          // 清空现有数据（全量更新）
          sendMessage("info", "🗑️ 清空现有数据...");
          try {
            await executeNebulaQuery(
              "USE sui_analysis; CLEAR SPACE sui_analysis"
            );
            sendMessage("success", "✅ 已清空现有数据");
          } catch (error) {
            sendMessage(
              "warning",
              `⚠️ 清空数据时出现问题: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            sendMessage("info", "继续处理新数据...");
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
            };

            const prevFirst = new Date(w.first_seen).getTime();
            const prevLast = new Date(w.last_seen).getTime();

            w.first_seen = formatNebulaDatetime(Math.min(prevFirst, ts));
            w.last_seen = formatNebulaDatetime(Math.max(prevLast, ts));
            w.transaction_count += 1;
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

          // 插入钱包数据
          if (wallets.size > 0) {
            sendMessage("info", "💾 开始插入钱包数据...");
            const walletList = Array.from(wallets.values());
            let walletInserted = 0;

            for (const wallet of walletList) {
              try {
                const insertWalletQuery = `USE sui_analysis; INSERT VERTEX wallet(address, first_seen, last_seen, transaction_count, total_amount, is_contract) VALUES hash("${wallet.address}"): ("${wallet.address}", datetime("${wallet.first_seen}"), datetime("${wallet.last_seen}"), ${wallet.transaction_count}, ${wallet.total_amount}, ${wallet.is_contract})`;
                await executeNebulaQuery(insertWalletQuery);
                walletInserted++;

                const progress =
                  30 + Math.round((walletInserted / walletList.length) * 30); // 30-60%
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
            let txInserted = 0;

            for (const edge of edges) {
              try {
                const insertTxQuery = `USE sui_analysis; INSERT EDGE transaction(amount, timestamp, tx_hash, gas_used, success) VALUES hash("${edge.src}") -> hash("${edge.dst}"): (${edge.amount}, datetime("${edge.timestamp}"), "${edge.tx_hash}", ${edge.gas_used}, ${edge.success})`;
                await executeNebulaQuery(insertTxQuery);
                txInserted++;

                if (txInserted % 10 === 0) {
                  // 每10条更新一次进度
                  const progress =
                    60 + Math.round((txInserted / edges.length) * 25); // 60-85%
                  sendMessage(
                    "progress",
                    `插入交易 ${txInserted}/${edges.length}`,
                    { progress }
                  );
                }
              } catch (error) {
                sendMessage(
                  "warning",
                  `插入交易失败: ${edge.tx_hash} - ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            }
            sendMessage("success", `✅ 成功插入 ${txInserted} 条交易`);
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
            };

            r.common_transactions += 1;
            r.total_amount += tx.amount;

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
                const insertRelQuery = `USE sui_analysis; INSERT EDGE related_to(relationship_score, common_transactions, total_amount, first_interaction, last_interaction, relationship_type) VALUES hash("${r.src}") -> hash("${r.dst}"): (${r.relationship_score}, ${r.common_transactions}, ${r.total_amount}, datetime("${r.first_interaction}"), datetime("${r.last_interaction}"), "${r.relationship_type}")`;
                await executeNebulaQuery(insertRelQuery);
                relInserted++;

                if (relInserted % 5 === 0) {
                  // 每5条更新一次进度
                  const progress =
                    85 + Math.round((relInserted / relList.length) * 15); // 85-100%
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
