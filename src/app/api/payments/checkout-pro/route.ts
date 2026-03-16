import { NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/server/supabaseAuth";

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
    transaction_amount: 4.99,
    description: "Acesso IA Historia 1a serie + criterios da prova",
    payment_method_id: "pix",
    payer: {
      email: user.email,
    },
    external_reference: `premium-${user.id}`,
    ...(notificationUrl
      ? {
          notification_url: appendTokenToNotificationUrl(notificationUrl, notificationToken),
        }
      : {}),
  };

  const mercadoPagoResponse = await fetch("https://api.mercadopago.com/v1/payments", {
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
        error: "Nao foi possivel gerar o PIX no Mercado Pago.",
        details: data,
      },
      { status: mercadoPagoResponse.status },
    );
  }

  return NextResponse.json({
    paymentId: data.id,
    status: data.status,
    qrCode: data.point_of_interaction?.transaction_data?.qr_code ?? null,
    qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
    ticketUrl: data.point_of_interaction?.transaction_data?.ticket_url ?? null,
  });
}
