"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Play, Square, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CollectionStatus {
  isRunning: boolean
  progress: number
  currentBlock: number
  totalTransactions: number
  processedTransactions: number
  errors: number
  startTime?: string
}

interface DataCollectionProps {
  onStatsUpdate: () => void
}

export default function DataCollection({ onStatsUpdate }: DataCollectionProps) {
  const [status, setStatus] = useState<CollectionStatus>({
    isRunning: false,
    progress: 0,
    currentBlock: 0,
    totalTransactions: 0,
    processedTransactions: 0,
    errors: 0,
  })
  const [startBlock, setStartBlock] = useState("")
  const [endBlock, setEndBlock] = useState("")
  const [batchSize, setBatchSize] = useState("100")
  const { toast } = useToast()

  const startCollection = async () => {
    if (!startBlock || !endBlock) {
      toast({
        title: "参数错误",
        description: "请输入起始和结束区块号",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/data-collection/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startBlock: Number.parseInt(startBlock),
          endBlock: Number.parseInt(endBlock),
          batchSize: Number.parseInt(batchSize),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to start collection")
      }

      setStatus((prev) => ({ ...prev, isRunning: true, startTime: new Date().toISOString() }))
      toast({
        title: "数据采集已启动",
        description: "开始从 Sui 网络采集交易数据",
      })

      // 开始轮询状态
      pollStatus()
    } catch (error) {
      toast({
        title: "启动失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    }
  }

  const stopCollection = async () => {
    try {
      const response = await fetch("/api/data-collection/stop", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to stop collection")
      }

      setStatus((prev) => ({ ...prev, isRunning: false }))
      toast({
        title: "数据采集已停止",
        description: "采集任务已成功停止",
      })
    } catch (error) {
      toast({
        title: "停止失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    }
  }

  const pollStatus = () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/data-collection/status")
        if (response.ok) {
          const newStatus = await response.json()
          setStatus(newStatus)

          if (!newStatus.isRunning) {
            clearInterval(interval)
            onStatsUpdate() // 更新统计数据
            toast({
              title: "采集完成",
              description: `成功处理 ${newStatus.processedTransactions} 笔交易`,
            })
          }
        }
      } catch (error) {
        console.error("Failed to poll status:", error)
      }
    }, 2000)

    return () => clearInterval(interval)
  }

  const resetDatabase = async () => {
    if (!confirm("确定要重置数据库吗？这将删除所有已采集的数据。")) {
      return
    }

    try {
      const response = await fetch("/api/data-collection/reset", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to reset database")
      }

      toast({
        title: "数据库已重置",
        description: "所有数据已清空，可以重新开始采集",
      })
      onStatsUpdate()
    } catch (error) {
      toast({
        title: "重置失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 采集配置 */}
      <Card>
        <CardHeader>
          <CardTitle>数据采集配置</CardTitle>
          <CardDescription>配置从 Sui GraphQL API 采集交易数据的参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startBlock">起始区块</Label>
              <Input
                id="startBlock"
                placeholder="例如: 1000000"
                value={startBlock}
                onChange={(e) => setStartBlock(e.target.value)}
                disabled={status.isRunning}
              />
            </div>
            <div>
              <Label htmlFor="endBlock">结束区块</Label>
              <Input
                id="endBlock"
                placeholder="例如: 1001000"
                value={endBlock}
                onChange={(e) => setEndBlock(e.target.value)}
                disabled={status.isRunning}
              />
            </div>
            <div>
              <Label htmlFor="batchSize">批处理大小</Label>
              <Input
                id="batchSize"
                placeholder="100"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                disabled={status.isRunning}
              />
            </div>
          </div>

          <div className="flex gap-4">
            {!status.isRunning ? (
              <Button onClick={startCollection}>
                <Play className="h-4 w-4 mr-2" />
                开始采集
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopCollection}>
                <Square className="h-4 w-4 mr-2" />
                停止采集
              </Button>
            )}
            <Button variant="outline" onClick={resetDatabase} disabled={status.isRunning}>
              <Database className="h-4 w-4 mr-2" />
              重置数据库
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 采集状态 */}
      <Card>
        <CardHeader>
          <CardTitle>采集状态</CardTitle>
          <CardDescription>实时显示数据采集进度和统计信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={status.isRunning ? "default" : "secondary"}>{status.isRunning ? "运行中" : "已停止"}</Badge>
            {status.isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {status.isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>采集进度</span>
                <span>{status.progress.toFixed(1)}%</span>
              </div>
              <Progress value={status.progress} />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{status.currentBlock.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">当前区块</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{status.processedTransactions.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">已处理交易</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{status.totalTransactions.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">总交易数</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{status.errors}</div>
              <p className="text-sm text-muted-foreground">错误数</p>
            </div>
          </div>

          {status.startTime && (
            <div className="text-sm text-gray-500">开始时间: {new Date(status.startTime).toLocaleString()}</div>
          )}
        </CardContent>
      </Card>

      {/* 数据库状态 */}
      <Card>
        <CardHeader>
          <CardTitle>NebulaGraph 数据库状态</CardTitle>
          <CardDescription>显示图数据库的连接状态和数据统计</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>数据库连接正常，图模型已初始化。节点类型：钱包地址，边类型：交易关系。</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
