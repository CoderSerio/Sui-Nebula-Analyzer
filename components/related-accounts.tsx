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
import { Loader2, RefreshCw, Filter, Copy, ExternalLink } from "lucide-react";

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
  const [minScore, setMinScore] = useState(0.5);
  const [filterMinScore, setFilterMinScore] = useState(0.5);

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
      const response = await fetch(`/api/all-relationships?limit=50`);

      if (!response.ok) {
        throw new Error("Failed to fetch related accounts");
      }

      const result: RelatedAccountsResponse = await response.json();

      if (result.error) {
        setError(result.error);
        return;
      }

      // 过滤数据根据最小分数
      const filteredData = result.relationships.filter(
        (account) => account.relationshipScore >= minScore
      );

      if (reset) {
        setData(filteredData);
      } else {
        setData((prev) => [...prev, ...filteredData]);
      }

      setPage(pageNum);
      setHasMore(false); // 目前一次性加载所有数据
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

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchRelatedAccounts(page + 1, false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 0.8) return "bg-red-100 text-red-800";
    if (score >= 0.6) return "bg-orange-100 text-orange-800";
    if (score >= 0.4) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "强关联";
    if (score >= 0.6) return "中关联";
    if (score >= 0.4) return "弱关联";
    return "低关联";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>关联账户列表</CardTitle>
            <CardDescription>
              显示所有检测到的关联账户对，按关联强度排序
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
            step="0.1"
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(parseFloat(e.target.value))}
            className="w-24"
          />
          <Button size="sm" onClick={handleFilter} disabled={loading}>
            应用过滤
          </Button>
        </div>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>账户地址对</TableHead>
                    <TableHead>关联强度</TableHead>
                    <TableHead>共同交易</TableHead>
                    <TableHead>交易次数</TableHead>
                    <TableHead>账户余额</TableHead>
                    <TableHead>关联类型</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((account, index) => (
                    <TableRow
                      key={`${account.addr1}-${account.addr2}-${index}`}
                    >
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {formatAddress(account.addr1)}
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
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {formatAddress(account.addr2)}
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
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getScoreBadgeColor(
                            account.relationshipScore
                          )}
                        >
                          {getScoreLabel(account.relationshipScore)}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          {account.relationshipScore.toFixed(3)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {account.commonTransactions}
                        </div>
                        {account.amount > 0 && (
                          <div className="text-xs text-gray-500">
                            {account.amount.toFixed(2)} SUI
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div>共同交易: {account.commonTransactions}</div>
                          <div>总金额: {account.amount.toFixed(2)} SUI</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div>
                            关联强度: {account.relationshipScore.toFixed(3)}
                          </div>
                          <div>类型: {account.type}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/?address=${account.addr1}`,
                                "_blank"
                              )
                            }
                            className="h-8 w-8 p-0"
                            title="分析地址1"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/?address=${account.addr2}`,
                                "_blank"
                              )
                            }
                            className="h-8 w-8 p-0"
                            title="分析地址2"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
