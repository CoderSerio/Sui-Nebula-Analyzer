import type { NextRequest } from "next/server";
import GatewayClient from "@/lib/gateway-client";

export async function GET(request: NextRequest) {
  console.log("=== Related Accounts API Called ===");

  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const limit = parseInt(searchParams.get("limit") || "20");

  console.log("Request params:", { address, limit });

  if (!address) {
    console.log("Missing address parameter");
    return Response.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  try {
    console.log("Creating GatewayClient...");
    const gatewayClient = new GatewayClient();

    console.log("Getting related accounts from Gateway server...");
    const relatedAccountsResult = await gatewayClient.getRelatedAccounts(
      address,
      limit
    );

    console.log("Related accounts retrieved successfully");
    return Response.json(relatedAccountsResult);
  } catch (error) {
    console.error("=== Related Accounts API Error ===");
    console.error("Error details:", error);

    // 返回空的相关账户列表而不是错误
    const fallbackResult = {
      targetAddress: address,
      totalFound: 0,
      accounts: [],
      timestamp: new Date().toISOString(),
      error: "Gateway connection failed, showing offline mode",
    };

    console.log("Returning fallback result due to error");
    return Response.json(fallbackResult);
  }
}
