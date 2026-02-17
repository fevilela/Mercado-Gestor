import type { CompanySettings } from "@shared/schema";
import { authorizeStonePayment } from "./stone-connect";

export type PaymentMethod = "pix" | "credito" | "debito";
export type PaymentStatus = "approved" | "declined" | "processing";
export type PaymentResult = {
  status: PaymentStatus;
  nsu?: string | null;
  brand?: string | null;
  provider?: string | null;
  authorizationCode?: string | null;
  providerReference?: string | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  expiresAt?: string | null;
};

const lastOrderByTerminal = new Map<string, string>();

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
  return "qr";
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
  const providerReference =
    provider === "mercadopago"
      ? data?.id || data?.order_id || payment?.id || data?.payment_intent_id || null
      : payment?.id || data?.id || data?.order_id || data?.payment_intent_id || null;
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
    providerReference,
    qrCode:
      data?.point_of_interaction?.transaction_data?.qr_code ||
      data?.transaction_data?.qr_code ||
      null,
    qrCodeBase64:
      data?.point_of_interaction?.transaction_data?.qr_code_base64 ||
      data?.transaction_data?.qr_code_base64 ||
      null,
    expiresAt:
      data?.date_of_expiration ||
      data?.expiration_date ||
      null,
  };
};

const parseProviderBody = (raw: string) => {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const cancelMercadoPagoOrder = async (token: string, orderId: string) => {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) return false;
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(normalizedOrderId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Idempotency-Key": `cancel-${normalizedOrderId}-${Date.now()}`,
      },
    }
  );
  return response.ok;
};

const extractMpDevices = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.devices)) return payload.devices;
  return [];
};

