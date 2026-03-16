import { NextResponse } from "next/server";

function hasValidNotificationToken(request: Request) {
  const expectedToken = process.env.MERCADO_PAGO_NOTIFICATION_TOKEN;

  if (!expectedToken) {
    return true;
  }

  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("token");
  const tokenFromHeader = request.headers.get("x-notification-token");

  return tokenFromQuery === expectedToken || tokenFromHeader === expectedToken;
}

export async function POST(request: Request) {
  if (!hasValidNotificationToken(request)) {
    return NextResponse.json({ error: "Token de notificacao invalido." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);

  // Endpoint preparado para producao. Aqui podemos persistir no Supabase quando desejar.
  console.log("Mercado Pago notification:", payload);

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  if (!hasValidNotificationToken(request)) {
    return NextResponse.json({ error: "Token de notificacao invalido." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, message: "Notification endpoint ativo." });
}
