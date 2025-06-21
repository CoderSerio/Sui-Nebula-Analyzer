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
import { Loader2, Search } from "lucide-react";
import TransactionGraph from "@/components/transaction-graph";
import AddressAnalysis from "@/components/address-analysis";
import RelatedAccounts from "@/components/related-accounts";
import DataCollection from "@/components/data-collection";

export default function SuiNebulaAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");

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
