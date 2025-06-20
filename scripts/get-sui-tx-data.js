// 用法：node get-sui-tx-data.js [数量] [RPC_URL]
import { createObjectCsvWriter } from "csv-writer";

const TOTAL = Number(process.argv[2] ?? 100);
const RPC = process.argv[3] ?? "https://fullnode.mainnet.sui.io:443";

// ---------- 时间处理 ----------
function formatNebulaDatetime(ts) {
  return new Date(ts).toISOString().replace("T", " ").split(".")[0];
}

// ---------- 基础 RPC ----------
const rpc = async (method, params = []) => {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method} → ${JSON.stringify(j.error)}`);
  return j.result;
};

// Nebula VID：补齐 64 位
const clean = (addr) => addr.replace(/^0x/, "").padStart(64, "0");

// ---------- 累积器 ----------
const wallets = new Map();
const upWallet = (addr, ts) => {
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

// ---------- 解析工具 ----------
function resolveRecipient(arg, inputs) {
  if (!arg) return null;
  if (arg.Input !== undefined) return inputs[arg.Input]?.value ?? null;
  if (arg.AddressOwner) return arg.AddressOwner;
  return null;
}

// ---------- 主流程 ----------
(async () => {
  const latest = Number(await rpc("sui_getLatestCheckpointSequenceNumber"));
  const start = Math.max(0, latest - TOTAL + 1);

  const edges = [];

  for (let seq = start; seq <= latest; seq++) {
    const cp = await rpc("sui_getCheckpoint", [String(seq)]);
    const ts = Number(cp.timestampMs);

    for (const digest of cp.transactions) {
      const tx = await rpc("sui_getTransactionBlock", [
        digest,
        { showInput: true, showRawInput: true, showEffects: true },
      ]);

      const senderRaw = tx.transaction?.data?.sender;
      if (!senderRaw) continue;
      const sender = clean(senderRaw);
      const gas = Number(tx.effects?.gasUsed?.computationCost ?? 0);
      const ok = tx.effects?.status?.status === "success";

      const pt = tx.transaction?.data?.transaction;
      if (pt?.kind !== "ProgrammableTransaction") continue;

      const { inputs = [], transactions: cmds = [] } = pt;

      for (const cmd of cmds) {
        // ---- TransferObjects ----
        if (cmd.TransferObjects) {
          const [, recipientSpec] = cmd.TransferObjects;
          const recRaw = resolveRecipient(recipientSpec, inputs);
          if (!recRaw) continue;

          const recipient = clean(recRaw);
          if (recipient === sender) continue;

          upWallet(sender, ts);
          upWallet(recipient, ts);

          edges.push({
            src: sender,
            dst: recipient,
            amount: 0,
            timestamp: formatNebulaDatetime(ts),
            tx_hash: digest,
            gas_used: gas,
            success: ok,
          });
        }

        // ---- TransferSui ----
        if (cmd.TransferSui) {
          const recipientSpec = cmd.TransferSui.at(-1);
          const recRaw = resolveRecipient(recipientSpec, inputs);
          if (!recRaw) continue;

          const recipient = clean(recRaw);
          if (recipient === sender) continue;

          upWallet(sender, ts);
          upWallet(recipient, ts);

          edges.push({
            src: sender,
            dst: recipient,
            amount: 0,
            timestamp: formatNebulaDatetime(ts),
            tx_hash: digest,
            gas_used: gas,
            success: ok,
          });
        }
      }
    }

    console.log(`✓ checkpoint ${seq} 解析完成`);
  }

  // ---------- 写 wallet_nodes.csv ----------
  await createObjectCsvWriter({
    path: "wallet_nodes.csv",
    header: [
      { id: "address", title: "address" },
      { id: "first_seen", title: "first_seen" },
      { id: "last_seen", title: "last_seen" },
      { id: "transaction_count", title: "transaction_count" },
      { id: "total_amount", title: "total_amount" },
      { id: "is_contract", title: "is_contract" },
    ],
  }).writeRecords([...wallets.values()]);

  // ---------- 写 transaction_edges.csv ----------
  await createObjectCsvWriter({
    path: "transaction_edges.csv",
    header: [
      { id: "src", title: "src" },
      { id: "dst", title: "dst" },
      { id: "amount", title: "amount" },
      { id: "timestamp", title: "timestamp" },
      { id: "tx_hash", title: "tx_hash" },
      { id: "gas_used", title: "gas_used" },
      { id: "success", title: "success" },
    ],
  }).writeRecords(edges);

  // ---------- 构建 related_to_edges.csv ----------
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

  for (const r of relatedMap.values()) {
    r.relationship_score = Math.log(r.common_transactions + 1);
  }

  await createObjectCsvWriter({
    path: "related_to_edges.csv",
    header: [
      { id: "src", title: "src" },
      { id: "dst", title: "dst" },
      { id: "relationship_score", title: "relationship_score" },
      { id: "common_transactions", title: "common_transactions" },
      { id: "total_amount", title: "total_amount" },
      { id: "first_interaction", title: "first_interaction" },
      { id: "last_interaction", title: "last_interaction" },
      { id: "relationship_type", title: "relationship_type" },
    ],
  }).writeRecords([...relatedMap.values()]);

  console.log(
    `\n🎉 完成！钱包节点 ${wallets.size} 个，交易边 ${edges.length} 条，关系边 ${relatedMap.size} 条。\n` +
    `📁 文件生成：wallet_nodes.csv, transaction_edges.csv, related_to_edges.csv`
  );
})().catch((e) => {
  console.error("❌ 出错：", e);
  process.exit(1);
});
