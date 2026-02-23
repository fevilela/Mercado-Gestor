type BridgePrintMeta = {
  fileName?: string;
};

type HybridPrinterBridge = {
  printPdfUrl?: (url: string, meta?: BridgePrintMeta) => Promise<boolean> | boolean;
  printPdfBase64?: (
    base64: string,
    meta?: BridgePrintMeta,
  ) => Promise<boolean> | boolean;
};

declare global {
  interface Window {
    MercadoGestorPrinterBridge?: HybridPrinterBridge;
  }
}

const BRIDGE_BASE_URLS = [
  "http://127.0.0.1:18181",
  "http://localhost:18181",
  "http://127.0.0.1:3001",
  "http://localhost:3001",
];

const PDF_URL_ENDPOINTS = ["/print/pdf-url", "/api/print/pdf-url"];
const PDF_BASE64_ENDPOINTS = ["/print/pdf-base64", "/api/print/pdf-base64"];

async function postJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 2500,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) return false;

    const payload = await res.json().catch(() => ({}));
    if (payload && typeof payload === "object" && "success" in payload) {
      return (payload as { success?: boolean }).success !== false;
    }

    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function tryBridgeEndpoints(
  endpoints: string[],
  body: Record<string, unknown>,
): Promise<boolean> {
  for (const base of BRIDGE_BASE_URLS) {
    for (const endpoint of endpoints) {
      const ok = await postJson(`${base}${endpoint}`, body);
      if (ok) return true;
    }
  }
  return false;
}

function installLocalhostBridgeAdapter() {
  if (typeof window === "undefined") return;

  // If a native SDK bridge already exists, do not override it.
  if (window.MercadoGestorPrinterBridge) return;

  window.MercadoGestorPrinterBridge = {
    async printPdfUrl(url: string, meta?: BridgePrintMeta) {
      return tryBridgeEndpoints(PDF_URL_ENDPOINTS, {
        url,
        fileName: meta?.fileName || null,
      });
    },
    async printPdfBase64(base64: string, meta?: BridgePrintMeta) {
      return tryBridgeEndpoints(PDF_BASE64_ENDPOINTS, {
        base64,
        fileName: meta?.fileName || null,
      });
    },
  };
}

installLocalhostBridgeAdapter();

export {};
