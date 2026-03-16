import { NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/server/supabaseAuth";
import { hasApprovedPixAccess } from "@/lib/server/paymentAccess";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  const hasAccess = await hasApprovedPixAccess({
    email: user.email,
    externalReference: `premium-${user.id}`,
  });

  return NextResponse.json({
    hasAccess,
  });
}
