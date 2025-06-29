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
import {
  analyzeRelationship,
  RelationshipAnalysis,
} from "@/lib/relationship-algorithms";

interface RelatedAddress {
  address: string;
  relationshipScore: number;
  commonTransactions: number;
  totalAmount: number;
  firstInteraction: string;
  lastInteraction: string;
  relationshipType: "strong" | "medium" | "weak";
  analysis?: RelationshipAnalysis;
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
      // 获取地址基本信息 - 移除hash()函数
      const addressQuery = `USE sui_analysis; MATCH (target:wallet) WHERE id(target) == "${searchAddress}" RETURN target.wallet.address AS address, target.wallet.transaction_count AS tx_count, target.wallet.total_amount AS total_amount, target.wallet.first_seen AS first_seen, target.wallet.last_seen AS last_seen`;

      const addressResponse = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: addressQuery }),
      });

      if (!addressResponse.ok) {
        throw new Error("Failed to get address information");
      }

      const addressResult = await addressResponse.json();

      if (!addressResult.success) {
        throw new Error(addressResult.error || "Address query failed");
      }

      // 获取相关账户数据 - 使用actual related_to边
      const relatedQuery = `USE sui_analysis; MATCH (target:wallet)-[r:related_to]-(related:wallet) WHERE id(target) == "${searchAddress}" RETURN related.wallet.address AS address, r.relationship_score AS score, r.common_transactions AS common_tx, r.total_amount AS total_amount, r.first_interaction AS first_interaction, r.last_interaction AS last_interaction, r.relationship_type AS type LIMIT 20`;

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
      const addressData = addressResult.data.data;
      const relatedData = relatedResult.data.data;

      // 处理相关地址数据
      const relatedAddresses: RelatedAddress[] = [];
      if (relatedData?.address && Array.isArray(relatedData.address)) {
        for (let i = 0; i < relatedData.address.length; i++) {
          const score = relatedData.score?.[i] || 0;
          const commonTx = relatedData.common_tx?.[i] || 0;
          const totalAmount = relatedData.total_amount?.[i] || 0;
          const firstInteraction =
            relatedData.first_interaction?.[i] || new Date().toISOString();
          const lastInteraction =
            relatedData.last_interaction?.[i] || new Date().toISOString();

          // 使用关联性算法进行分析
          const analysis = analyzeRelationship({
            commonTransactions: commonTx,
            totalAmount: totalAmount,
            firstInteraction: new Date(firstInteraction),
            lastInteraction: new Date(lastInteraction),
            addresses: [searchAddress, relatedData.address[i]],
          });

          relatedAddresses.push({
            address: relatedData.address[i],
            relationshipScore: score,
            commonTransactions: commonTx,
            totalAmount: totalAmount,
            firstInteraction: firstInteraction,
            lastInteraction: lastInteraction,
            relationshipType: analysis.type,
            analysis: analysis,
          });
        }
      }

      // 如果没有related_to边数据，尝试从transaction边推断关联
      if (relatedAddresses.length === 0) {
        const transactionQuery = `USE sui_analysis; MATCH (target:wallet)-[r:transaction]-(related:wallet) WHERE id(target) == "${searchAddress}" RETURN related.wallet.address AS address, related.wallet.transaction_count AS tx_count, related.wallet.total_amount AS amount, r.amount AS tx_amount, r.tx_timestamp AS tx_time LIMIT 10`;

        const transactionResponse = await fetch("/api/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: transactionQuery }),
        });

        if (transactionResponse.ok) {
          const transactionResult = await transactionResponse.json();
          const txData = transactionResult.data?.data;

          if (txData?.address && Array.isArray(txData.address)) {
            for (let i = 0; i < txData.address.length; i++) {
              const txAmount = txData.tx_amount?.[i] || 0;
              const analysis = analyzeRelationship({
                commonTransactions: 1, // 简化为1个交易
                totalAmount: txAmount,
                firstInteraction: new Date(txData.tx_time?.[i] || Date.now()),
                lastInteraction: new Date(txData.tx_time?.[i] || Date.now()),
                addresses: [searchAddress, txData.address[i]],
              });

              relatedAddresses.push({
                address: txData.address[i],
                relationshipScore: analysis.score,
                commonTransactions: 1,
                totalAmount: txAmount,
                firstInteraction:
                  txData.tx_time?.[i] || new Date().toISOString(),
                lastInteraction:
                  txData.tx_time?.[i] || new Date().toISOString(),
                relationshipType: analysis.type,
                analysis: analysis,
              });
            }
          }
        }
      }

      // 按关联强度排序
      relatedAddresses.sort(
        (a, b) => b.relationshipScore - a.relationshipScore
      );

      const finalResult = {
        targetAddress: addressData?.address?.[0] || searchAddress,
        relatedAddresses: relatedAddresses,
        analysisTime: new Date().toISOString(),
        totalRelationships: relatedAddresses.length,
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
          <br />
          <small className="text-gray-500">
            算法：多因子加权评分模型 (MVP版本)
          </small>
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

            {/* 关联地址列表 */}
            <CardTitle className="text-lg">关联地址详情</CardTitle>
            <CardDescription>
              按关联强度排序，显示详细的关联分析结果
            </CardDescription>
            <CardContent className="p-0">
              <div className="space-y-4">
                {analysisResult.relatedAddresses?.map((address, index) => (
                  <div key={address.address} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        {getRelationshipBadge(address.relationshipType)}
                        <span className="text-sm font-medium">
                          关联度: {(address.relationshipScore * 100).toFixed(1)}
                          %
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

                    {/* 详细分析因子 */}
                    {address.analysis && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-gray-500 mb-2">
                          分析因子:
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">交易频次:</span>
                            <div className="font-medium">
                              {(
                                address.analysis.factors.commonTransactions *
                                100
                              ).toFixed(0)}
                              %
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">金额相关:</span>
                            <div className="font-medium">
                              {(
                                address.analysis.factors.amountCorrelation * 100
                              ).toFixed(0)}
                              %
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">时间模式:</span>
                            <div className="font-medium">
                              {(
                                address.analysis.factors.timePatternSimilarity *
                                100
                              ).toFixed(0)}
                              %
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">频率相关:</span>
                            <div className="font-medium">
                              {(
                                address.analysis.factors.frequencyCorrelation *
                                100
                              ).toFixed(0)}
                              %
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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
