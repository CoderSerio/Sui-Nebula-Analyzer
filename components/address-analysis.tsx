"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RelatedAddress {
  address: string;
  relationshipScore: number;
  commonTransactions: number;
  totalAmount: number;
  firstInteraction: string;
  lastInteraction: string;
  relationshipType: "strong" | "medium" | "weak";
}

interface AnalysisResult {
  targetAddress: string;
  relatedAddresses: RelatedAddress[];
  analysisTime: string;
  totalRelationships: number;
}

interface AddressAnalysisProps {
  searchAddress: string;
}

export default function AddressAnalysis({
  searchAddress,
}: AddressAnalysisProps) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (searchAddress) {
      performAnalysis();
    }
  }, [searchAddress]);

  const performAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // 获取地址分析数据
      const analysisQuery = `USE sui_analysis; MATCH (target:wallet) WHERE id(target) == hash("${searchAddress}") RETURN target.wallet.address AS address, target.wallet.transaction_count AS tx_count, target.wallet.total_amount AS total_amount, target.wallet.first_seen AS first_seen, target.wallet.last_seen AS last_seen, target.wallet.is_contract AS is_contract`;

      const analysisResponse = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: analysisQuery }),
      });

      if (!analysisResponse.ok) {
        throw new Error("Failed to get address analysis");
      }

      const analysisResult = await analysisResponse.json();

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || "Address analysis failed");
      }

      // 获取相关账户数据
      const relatedQuery = `USE sui_analysis; MATCH (target:wallet)-[r:related_to]-(related:wallet) WHERE id(target) == hash("${searchAddress}") RETURN related.wallet.address AS address, r.relationship_score AS score, r.common_transactions AS common_tx, r.total_amount AS total_amount, r.relationship_type AS type LIMIT 20`;

      const relatedResponse = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: relatedQuery }),
      });

      if (!relatedResponse.ok) {
        throw new Error("Failed to get related accounts");
      }

      const relatedResult = await relatedResponse.json();

      // 处理地址分析数据
      const analysisData = analysisResult.data.data;
      const relatedData = relatedResult.data.data;

      // 处理相关地址数据
      const relatedAddresses: RelatedAddress[] = [];
      if (relatedData?.address && Array.isArray(relatedData.address)) {
        for (let i = 0; i < relatedData.address.length; i++) {
          const score = relatedData.score?.[i] || 0;
          relatedAddresses.push({
            address: relatedData.address[i],
            relationshipScore: score,
            commonTransactions: relatedData.common_tx?.[i] || 0,
            totalAmount: relatedData.total_amount?.[i] || 0,
            firstInteraction: new Date().toISOString(), // 默认值
            lastInteraction: new Date().toISOString(), // 默认值
            relationshipType:
              score > 0.8 ? "strong" : score > 0.5 ? "medium" : "weak",
          });
        }
      }

      // 转换数据格式以匹配前端期望
      const finalResult = {
        targetAddress: analysisData?.address?.[0] || searchAddress,
        relatedAddresses: relatedAddresses,
        analysisTime: new Date().toISOString(),
        totalRelationships: relatedAddresses.length,
        // 保留原始数据用于调试
        rawData: analysisData,
      };

      setAnalysisResult(finalResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "已复制",
        description: "地址已复制到剪贴板",
      });
    } catch (err) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      });
    }
  };

  const getRelationshipBadge = (type: string) => {
    switch (type) {
      case "strong":
        return <Badge variant="destructive">强关联</Badge>;
      case "medium":
        return <Badge variant="default">中等关联</Badge>;
      case "weak":
        return <Badge variant="secondary">弱关联</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>关联地址分析</CardTitle>
        <CardDescription>
          基于交易模式识别潜在关联地址，分析关联强度和交易特征
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>正在分析地址关联性...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!searchAddress && !loading && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            请输入地址开始关联分析
          </div>
        )}

        {analysisResult && !loading && (
          <div className="space-y-6">
            {/* 分析概览 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {analysisResult.totalRelationships}
                  </div>
                  <p className="text-sm text-muted-foreground">发现关联地址</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {
                      analysisResult.relatedAddresses?.filter(
                        (a) => a.relationshipType === "strong"
                      ).length
                    }
                  </div>
                  <p className="text-sm text-muted-foreground">强关联地址</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {analysisResult.relatedAddresses?.reduce(
                      (sum, a) => sum + a.commonTransactions,
                      0
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">共同交易总数</p>
                </CardContent>
              </Card>
            </div>

            {/* 目标地址信息 */}
            {/* <Card>
              <CardHeader>
                <CardTitle className="text-lg">目标地址</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    {analysisResult.targetAddress}
                  </code>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(analysisResult.targetAddress)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://suiscan.xyz/mainnet/account/${analysisResult.targetAddress}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card> */}

            {/* 关联地址列表 */}
            <CardTitle className="text-lg">关联地址详情</CardTitle>
            <CardDescription>
              按关联强度排序，显示详细的关联分析结果
            </CardDescription>
            <CardContent className="p-0">
              <div>
                {analysisResult.relatedAddresses?.map((address, index) => (
                  <div key={address.address} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        {getRelationshipBadge(address.relationshipType)}
                        <span className="text-sm font-medium">
                          关联度: {address.relationshipScore}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(address.address)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `https://suiscan.xyz/mainnet/account/${address.address}`,
                              "_blank"
                            )
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {address.address}
                      </code>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">共同交易:</span>
                        <div className="font-medium">
                          {address.commonTransactions} 次
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">总金额:</span>
                        <div className="font-medium">
                          {address.totalAmount.toFixed(2)} SUI
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">首次交互:</span>
                        <div className="font-medium">
                          {new Date(
                            address.firstInteraction
                          ).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">最近交互:</span>
                        <div className="font-medium">
                          {new Date(
                            address.lastInteraction
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {analysisResult.relatedAddresses?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>未发现明显的关联地址</p>
                  <p className="text-sm">该地址的交易模式相对独立</p>
                </div>
              )}
            </CardContent>

            {/* 分析时间 */}
            <div className="text-sm text-gray-500 text-center">
              分析完成时间:{" "}
              {new Date(analysisResult.analysisTime).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