const resolveMercadoPagoTerminalId = async (
  token: string,
  terminalRef: string
) => {
  const rawRef = String(terminalRef || "").trim();
  if (!rawRef) {
    throw new Error("Identificacao do Point nao informada");
  }

  const separators = ["|", ":", "/", ";", ","];
  const separator = separators.find((s) => rawRef.includes(s));
  if (!separator) {
    return rawRef;
  }

  const [rawStoreId, rawPosId] = rawRef.split(separator);
  const storeId = String(rawStoreId || "").trim();
  const posId = String(rawPosId || "").trim();
  if (!storeId || !posId) {
    throw new Error(
      "Formato invalido. Use store_id|pos_id (ex.: STORE123|POS456)"
    );
  }

  const devicesRes = await fetch(
    `https://api.mercadopago.com/point/integration-api/devices?store_id=${encodeURIComponent(
      storeId
    )}&pos_id=${encodeURIComponent(posId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!devicesRes.ok) {
    const details = await readProviderError(devicesRes);
    throw new Error(
      details || "Nao foi possivel consultar devices com store_id e pos_id"
    );
  }

  const devicesPayload = await devicesRes.json().catch(() => ({}));
  const devices = extractMpDevices(devicesPayload);
  if (devices.length === 0) {
    throw new Error("Nenhum dispositivo encontrado para store_id + pos_id");
  }

  const preferred = devices[0] || {};
  const candidate =
    preferred?.terminal_id ||
    preferred?.terminalId ||
    preferred?.id ||
    preferred?.device_id ||
    preferred?.deviceId ||
    preferred?.code ||
    "";
  const resolved = String(candidate || "").trim();
  if (!resolved) {
    throw new Error(
      "Dispositivo encontrado, mas sem terminal_id valido para autorizacao"
    );
  }
  return resolved;
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
  const resolvedTerminalId = await resolveMercadoPagoTerminalId(
    token,
    terminalId
  );
  if (!resolvedTerminalId) {
    throw new Error("POS ID do Mercado Pago nao informado");
  }
  const createUrl = "https://api.mercadopago.com/v1/orders";
  const paymentMethodConfig =
    method === "pix"
      ? {
          default_type: mapPaymentType(method),
        }
      : {
          default_type: mapPaymentType(method),
          default_installments: 1,
          installments_cost: "seller",
        };
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  let createRes: Response | null = null;
  let createErrorMessage = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const externalReference = `pdv-${Date.now()}-${attempt}`;
    const idempotencyKey = `${resolvedTerminalId}-${externalReference}`;
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
          terminal_id: resolvedTerminalId,
          print_on_terminal: "no_ticket",
        },
        payment_method: paymentMethodConfig,
      },
    };
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Idempotency-Key": idempotencyKey,
    };
    createRes = await fetch(createUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (createRes.ok) break;

    const raw = await createRes.text().catch(() => "");
    const data = parseProviderBody(raw);
    const firstCode = String(data?.errors?.[0]?.code || "").trim();
    const message =
      [firstCode, String(data?.errors?.[0]?.message || "").trim()]
        .filter(Boolean)
        .join(" - ") || raw.slice(0, 240).trim();
    createErrorMessage = message
      ? `${message} (status ${createRes.status})`
      : `Pagamento nao autorizado (status ${createRes.status})`;

    const isQueuedOrder =
      createRes.status === 409 &&
      firstCode.toLowerCase() === "already_queued_order_on_terminal";
    if (isQueuedOrder && attempt < 3) {
      const previousOrderId = lastOrderByTerminal.get(resolvedTerminalId);
      if (previousOrderId) {
        await cancelMercadoPagoOrder(token, previousOrderId).catch(() => false);
      }
      await wait(2500);
      continue;
    }
    break;
  }

  if (!createRes || !createRes.ok) {
    throw new Error(createErrorMessage || "Pagamento nao autorizado");
  }

  const order = await createRes.json();
  const orderId = order?.id || order?.order_id;
  if (orderId) {
    lastOrderByTerminal.set(resolvedTerminalId, String(orderId));
  }

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

const readProviderError = async (response: Response) => {
  const raw = await response.text().catch(() => "");
  const data = parseProviderBody(raw);
  const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
  const firstErrorCode = String(firstError?.code || "").trim();
  const firstErrorMessage = String(firstError?.message || "").trim();
  const firstErrorDetail = Array.isArray(firstError?.details)
    ? String(firstError.details[0] || "").trim()
    : "";
  const cause =
    data?.cause?.[0]?.description ||
    data?.cause?.[0]?.message ||
    data?.cause?.[0]?.code ||
    "";
  const message =
    firstErrorMessage ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    data?.status_message ||
    "";
  const codeHint = firstErrorCode || "";
  const rawSnippet =
    !message && !cause && !firstErrorDetail ? raw.slice(0, 240).trim() : "";
  const details = [codeHint, message, cause, firstErrorDetail, rawSnippet]
    .filter(Boolean)
    .join(" - ");
  const statusInfo = response.status ? ` (status ${response.status})` : "";
  return `${details}${statusInfo}`.trim();
};

export const validateMercadoPagoSettings = async (
  accessToken: string,
  terminalId: string
) => {
  const token = accessToken.trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Error("Access token nao informado");
  }
  const terminalRef = terminalId.trim();
  if (!terminalRef) {
    throw new Error("Identificacao do Point nao informada");
  }
  const separators = ["|", ":", "/", ";", ","];
  const separator = separators.find((s) => terminalRef.includes(s));

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const userRes = await fetch("https://api.mercadopago.com/users/me", {
    method: "GET",
    headers,
  });

  if (!userRes.ok) {
    const message = await readProviderError(userRes);
    throw new Error(message || "Credenciais do Mercado Pago invalidas");
  }

  if (!separator) {
    return { ok: true, mode: "terminal_id" };
  }

  const [rawStoreId, rawPosId] = terminalRef.split(separator);
  const storeId = String(rawStoreId || "").trim();
  const posId = String(rawPosId || "").trim();
  if (!storeId || !posId) {
    throw new Error(
      "Formato invalido. Use store_id|pos_id (ex.: STORE123|POS456)"
    );
  }

  const terminalRes = await fetch(
    `https://api.mercadopago.com/point/integration-api/devices?store_id=${encodeURIComponent(
      storeId
    )}&pos_id=${encodeURIComponent(posId)}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!terminalRes.ok) {
    const message = await readProviderError(terminalRes);
    throw new Error(
      message || "Dispositivo do Mercado Pago nao encontrado para store_id + pos_id"
    );
  }

  const terminalData = await terminalRes.json().catch(() => ({}));
  const devices = extractMpDevices(terminalData);
  if (devices.length === 0) {
    throw new Error(
      "Nenhum dispositivo retornado para store_id + pos_id informados"
    );
  }

  return { ok: true, devicesFound: devices.length };
};

export const getMercadoPagoOrderStatus = async (
  accessToken: string,
  orderId: string
): Promise<PaymentResult> => {
  const token = String(accessToken || "").trim().replace(/^Bearer\s+/i, "");
  const normalizedOrderId = String(orderId || "").trim();
  if (!token) {
    throw new Error("Access token nao informado");
  }
  if (!normalizedOrderId) {
    throw new Error("ID do pedido nao informado");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const orderResponse = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(normalizedOrderId)}`,
    {
      method: "GET",
      headers,
    }
  );

  if (orderResponse.ok) {
    const payload = await orderResponse.json().catch(() => ({}));
    return parseResult(payload, "mercadopago");
  }

  // Some flows may return payment-like ids (e.g. PAY...) in providerReference.
  const paymentResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(normalizedOrderId)}`,
    {
      method: "GET",
      headers,
    }
  );
  if (paymentResponse.ok) {
    const payload = await paymentResponse.json().catch(() => ({}));
    return parseResult(payload, "mercadopago");
  }

  const message =
    (await readProviderError(orderResponse)) ||
    (await readProviderError(paymentResponse));
  throw new Error(message || "Falha ao consultar status do pedido");
};

