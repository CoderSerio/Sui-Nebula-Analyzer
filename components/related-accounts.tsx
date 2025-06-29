"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  Filter,
  Copy,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  processTransactionDataToRelationships,
  getRelationshipLevel,
  formatAddress,
  getScoreBadgeColor,
} from "@/lib/analytics-utils";

interface RelatedAccount {
  addr1: string;
  addr2: string;
  relationshipScore: number;
  commonTransactions: number;
  amount: number;
  type: string;
}

interface RelatedAccountsResponse {
  totalFound: number;
  relationships: RelatedAccount[];
  timestamp: string;
  error?: string;
}

export default function RelatedAccounts() {
  const [data, setData] = useState<RelatedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [minScore, setMinScore] = useState(0.1);
  const [filterMinScore, setFilterMinScore] = useState(0.1);
  const [proMode, setProMode] = useState(false);

  useEffect(() => {
    fetchRelatedAccounts(1, true);
  }, []);

  const fetchRelatedAccounts = async (
    pageNum: number = 1,
    reset: boolean = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      // 首先尝试从related_to边获取数据
      let query;
      if (proMode) {
        // Pro模式查询更多字段
        query = `USE sui_analysis; MATCH (a:wallet)-[r:related_to]-(b:wallet) WHERE r.relationship_score >= ${minScore} RETURN 
          a.wallet.address AS addr1, 
          b.wallet.address AS addr2, 
          r.relationship_score AS score, 
          r.common_transactions AS common_tx, 
          r.total_amount AS amount,
          r.avg_gas_used AS avg_gas,
          r.first_interaction AS first_interaction,
          r.last_interaction AS last_interaction,
          r.relationship_type AS rel_type,
          a.wallet.sui_balance AS addr1_balance,
          b.wallet.sui_balance AS addr2_balance,
          a.wallet.owned_objects_count AS addr1_objects,
          b.wallet.owned_objects_count AS addr2_objects,
          a.wallet.is_contract AS addr1_contract,
          b.wallet.is_contract AS addr2_contract
          LIMIT 50`;
      } else {
        // 基础模式查询
        query = `USE sui_analysis; MATCH (a:wallet)-[r:related_to]-(b:wallet) WHERE r.relationship_score >= ${minScore} RETURN a.wallet.address AS addr1, b.wallet.address AS addr2, r.relationship_score AS score, r.common_transactions AS common_tx, r.total_amount AS amount LIMIT 50`;
      }

      console.log("正在查询related_to边数据...", "minScore:", minScore);

      let response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      let result = await response.json();
      let relationships: RelatedAccount[] = [];

      console.log("related_to查询结果:", result);

      // 处理related_to边数据
      if (result.success && result.data?.data?.addr1?.length > 0) {
        const data = result.data.data;
        console.log("找到related_to边数据:", data.addr1.length, "条");
        for (let i = 0; i < data.addr1.length; i++) {
          const baseRelationship = {
            addr1: data.addr1[i],
            addr2: data.addr2[i],
            relationshipScore: data.score?.[i] || 0,
            commonTransactions: data.common_tx?.[i] || 0,
            amount: data.amount?.[i] || 0,
            type: "related",
          };

          // 如果是Pro模式，添加额外字段
          if (proMode) {
            Object.assign(baseRelationship, {
              avgGasUsed: data.avg_gas?.[i] || 0,
              firstInteraction: data.first_interaction?.[i],
              lastInteraction: data.last_interaction?.[i],
              relationshipType: data.rel_type?.[i] || "unknown",
              // 使用第一个地址的信息作为主要信息
              balance: data.addr1_balance?.[i] || 0,
              objectCount: data.addr1_objects?.[i] || 0,
              isContract: data.addr1_contract?.[i] || false,
              transactionType: data.rel_type?.[i] || "Mixed",
              successRate: Math.random() * 0.3 + 0.7, // 模拟成功率
              activityScore: Math.min(
                baseRelationship.commonTransactions / 10,
                1
              ),
            });
          }

          relationships.push(baseRelationship);
        }
      } else {
        // 如果没有related_to边数据，从transaction边推断关联
        console.log(
          "没有找到related_to边数据，尝试从transaction边推断... Error:",
          result.error
        );
        // 简化查询：直接获取所有transaction边
        if (proMode) {
          query = `USE sui_analysis; MATCH (a:wallet)-[r:transaction]-(b:wallet) RETURN 
            a.wallet.address AS addr1, 
            b.wallet.address AS addr2, 
            r.amount AS amount,
            r.gas_used AS gas_used,
            r.success AS success,
            r.transaction_type AS tx_type,
            r.tx_timestamp AS tx_time,
            a.wallet.sui_balance AS addr1_balance,
            b.wallet.sui_balance AS addr2_balance,
            a.wallet.owned_objects_count AS addr1_objects,
            b.wallet.owned_objects_count AS addr2_objects,
            a.wallet.is_contract AS addr1_contract,
            b.wallet.is_contract AS addr2_contract
            LIMIT 200`;
        } else {
          query = `USE sui_analysis; MATCH (a:wallet)-[r:transaction]-(b:wallet) RETURN a.wallet.address AS addr1, b.wallet.address AS addr2, r.amount AS amount LIMIT 200`;
        }

        response = await fetch("/api/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        result = await response.json();

        if (result.success && result.data?.data?.addr1?.length > 0) {
          const data = result.data.data;
          console.log("找到transaction边数据:", data.addr1.length, "条");

          // 使用新的工具函数处理数据
          const processedRelationships = processTransactionDataToRelationships(
            {
              addr1: data.addr1,
              addr2: data.addr2,
              amount: data.amount || [],
            },
            minScore,
            {
              enableLogging: true,
              scoreOptions: {
                txWeight: 0.7,
                amountWeight: 0.3,
                maxTxForFullScore: 5,
                maxAmountLog: 10,
              },
            }
          );

          // 如果是Pro模式，为推断的关系添加额外字段
          if (proMode && data.addr1_balance) {
            processedRelationships.forEach((rel, index) => {
              if (index < data.addr1.length) {
                Object.assign(rel, {
                  balance: data.addr1_balance?.[index] || 0,
                  objectCount: data.addr1_objects?.[index] || 0,
                  isContract: data.addr1_contract?.[index] || false,
                  transactionType: data.tx_type?.[index] || "Mixed",
                  avgGasUsed: data.gas_used?.[index] || 0,
                  successRate: data.success?.[index] ? 1 : 0,
                  firstInteraction: data.tx_time?.[index],
                  lastInteraction: data.tx_time?.[index],
                  activityScore: Math.min(rel.commonTransactions / 5, 1),
                });
              }
            });
          }

          relationships.push(...processedRelationships);
        }
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch related accounts");
      }

      // 按关联强度排序
      relationships.sort((a, b) => b.relationshipScore - a.relationshipScore);

      if (reset) {
        setData(relationships);
      } else {
        setData((prev) => [...prev, ...relationships]);
      }

      setPage(pageNum);
      setHasMore(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setMinScore(filterMinScore);
    fetchRelatedAccounts(1, true);
  };

  // Pro模式变化时重新获取数据
  useEffect(() => {
    if (data.length > 0) {
      fetchRelatedAccounts(1, true);
    }
  }, [proMode]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchRelatedAccounts(page + 1, false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  // 使用工具函数代替本地函数
  const formatAddressDisplay = (address: string) =>
    formatAddress(address, 8, 8);

  // 基础表格列
  const basicColumns = [
    {
      key: "sendFrom",
      label: "来源",
      render: (account: any) => (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {formatAddressDisplay(account.addr1)}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyAddress(account.addr1)}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: "accessTo",
      label: "去向",
      render: (account: any) => (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {formatAddressDisplay(account.addr2)}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyAddress(account.addr2)}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: "strength",
      label: "关联强度",
      render: (account: any) => {
        const level = getRelationshipLevel(account.relationshipScore);
        return (
          <>
            <Badge className={getScoreBadgeColor(account.relationshipScore)}>
              {level.label}
            </Badge>
            <div className="text-xs text-gray-500 mt-1 px-3">
              {(account.relationshipScore * 100).toFixed(1)}%
            </div>
          </>
        );
      },
    },
    {
      key: "transactions",
      label: "共同交易",
      render: (account: any) => (
        <>
          <div className="text-sm font-medium">
            {account.commonTransactions}
          </div>
          {account.amount > 0 && (
            <div className="text-xs text-gray-500">
              {account.amount.toFixed(2)} SUI
            </div>
          )}
        </>
      ),
    },
  ] as const;

  // 格式化时间函数
  const formatNebulaDate = (dateObj: any) => {
    if (!dateObj || typeof dateObj !== "object") return "N/A";

    try {
      // NebulaGraph 返回的时间格式：{year, month, day, hour, minute, sec, microsec}
      const { year, month, day, hour, minute, sec } = dateObj;
      if (!year || !month || !day) return "N/A";

      const date = new Date(
        year,
        month - 1,
        day,
        hour || 0,
        minute || 0,
        sec || 0
      );
      return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch (error) {
      return "N/A";
    }
  };

  // 格式化Gas费用
  const formatGas = (gas: number) => {
    if (!gas || gas === 0) return "N/A";

    if (gas >= 1000000) {
      return `${(gas / 1000000).toFixed(1)}M`;
    } else if (gas >= 1000) {
      return `${(gas / 1000).toFixed(1)}K`;
    }
    return gas.toString();
  };

  // 获取交易类型显示
  const getTransactionType = (type: string) => {
    switch (type) {
      case "TransferSui":
        return "SUI转账";
      case "TransferObjects":
        return "对象转移";
      case "strong":
      case "medium":
      case "weak":
        return "综合交易";
      default:
        return "未知类型";
    }
  };

  // Pro模式额外列
  const proColumns = [
    {
      key: "accountInfo",
      label: "账户信息",
      render: (account: any) => (
        <div className="space-y-1 text-xs">
          <div className="font-medium">
            余额:{" "}
            {account.balance && account.balance > 0
              ? `${account.balance.toFixed(2)} SUI`
              : "--"}
          </div>
          <div className="text-gray-500">
            对象: {account.objectCount > 0 ? account.objectCount : "N/A"}
          </div>
          {account.isContract && (
            <Badge variant="outline" className="text-xs">
              合约
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "transactionDetails",
      label: "交易详情",
      render: (account: any) => (
        <div className="space-y-1 text-xs">
          {/* <div>类型: {getTransactionType(account.transactionType)}</div> */}
          <div>Gas费: {formatGas(account.avgGasUsed)}</div>
        </div>
      ),
    },
    {
      key: "timePattern",
      label: "时间模式",
      render: (account: any) => (
        <div className="space-y-1 text-xs">
          <div>首次: {formatNebulaDate(account.firstInteraction)}</div>
          <div>最近: {formatNebulaDate(account.lastInteraction)}</div>
          <div className="text-gray-500">
            活跃度:{" "}
            {account.activityScore
              ? `${(account.activityScore * 100).toFixed(0)}%`
              : "N/A"}
          </div>
        </div>
      ),
    },
  ];

  // 根据模式选择表格列
  const tableColumns = proMode
    ? [...basicColumns, ...proColumns]
    : basicColumns;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>关联账户列表</CardTitle>
            <CardDescription>
              显示所有检测到的关联账户对，按关联强度排序
              <br />
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRelatedAccounts(1, true)}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 过滤器 */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Label htmlFor="minScore">最小关联分数:</Label>
          </div>
          <Input
            id="minScore"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(parseFloat(e.target.value))}
            className="w-24"
          />
          <Button size="sm" onClick={handleFilter} disabled={loading}>
            应用过滤
          </Button>

          {/* Pro模式开关 */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l">
            <Zap className="h-4 w-4 text-amber-500" />
            <Label htmlFor="pro-mode">Pro模式</Label>
            <Switch
              id="pro-mode"
              checked={proMode}
              onCheckedChange={setProMode}
            />
          </div>
        </div>

        {/* Pro模式说明 */}
        {proMode && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-2">
              <Zap className="h-4 w-4" />
              Pro模式已启用
            </div>
            <div className="text-xs text-amber-600">
              显示额外字段：账户余额、对象数量、合约状态、交易详情、时间模式等
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && data.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>正在加载关联账户...</span>
          </div>
        )}

        {data.length > 0 && (
          <div className="space-y-4">
            {/* 统计信息 */}
            <div className="flex gap-4 text-sm text-gray-600">
              <span>已加载: {data.length} 个关联对</span>
              <span>当前页: {page}</span>
              {hasMore && <span>• 还有更多数据</span>}
            </div>

            {/* 表格 */}
            <div className="border rounded-lg overflow-hidden">
              <div className={`overflow-x-auto ${proMode ? "min-w-full" : ""}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tableColumns.map((column) => (
                        <TableHead
                          key={column.key}
                          className={proMode ? "min-w-32" : ""}
                        >
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((account, index) => (
                      <TableRow
                        key={`${account.addr1}-${account.addr2}-${index}`}
                      >
                        {tableColumns.map((column) => (
                          <TableCell
                            key={column.key}
                            className={proMode ? "min-w-32" : ""}
                          >
                            {column.render(account)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 加载更多 */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      加载中...
                    </>
                  ) : (
                    "加载更多"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {!loading && data.length === 0 && !error && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <p className="mb-2">未找到符合条件的关联账户</p>
              <p className="text-sm">
                尝试降低最小关联分数或检查数据是否已导入
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
