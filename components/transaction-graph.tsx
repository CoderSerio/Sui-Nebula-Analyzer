"use client";

import { useState, useEffect, useRef } from "react";
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
import { Loader2, RefreshCw, Download } from "lucide-react";
import * as d3 from "d3";

interface Node {
  id: string;
  address: string;
  type: "target" | "related" | "normal";
  transactionCount: number;
  totalAmount: number;
}

interface Link {
  source: string;
  target: string;
  transactionCount: number;
  totalAmount: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface TransactionGraphProps {
  searchAddress: string;
}

export default function TransactionGraph({
  searchAddress,
}: TransactionGraphProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (searchAddress) {
      fetchGraphData();
    }
  }, [searchAddress]);

  useEffect(() => {
    if (graphData && svgRef.current) {
      renderGraph();
    }
  }, [graphData]);

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 构造中心节点查询
      const centerQuery = `USE sui_analysis; MATCH (center:wallet) WHERE id(center) == hash("${searchAddress}") RETURN center.wallet.address AS center_address, center.wallet.transaction_count AS center_tx_count, center.wallet.total_amount AS center_amount`;

      const centerResponse = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: centerQuery }),
      });

      if (!centerResponse.ok) {
        throw new Error("Failed to fetch center node data");
      }

      const centerResult = await centerResponse.json();

      if (
        !centerResult.success ||
        !centerResult.data.data.center_address?.[0]
      ) {
        setGraphData({ nodes: [], links: [] });
        return;
      }

      // 构造连接节点查询
      const connectionsQuery = `USE sui_analysis; MATCH (center:wallet)-[r:transaction]-(connected:wallet) WHERE id(center) == hash("${searchAddress}") RETURN connected.wallet.address AS connected_address, connected.wallet.transaction_count AS connected_tx_count, connected.wallet.total_amount AS connected_amount, r.amount AS edge_amount LIMIT 50`;

      const connectionsResponse = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: connectionsQuery }),
      });

      if (!connectionsResponse.ok) {
        throw new Error("Failed to fetch connections data");
      }

      const connectionsResult = await connectionsResponse.json();

      // 处理数据格式
      const nodes: Node[] = [];
      const links: Link[] = [];

      const centerData = centerResult.data.data;

      // 添加中心节点
      if (centerData.center_address && centerData.center_address.length > 0) {
        nodes.push({
          id: centerData.center_address[0],
          address: centerData.center_address[0],
          type: "target",
          transactionCount: centerData.center_tx_count?.[0] || 0,
          totalAmount: centerData.center_amount?.[0] || 0,
        });

        // 添加连接节点和链接
        const connectionsData = connectionsResult.data.data;
        if (
          connectionsData?.connected_address &&
          connectionsData.connected_address.length > 0
        ) {
          connectionsData.connected_address.forEach(
            (connAddress: string, index: number) => {
              nodes.push({
                id: connAddress,
                address: connAddress,
                type: "related",
                transactionCount:
                  connectionsData.connected_tx_count?.[index] || 0,
                totalAmount: connectionsData.connected_amount?.[index] || 0,
              });

              links.push({
                source: centerData.center_address[0],
                target: connAddress,
                transactionCount: 1, // 简化为1次交易
                totalAmount: connectionsData.edge_amount?.[index] || 0,
              });
            }
          );
        }
      }

      setGraphData({ nodes, links });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = () => {
    if (!graphData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;

    svg.attr("width", width).attr("height", height);

    // 创建力导向图
    const simulation = d3
      .forceSimulation(graphData.nodes as any)
      .force(
        "link",
        d3
          .forceLink(graphData.links)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // 绘制连线
    const link = svg
      .append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.transactionCount));

    // 绘制节点
    const node = svg
      .append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => Math.max(5, Math.sqrt(d.transactionCount) * 2))
      .attr("fill", (d) => {
        switch (d.type) {
          case "target":
            return "#ef4444";
          case "related":
            return "#f59e0b";
          default:
            return "#3b82f6";
        }
      })
      .call(
        d3
          .drag<any, any>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // 添加标签
    const label = svg
      .append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .enter()
      .append("text")
      .text((d) => d.address.slice(0, 8) + "...")
      .attr("font-size", "10px")
      .attr("dx", 12)
      .attr("dy", 4);

    // 添加工具提示
    node
      .append("title")
      .text(
        (d) =>
          `地址: ${d.address}\n交易次数: ${
            d.transactionCount
          }\n总金额: ${d.totalAmount.toFixed(2)} SUI`
      );

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);

      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  };

  const exportGraph = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `transaction-graph-${Date.now()}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>交易网络图谱</CardTitle>
            <CardDescription>
              可视化展示地址间的交易关系网络，红色为目标地址，橙色为关联地址
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGraphData}
              disabled={loading || !searchAddress}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            {/* <Button variant="outline" size="sm" onClick={exportGraph} disabled={!graphData}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button> */}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>正在分析交易网络...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!searchAddress && !loading && (
          <div className="flex items-center justify-center h-96 text-gray-500">
            请输入地址开始分析
          </div>
        )}

        {graphData && !loading && (
          <div className="space-y-4">
            {/* 图例 */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>目标地址</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span>关联地址</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>普通地址</span>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="flex gap-4">
              <Badge variant="secondary">
                节点数: {graphData.nodes.length}
              </Badge>
              <Badge variant="secondary">
                连接数: {graphData.links.length}
              </Badge>
              <Badge variant="secondary">
                关联地址:{" "}
                {graphData.nodes.filter((n) => n.type === "related").length}
              </Badge>
            </div>

            {/* SVG 图谱 */}
            <div className="border rounded-lg overflow-hidden">
              <svg ref={svgRef} className="w-full"></svg>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
