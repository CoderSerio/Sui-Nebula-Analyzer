import { NextRequest, NextResponse } from "next/server";
import GatewayClient from "@/lib/gateway-client";

export async function GET(request: NextRequest) {
  console.log("=== All Relationships API Called ===");

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "50";

    console.log("Request params:", { limit });

    const client = new GatewayClient();
    console.log("Creating GatewayClient...");

    console.log("Getting all relationships from Gateway server...");
    const data = await client.getAllRelationships(parseInt(limit));

    console.log("All relationships retrieved successfully");

    return NextResponse.json(data);
  } catch (error) {
    console.log("=== All Relationships API Error ===");
    console.error("Error details:", error);

    // 返回fallback数据
    console.log("Returning fallback data due to error");
    return NextResponse.json({
      totalFound: 0,
      relationships: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
