import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Search,
  ScanBarcode,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  QrCode,
  User,
  FileCheck,
  CheckCircle2,
  Loader2,
  Printer,
  Package,
  X,
  Ban,
  XCircle,
  Volume2,
  DollarSign,
  Wallet,
  Lock,
  ArrowDownLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

type PdvPaymentMethod = {
  id: number;
  name: string;
  type: "pix" | "credito" | "debito" | "dinheiro" | "outros";
  tefMethod?: "pix" | "credito" | "debito" | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
};
type PaymentStatus = "idle" | "processing" | "approved" | "declined" | "error";
type PaymentResult = {
  status: "approved" | "declined" | "processing";
  nsu?: string | null;
  brand?: string | null;
  provider?: string | null;
  authorizationCode?: string | null;
  providerReference?: string | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  expiresAt?: string | null;
};
type FiscalStatus = "idle" | "sending" | "success" | "pending_fiscal";
type FiscalReadiness = {
  ready: boolean;
  messages: string[];
};
type PosTerminalConfig = {
  id: number;
  name: string;
  code?: string | null;
  isActive?: boolean | null;
  assignedUserId?: string | null;
  requiresSangria?: boolean | null;
  requiresSuprimento?: boolean | null;
  paymentProvider?: "company_default" | "mercadopago" | "stone" | null;
  mpTerminalId?: string | null;
  stoneTerminalId?: string | null;
};

type HybridPrinterBridge = {
  printPdfUrl?: (url: string, meta?: { fileName?: string }) => Promise<boolean> | boolean;
  printPdfBase64?: (
    base64: string,
    meta?: { fileName?: string },
  ) => Promise<boolean> | boolean;
};

declare global {
  interface Window {
    MercadoGestorPrinterBridge?: HybridPrinterBridge;
    AndroidPrinter?: HybridPrinterBridge;
    MiniPDVPrinter?: HybridPrinterBridge;
    Android?: HybridPrinterBridge;
  }
}

