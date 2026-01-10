import type { CompanySettings } from "@shared/schema";

export type PaymentMethod = "pix" | "credito" | "debito";
export type PaymentStatus = "approved" | "declined" | "processing";
export type PaymentResult = {
  status: PaymentStatus;
  nsu?: string | null;
  brand?: string | null;
  provider?: string | null;
  authorizationCode?: string | null;
  providerReference?: string | null;
};

const normalizeStatus = (raw: string): PaymentStatus => {
  const value = raw.toLowerCase();
  if (
    [
      "approved",
      "authorized",
      "success",
      "paid",
      "finished",
      "closed",
    ].includes(value)
  ) {
    return "approved";
  }
  if (
    [
      "rejected",
      "declined",
      "denied",
      "canceled",
      "cancelled",
      "refused",
      "failure",
      "failed",
    ].includes(value)
  ) {
    return "declined";
  }
  return "processing";
};

const mapPaymentType = (method: PaymentMethod) => {
  if (method === "credito") return "credit_card";
  if (method === "debito") return "debit_card";
  return "pix";
};

const parseResult = (data: any, provider: string): PaymentResult => {
  const payment =
    data?.payment ||
    data?.payments?.[0] ||
    data?.transaction ||
    data?.transactions?.payments?.[0] ||
    {};
  const statusSource =
    payment?.status || data?.status || data?.state || "";
  return {
    status: normalizeStatus(String(statusSource)),
    nsu: payment?.nsu || payment?.reference_id || null,
    brand:
      payment?.card?.brand ||
      payment?.payment_method_id ||
      payment?.payment_method ||
      null,
    provider,
    authorizationCode: payment?.authorization_code || null,
    providerReference:
      payment?.id || data?.id || data?.order_id || data?.payment_intent_id || null,
  };
};

const authorizeMercadoPago = async (
  amount: number,
  method: PaymentMethod,
  accessToken: string,
  terminalId: string,
  description: string
): Promise<PaymentResult> => {
  const token = accessToken.trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Error("Pagamento eletronico nao configurado");
  }
  const externalReference = `pdv-${Date.now()}`;
  const idempotencyKey = `${terminalId}-${externalReference}`;
  const createUrl = "https://api.mercadopago.com/v1/orders";
  const payload = {
    type: "point",
    external_reference: externalReference,
    expiration_time: "PT15M",
    description,
    transactions: {
      payments: [
        {
          amount: amount.toFixed(2),
        },
      ],
    },
    config: {
      point: {
        terminal_id: terminalId,
        print_on_terminal: "no_ticket",
      },
      payment_method: {
        default_type: mapPaymentType(method),
        default_installments: 1,
        installments_cost: "seller",
      },
    },
  };
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Idempotency-Key": idempotencyKey,
  };
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const error = await createRes.json().catch(() => ({}));
    throw new Error(error?.message || "Pagamento nao autorizado");
  }

  const order = await createRes.json();
  const orderId = order?.id || order?.order_id;

  if (!orderId) {
    return parseResult(order, "mercadopago");
  }

  const statusRes = await fetch(
    `https://api.mercadopago.com/v1/orders/${orderId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!statusRes.ok) {
    return parseResult(order, "mercadopago");
  }

  const statusData = await statusRes.json();
  return parseResult(statusData, "mercadopago");
};

export const authorizePayment = async ({
  amount,
  method,
  settings,
  description,
}: {
  amount: number;
  method: PaymentMethod;
  settings: CompanySettings | null;
  description: string;
}): Promise<PaymentResult> => {
  if (
    settings?.mpEnabled &&
    settings?.mpAccessToken &&
    settings?.mpTerminalId
  ) {
    return authorizeMercadoPago(
      amount,
      method,
      settings.mpAccessToken,
      settings.mpTerminalId,
      description
    );
  }

  if (settings?.stoneEnabled && settings?.stoneCode) {
    throw new Error("Provedor de pagamento nao configurado");
  }

  throw new Error("Pagamento eletronico nao configurado");
};
