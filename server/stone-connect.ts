import type { PaymentMethod, PaymentResult } from "./payment-service";

type StoneEnvironment = "homologacao" | "producao";

const normalizeStatus = (raw: string): PaymentResult["status"] => {
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

const resolveEnvUrl = (baseName: string, environment: StoneEnvironment) => {
  const upper = environment === "producao" ? "PRODUCAO" : "HOMOLOGACAO";
  return (
    process.env[`${baseName}_${upper}`] ||
    process.env[baseName] ||
    ""
  );
};

const requireUrl = (name: string, value: string) => {
  if (!value) {
    throw new Error(`Stone Connect nao configurado: ${name}`);
  }
  return value;
};

const readProviderError = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  const message =
    data?.message ||
    data?.error_description ||
    data?.error ||
    data?.status_message ||
    data?.detail ||
    "";
  const statusInfo = response.status ? ` (status ${response.status})` : "";
  return `${message}${statusInfo}`.trim();
};

const mapStoneMethod = (method: PaymentMethod) => {
  if (method === "credito") return "credit";
  if (method === "debito") return "debit";
  return "pix";
};

const parseStoneResult = (data: any): PaymentResult => {
  const payment =
    data?.payment ||
    data?.transaction ||
    data?.transactions?.[0] ||
    data;
  const statusSource =
    payment?.status || data?.status || data?.state || "";
  return {
    status: normalizeStatus(String(statusSource)),
    nsu: payment?.nsu || payment?.reference_id || null,
    brand: payment?.card_brand || payment?.payment_method || null,
    provider: "stone",
    authorizationCode: payment?.authorization_code || null,
    providerReference: payment?.id || data?.id || null,
  };
};

const fetchAccessToken = async (
  clientId: string,
  clientSecret: string,
  environment: StoneEnvironment
) => {
  const authUrl = requireUrl(
    "STONE_CONNECT_AUTH_URL",
    resolveEnvUrl("STONE_CONNECT_AUTH_URL", environment)
  );
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();
  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || "Falha ao autenticar Stone Connect");
  }

  const data = await response.json();
  const token = data?.access_token || data?.token || data?.accessToken;
  if (!token) {
    throw new Error("Token da Stone Connect nao retornado");
  }
  return String(token);
};

export const validateStoneSettings = async ({
  clientId,
  clientSecret,
  environment,
}: {
  clientId: string;
  clientSecret: string;
  environment: StoneEnvironment;
}) => {
  await fetchAccessToken(clientId, clientSecret, environment);
  return { ok: true };
};

export const authorizeStonePayment = async ({
  amount,
  method,
  description,
  terminalId,
  clientId,
  clientSecret,
  environment,
}: {
  amount: number;
  method: PaymentMethod;
  description: string;
  terminalId: string;
  clientId: string;
  clientSecret: string;
  environment: StoneEnvironment;
}): Promise<PaymentResult> => {
  const paymentUrl = requireUrl(
    "STONE_CONNECT_PAYMENT_URL",
    resolveEnvUrl("STONE_CONNECT_PAYMENT_URL", environment)
  );
  const token = await fetchAccessToken(clientId, clientSecret, environment);
  const payload = {
    amount: amount.toFixed(2),
    method: mapStoneMethod(method),
    terminal_id: terminalId,
    description,
    reference: `pdv-${Date.now()}`,
  };
  const response = await fetch(paymentUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || "Pagamento nao autorizado");
  }

  const data = await response.json();
  return parseStoneResult(data);
};

export const captureStonePayment = async ({
  paymentId,
  clientId,
  clientSecret,
  environment,
}: {
  paymentId: string;
  clientId: string;
  clientSecret: string;
  environment: StoneEnvironment;
}) => {
  const captureUrl = requireUrl(
    "STONE_CONNECT_CAPTURE_URL",
    resolveEnvUrl("STONE_CONNECT_CAPTURE_URL", environment)
  );
  const token = await fetchAccessToken(clientId, clientSecret, environment);
  const response = await fetch(captureUrl.replace(":id", paymentId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || "Falha ao capturar pagamento");
  }

  const data = await response.json();
  return parseStoneResult(data);
};

export const cancelStonePayment = async ({
  paymentId,
  clientId,
  clientSecret,
  environment,
}: {
  paymentId: string;
  clientId: string;
  clientSecret: string;
  environment: StoneEnvironment;
}) => {
  const cancelUrl = requireUrl(
    "STONE_CONNECT_CANCEL_URL",
    resolveEnvUrl("STONE_CONNECT_CANCEL_URL", environment)
  );
  const token = await fetchAccessToken(clientId, clientSecret, environment);
  const response = await fetch(cancelUrl.replace(":id", paymentId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || "Falha ao cancelar pagamento");
  }

  const data = await response.json();
  return parseStoneResult(data);
};

export const getStonePaymentStatus = async ({
  paymentId,
  clientId,
  clientSecret,
  environment,
}: {
  paymentId: string;
  clientId: string;
  clientSecret: string;
  environment: StoneEnvironment;
}) => {
  const statusUrl = requireUrl(
    "STONE_CONNECT_STATUS_URL",
    resolveEnvUrl("STONE_CONNECT_STATUS_URL", environment)
  );
  const token = await fetchAccessToken(clientId, clientSecret, environment);
  const response = await fetch(statusUrl.replace(":id", paymentId), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || "Falha ao consultar pagamento");
  }

  const data = await response.json();
  return parseStoneResult(data);
};
