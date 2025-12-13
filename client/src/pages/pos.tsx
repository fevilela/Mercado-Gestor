import { useState } from "react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

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

  const subtotal = cart.reduce(
    (acc, item) => acc + parseFloat(item.product.price) * item.qty,
    0
  );
  const total = subtotal;

  const filteredProducts = products.filter(
    (p: any) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.ean && p.ean.includes(searchQuery))
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Side: Product Selection */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center px-6 gap-4 bg-card">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10 bg-background"
              placeholder="Buscar produto (F2) ou ler código de barras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            {isFiscalConfigured ? (
              <Badge
                variant="outline"
                className="h-8 gap-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              >
                <CheckCircle2 className="h-3 w-3" /> SEFAZ Online
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-8 gap-2 bg-amber-500/10 text-amber-600 border-amber-500/20"
              >
                <FileCheck className="h-3 w-3" /> Modo Offline
              </Badge>
            )}
            <Button variant="outline" className="gap-2">
              <ScanBarcode className="h-4 w-4" />
              Ler Código
            </Button>
          </div>
        </div>

        {/* Categories */}
        <div className="h-14 border-b border-border flex items-center px-6 gap-2 bg-muted/20 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Badge
            variant="default"
            className="cursor-pointer hover:opacity-90 px-4 py-1.5 text-sm"
          >
            Todos
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm"
          >
            Mercearia
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm"
          >
            Bebidas
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm"
          >
            Higiene
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm"
          >
            Limpeza
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm"
          >
            Açougue
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm"
          >
            Padaria
          </Badge>
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

      {/* Right Side: Cart & Checkout */}
      <div className="w-[400px] flex flex-col bg-card shadow-xl z-10">
        {/* Cart Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary text-primary-foreground">
          <div className="flex items-center gap-2 font-bold text-lg">
            <User className="h-5 w-5" />
            <span>Consumidor Final</span>
          </div>
          <Badge
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            Caixa 01
          </Badge>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <ScanBarcode className="h-16 w-16 mb-4" />
                <p>Carrinho vazio</p>
                <p className="text-sm">Adicione produtos para começar</p>
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
        <div className="border-t border-border bg-muted/30 p-6 space-y-4">
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

          <Button
            size="lg"
            className="w-full h-12 text-lg font-bold gap-2"
            disabled={cart.length === 0}
            onClick={handleFinishSale}
            data-testid="button-finish-sale"
          >
            FINALIZAR VENDA
            <FileCheck className="h-5 w-5" />
          </Button>
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
                >
                  <Plus className="mr-2 h-4 w-4" /> Nova Venda
                </Button>
                <Button onClick={resetSale} className="flex-1">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Cupom
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
