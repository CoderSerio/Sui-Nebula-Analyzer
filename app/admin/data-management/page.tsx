"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Database,
  Users,
  GitBranch,
  Activity,
  Loader2,
  RefreshCw,
  Settings,
  Play,
  CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

interface DataStats {
  totalWallets: number;
  totalTransactions: number;
  totalRelationships: number;
  lastUpdate: string;
}

// Console日志接口
interface ConsoleMessage {
  type: "info" | "success" | "warning" | "error" | "progress" | "complete";
  message: string;
  data?: any;
  timestamp: string;
}

export default function DataManagementPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

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
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatDate = (dateStr: string) => {
    return dateStr ? new Date(dateStr).toLocaleDateString() : "-";
  };

  // Console组件
  const Console = ({
    messages,
    isActive,
  }: {
    messages: ConsoleMessage[];
    isActive: boolean;
  }) => {
    const consoleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      }
    }, [messages]);

    const getMessageColor = (type: string) => {
      switch (type) {
        case "success":
          return "text-green-600";
        case "warning":
          return "text-yellow-600";
        case "error":
          return "text-red-600";
        case "progress":
          return "text-blue-600";
        case "complete":
          return "text-green-700 font-bold";
        default:
          return "text-gray-700";
      }
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            实时日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={consoleRef}
            className="bg-gray-900 text-gray-100 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm"
          >
            {messages.length === 0 ? (
              <div className="text-gray-400">等待开始...</div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-400 text-xs">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>{" "}
                  <span className={getMessageColor(msg.type)}>
                    {msg.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // 数据采集组件
  const DataCollection = () => {
    const [checkpointCount, setCheckpointCount] = useState(10);
    const [rpcUrl, setRpcUrl] = useState("https://fullnode.mainnet.sui.io:443");
    const [useEnhancedScript, setUseEnhancedScript] = useState(false);
    const [isCollecting, setIsCollecting] = useState(false);
    const [collectionResult, setCollectionResult] = useState<any>(null);
    const [progress, setProgress] = useState(0);
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>(
      []
    );

    const startDataCollection = async () => {
      setIsCollecting(true);
      setCollectionResult(null);
      setProgress(0);
      setConsoleMessages([]);

      try {
        const response = await fetch("/api/data-collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkpointCount,
            rpcUrl,
            useEnhancedScript,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP错误: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("无法读取响应流");
        }

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const message: ConsoleMessage = JSON.parse(line);
              setConsoleMessages((prev) => [...prev, message]);

              // 更新进度
              if (message.type === "progress" && message.data?.progress) {
                setProgress(message.data.progress);
              }

              // 处理完成
              if (message.type === "complete") {
                setCollectionResult({
                  success: true,
                  message: message.message,
                  stats: message.data?.stats || {},
                  timestamp: message.timestamp,
                });
                setProgress(100);
                // 延迟刷新数据统计，让用户先看到结果
                // setTimeout(() => {
                //   fetchStats();
                // }, 5000); // 5秒后再刷新，让用户有时间查看日志
              }

              // 处理错误
              if (message.type === "error") {
                setCollectionResult({
                  success: false,
                  error: message.message,
                  timestamp: message.timestamp,
                });
              }
            } catch (parseError) {
              console.error("解析消息失败:", parseError);
            }
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setConsoleMessages((prev) => [
          ...prev,
          {
            type: "error",
            message: `连接错误: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setCollectionResult({
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        setProgress(0);
      } finally {
        setIsCollecting(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* 配置区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              采集配置
            </CardTitle>
            <CardDescription>
              配置数据采集参数，系统将获取最新的 Sui 交易数据并存储到
              NebulaGraph
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkpoint-count">Checkpoint 数量</Label>
                <Input
                  id="checkpoint-count"
                  type="number"
                  value={checkpointCount}
                  onChange={(e) => setCheckpointCount(Number(e.target.value))}
                  min={1}
                  max={1000}
                  disabled={isCollecting}
                />
                <p className="text-xs text-gray-500">
                  推荐从小数量开始测试，如10个checkpoint
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rpc-url">Sui RPC URL</Label>
                <Input
                  id="rpc-url"
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                  disabled={isCollecting}
                />
                <p className="text-xs text-gray-500">Sui 全节点RPC地址</p>
              </div>
            </div>

            {/* 增强功能选项 */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enhanced-script">增强版数据采集</Label>
                  <p className="text-xs text-gray-500">
                    启用后将采集账户余额、对象数量等额外信息（会增加采集时间）
                  </p>
                </div>
                <Switch
                  id="enhanced-script"
                  checked={useEnhancedScript}
                  onCheckedChange={setUseEnhancedScript}
                  disabled={isCollecting}
                />
              </div>

              {useEnhancedScript && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-700">
                    <strong>增强版功能包括：</strong>
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>• 账户SUI余额查询</li>
                      <li>• 拥有对象数量统计</li>
                      <li>• 合约地址识别</li>
                      <li>• 改进的关联性评分算法</li>
                      <li>• 更多交易类型分析</li>
                    </ul>
                    <p className="mt-2 text-xs text-blue-600">
                      ⚠️ 注意：增强版功能会显著增加采集时间
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 执行区域 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              执行采集
            </CardTitle>
            {/* <CardDescription>
              开始数据采集任务。注意：这将清空现有数据并重新导入！
            </CardDescription> */}
            {/* 警告提示 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="text-yellow-600 mt-0.5">⚠️</div>
                <div>
                  <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                    <li>
                      数据采集将清空所有现有数据，采集过程中请不要退出页面
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={startDataCollection}
                disabled={isCollecting}
                size="lg"
              >
                {isCollecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    采集中...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    开始采集
                  </>
                )}
              </Button>
              {isCollecting && (
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>处理进度</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 实时Console */}
        {(isCollecting || consoleMessages.length > 0) && (
          <Console messages={consoleMessages} isActive={isCollecting} />
        )}

        {/* 结果显示 */}
        {collectionResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {collectionResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">
                    ✕
                  </div>
                )}
                采集结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collectionResult.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {collectionResult.stats.walletsInserted}
                      </p>
                      <p className="text-sm text-blue-600">钱包数量</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {collectionResult.stats.transactionsInserted}
                      </p>
                      <p className="text-sm text-green-600">交易数量</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {collectionResult.stats.relationshipsInserted}
                      </p>
                      <p className="text-sm text-orange-600">关联关系</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {collectionResult.stats.checkpointsProcessed}
                      </p>
                      <p className="text-sm text-purple-600">Checkpoint</p>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium">
                      ✅ {collectionResult.message}
                    </p>
                    <p className="text-green-600 text-sm mt-1">
                      完成时间:{" "}
                      {new Date(collectionResult.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">❌ 采集失败</p>
                  <p className="text-red-600 text-sm mt-1">
                    错误: {collectionResult.error}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回主页
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">数据管理</h1>
              <p className="text-gray-600">Sui 链上数据采集和管理</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchStats} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("/api/debug-db", "_blank")}
            >
              🔍 调试
            </Button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* 数据统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <Activity className="h-8 w-8 text-green-500" />
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

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">最后更新</p>
                  <p className="text-xs text-muted-foreground">
                    {stats?.lastUpdate ? formatDate(stats.lastUpdate) : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 数据采集 */}
        <DataCollection />
      </div>
    </div>
  );
}