export const clearMercadoPagoTerminalQueue = async (
  accessToken: string,
  terminalRef: string
) => {
  const token = String(accessToken || "").trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Error("Access token nao informado");
  }
  const resolvedTerminalId = await resolveMercadoPagoTerminalId(token, terminalRef);
  const knownOrderId = lastOrderByTerminal.get(resolvedTerminalId);
  if (!knownOrderId) {
    return {
      ok: true,
      cleared: false,
      terminalId: resolvedTerminalId,
      message: "Nenhuma pendencia local conhecida para este terminal",
    };
  }

  const cancelled = await cancelMercadoPagoOrder(token, knownOrderId).catch(
    () => false
  );
  if (cancelled) {
    lastOrderByTerminal.delete(resolvedTerminalId);
  }
  return {
    ok: cancelled,
    cleared: cancelled,
    terminalId: resolvedTerminalId,
    orderId: knownOrderId,
    message: cancelled
      ? "Pendencia cancelada com sucesso"
      : "Nao foi possivel cancelar a pendencia",
  };
};

export const createMercadoPagoPixQr = async ({
  amount,
  accessToken,
  description,
  payerEmail,
}: {
  amount: number;
  accessToken: string;
  description: string;
  payerEmail?: string | null;
}): Promise<PaymentResult> => {
  const token = String(accessToken || "").trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Error("Access token nao informado");
  }
  const normalizedEmail = String(payerEmail || "").trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const safeEmail = emailRegex.test(normalizedEmail)
    ? normalizedEmail
    : "pagamentos@example.com";
  const payload = {
    transaction_amount: Number(amount.toFixed(2)),
    description,
    payment_method_id: "pix",
    payer: {
      email: safeEmail,
    },
  };
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Idempotency-Key": `pix-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || "Falha ao gerar QR PIX");
  }

  const payment = await response.json().catch(() => ({}));
  return parseResult(payment, "mercadopago");
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
  const stoneClientId = settings?.stoneClientId ?? "";
  const stoneClientSecret = settings?.stoneClientSecret ?? "";
  const stoneTerminalId = settings?.stoneTerminalId ?? "";
  const mpAccessToken = settings?.mpAccessToken ?? "";
  const mpTerminalId = settings?.mpTerminalId ?? "";

  const hasStoneCreds =
    !!stoneClientId &&
    !!stoneClientSecret &&
    !!stoneTerminalId;
  const hasMpCreds = !!mpAccessToken && !!mpTerminalId;
  const stoneEnabled = !!settings?.stoneEnabled;
  const mpEnabled = !!settings?.mpEnabled;

  // Respect explicit provider toggles first.
  if (mpEnabled && hasMpCreds) {
    return authorizeMercadoPago(
      amount,
      method,
      mpAccessToken,
      mpTerminalId,
      description
    );
  }

  if (stoneEnabled && hasStoneCreds) {
    return authorizeStonePayment({
      amount,
      method,
      description,
      terminalId: stoneTerminalId,
      clientId: stoneClientId,
      clientSecret: stoneClientSecret,
      environment:
        settings?.stoneEnvironment === "homologacao"
          ? "homologacao"
          : "producao",
    });
  }

  // Legacy fallback when toggles are not configured.
  if (!mpEnabled && !stoneEnabled && hasMpCreds) {
    return authorizeMercadoPago(
      amount,
      method,
      mpAccessToken,
      mpTerminalId,
      description
    );
  }

  if (!mpEnabled && !stoneEnabled && hasStoneCreds) {
    return authorizeStonePayment({
      amount,
      method,
      description,
      terminalId: stoneTerminalId,
      clientId: stoneClientId,
      clientSecret: stoneClientSecret,
      environment:
        settings?.stoneEnvironment === "homologacao"
          ? "homologacao"
          : "producao",
    });
  }

  if (stoneEnabled && !hasStoneCreds) {
    throw new Error(
      "Stone habilitado, mas faltam credenciais (client id, client secret ou terminal)"
    );
  }

  if (mpEnabled && !hasMpCreds) {
    throw new Error(
      "Mercado Pago habilitado, mas faltam credenciais (access token, store_id e pos_id)"
    );
  }

  throw new Error("Pagamento eletronico nao configurado");
};
