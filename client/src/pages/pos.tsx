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

type PaymentMethod = "pix" | "credito" | "debito" | null;
type FiscalStatus = "idle" | "sending" | "success" | "pending_fiscal";

export default function POS() {
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<{ product: any; qty: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [fiscalStatus, setFiscalStatus] = useState<FiscalStatus>("idle");
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelReceipt, setShowCancelReceipt] = useState(false);
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

  const openCashRegisterMutation = useMutation({
    mutationFn: async (data: { openingAmount: string }) => {
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
    openCashRegisterMutation.mutate({ openingAmount });
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

  const isFiscalConfigured =
    settings?.fiscalEnabled && settings?.cscToken && settings?.cscId;

  const isScannerEnabled = settings?.barcodeScannerEnabled !== false;
  const isScannerAutoAdd = settings?.barcodeScannerAutoAdd !== false;
  const isScannerBeep = settings?.barcodeScannerBeep !== false;

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createSaleMutation = useMutation({
    mutationFn: async (
      saleData: any
    ): Promise<{ sale: any; fiscalConfigured: boolean }> => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });
      if (!res.ok) throw new Error("Failed to create sale");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
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

  const getPaymentMethodLabel = (method: PaymentMethod): string => {
    switch (method) {
      case "pix":
        return "PIX";
      case "credito":
        return "Cartão de Crédito";
      case "debito":
        return "Cartão de Débito";
      default:
        return "Não informado";
    }
  };

  const handleFinishSale = async () => {
    if (!selectedPayment) {
      toast({
        title: "Selecione a forma de pagamento",
        description:
          "Escolha PIX, Cartão de Crédito ou Cartão de Débito para continuar.",
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
        nfceStatus: "Autorizada",
      },
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.qty,
        unitPrice: item.product.price,
        subtotal: (parseFloat(item.product.price) * item.qty).toFixed(2),
      })),
    };

    try {
      const result = await createSaleMutation.mutateAsync(saleData);

      setTimeout(() => {
        if (result.fiscalConfigured === false) {
          setFiscalStatus("pending_fiscal");
          toast({
            title: "Venda Registrada",
            description:
              "Venda salva como pendente fiscal. Configure o certificado para emitir NFC-e.",
            variant: "default",
            className: "bg-amber-500 text-white border-none",
          });
        } else {
          setFiscalStatus("success");
          toast({
            title: "Venda Autorizada!",
            description:
              "Nota Fiscal (NFC-e) emitida e enviada para a Receita com sucesso.",
            variant: "default",
            className: "bg-emerald-500 text-white border-none",
          });
        }
      }, 1500);
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
  };

  const handleCancelSale = () => {
    setCancelledItems([...cart]);
    setCancelledTotal(total);
    setShowCancelDialog(false);
    setShowCancelReceipt(true);
    setCart([]);
    setSelectedPayment(null);
    toast({
      title: "Venda Cancelada",
      description: "A venda foi cancelada com sucesso.",
      variant: "default",
      className: "bg-red-500 text-white border-none",
    });
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

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Catalog Panel - Only shown when showCatalog is true */}
      {showCatalog && (
        <div className="flex-1 flex flex-col border-r border-border">
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
          showCatalog ? "w-[400px]" : "flex-1"
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
            {isFiscalConfigured ? (
              <Badge
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> SEFAZ Online
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <FileCheck className="h-3 w-3 mr-1" /> Modo Offline
              </Badge>
            )}
            {cashRegister && (
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
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => setShowCatalog(!showCatalog)}
              data-testid="button-toggle-catalog"
            >
              <Package className="h-4 w-4" />
              Catálogo
            </Button>
            <Badge
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {cashRegister ? `Caixa Aberto` : `Caixa Fechado`}
            </Badge>
          </div>
        </div>

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
          className={`border-t border-border bg-muted/30 p-6 space-y-4 ${
            !showCatalog ? "max-w-2xl mx-auto w-full" : ""
          }`}
        >
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Descontos</span>
              <span>R$ 0,00</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tributos Aprox. (IBPT)</span>
              <span>R$ {(total * 0.18).toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-end">
              <span className="font-bold text-lg">Total a Pagar</span>
              <span
                className="font-bold text-3xl text-primary"
                data-testid="text-total"
              >
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <Button
              className={`h-14 flex flex-col gap-1 transition-all ${
                selectedPayment === "pix"
                  ? "bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300 ring-offset-2"
                  : "bg-purple-600/70 hover:bg-purple-600"
              }`}
              onClick={() => setSelectedPayment("pix")}
              data-testid="button-payment-pix"
            >
              <QrCode className="h-5 w-5" />
              <span className="text-xs">PIX</span>
            </Button>
            <Button
              className={`h-14 flex flex-col gap-1 transition-all ${
                selectedPayment === "credito"
                  ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300 ring-offset-2"
                  : "bg-blue-600/70 hover:bg-blue-600"
              }`}
              onClick={() => setSelectedPayment("credito")}
              data-testid="button-payment-credit"
            >
              <CreditCard className="h-5 w-5" />
              <span className="text-xs">Crédito</span>
            </Button>
            <Button
              className={`h-14 flex flex-col gap-1 transition-all ${
                selectedPayment === "debito"
                  ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300 ring-offset-2"
                  : "bg-emerald-600/70 hover:bg-emerald-600"
              }`}
              onClick={() => setSelectedPayment("debito")}
              data-testid="button-payment-debit"
            >
              <CreditCard className="h-5 w-5" />
              <span className="text-xs">Débito</span>
            </Button>
          </div>

          {selectedPayment && (
            <div className="text-center text-sm text-muted-foreground">
              Forma de pagamento:{" "}
              <span className="font-medium text-foreground">
                {getPaymentMethodLabel(selectedPayment)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="destructive"
              className="h-12 text-lg font-bold gap-2"
              disabled={cart.length === 0}
              onClick={() => setShowCancelDialog(true)}
              data-testid="button-cancel-sale"
            >
              <Ban className="h-5 w-5" />
              CANCELAR
            </Button>
            <Button
              size="lg"
              className="h-12 text-lg font-bold gap-2"
              disabled={cart.length === 0}
              onClick={handleFinishSale}
              data-testid="button-finish-sale"
            >
              FINALIZAR
              <FileCheck className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Fiscal Dialog Simulation */}
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
                "Venda salva com sucesso. Emissão fiscal pendente."}
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
                    Configure o certificado digital nas configurações para
                    emitir NFC-e
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
                    Protocolo: 135230004567890
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            {(fiscalStatus === "success" ||
              fiscalStatus === "pending_fiscal") && (
              <>
                <Button
                  variant="outline"
                  onClick={resetSale}
                  className="flex-1"
                  data-testid="button-new-sale"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nova Venda
                </Button>
                <Button
                  onClick={resetSale}
                  className="flex-1"
                  data-testid="button-print-receipt"
                >
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Cupom
                </Button>
              </>
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
              <p>Caixa 01 • Operador: Sistema</p>
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
                window.print();
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
              <Button size="lg" onClick={() => setShowOpenCashDialog(true)}>
                <Wallet className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
