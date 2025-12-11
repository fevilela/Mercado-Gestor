import { useState } from "react";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  Search, 
  ScanBarcode, 
  Trash2, 
  Plus, 
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  User,
  FileCheck,
  CheckCircle2,
  Loader2,
  Printer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
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

export default function POS() {
  const [cart, setCart] = useState<{product: typeof MOCK_PRODUCTS[0], qty: number}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [fiscalStatus, setFiscalStatus] = useState<"idle" | "sending" | "success">("idle");
  const { toast } = useToast();

  const addToCart = (product: typeof MOCK_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const handleFinishSale = () => {
    setIsFinishing(true);
    setFiscalStatus("sending");
    
    // Simulate API call to SEFAZ
    setTimeout(() => {
      setFiscalStatus("success");
      toast({
        title: "Venda Autorizada!",
        description: "Nota Fiscal (NFC-e) emitida e enviada para a Receita com sucesso.",
        variant: "default",
        className: "bg-emerald-500 text-white border-none"
      });
    }, 2000);
  };

  const resetSale = () => {
    setCart([]);
    setIsFinishing(false);
    setFiscalStatus("idle");
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);
  const total = subtotal; // Add taxes/discounts logic here if needed

  const filteredProducts = MOCK_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code.includes(searchQuery)
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
             <Badge variant="outline" className="h-8 gap-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> SEFAZ Online
             </Badge>
             <Button variant="outline" className="gap-2">
               <ScanBarcode className="h-4 w-4" />
               Ler Código
             </Button>
          </div>
        </div>

        {/* Categories (Horizontal Scroll) */}
        <div className="h-14 border-b border-border flex items-center px-6 gap-2 bg-muted/20 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Badge variant="default" className="cursor-pointer hover:opacity-90 px-4 py-1.5 text-sm">Todos</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm">Mercearia</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm">Bebidas</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm">Higiene</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm">Limpeza</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm">Açougue</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-4 py-1.5 text-sm">Padaria</Badge>
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1 bg-muted/10 p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:border-primary hover:shadow-md transition-all active:scale-95 flex flex-col overflow-hidden"
                onClick={() => addToCart(product)}
              >
                <div className="aspect-square bg-white p-4 flex items-center justify-center">
                  {/* In a real app, use product.image */}
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {product.name.substring(0,2).toUpperCase()}
                  </div>
                </div>
                <div className="p-3 flex flex-col flex-1 justify-between bg-card">
                  <div>
                    <h3 className="font-medium text-sm line-clamp-2 leading-tight mb-1">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.code}</p>
                  </div>
                  <div className="mt-2 font-bold text-lg text-primary">
                    R$ {product.price.toFixed(2)}
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
          <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
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
                <div key={item.product.id} className="flex gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
                  <div className="h-12 w-12 bg-white rounded flex items-center justify-center border border-border text-xs font-bold">
                     x{item.qty}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-sm line-clamp-1">{item.product.name}</h4>
                      <span className="font-bold text-sm">R$ {(item.product.price * item.qty).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">Unit: R$ {item.product.price.toFixed(2)}</p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); updateQty(item.product.id, -1); }}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); updateQty(item.product.id, 1); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}>
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
              <span className="font-bold text-3xl text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button className="h-14 flex flex-col gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Banknote className="h-5 w-5" />
              <span className="text-xs">Dinheiro (F8)</span>
            </Button>
            <Button className="h-14 flex flex-col gap-1 bg-blue-600 hover:bg-blue-700">
              <CreditCard className="h-5 w-5" />
              <span className="text-xs">Cartão (F9)</span>
            </Button>
            <Button className="h-14 flex flex-col gap-1 bg-purple-600 hover:bg-purple-700">
              <QrCode className="h-5 w-5" />
              <span className="text-xs">PIX (F10)</span>
            </Button>
            <Button variant="outline" className="h-14 flex flex-col gap-1">
              <span className="text-lg font-bold">...</span>
              <span className="text-xs">Outros</span>
            </Button>
          </div>
          
          <Button 
            size="lg" 
            className="w-full h-12 text-lg font-bold gap-2" 
            disabled={cart.length === 0}
            onClick={handleFinishSale}
          >
            FINALIZAR VENDA
            <FileCheck className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Fiscal Dialog Simulation */}
      <Dialog open={isFinishing} onOpenChange={(open) => !open && fiscalStatus === 'success' && resetSale()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Processando Venda</DialogTitle>
            <DialogDescription>
              Comunicando com a SEFAZ para emissão da NFC-e...
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {fiscalStatus === 'sending' && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Autenticando certificado digital...</p>
              </>
            )}
            
            {fiscalStatus === 'success' && (
              <>
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-bold text-xl text-emerald-600">Venda Aprovada!</h3>
                  <p className="text-sm text-muted-foreground">Protocolo: 135230004567890</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            {fiscalStatus === 'success' && (
              <>
                <Button variant="outline" onClick={resetSale} className="flex-1">
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
