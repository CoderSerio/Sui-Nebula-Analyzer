"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  Settings,
  Users,
  Database,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import TransactionGraph from "@/components/transaction-graph";
import AddressAnalysis from "@/components/address-analysis";
import RelatedAccounts from "@/components/related-accounts";

interface DataStats {
  totalWallets: number;
  totalTransactions: number;
  totalRelationships: number;
  lastUpdate: string;
}

export default function SuiNebulaAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [stats, setStats] = useState<DataStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);

      // 获取统计数据
      const queries = [
        "USE sui_analysis; MATCH (n:wallet) RETURN count(n) as count",
        "USE sui_analysis; MATCH ()-[e:transaction]->() RETURN count(e) as count",
        "USE sui_analysis; MATCH ()-[r:related_to]->() RETURN count(r) as count",
      ];

      const results = await Promise.all(
        queries.map(async (query) => {
          const response = await fetch("/api/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          const result = await response.json();
          return result.success ? result.data.data.count?.[0] || 0 : 0;
        })
      );

      setStats({
        totalWallets: results[0],
        totalTransactions: results[1],
        totalRelationships: results[2],
        lastUpdate: new Date().toISOString(),
      });
    } catch (err) {
      console.error("获取统计数据失败:", err);
      // 设置默认值，避免显示错误
      setStats({
        totalWallets: 0,
        totalTransactions: 0,
        totalRelationships: 0,
        lastUpdate: new Date().toISOString(),
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = async () => {
    if (!searchAddress.trim()) return;
    setLoading(true);
    // 搜索逻辑将在组件间传递
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="relative text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Sui 区块链交易关联分析系统
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            基于 NebulaGraph
            的智能地址关联识别平台，通过交易模式分析发现潜在关联地址
          </p>
          {/* 设置按钮 */}
          <div className="absolute top-0 right-0">
            <Link href="/admin/data-management">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                数据管理
              </Button>
            </Link>
          </div>
        </div>

        {/* 数据统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.totalWallets || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">钱包总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.totalTransactions || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">交易总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <GitBranch className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.totalRelationships || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">关联关系</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>地址搜索分析</CardTitle>
            <CardDescription>
              输入 Sui 地址来分析其交易网络和潜在关联地址
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="输入 Sui 地址 (0x...)"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className="flex-1"
              />
              {/* <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                分析
              </Button> */}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="related" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="related">关联账户列表</TabsTrigger>
            <TabsTrigger value="graph">交易网络图谱</TabsTrigger>
            <TabsTrigger value="analysis">关联地址分析</TabsTrigger>
          </TabsList>

          <TabsContent value="related">
            <RelatedAccounts />
          </TabsContent>

          <TabsContent value="graph">
            <TransactionGraph searchAddress={searchAddress} />
          </TabsContent>

          <TabsContent value="analysis">
            <AddressAnalysis searchAddress={searchAddress} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
