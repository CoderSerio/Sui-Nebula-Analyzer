// HTTP-based NebulaGraph Client using Gateway session login
import fetch from "node-fetch";

/**
 * Thin wrapper around NebulaGraph HTTP Gateway (vesoft/nebula-http-gateway)
 *   POST /api/db/connect   -> returns { code, data (session), message }
 *   POST /api/db/exec      -> returns { code, data, message }
 *   POST /api/db/disconnect -> returns { code, message }
 *
 * Works on Apple‑silicon Macs by forcing x86 image in docker‑compose.
 */
export interface NebulaConfig {
  host: string;
  port: number; // Gateway port (default 8090)
  username: string;
  password: string;
  space: string; // graph space to use on every request
}

export default class NebulaHttpClient {
  private readonly cfg: NebulaConfig;
  private session: string | null = null;

  constructor(partial: Partial<NebulaConfig> = {}) {
    this.cfg = {
      host: process.env.NEBULA_HOST || "localhost",
      port: Number(process.env.NEBULA_HTTP_PORT) || 8090,
      username: process.env.NEBULA_USERNAME || "root",
      password: process.env.NEBULA_PASSWORD || "nebula",
      space: process.env.NEBULA_SPACE || "sui_analysis",
      ...partial,
    };

    console.log("NebulaHttpClient cfg", { ...this.cfg, password: "***" });
  }

  /* ------------------------------------------------------------------ */
  /*  Low‑level session helpers                                         */
  /* ------------------------------------------------------------------ */

  /** Ensure we have a valid session before any exec */
  private async ensureSession(): Promise<void> {
    if (this.session) return;
    await this.login();
  }

  /** POST /api/db/connect -> sets this.session */
  private async login(): Promise<void> {
    const url = `http://${this.cfg.host}:${this.cfg.port}/api/db/connect`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.cfg.username,
        password: this.cfg.password,
        address: "nebula-docker-compose-graphd-1", // 匹配HTTP Gateway的实际配置
        port: 9669,
      }),
    });

    if (!res.ok) throw new Error(`Gateway login HTTP ${res.status}`);

    const json = (await res.json()) as any;
    if (json.code !== 0 || !json.data) {
      throw new Error(`Gateway login failed: ${json.message || json.code}`);
    }
    this.session = json.data;
    console.log("Nebula session established:", this.session);
  }

  /** POST /api/db/disconnect */
  public async close(): Promise<void> {
    if (!this.session) return;
    try {
      const url = `http://${this.cfg.host}:${this.cfg.port}/api/db/disconnect`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.session }),
      });
    } finally {
      this.session = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Query executor                                                    */
  /* ------------------------------------------------------------------ */

  public async executeQuery(stmt: string): Promise<any> {
    await this.ensureSession();

    const url = `http://${this.cfg.host}:${this.cfg.port}/api/db/exec`;
    const payload = {
      sessionId: this.session,
      space: this.cfg.space,
      stmt,
    };

    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // session 过期自动重登重试一次
    if (res.status === 401 || res.status === 403) {
      console.warn("Session expired – re‑login");
      this.session = null;
      await this.ensureSession();
      payload.sessionId = this.session;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) throw new Error(`Query HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (json.code !== 0)
      throw new Error(`Nebula error ${json.code}: ${json.message}`);
    return json.data; // { column_names, rows }
  }
}
