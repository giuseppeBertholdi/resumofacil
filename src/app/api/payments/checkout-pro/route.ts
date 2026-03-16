import { NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/server/supabaseAuth";

function normalizeBaseUrl(urlLike: string) {
  const withProtocol = /^https?:\/\//i.test(urlLike) ? urlLike : `https://${urlLike}`;
  return withProtocol.replace(/\/+$/, "");
}

function appendTokenToNotificationUrl(notificationUrl: string, token?: string) {
  if (!token) {
    return notificationUrl;
  }

  const separator = notificationUrl.includes("?") ? "&" : "?";
  return `${notificationUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const notificationUrl = process.env.MERCADO_PAGO_NOTIFICATION_URL;
  const notificationToken = process.env.MERCADO_PAGO_NOTIFICATION_TOKEN;
  const requestOrigin = request.headers.get("origin");
  const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL || requestOrigin || new URL(request.url).origin;
  const appUrl = normalizeBaseUrl(appUrlRaw);
  const canUseAutoReturn = appUrl.startsWith("https://") && !appUrl.includes("localhost");

  if (!user) {
    return NextResponse.json(
      { error: "Faca login com Google antes de iniciar o pagamento." },
      { status: 401 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "MERCADO_PAGO_ACCESS_TOKEN nao configurado. Adicione no .env para ativar o Checkout Pro.",
      },
      { status: 500 },
    );
  }

  const payload = {
    items: [
      {
        id: "acesso-historia-1a-serie",
        title: "Acesso IA Historia 1a serie + criterios da prova",
        description: "Acesso premium mensal para perguntas, resumos e exercicios.",
        quantity: 1,
        currency_id: "BRL",
        unit_price: 4.99,
      },
    ],
    payer: {
      email: user.email,
    },
    external_reference: `premium-${user.id}`,
    back_urls: {
      success: `${appUrl}/pagamento/sucesso`,
      pending: `${appUrl}/pagamento/pendente`,
      failure: `${appUrl}/pagamento/falhou`,
    },
    payment_methods: {
      installments: 1,
      excluded_payment_types: [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "ticket" },
        { id: "atm" },
      ],
    },
    ...(canUseAutoReturn ? { auto_return: "approved" } : {}),
    ...(notificationUrl
      ? {
          notification_url: appendTokenToNotificationUrl(notificationUrl, notificationToken),
        }
      : {}),
  };

  const mercadoPagoResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await mercadoPagoResponse.json();

  if (!mercadoPagoResponse.ok) {
    return NextResponse.json(
      {
        error: "Nao foi possivel criar a preferencia no Checkout Pro.",
        details: data,
      },
      { status: mercadoPagoResponse.status },
    );
  }

  return NextResponse.json({
    preferenceId: data.id,
    checkoutUrl: data.init_point ?? null,
    sandboxCheckoutUrl: data.sandbox_init_point ?? null,
  });
}
