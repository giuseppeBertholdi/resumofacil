type MercadoPagoSearchResponse = {
  results?: Array<{
    status?: string;
    transaction_amount?: number;
    payment_method_id?: string;
    external_reference?: string;
  }>;
};

export async function hasApprovedPixAccess(input: {
  email: string;
  externalReference: string;
}): Promise<boolean> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return false;
  }

  const params = new URLSearchParams({
    status: "approved",
    "payer.email": input.email,
    sort: "date_created",
    criteria: "desc",
    limit: "20",
  });

  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as MercadoPagoSearchResponse;
  const results = data.results ?? [];

  return results.some((payment) => {
    const isApproved = payment.status === "approved";
    const isPix = payment.payment_method_id === "pix";
    const hasExpectedAmount = Number(payment.transaction_amount ?? 0) >= 4.99;
    const isExpectedReference = payment.external_reference === input.externalReference;
    return isApproved && isPix && hasExpectedAmount && isExpectedReference;
  });
}
