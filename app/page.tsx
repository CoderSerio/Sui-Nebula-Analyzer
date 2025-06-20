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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Network, Search, Database, TrendingUp } from "lucide-react";
import TransactionGraph from "@/components/transaction-graph";
import AddressAnalysis from "@/components/address-analysis";
import DataCollection from "@/components/data-collection";

interface Stats {
  totalAddresses: number;
  totalTransactions: number;
  relatedGroups: number;
  lastUpdate: string;
}

export default function SuiNebulaAnalyzer() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Sui 区块链交易关联分析系统
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            基于 NebulaGraph
            的智能地址关联识别平台，通过交易模式分析发现潜在关联地址
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总地址数</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalAddresses.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总交易数</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalTransactions.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">关联组数</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.relatedGroups}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">最后更新</CardTitle>
                <Search className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">
                  {new Date(stats.lastUpdate).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                分析
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="graph" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="graph">交易网络图谱</TabsTrigger>
            <TabsTrigger value="analysis">关联地址分析</TabsTrigger>
            {/* <TabsTrigger value="collection">数据采集</TabsTrigger> */}
          </TabsList>

          <TabsContent value="graph">
            <TransactionGraph searchAddress={searchAddress} />
          </TabsContent>

          <TabsContent value="analysis">
            <AddressAnalysis searchAddress={searchAddress} />
          </TabsContent>

          {/* 改为用脚本实现 */}
          {/* <TabsContent value="collection">
            <DataCollection onStatsUpdate={fetchStats} />
          </TabsContent> */}
        </Tabs>

        {/* Technology Stack Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>技术架构</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">
                  数据源
                </Badge>
                <p className="text-sm">Sui GraphQL API</p>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">
                  图数据库
                </Badge>
                <p className="text-sm">NebulaGraph</p>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">
                  后端
                </Badge>
                <p className="text-sm">Next.js API Routes</p>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">
                  前端
                </Badge>
                <p className="text-sm">React + D3.js</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
