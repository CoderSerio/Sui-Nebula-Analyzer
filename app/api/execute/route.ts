import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3002";

export async function POST(request: NextRequest) {
  console.log("=== Execute API Called ===");

  try {
    const body = await request.json();
    const { query, returnOriginal = false } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 }
      );
    }

    console.log("Forwarding query to Gateway Server:", query);

    const response = await fetch(`${GATEWAY_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, returnOriginal }),
    });

    if (!response.ok) {
      throw new Error(
        `Gateway request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("Query executed successfully");

    return NextResponse.json(data);
  } catch (error) {
    console.error("=== Execute API Error ===");
    console.error("Error details:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
