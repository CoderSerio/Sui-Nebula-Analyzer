// NebulaGraph 客户端封装
import { NebulaGraphConnector } from "../scripts/nebula-connector.js"

class NebulaClient {
  private static instance: NebulaClient
  private connector: NebulaGraphConnector

  private constructor() {
    this.connector = new NebulaGraphConnector({
      host: process.env.NEBULA_HOST || "localhost",
      port: Number.parseInt(process.env.NEBULA_PORT || "9669"),
      username: process.env.NEBULA_USERNAME || "root",
      password: process.env.NEBULA_PASSWORD || "nebula",
      space: process.env.NEBULA_SPACE || "sui_analysis",
    })
  }

  public static getInstance(): NebulaClient {
    if (!NebulaClient.instance) {
      NebulaClient.instance = new NebulaClient()
    }
    return NebulaClient.instance
  }

  async connect() {
    return await this.connector.connect()
  }

  async disconnect() {
    return await this.connector.disconnect()
  }

  async getAddressNetwork(address: string, depth = 2) {
    return await this.connector.getAddressNetwork(address, depth)
  }

  async getRelatedAddresses(address: string, minScore = 0.3) {
    return await this.connector.getRelatedAddresses(address, minScore)
  }

  async getStatistics() {
    return await this.connector.getStatistics()
  }

  async batchInsertTransactions(transactions: any[]) {
    return await this.connector.batchInsertTransactions(transactions)
  }

  async clearDatabase() {
    return await this.connector.clearDatabase()
  }
}

export default NebulaClient
