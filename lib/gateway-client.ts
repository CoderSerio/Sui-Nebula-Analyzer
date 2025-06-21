// Gateway Client for calling our independent Nebula Gateway Server
export interface GatewayConfig {
  baseUrl: string;
}

export default class GatewayClient {
  private readonly baseUrl: string;

  constructor(config: Partial<GatewayConfig> = {}) {
    this.baseUrl =
      config.baseUrl || process.env.GATEWAY_URL || "http://localhost:3002";
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(
          `Gateway request failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`Gateway request to ${url} failed:`, error);
      throw error;
    }
  }

  public async getStats(): Promise<any> {
    return this.request("/stats");
  }

  public async getGraphData(address: string): Promise<any> {
    return this.request(`/graph-data?address=${encodeURIComponent(address)}`);
  }

  public async getAddressAnalysis(address: string): Promise<any> {
    return this.request(
      `/address-analysis?address=${encodeURIComponent(address)}`
    );
  }

  public async getRelatedAccounts(
    address: string,
    limit: number = 20
  ): Promise<any> {
    return this.request(
      `/related-accounts?address=${encodeURIComponent(address)}&limit=${limit}`
    );
  }

  public async executeQuery(
    query: string,
    returnOriginal: boolean = false
  ): Promise<any> {
    return this.request("/query", {
      method: "POST",
      body: JSON.stringify({ query, returnOriginal }),
    });
  }

  public async healthCheck(): Promise<any> {
    return this.request("/health");
  }

  public async getAllRelationships(limit: number = 50): Promise<any> {
    return this.request(`/all-relationships?limit=${limit}`);
  }
}
