// Nebula Graph Client using @nebula-contrib/nebula-nodejs
import { createClient } from "@nebula-contrib/nebula-nodejs";

export interface NebulaConfig {
  servers: string[];
  userName: string;
  password: string;
  space: string;
  poolSize?: number;
  bufferSize?: number;
  executeTimeout?: number;
  pingInterval?: number;
}

export default class NebulaClient {
  private client: any;
  private config: NebulaConfig;

  constructor(partial: Partial<NebulaConfig> = {}) {
    this.config = {
      servers: [
        process.env.NEBULA_HOST
          ? `${process.env.NEBULA_HOST}:9669`
          : "localhost:9669",
      ],
      userName: process.env.NEBULA_USERNAME || "root",
      password: process.env.NEBULA_PASSWORD || "nebula",
      space: process.env.NEBULA_SPACE || "sui_analysis",
      poolSize: 5,
      bufferSize: 2000,
      executeTimeout: 15000,
      pingInterval: 60000,
      ...partial,
    };

    console.log("NebulaClient config:", {
      ...this.config,
      password: "***",
    });

    this.client = createClient(this.config);

    // 设置事件监听器
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on("ready", ({ sender }: any) => {
      console.log("Nebula client ready");
    });

    this.client.on("error", ({ sender, error }: any) => {
      console.error("Nebula client error:", error);
    });

    this.client.on("connected", ({ sender }: any) => {
      console.log("Nebula client connected");
    });

    this.client.on("authorized", ({ sender }: any) => {
      console.log("Nebula client authorized");
    });

    this.client.on("reconnecting", ({ sender, retryInfo }: any) => {
      console.log("Nebula client reconnecting:", retryInfo);
    });

    this.client.on("close", ({ sender }: any) => {
      console.log("Nebula client connection closed");
    });
  }

  public async executeQuery(
    stmt: string,
    returnOriginal: boolean = false
  ): Promise<any> {
    try {
      console.log("Executing query:", stmt);
      const result = await this.client.execute(stmt, returnOriginal);
      console.log("Query executed successfully");
      return result;
    } catch (error) {
      console.error("Query execution failed:", error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        console.log("Nebula client closed successfully");
      } catch (error) {
        console.error("Error closing Nebula client:", error);
      }
    }
  }
}
