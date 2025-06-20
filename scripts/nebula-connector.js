// NebulaGraph 数据库连接和操作脚本
import { Connection } from "nebula-js"

class NebulaGraphConnector {
  constructor(config = {}) {
    this.config = {
      host: config.host || "localhost",
      port: config.port || 9669,
      username: config.username || "root",
      password: config.password || "nebula",
      space: config.space || "sui_analysis",
    }
    this.connection = null
  }

  // 连接到 NebulaGraph
  async connect() {
    try {
      this.connection = new Connection({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
      })

      await this.connection.open()
      await this.connection.execute(`USE ${this.config.space}`)

      console.log("Connected to NebulaGraph successfully")
      return true
    } catch (error) {
      console.error("Failed to connect to NebulaGraph:", error)
      throw error
    }
  }

  // 断开连接
  async disconnect() {
    if (this.connection) {
      await this.connection.close()
      this.connection = null
    }
  }

  // 插入钱包地址节点
  async insertWalletNode(address, metadata = {}) {
    const nql = `
      INSERT VERTEX wallet(address, first_seen, last_seen, transaction_count, total_amount, is_contract) 
      VALUES "${address}": ("${address}", "${metadata.firstSeen || new Date().toISOString()}", 
      "${metadata.lastSeen || new Date().toISOString()}", ${metadata.transactionCount || 0}, 
      ${metadata.totalAmount || 0.0}, ${metadata.isContract || false})
    `

    try {
      await this.connection.execute(nql)
      return true
    } catch (error) {
      console.error("Failed to insert wallet node:", error)
      return false
    }
  }

  // 插入交易边
  async insertTransactionEdge(sender, receiver, transactionData) {
    const nql = `
      INSERT EDGE transaction(amount, timestamp, tx_hash, gas_used, success) 
      VALUES "${sender}" -> "${receiver}": (${transactionData.amount}, 
      "${transactionData.timestamp}", "${transactionData.txHash}", 
      ${transactionData.gasUsed}, ${transactionData.success})
    `

    try {
      await this.connection.execute(nql)
      return true
    } catch (error) {
      console.error("Failed to insert transaction edge:", error)
      return false
    }
  }

  // 插入关联关系边
  async insertRelationshipEdge(address1, address2, relationshipData) {
    const nql = `
      INSERT EDGE related_to(relationship_score, common_transactions, total_amount, 
      first_interaction, last_interaction, relationship_type) 
      VALUES "${address1}" -> "${address2}": (${relationshipData.relationshipScore}, 
      ${relationshipData.commonTransactions}, ${relationshipData.totalAmount}, 
      "${relationshipData.firstInteraction}", "${relationshipData.lastInteraction}", 
      "${relationshipData.relationshipType}")
    `

    try {
      await this.connection.execute(nql)
      return true
    } catch (error) {
      console.error("Failed to insert relationship edge:", error)
      return false
    }
  }

  // 查询地址的交易网络
  async getAddressNetwork(address, depth = 2) {
    const nql = `
      GET SUBGRAPH WITH PROP ${depth} STEPS FROM "${address}" 
      YIELD VERTICES AS nodes, EDGES AS relationships
    `

    try {
      const result = await this.connection.execute(nql)
      return this.processNetworkResult(result)
    } catch (error) {
      console.error("Failed to get address network:", error)
      return null
    }
  }

  // 查询关联地址
  async getRelatedAddresses(address, minScore = 0.3) {
    const nql = `
      MATCH (v1:wallet {address: "${address}"})-[e:related_to]->(v2:wallet) 
      WHERE e.relationship_score >= ${minScore} 
      RETURN v2.wallet.address AS address, e.relationship_score AS score, 
      e.common_transactions AS transactions, e.total_amount AS amount,
      e.relationship_type AS type
      ORDER BY e.relationship_score DESC
    `

    try {
      const result = await this.connection.execute(nql)
      return this.processRelatedAddressesResult(result)
    } catch (error) {
      console.error("Failed to get related addresses:", error)
      return []
    }
  }

  // 批量插入交易数据
  async batchInsertTransactions(transactions) {
    const batchSize = 100
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize)

      try {
        // 先插入节点
        for (const tx of batch) {
          await this.insertWalletNode(tx.sender)
          await this.insertWalletNode(tx.receiver)
        }

        // 再插入边
        for (const tx of batch) {
          const success = await this.insertTransactionEdge(tx.sender, tx.receiver, tx)
          if (success) successCount++
          else errorCount++
        }

        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}, Success: ${successCount}, Errors: ${errorCount}`)
      } catch (error) {
        console.error(`Batch processing error:`, error)
        errorCount += batch.length
      }
    }

    return { successCount, errorCount }
  }

  // 处理网络查询结果
  processNetworkResult(result) {
    const nodes = []
    const links = []

    // 处理节点
    if (result.data && result.data.nodes) {
      result.data.nodes.forEach((node) => {
        nodes.push({
          id: node.address,
          address: node.address,
          type: "normal",
          transactionCount: node.transaction_count || 0,
          totalAmount: node.total_amount || 0,
        })
      })
    }

    // 处理边
    if (result.data && result.data.relationships) {
      result.data.relationships.forEach((edge) => {
        links.push({
          source: edge.src,
          target: edge.dst,
          transactionCount: edge.properties.common_transactions || 1,
          totalAmount: edge.properties.amount || 0,
        })
      })
    }

    return { nodes, links }
  }

  // 处理关联地址查询结果
  processRelatedAddressesResult(result) {
    const relatedAddresses = []

    if (result.data && result.data.length > 0) {
      result.data.forEach((row) => {
        relatedAddresses.push({
          address: row.address,
          relationshipScore: row.score,
          commonTransactions: row.transactions,
          totalAmount: row.amount,
          relationshipType: row.type,
        })
      })
    }

    return relatedAddresses
  }

  // 清空数据库
  async clearDatabase() {
    try {
      await this.connection.execute("DELETE EDGE transaction")
      await this.connection.execute("DELETE EDGE related_to")
      await this.connection.execute("DELETE VERTEX wallet")
      console.log("Database cleared successfully")
      return true
    } catch (error) {
      console.error("Failed to clear database:", error)
      return false
    }
  }

  // 获取数据库统计信息
  async getStatistics() {
    try {
      const walletCountResult = await this.connection.execute("MATCH (v:wallet) RETURN count(v) AS wallet_count")
      const transactionCountResult = await this.connection.execute(
        "MATCH ()-[e:transaction]->() RETURN count(e) AS transaction_count",
      )
      const relationshipCountResult = await this.connection.execute(
        "MATCH ()-[e:related_to]->() RETURN count(e) AS relationship_count",
      )

      return {
        totalAddresses: walletCountResult.data[0]?.wallet_count || 0,
        totalTransactions: transactionCountResult.data[0]?.transaction_count || 0,
        relatedGroups: relationshipCountResult.data[0]?.relationship_count || 0,
        lastUpdate: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Failed to get statistics:", error)
      return {
        totalAddresses: 0,
        totalTransactions: 0,
        relatedGroups: 0,
        lastUpdate: new Date().toISOString(),
      }
    }
  }
}

export { NebulaGraphConnector }