export default function POS() {
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<{ product: any; qty: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [fiscalStatus, setFiscalStatus] = useState<FiscalStatus>("idle");
  const [selectedPayment, setSelectedPayment] =
    useState<PdvPaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelReceipt, setShowCancelReceipt] = useState(false);
  const [showPixQrDialog, setShowPixQrDialog] = useState(false);
  const [showTerminalActionDialog, setShowTerminalActionDialog] = useState(false);
  const [terminalLockActive, setTerminalLockActive] = useState(false);
  const [terminalLockReference, setTerminalLockReference] = useState<
    string | null
  >(null);
  const [isReleasingTerminal, setIsReleasingTerminal] = useState(false);
  const [cancelledItems, setCancelledItems] = useState<
    { product: any; qty: number }[]
  >([]);
  const [cancelledTotal, setCancelledTotal] = useState(0);
  const [showOpenCashDialog, setShowOpenCashDialog] = useState(false);
  const [showSangriaDialog, setShowSangriaDialog] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [sangriaAmount, setSangriaAmount] = useState("");
  const [sangriaReason, setSangriaReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();

  const { data: cashRegisterData, isLoading: isLoadingCashRegister } = useQuery(
    {
      queryKey: ["/api/cash-register/current"],
      queryFn: async () => {
        const res = await fetch("/api/cash-register/current");
        if (!res.ok) throw new Error("Failed to fetch cash register");
        return res.json();
      },
    }
  );

  const cashRegister = cashRegisterData?.register;
  const cashMovements = cashRegisterData?.movements || [];
  const [selectedPosTerminalId, setSelectedPosTerminalId] = useState<number | null>(
    null
  );

  const { data: posTerminalsData } = useQuery({
    queryKey: ["/api/pos-terminals"],
    queryFn: async () => {
      const res = await fetch("/api/pos-terminals");
      if (!res.ok) throw new Error("Failed to fetch POS terminals");
      return res.json();
    },
  });
  const isAdminTerminalOverride =
    hasPermission("users:manage") || hasPermission("settings:edit");
  const posTerminals = ((posTerminalsData || []) as PosTerminalConfig[])
    .filter((t) => t?.isActive !== false)
    .filter((t) => {
      const assigned = String(t?.assignedUserId || "").trim();
      if (!assigned) return true;
      if (isAdminTerminalOverride) return true;
      return assigned === String(user?.id || "");
    });
  const selectedPosTerminal =
    posTerminals.find((t) => t.id === selectedPosTerminalId) || null;
  const selectedMpTerminalRef = String(
    selectedPosTerminal?.mpTerminalId || ""
  ).trim();

  useEffect(() => {
    const raw = window.localStorage.getItem("pdv:selected-terminal-id");
    const id = Number(raw);
    if (Number.isFinite(id) && id > 0) {
      setSelectedPosTerminalId(id);
    }
  }, []);

  useEffect(() => {
    if (!posTerminals.length) return;
    if (
      selectedPosTerminalId &&
      posTerminals.some((t) => t.id === selectedPosTerminalId)
    ) {
      return;
    }
    setSelectedPosTerminalId(posTerminals[0].id);
  }, [posTerminals, selectedPosTerminalId]);

  useEffect(() => {
    if (!selectedPosTerminalId) return;
    window.localStorage.setItem(
      "pdv:selected-terminal-id",
      String(selectedPosTerminalId)
    );
  }, [selectedPosTerminalId]);

  const openCashRegisterMutation = useMutation({
    mutationFn: async (data: { openingAmount: string; terminalId?: number }) => {
      const res = await fetch("/api/cash-register/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to open cash register");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/cash-register/current"],
      });
      setShowOpenCashDialog(false);
      setOpeningAmount("");
      toast({
        title: "Caixa Aberto",
        description: "O caixa foi aberto com sucesso.",
        className: "bg-emerald-500 text-white border-none",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sangriaMutation = useMutation({
    mutationFn: async (data: {
      type: string;
      amount: string;
      reason?: string;
    }) => {
      const res = await fetch("/api/cash-register/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create movement");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/cash-register/current"],
      });
      setShowSangriaDialog(false);
      setSangriaAmount("");
      setSangriaReason("");
      toast({
        title: "Sangria Registrada",
        description: "A retirada de dinheiro foi registrada com sucesso.",
        className: "bg-emerald-500 text-white border-none",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenCashRegister = () => {
    if (!openingAmount || parseFloat(openingAmount) < 0) {
      toast({
        title: "Valor Inválido",
        description: "Informe o valor inicial do caixa.",
        variant: "destructive",
      });
      return;
    }
    openCashRegisterMutation.mutate({
      openingAmount,
      terminalId: selectedPosTerminalId || undefined,
    });
  };

  const handleSangria = () => {
    if (!sangriaAmount || parseFloat(sangriaAmount) <= 0) {
      toast({
        title: "Valor Inválido",
        description: "Informe o valor da sangria.",
        variant: "destructive",
      });
      return;
    }
    sangriaMutation.mutate({
      type: "sangria",
      amount: sangriaAmount,
      reason: sangriaReason,
    });
  };

  const playBeep = useCallback(() => {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 1200;
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 100);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const { data: fiscalReadiness } = useQuery<FiscalReadiness>({
    queryKey: ["/api/fiscal/readiness"],
    retry: false,
  });

  const isFiscalConfigured = Boolean(fiscalReadiness?.ready);
  const fiscalMissingMessage =
    fiscalReadiness?.messages?.[0] ||
    "Configuracao fiscal incompleta para emissao da NFC-e.";
  const fiscalEnvironmentLabel =
    settings?.fiscalEnvironment === "producao" ? "Producao" : "Homologacao";

  const isScannerEnabled = settings?.barcodeScannerEnabled !== false;
  const isScannerAutoAdd = settings?.barcodeScannerAutoAdd !== false;
  const isScannerBeep = settings?.barcodeScannerBeep !== false;

  const getPdfBlob = async (url: string, errorMessage: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || errorMessage);
    }
    return res.blob();
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : "";
        if (!base64) {
          reject(new Error("Falha ao converter PDF"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Falha ao ler PDF"));
      reader.readAsDataURL(blob);
    });

  const tryBridgePrintPdf = async (url: string, blob: Blob, fileName: string) => {
    const bridges: HybridPrinterBridge[] = [
      window.MercadoGestorPrinterBridge,
      window.MiniPDVPrinter,
      window.AndroidPrinter,
      window.Android,
    ].filter(Boolean) as HybridPrinterBridge[];

    for (const bridge of bridges) {
      try {
        if (typeof bridge.printPdfUrl === "function") {
          const ok = await bridge.printPdfUrl(url, { fileName });
          if (ok !== false) return true;
        }
        if (typeof bridge.printPdfBase64 === "function") {
          const base64 = await blobToBase64(blob);
          const ok = await bridge.printPdfBase64(base64, { fileName });
          if (ok !== false) return true;
        }
      } catch {
        // tenta o proximo bridge
      }
    }
    return false;
  };

  const tryBrowserPrintPdf = async (blob: Blob): Promise<boolean> =>
    new Promise((resolve) => {
      try {
        const objectUrl = URL.createObjectURL(blob);
        const iframe = document.createElement("iframe");
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          setTimeout(() => {
            iframe.remove();
            URL.revokeObjectURL(objectUrl);
          }, 3000);
          resolve(ok);
        };

        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.src = objectUrl;
        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              finish(true);
            } catch {
              finish(false);
            }
          }, 500);
        };
        iframe.onerror = () => finish(false);
        document.body.appendChild(iframe);
        setTimeout(() => finish(false), 5000);
      } catch {
        resolve(false);
      }
    });

  const printPdfHybrid = async (url: string, fileName: string) => {
    const blob = await getPdfBlob(url, "Falha ao carregar PDF para impressao");
    const isAndroidDevice = /android/i.test(navigator.userAgent || "");
    const printerModel = String(settings?.printerModel || "").toLowerCase();
    const preferBridgeFirst = isAndroidDevice || printerModel.includes("escpos");

    const printed = preferBridgeFirst
      ? ((await tryBridgePrintPdf(url, blob, fileName)) ||
          (await tryBrowserPrintPdf(blob)))
      : ((await tryBrowserPrintPdf(blob)) ||
          (await tryBridgePrintPdf(url, blob, fileName)));

    if (printed) return true;

    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    toast({
      title: "Impressao em modo hibrido",
      description: "Impressao automatica indisponivel. PDF aberto para impressao manual.",
      variant: "destructive",
    });
    return false;
  };

  const {
    data: pdvLoad,
    error: pdvLoadError,
  } = useQuery({
    queryKey: ["/api/pdv/load"],
    queryFn: async () => {
      const res = await fetch("/api/pdv/load");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Nenhuma carga enviada");
      }
      return res.json();
    },
  });

  const fallbackPaymentMethods: PdvPaymentMethod[] = [
    { id: -1, name: "PIX", type: "pix", tefMethod: "pix" },
    { id: -2, name: "Cartao de Credito", type: "credito", tefMethod: "credito" },
    { id: -3, name: "Cartao de Debito", type: "debito", tefMethod: "debito" },
    { id: -4, name: "Dinheiro", type: "dinheiro" },
  ];
  const products = (pdvLoad?.products || []) as any[];
  const paymentMethods = (pdvLoad?.paymentMethods || []) as PdvPaymentMethod[];
  const normalizeText = (value: string) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const inferTefMethod = (
    method: PdvPaymentMethod
  ): "pix" | "credito" | "debito" | null => {
    if (method.tefMethod) return method.tefMethod;
    const typeToken = normalizeText(method.type || "");
    const nameToken = normalizeText(method.name || "");
    const token = `${typeToken} ${nameToken}`;
    if (token.includes("pix") || token.includes("qr")) return "pix";
    if (token.includes("credito") || token.includes("credit")) return "credito";
    if (token.includes("debito") || token.includes("debit")) return "debito";
    if (token.includes("cartao") || token.includes("card")) return "credito";
    return null;
  };
  const resolveTefMethod = (
    method: PdvPaymentMethod
  ): "pix" | "credito" | "debito" | null => {
    const inferred = inferTefMethod(method);
    if (inferred) return inferred;

    const normalizedType = normalizeText(method.type || "");
    if (normalizedType.includes("credito") || normalizedType.includes("credit")) {
      return "credito";
    }
    if (normalizedType.includes("debito") || normalizedType.includes("debit")) {
      return "debito";
    }
    if (normalizedType.includes("pix")) {
      return "pix";
    }
    return null;
  };
  const normalizePaymentMethod = (method: PdvPaymentMethod): PdvPaymentMethod => {
    let tefMethod = inferTefMethod(method);
    if (!tefMethod) {
      const normalizedType = normalizeText(method.type || "");
      if (normalizedType.includes("credito") || normalizedType.includes("credit")) {
        tefMethod = "credito";
      } else if (
        normalizedType.includes("debito") ||
        normalizedType.includes("debit")
      ) {
        tefMethod = "debito";
      } else if (normalizedType.includes("pix")) {
        tefMethod = "pix";
      }
    }
    if (tefMethod) {
      return { ...method, tefMethod };
    }
    return method;
  };
  const activePaymentMethods = paymentMethods
    .filter((method) => method.isActive !== false)
    .map(normalizePaymentMethod);
  const availablePaymentMethods =
    activePaymentMethods.length > 0 ? activePaymentMethods : fallbackPaymentMethods;

  const createSaleMutation = useMutation({
    mutationFn: async (
      saleData: any
    ): Promise<{
      sale: any;
      fiscalConfigured: boolean;
      fiscalReadiness?: FiscalReadiness;
    }> => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create sale");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pdv/load"] });
    },
  });

  const addToCart = useCallback((product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }, []);

  const handleBarcodeScanned = useCallback(
    (barcode: string) => {
      if (!isScannerEnabled || !barcode) return;

      const product = products.find((p: any) => p.ean === barcode);

      if (product) {
        if (isScannerBeep) playBeep();
        if (isScannerAutoAdd) {
          addToCart(product);
          toast({
            title: "Produto Adicionado",
            description: `${product.name} - R$ ${parseFloat(
              product.price
            ).toFixed(2)}`,
            className: "bg-emerald-500 text-white border-none",
          });
        } else {
          setSearchQuery(barcode);
          setShowCatalog(true);
        }
      } else {
        toast({
          title: "Produto Não Encontrado",
          description: `Código ${barcode} não cadastrado no sistema.`,
          variant: "destructive",
        });
      }
    },
    [
      products,
      isScannerEnabled,
      isScannerAutoAdd,
      isScannerBeep,
      playBeep,
      addToCart,
      toast,
    ]
  );

  useEffect(() => {
    if (!isScannerEnabled) return;

    let buffer = "";
    let lastKeyTime = 0;
    let keyTimings: number[] = [];
    const SCANNER_SPEED_THRESHOLD = 50;
    const MIN_BARCODE_LENGTH = 8;
    const BUFFER_TIMEOUT = 300;

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeSinceLastKey = currentTime - lastKeyTime;

      if (timeSinceLastKey > BUFFER_TIMEOUT) {
        buffer = "";
        keyTimings = [];
      }

      if (/^[0-9]$/.test(e.key)) {
        if (buffer.length > 0) {
          keyTimings.push(timeSinceLastKey);
        }
        buffer += e.key;
        lastKeyTime = currentTime;
      }

      if (e.key === "Enter" && buffer.length >= MIN_BARCODE_LENGTH) {
        const avgTiming =
          keyTimings.length > 0
            ? keyTimings.reduce((a, b) => a + b, 0) / keyTimings.length
            : 0;

        if (avgTiming < SCANNER_SPEED_THRESHOLD && avgTiming > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleBarcodeScanned(buffer);
        }
        buffer = "";
        keyTimings = [];
      }
    };

    window.addEventListener("keydown", handleKeyPress, true);
    return () => window.removeEventListener("keydown", handleKeyPress, true);
  }, [isScannerEnabled, handleBarcodeScanned]);

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id));
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === id) {
          const newQty = Math.max(1, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  const getPaymentMethodLabel = (method?: PdvPaymentMethod | null): string => {
    return method?.name || "Nao informado";
  };

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const configuredTimeoutSeconds = Number(settings?.paymentTimeoutSeconds ?? 30);
  const safeTimeoutSeconds = Number.isFinite(configuredTimeoutSeconds)
    ? Math.min(300, Math.max(10, Math.round(configuredTimeoutSeconds)))
    : 30;
  const PAYMENT_TIMEOUT_MS = safeTimeoutSeconds * 1000;
  const PAYMENT_POLL_INTERVAL_MS = 3_000;

  const tryReleaseMercadoPagoTerminal = async (
    providerReference?: string | null
  ) => {
    const reference = String(providerReference || "").trim();
    let released = false;

    if (reference) {
      const cancelRes = await fetch("/api/payments/mercadopago/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerReference: reference }),
      }).catch(() => null);

      if (cancelRes?.ok) {
        const cancelBody = await cancelRes.json().catch(() => ({}));
        released = Boolean(cancelBody?.cancelled);
      }
    }

    if (!released) {
      const clearRes = await fetch("/api/payments/mercadopago/clear-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerReference: reference || undefined,
          terminalId: selectedMpTerminalRef || undefined,
        }),
      }).catch(() => null);

      if (clearRes?.ok) {
        const clearBody = await clearRes.json().catch(() => ({}));
        released = Boolean(clearBody?.cleared);
      }
    }

    if (reference) {
      const statusRes = await fetch(
        `/api/payments/mercadopago/status/${encodeURIComponent(reference)}`
      , {
        cache: "no-store",
      }).catch(() => null);
      if (statusRes?.ok) {
        const statusBody = await statusRes.json().catch(() => ({}));
        const status = String(statusBody?.status || "").toLowerCase();
        if (status && status !== "processing") {
          released = true;
        } else if (status === "processing") {
          released = false;
        }
      }
    }

    return released;
  };

  const handleSelectPayment = async (method: PdvPaymentMethod) => {
    if (terminalLockActive) {
      toast({
        title: "PDV bloqueado",
        description:
          "Existe uma cobranca pendente na maquininha. Libere no terminal para continuar.",
        variant: "destructive",
      });
      return;
    }
    if (!method) return;
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens antes de selecionar o pagamento.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPayment(method);
    setPaymentResult(null);
    setShowPixQrDialog(false);
    setShowTerminalActionDialog(false);
    paymentFlowCancelledRef.current = false;

    const tefMethod = resolveTefMethod(method);

    if (!tefMethod) {
      setPaymentStatus("approved");
      setPaymentResult({
        status: "approved",
        provider: "manual",
      });
      toast({
        title: "Pagamento confirmado",
        description: `Forma: ${method.name}`,
        className: "bg-emerald-500 text-white border-none",
      });
      return;
    }

    if (isAuthorizingRef.current) {
      toast({
        title: "Pagamento em andamento",
        description:
          "Ja existe uma autorizacao em andamento para esta venda. Aguarde o retorno da maquininha.",
      });
      return;
    }

    if (paymentStatus === "processing") {
      setPaymentStatus("idle");
      setPaymentResult(null);
    }

    setPaymentStatus("processing");
    isAuthorizingRef.current = true;

    try {
      let result: PaymentResult | null = null;
      if (tefMethod === "pix") {
        const pixRes = await fetch("/api/payments/pix/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: parseFloat(total.toFixed(2)) }),
        });
        if (!pixRes.ok) {
          const error = await pixRes.json().catch(() => ({}));
          throw new Error(error.error || "Falha ao gerar QR PIX");
        }
        const pixResult: PaymentResult = await pixRes.json();
        result = pixResult;
        setPaymentResult(pixResult);
        setPaymentStatus(
          pixResult.status === "approved"
            ? "approved"
            : pixResult.status === "declined"
              ? "declined"
              : "processing"
        );
        setShowPixQrDialog(true);
        setShowTerminalActionDialog(false);
      } else {
        let res: Response | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          res = await fetch("/api/payments/authorize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: parseFloat(total.toFixed(2)),
              method: tefMethod,
              posTerminalId: selectedPosTerminalId || undefined,
            }),
          });
          if (res.status !== 409 || attempt === 3) {
            break;
          }
          await fetch("/api/payments/mercadopago/clear-queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              terminalId: selectedMpTerminalRef || undefined,
            }),
          }).catch(() => null);
          toast({
            title: "Terminal ocupado",
            description:
              "Liberando fila automaticamente e reenviando para a maquininha...",
          });
          await sleep(5000);
        }

        if (!res) {
          throw new Error("Falha no pagamento");
        }

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          if (res.status === 409) {
            throw new Error(
              error.error ||
                "Ja existe uma cobranca pendente na maquininha. Finalize ou cancele no terminal."
            );
          }
          throw new Error(error.error || "Falha no pagamento");
        }

        const authResult: PaymentResult = await res.json();
        result = authResult;
        setPaymentResult(authResult);
        if (authResult.status === "approved") {
          setPaymentStatus("approved");
          setShowTerminalActionDialog(false);
          toast({
            title: "Pagamento aprovado",
            description: authResult.brand
              ? `Bandeira: ${authResult.brand}`
              : "Pagamento autorizado.",
            className: "bg-emerald-500 text-white border-none",
          });
          return;
        }

        if (authResult.status === "declined") {
          setPaymentStatus("declined");
          setShowTerminalActionDialog(false);
          toast({
            title: "Pagamento negado",
            description: "Tente outra forma de pagamento.",
            variant: "destructive",
          });
          return;
        }
      }

      setPaymentStatus("processing");
      setShowTerminalActionDialog(tefMethod !== "pix");
      toast({
        title: "Pagamento em andamento",
        description:
          tefMethod === "pix"
            ? "Aguardando pagamento via QR na tela do PDV."
            : "Aguardando confirmacao do terminal.",
      });

      if (
        result &&
        result.provider === "mercadopago" &&
        result.providerReference &&
        result.status === "processing"
      ) {
        const maxAttempts = Math.ceil(
          PAYMENT_TIMEOUT_MS / PAYMENT_POLL_INTERVAL_MS
        );
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (paymentFlowCancelledRef.current) {
            return;
          }
          await sleep(PAYMENT_POLL_INTERVAL_MS);
          const statusRes = await fetch(
            `/api/payments/mercadopago/status/${encodeURIComponent(
              result.providerReference
            )}`
            ,
            {
              cache: "no-store",
            }
          );
          if (!statusRes.ok) {
            continue;
          }
          const statusResult: PaymentResult = await statusRes.json();
          setPaymentResult(statusResult);

          if (statusResult.status === "approved") {
            setPaymentStatus("approved");
            setShowPixQrDialog(false);
            setShowTerminalActionDialog(false);
            toast({
              title: "Pagamento aprovado",
              description: statusResult.brand
                ? `Bandeira: ${statusResult.brand}`
                : "Pagamento autorizado.",
              className: "bg-emerald-500 text-white border-none",
            });
            return;
          }

          if (statusResult.status === "declined") {
            setPaymentStatus("declined");
            setShowPixQrDialog(false);
            setShowTerminalActionDialog(false);
            toast({
              title: "Pagamento negado",
              description: "Tente outra forma de pagamento.",
              variant: "destructive",
            });
            return;
          }
        }

        let autoCancelled = false;
        const cancelRes = await fetch("/api/payments/mercadopago/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerReference: result.providerReference,
          }),
        }).catch(() => null);
        if (cancelRes?.ok) {
          const cancelBody = await cancelRes.json().catch(() => ({}));
          autoCancelled = Boolean(cancelBody?.ok || cancelBody?.cancelled);
        }

        if (!autoCancelled) {
          const clearRes = await fetch("/api/payments/mercadopago/clear-queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerReference: result.providerReference,
              terminalId: selectedMpTerminalRef || undefined,
            }),
          }).catch(() => null);
          if (clearRes?.ok) {
            const clearBody = await clearRes.json().catch(() => ({}));
            autoCancelled = Boolean(clearBody?.ok || clearBody?.cleared);
          }
        }

        setPaymentStatus("error");
        setShowPixQrDialog(false);
        setShowTerminalActionDialog(false);
        toast({
          title: "Tempo de pagamento expirado",
          description:
            autoCancelled
              ? `Pagamento nao confirmado em ${safeTimeoutSeconds} segundos. Cobranca cancelada automaticamente.`
              : `Pagamento nao confirmado em ${safeTimeoutSeconds} segundos. Tente cancelar no terminal.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      setPaymentStatus("error");
      setShowPixQrDialog(false);
      setShowTerminalActionDialog(false);
      toast({
        title: "Erro no pagamento",
        description: error instanceof Error ? error.message : "Falha no pagamento",
        variant: "destructive",
      });
    } finally {
      isAuthorizingRef.current = false;
    }
  };

  const handleFinishSale = async () => {
    if (terminalLockActive) {
      toast({
        title: "PDV bloqueado",
        description:
          "Existe uma cobranca pendente na maquininha. Libere o terminal para finalizar vendas.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPayment) {
      toast({
        title: "Selecione a forma de pagamento",
        description:
          "Escolha PIX, Cartão de Crédito ou Cartão de Débito para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (paymentStatus !== "approved" || !paymentResult) {
      toast({
        title: "Pagamento pendente",
        description: "A venda so pode ser finalizada com pagamento aprovado.",
        variant: "destructive",
      });
      return;
    }

    setIsFinishing(true);
    setFiscalStatus("sending");

    const saleData = {
      sale: {
        customerName: "Consumidor Final",
        total: total.toFixed(2),
        itemsCount: cart.reduce((acc, item) => acc + item.qty, 0),
        paymentMethod: getPaymentMethodLabel(selectedPayment),
        status: "Concluído",
        nfceStatus: "Pendente",
      },
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.qty,
        unitPrice: item.product.price,
        subtotal: (parseFloat(item.product.price) * item.qty).toFixed(2),
      })),
      payment: {
        status: paymentResult.status,
        nsu: paymentResult.nsu || null,
        brand: paymentResult.brand || null,
        provider: paymentResult.provider || null,
        authorizationCode: paymentResult.authorizationCode || null,
        providerReference: paymentResult.providerReference || null,
      },
    };

    const autoPrintFiscalCoupon = async (saleId: number) => {
      if (!Number.isFinite(saleId) || saleId <= 0) return;
      try {
        await printPdfHybrid(`/api/fiscal/nfce/${saleId}/pdf`, `nfce-${saleId}.pdf`);
      } catch {
        // usuario ainda pode reimprimir no Fiscal Central
      }
    };

    try {
      const result = await createSaleMutation.mutateAsync(saleData);

      if (result.fiscalConfigured === false) {
        setFiscalStatus("pending_fiscal");
        toast({
          title: "Venda Registrada",
          description:
            result.fiscalReadiness?.messages?.[0] ||
            "Venda salva como pendente fiscal.",
          variant: "default",
          className: "bg-amber-500 text-white border-none",
        });
        return;
      }

      try {
        const response = await fetch("/api/fiscal/nfce/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saleIds: [result.sale?.id].filter(Boolean) }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Erro ao enviar NFC-e");
        }
        setFiscalStatus("success");
        if (result.sale?.id) {
          void autoPrintFiscalCoupon(Number(result.sale.id));
        }
        toast({
          title: "Envio Fiscal Iniciado",
          description: "NFC-e enviada para a SEFAZ e cupom fiscal enviado para impressao.",
          variant: "default",
          className: "bg-emerald-500 text-white border-none",
        });
      } catch (error) {
        setFiscalStatus("pending_fiscal");
        toast({
          title: "Envio Fiscal Pendente",
          description:
            error instanceof Error
              ? error.message
              : "Falha ao enviar NFC-e automaticamente.",
          variant: "default",
          className: "bg-amber-500 text-white border-none",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao processar venda",
        variant: "destructive",
      });
      setIsFinishing(false);
      setFiscalStatus("idle");
    }
  };

  const resetSale = () => {
    setCart([]);
    setIsFinishing(false);
    setFiscalStatus("idle");
    setSelectedPayment(null);
    setPaymentStatus("idle");
    setPaymentResult(null);
    setShowPixQrDialog(false);
    setShowTerminalActionDialog(false);
  };

  const handleCancelSale = async () => {
    paymentFlowCancelledRef.current = true;
    let remoteCancelled = false;
    const shouldTryRemoteCancel =
      paymentResult?.provider === "mercadopago" &&
      !!paymentResult?.providerReference &&
      paymentResult?.status !== "approved";
    const shouldTryClearQueue =
      paymentResult?.provider === "mercadopago" &&
      paymentResult?.status !== "approved";
    if (shouldTryRemoteCancel || shouldTryClearQueue) {
      setTerminalLockReference(paymentResult?.providerReference || null);
      setTerminalLockActive(true);
      remoteCancelled = await tryReleaseMercadoPagoTerminal(
        paymentResult?.providerReference
      );
      if (remoteCancelled) {
        setTerminalLockActive(false);
        setTerminalLockReference(null);
      }
    }
    setCancelledItems([...cart]);
    setCancelledTotal(total);
    setShowCancelDialog(false);
    setShowCancelReceipt(true);
    setCart([]);
    setSelectedPayment(null);
    setPaymentStatus("idle");
    setPaymentResult(null);
    setShowPixQrDialog(false);
    setShowTerminalActionDialog(false);
    toast({
      title: "Venda Cancelada",
      description: remoteCancelled
        ? "Venda cancelada e cobranca removida da maquininha."
        : "Venda cancelada no PDV. Como a maquininha segue pendente, o PDV foi bloqueado ate liberar o terminal.",
      variant: "default",
      className: "bg-red-500 text-white border-none",
    });
  };

  const handleRetryTerminalRelease = async () => {
    if (!terminalLockActive || isReleasingTerminal) return;
    setIsReleasingTerminal(true);
    try {
      const released = await tryReleaseMercadoPagoTerminal(terminalLockReference);
      if (released) {
        setTerminalLockActive(false);
        setTerminalLockReference(null);
        toast({
          title: "PDV liberado",
          description: "Terminal liberado com sucesso.",
          className: "bg-emerald-500 text-white border-none",
        });
      } else {
        toast({
          title: "Terminal ainda pendente",
          description:
            "Cancele a cobranca na maquininha e tente novamente para liberar o PDV.",
          variant: "destructive",
        });
      }
    } finally {
      setIsReleasingTerminal(false);
    }
  };

  const closeCancelReceipt = () => {
    setShowCancelReceipt(false);
    setCancelledItems([]);
    setCancelledTotal(0);
  };

  const subtotal = cart.reduce(
    (acc, item) => acc + parseFloat(item.product.price) * item.qty,
    0
  );
  const total = subtotal;

  const lastTotalRef = useRef(total);
  const isAuthorizingRef = useRef(false);
  const paymentFlowCancelledRef = useRef(false);

  useEffect(() => {
    if (lastTotalRef.current !== total) {
      lastTotalRef.current = total;
      if (paymentStatus !== "idle") {
        setPaymentStatus("idle");
        setPaymentResult(null);
        setSelectedPayment(null);
        setShowTerminalActionDialog(false);
      }
    }
  }, [paymentStatus, total]);

  const uniqueCategories = products
    .map((p: any) => String(p.category))
    .filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i);
  const categories: string[] = ["Todos", ...uniqueCategories];

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.ean && p.ean.includes(searchQuery));
    const matchesCategory =
      selectedCategory === "Todos" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const paymentTypeIcons = {
    pix: QrCode,
    credito: CreditCard,
    debito: CreditCard,
    dinheiro: DollarSign,
    outros: Wallet,
  } as const;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Catalog Panel - Only shown when showCatalog is true */}
      {showCatalog && (
        <div className="w-[56%] min-w-[430px] max-w-[740px] shrink-0 flex flex-col border-r border-border">
          {/* Header */}
          <div className="h-16 border-b border-border flex items-center px-6 gap-4 bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCatalog(false)}
              data-testid="button-close-catalog"
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10 bg-background"
                placeholder="Buscar produto (F2) ou ler código de barras..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                data-testid="input-search-catalog"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <ScanBarcode className="h-4 w-4" />
              Ler Código
            </Button>
          </div>

          {/* Categories */}
          <div className="h-14 border-b border-border flex items-center px-6 gap-2 bg-muted/20 overflow-x-auto whitespace-nowrap scrollbar-hide">
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`cursor-pointer px-4 py-1.5 text-sm ${
                  selectedCategory === category
                    ? "hover:opacity-90"
                    : "hover:bg-muted"
                }`}
                onClick={() => setSelectedCategory(category)}
                data-testid={`filter-category-${category}`}
              >
                {category}
              </Badge>
            ))}
          </div>

          {/* Product Grid */}
          <ScrollArea className="flex-1 bg-muted/10 p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product: any) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary hover:shadow-md transition-all active:scale-95 flex flex-col overflow-hidden"
                  onClick={() => addToCart(product)}
                  data-testid={`product-card-${product.id}`}
                >
                  <div className="aspect-square bg-white p-2 flex items-center justify-center overflow-hidden">
                    {product.mainImageUrl ? (
                      <img
                        src={product.mainImageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden"
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl ${
                        product.mainImageUrl ? "hidden" : ""
                      }`}
                    >
                      {product.name.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-1 justify-between bg-card">
                    <div>
                      <h3 className="font-medium text-sm line-clamp-2 leading-tight mb-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.ean || "N/A"}
                      </p>
                    </div>
                    <div className="mt-2 font-bold text-lg text-primary">
                      R$ {parseFloat(product.price).toFixed(2)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Cart & Checkout Area */}
      <div
        className={`flex flex-col bg-card shadow-xl z-10 ${
          showCatalog ? "flex-1 min-w-[500px]" : "flex-1"
        }`}
      >
        {/* Cart Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary text-primary-foreground">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 font-bold text-lg">
              <User className="h-5 w-5" />
              <span>Consumidor Final</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {posTerminals.length > 0 && (
              posTerminals.length === 1 || !isAdminTerminalOverride ? (
                <Badge
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/20 text-white border-0"
                  title="Terminal PDV"
                >
                  Caixa:{" "}
                  {(() => {
                    const terminal = selectedPosTerminal || posTerminals[0];
                    if (!terminal) return "PDV";
                    return terminal.code
                      ? `${terminal.name} - ${terminal.code}`
                      : terminal.name;
                  })()}
                </Badge>
              ) : (
                <select
                  className="h-9 rounded-md border border-white/30 bg-white/15 px-2 text-sm text-white"
                  value={selectedPosTerminalId || ""}
                  onChange={(e) => setSelectedPosTerminalId(Number(e.target.value))}
                  title="Terminal PDV"
                >
                  {posTerminals.map((terminal) => (
                    <option
                      key={terminal.id}
                      value={terminal.id}
                      className="text-black"
                    >
                      {terminal.name}
                      {terminal.code ? ` (${terminal.code})` : ""}
                    </option>
                  ))}
                </select>
              )
            )}
            {cashRegister &&
              hasPermission("pos:sangria") &&
              selectedPosTerminal?.requiresSangria !== false && (
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => setShowSangriaDialog(true)}
                data-testid="button-sangria"
              >
                <ArrowDownLeft className="h-4 w-4" />
                Sangria
              </Button>
            )}
            {!showCatalog && (
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => setShowCatalog(true)}
                data-testid="button-toggle-catalog"
              >
                <Package className="h-4 w-4" />
                Catálogo
              </Button>
            )}
            <Badge
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {cashRegister ? `Caixa Aberto` : `Caixa Fechado`}
            </Badge>
          </div>
        </div>

        {pdvLoadError && (
          <div className="mx-4 mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Nenhuma carga enviada para o PDV. Gere a carga para atualizar produtos e pagamentos.
          </div>
        )}

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4">
          <div
            className={`space-y-3 ${!showCatalog ? "max-w-2xl mx-auto" : ""}`}
          >
            {cart.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <ScanBarcode className="h-16 w-16 mb-4" />
                <p>Carrinho vazio</p>
                <p className="text-sm">
                  Clique em "Catálogo" para adicionar produtos
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 bg-muted/20 p-3 rounded-lg border border-border/50"
                  data-testid={`cart-item-${item.product.id}`}
                >
                  <div className="h-12 w-12 bg-white rounded flex items-center justify-center border border-border text-xs font-bold">
                    x{item.qty}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-sm line-clamp-1">
                        {item.product.name}
                      </h4>
                      <span className="font-bold text-sm">
                        R${" "}
                        {(parseFloat(item.product.price) * item.qty).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        Unit: R$ {parseFloat(item.product.price).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQty(item.product.id, -1);
                          }}
                          data-testid={`button-decrease-qty-${item.product.id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQty(item.product.id, 1);
                          }}
                          data-testid={`button-increase-qty-${item.product.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.product.id);
                          }}
                          data-testid={`button-remove-${item.product.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Totals Section */}
        <div
          className={`border-t border-border bg-background p-6 space-y-4 ${
            !showCatalog ? "max-w-2xl mx-auto w-full" : ""
          }`}
        >
          <div className="space-y-2 rounded-lg border border-border/70 p-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Descontos</span>
              <span>R$ 0,00</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-end">
              <span className="font-medium text-base">Total a pagar</span>
              <span
                className="font-semibold text-3xl text-foreground tracking-tight"
                data-testid="text-total"
              >
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availablePaymentMethods.map((method) => {
              const isSelected = selectedPayment?.id === method.id;
              const Icon = paymentTypeIcons[method.type] || Wallet;
              return (
                <Button
                  key={method.id}
                  variant="outline"
                  className={`h-11 justify-start gap-2 px-3 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
                      : "border-border bg-background text-foreground hover:bg-muted/60"
                  }`}
                  onClick={() => handleSelectPayment(method)}
                  disabled={cart.length === 0 || paymentStatus === "processing"}
                  data-testid={`button-payment-${method.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{method.name}</span>
                </Button>
              );
            })}
          </div>

          {selectedPayment && (
            <div className="rounded-md border border-border px-3 py-2 text-center text-sm text-muted-foreground space-y-1">
              <div>
                Forma de pagamento:{" "}
                <span className="font-medium text-foreground">
                  {getPaymentMethodLabel(selectedPayment)}
                </span>
              </div>
              {paymentStatus === "processing" && (
                <div>Processando pagamento...</div>
              )}
              {paymentStatus === "approved" && (
                <div className="text-emerald-600">
                  Pagamento aprovado
                  {paymentResult?.nsu ? ` • NSU ${paymentResult.nsu}` : ""}
                  {paymentResult?.brand ? ` • ${paymentResult.brand}` : ""}
                </div>
              )}
              {paymentStatus === "declined" && (
                <div className="text-red-600">Pagamento negado</div>
              )}
              {paymentStatus === "error" && (
                <div className="text-red-600">Erro no pagamento</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="lg"
              variant="outline"
              className="h-11 gap-2 border-border text-foreground hover:bg-muted/60"
              disabled={cart.length === 0}
              onClick={() => setShowCancelDialog(true)}
              data-testid="button-cancel-sale"
            >
              <Ban className="h-5 w-5" />
              Cancelar venda
            </Button>
            <Button
              size="lg"
              className="h-11 gap-2"
              disabled={cart.length === 0 || paymentStatus !== "approved"}
              onClick={handleFinishSale}
              data-testid="button-finish-sale"
            >
              Finalizar venda
              <FileCheck className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center justify-end gap-2 px-1 text-[11px] text-muted-foreground">
            <span>{isFiscalConfigured ? "SEFAZ online" : "SEFAZ offline"}</span>
            <span>•</span>
            <span>Ambiente {fiscalEnvironmentLabel}</span>
          </div>
        </div>
      </div>

      {/* Fiscal Dialog Simulation */}
      <Dialog
        open={showPixQrDialog}
        onOpenChange={(open) => {
          if (!open && paymentStatus === "processing") {
            toast({
              title: "PIX em andamento",
              description:
                "O pagamento continua em processamento mesmo com a janela fechada.",
            });
          }
          setShowPixQrDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PIX - QR Code</DialogTitle>
            <DialogDescription>
              Peça para o cliente escanear o QR Code abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {paymentResult?.qrCodeBase64 ? (
              <img
                src={`data:image/png;base64,${paymentResult.qrCodeBase64}`}
                alt="QR PIX"
                className="mx-auto h-64 w-64 rounded border"
              />
            ) : (
              <div className="text-sm text-muted-foreground text-center">
                QR em processamento...
              </div>
            )}
            <Input
              readOnly
              value={paymentResult?.qrCode || ""}
              placeholder="Codigo PIX copia e cola"
            />
            <Button
              variant="outline"
              onClick={async () => {
                const code = paymentResult?.qrCode || "";
                if (!code) return;
                await navigator.clipboard.writeText(code).catch(() => null);
                toast({
                  title: "Copiado",
                  description: "Codigo PIX copiado para a area de transferencia.",
                });
              }}
            >
              Copiar codigo PIX
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFinishing}
        onOpenChange={(open) =>
          !open &&
          (fiscalStatus === "success" || fiscalStatus === "pending_fiscal") &&
          resetSale()
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fiscalStatus === "pending_fiscal"
                ? "Venda Registrada"
                : "Processando Venda"}
            </DialogTitle>
            <DialogDescription>
              {fiscalStatus === "sending" &&
                (isFiscalConfigured
                  ? "Comunicando com a SEFAZ para emissão da NFC-e..."
                  : "Registrando venda...")}
              {fiscalStatus === "pending_fiscal" &&
                "Venda salva com sucesso. Emissao fiscal pendente."}
              {fiscalStatus === "success" && "Nota fiscal emitida com sucesso."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {fiscalStatus === "sending" && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isFiscalConfigured
                    ? "Autenticando certificado digital..."
                    : "Processando..."}
                </p>
              </>
            )}

            {fiscalStatus === "pending_fiscal" && (
              <>
                <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 animate-in zoom-in duration-300">
                  <FileCheck className="h-10 w-10" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-bold text-xl text-amber-600">
                    Venda Registrada
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Pendente emissão fiscal
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {fiscalMissingMessage}
                  </p>
                </div>
              </>
            )}

            {fiscalStatus === "success" && (
              <>
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-bold text-xl text-emerald-600">
                    Venda Aprovada!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Protocolo: 135250004567890
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            {(fiscalStatus === "success" ||
              fiscalStatus === "pending_fiscal") && (
              <Button
                variant="outline"
                onClick={resetSale}
                className="flex-1"
                data-testid="button-new-sale"
              >
                <Plus className="mr-2 h-4 w-4" /> Nova Venda
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Cancelar Venda
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta venda? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Itens no carrinho:</span>
                <span className="font-medium">
                  {cart.reduce((acc, item) => acc + item.qty, 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Valor total:</span>
                <span className="font-bold text-destructive">
                  R$ {total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSale}
              className="flex-1"
              data-testid="button-confirm-cancel"
            >
              <Ban className="mr-2 h-4 w-4" />
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Receipt Dialog */}
      <Dialog open={showCancelReceipt} onOpenChange={closeCancelReceipt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-destructive">
              Cupom de Cancelamento
            </DialogTitle>
          </DialogHeader>
          <div className="border-2 border-dashed border-destructive/30 rounded-lg p-4 bg-red-50/50">
            <div className="text-center border-b border-destructive/20 pb-3 mb-3">
              <p className="font-bold text-lg text-destructive">
                VENDA CANCELADA
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("pt-BR")} às{" "}
                {new Date().toLocaleTimeString("pt-BR")}
              </p>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-center text-muted-foreground">
                ITENS CANCELADOS
              </p>
              {cancelledItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="line-through text-muted-foreground">
                    {item.qty}x {item.product.name}
                  </span>
                  <span className="line-through text-muted-foreground">
                    R$ {(parseFloat(item.product.price) * item.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-destructive/20 pt-3">
              <div className="flex justify-between font-bold text-destructive">
                <span>TOTAL CANCELADO:</span>
                <span>R$ {cancelledTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Motivo: Cancelamento solicitado pelo operador</p>
              {settings?.receiptShowSeller !== false ? (
                <p>Caixa 01 - Operador ID: {user?.id || "Sistema"}</p>
              ) : null}
              {settings?.receiptFooterText ? (
                <p className="whitespace-pre-line mt-1">
                  {String(settings.receiptFooterText)}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeCancelReceipt}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                try {
                  window.print();
                } catch {
                  toast({
                    title: "Nao foi possivel imprimir automaticamente",
                    description: "Use o menu do navegador/dispositivo para imprimir.",
                    variant: "destructive",
                  });
                }
              }}
              className="flex-1"
              data-testid="button-print-cancel-receipt"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTerminalActionDialog}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Aguardando na Maquininha</DialogTitle>
            <DialogDescription>
              Para continuar o pagamento, aperte o botao verde na maquininha e
              siga as instrucoes no terminal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                setShowTerminalActionDialog(false);
                setShowCancelDialog(true);
              }}
              className="w-full"
            >
              Cancelar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={terminalLockActive}>
        <DialogContent
          className="sm:max-w-lg"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-destructive">PDV Bloqueado</DialogTitle>
            <DialogDescription>
              A venda foi cancelada no PDV, mas a maquininha ainda esta aguardando
              pagamento. Libere a cobranca no terminal para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            Referencia: {terminalLockReference || "Nao informada"}
          </div>
          <DialogFooter>
            <Button
              onClick={handleRetryTerminalRelease}
              disabled={isReleasingTerminal}
              className="w-full"
            >
              {isReleasingTerminal ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Tentar liberar PDV"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Cash Register Dialog */}
      <Dialog open={showOpenCashDialog} onOpenChange={setShowOpenCashDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Abrir Caixa
            </DialogTitle>
            <DialogDescription>
              Informe o valor inicial em dinheiro no caixa para iniciar as
              operações do dia.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Valor Inicial (Fundo de Caixa)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digite o valor em dinheiro que está no caixa antes de iniciar as
                vendas.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOpenCashDialog(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleOpenCashRegister}
              className="flex-1"
              disabled={openCashRegisterMutation.isPending}
            >
              {openCashRegisterMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="mr-2 h-4 w-4" />
              )}
              Abrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sangria Dialog */}
      <Dialog open={showSangriaDialog} onOpenChange={setShowSangriaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-orange-500" />
              Sangria (Retirada de Dinheiro)
            </DialogTitle>
            <DialogDescription>
              Registre a retirada de dinheiro do caixa. Esta operação é opcional
              e pode ser realizada a qualquer momento durante o expediente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor da Retirada</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={sangriaAmount}
                  onChange={(e) => setSangriaAmount(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (Opcional)</label>
              <Input
                placeholder="Ex: Pagamento de fornecedor, troco..."
                value={sangriaReason}
                onChange={(e) => setSangriaReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSangriaDialog(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSangria}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              disabled={sangriaMutation.isPending}
            >
              {sangriaMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownLeft className="mr-2 h-4 w-4" />
              )}
              Registrar Sangria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Register Closed Overlay */}
      {!isLoadingCashRegister && !cashRegister && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md p-8">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Caixa Fechado</h2>
              <p className="text-muted-foreground">
                Para iniciar as vendas, é necessário abrir o caixa informando o
                valor inicial em dinheiro.
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button variant="outline" size="lg">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              {hasPermission("pos:cash_open") ? (
                <Button size="lg" onClick={() => setShowOpenCashDialog(true)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Abrir Caixa
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Você não tem permissão para abrir o caixa
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

