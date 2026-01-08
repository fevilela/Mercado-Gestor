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
  const payment = data?.payment || data?.payments?.[0] || data?.transaction || {};
  const statusSource = payment?.status || data?.status || "";
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
      payment?.id || data?.id || data?.payment_intent_id || null,
  };
};

const authorizeMercadoPago = async (
  amount: number,
  method: PaymentMethod,
  accessToken: string,
  terminalId: string,
  description: string
): Promise<PaymentResult> => {
  const createRes = await fetch(
    "https://api.mercadopago.com/point/integration-api/payment-intents",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        description,
        payment: { type: mapPaymentType(method) },
        device_id: terminalId,
      }),
    }
  );

  if (!createRes.ok) {
    const error = await createRes.json().catch(() => ({}));
    throw new Error(error?.message || "Pagamento nao autorizado");
  }

  const intent = await createRes.json();
  const intentId = intent?.id || intent?.payment_intent_id;

  if (!intentId) {
    return parseResult(intent, "mercadopago");
  }

  const statusRes = await fetch(
    `https://api.mercadopago.com/point/integration-api/payment-intents/${intentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!statusRes.ok) {
    return parseResult(intent, "mercadopago");
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
