import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, AlertCircle, Check, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: number;
  name: string;
  ean?: string;
  price: string;
  purchasePrice?: string;
  ncm?: string;
  csosnCode?: string;
  cstIcms?: string;
  cstIpi?: string;
  cstPisCofins?: string;
  origin?: string;
  unit?: string;
  category?: string;
  serviceCode?: string;
  cest?: string;
}

interface Customer {
  id: number;
  name: string;
  cpfCnpj?: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  personType?: string;
  isIcmsContributor?: boolean;
}

interface Supplier {
  id: number;
  name: string;
  email?: string | null;
  cnpj?: string | null;
  address?: string | null;
}

interface TransporterLookup {
  id: number;
  name: string;
  cnpjCpf?: string | null;
  ie?: string | null;
  rntc?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

interface AppSettings {
  cnpj?: string;
  ie?: string;
  razaoSocial?: string;
  crt?: string;
  regimeTributario?: string;
  sefazUf?: string;
  sefazMunicipioCodigo?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface RecipientLookupOption {
  id: string;
  entityId: number;
  kind: "customer" | "supplier";
  name: string;
  document: string;
  email: string;
  address: string;
}

interface CfopCode {
  id: number;
  code: string;
  description: string;
  type: string;
  operationType: string;
  scope: string;
}

interface FormItem {
  productId: number;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  ncm: string;
  csosn: string;
  cstIcms: string;
  cstIpi: string;
  cstPisCofins: string;
  cfop: string;
  origin: string;
  serviceCode: string;
  cest: string;
  discountValue: string;
  bcIcmsValue: string;
  icmsAliquot: string;
  icmsReduction: string;
  ipiAliquot: string;
  pisAliquot: string;
  cofinsAliquot: string;
  issAliquot: string;
  irrfAliquot: string;
  icmsValue: string;
  ipiValue: string;
  pisValue: string;
  cofinsValue: string;
  issValue: string;
  irrfValue: string;
  icmsStValue: string;
  totalTaxes: string;
}

interface HeaderTaxTotals {
  productsTotal: string;
  discountTotal: string;
  otherExpensesTotal: string;
  noteTotal: string;
  bcIcmsTotal: string;
  icmsTotal: string;
  icmsStTotal: string;
  ipiTotal: string;
  pisTotal: string;
  cofinsTotal: string;
  issTotal: string;
  irrfTotal: string;
}

interface NfseItem {
  id: string;
  code: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  serviceCode: string;
}

interface NfceSale {
  id: number;
  customerName: string;
  total: string;
  nfceStatus: string;
  nfceProtocol: string | null;
  nfceKey: string | null;
  nfceError?: string | null;
  createdAt: string;
}

interface NfePaymentDraft {
  id: string;
  form: string;
  term: string;
  value: string;
  dueDate: string;
  cardBrand: string;
  acquirerCnpj: string;
  authorizationCode: string;
}

interface SearchableSelectOption {
  value: string;
  label: string;
}

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function SearchablePopoverSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Pesquisar...",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedQuery = normalizeSearchText(query);
  const filtered = normalizedQuery
    ? options.filter((option) =>
        normalizeSearchText(`${option.label} ${option.value}`).includes(
          normalizedQuery
        )
      )
    : options;

  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {selected?.label || placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] max-w-[95vw] p-2" align="start">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
        />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma opcao encontrada
            </div>
          ) : (
            filtered.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function FiscalDocuments() {
  const [activeTab, setActiveTab] = useState("nfe");
  const queryClient = useQueryClient();
  const [recipientNameSearch, setRecipientNameSearch] = useState("");
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientLookupOption | null>(null);
  const fallbackCompanyName = "Sua Empresa LTDA";
  const fallbackCompanyCnpj = "00.000.000/0000-00";
  const fallbackCompanyIe = "000.000.000.000";
  const ufToCode: Record<string, string> = {
    RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
    MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
    MG: "31", ES: "32", RJ: "33", SP: "35",
    PR: "41", SC: "42", RS: "43",
    MS: "50", MT: "51", GO: "52", DF: "53",
  };
  const [companyIm] = useState("00000000");
  const [companyRegime] = useState("Simples Nacional");
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [cfopSearch, setCfopSearch] = useState("");
  const [cfopOpen, setCfopOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [editingTaxItemIndex, setEditingTaxItemIndex] = useState<number | null>(
    null
  );
  const [isNoteClosed, setIsNoteClosed] = useState(false);
  const [headerTaxes, setHeaderTaxes] = useState<HeaderTaxTotals>({
    productsTotal: "0.00",
    discountTotal: "0.00",
    otherExpensesTotal: "0.00",
    noteTotal: "0.00",
    bcIcmsTotal: "0.00",
    icmsTotal: "0.00",
    icmsStTotal: "0.00",
    ipiTotal: "0.00",
    pisTotal: "0.00",
    cofinsTotal: "0.00",
    issTotal: "0.00",
    irrfTotal: "0.00",
  });
  const [lastTaxCalculation, setLastTaxCalculation] = useState<any | null>(
    null
  );
  const [selectedNfceIds, setSelectedNfceIds] = useState<number[]>([]);
  const [inutilizeForm, setInutilizeForm] = useState({
    serie: "",
    startNumber: "",
    endNumber: "",
    reason: "",
  });
  const [cancelNfceDialog, setCancelNfceDialog] = useState({
    open: false,
    saleId: 0,
    reason: "",
  });
  const [nfeOps, setNfeOps] = useState({
    uf: "MG",
    xmlContent: "",
    cancelAccessKey: "",
    cancelProtocol: "",
    cancelReason: "",
    cceAccessKey: "",
    cceText: "",
    cceSequence: "1",
    inutilizeSeries: "",
    inutilizeStart: "",
    inutilizeEnd: "",
    inutilizeReason: "",
  });
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentTime = now.toTimeString().slice(0, 5);
  const [nfeWorkspaceTab, setNfeWorkspaceTab] = useState("identificacao");
  const [selectedNfeItemIndex, setSelectedNfeItemIndex] = useState(0);
  const [productSearchRowIndex, setProductSearchRowIndex] = useState<number | null>(0);
  const [nfeIdentification, setNfeIdentification] = useState({
    naturezaOperacao: "Venda de mercadoria",
    tipoOperacao: "saida",
    finalidade: "normal",
    consumidorFinal: "sim",
    presenca: "presencial",
    dataEmissao: currentDate,
    horaEmissao: currentTime,
    dataSaida: currentDate,
    horaSaida: currentTime,
  });
  const [nfeDestExtra, setNfeDestExtra] = useState({
    ie: "",
    ieIndicator: "contribuinte",
    email: "",
    address: "",
  });
  const [nfeTransport, setNfeTransport] = useState({
    freightMode: "0",
    carrierName: "",
    carrierDocument: "",
    plate: "",
    plateUf: "",
    rntc: "",
    grossWeight: "",
    netWeight: "",
  });
  const [nfePayments, setNfePayments] = useState<NfePaymentDraft[]>([
    {
      id: "1",
      form: "01",
      term: "avista",
      value: "0.00",
      dueDate: currentDate,
      cardBrand: "",
      acquirerCnpj: "",
      authorizationCode: "",
    },
  ]);
  const [nfeAdditionalFields, setNfeAdditionalFields] = useState({
    fisco: "",
    contribuinte: "",
  });
  const [productPickerDialogOpen, setProductPickerDialogOpen] = useState(false);
  const [nfeResponsibleTech, setNfeResponsibleTech] = useState({
    cnpj: "",
    name: "",
    email: "",
    phone: "",
  });
  const autoTaxRecalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const nfeTipoOperacaoOptions: SearchableSelectOption[] = [
    { value: "entrada", label: "Entrada" },
    { value: "saida", label: "Saida" },
  ];
  const nfeFinalidadeOptions: SearchableSelectOption[] = [
    { value: "normal", label: "Normal" },
    { value: "complementar", label: "Complementar" },
    { value: "ajuste", label: "Ajuste" },
    { value: "devolucao", label: "Devolucao" },
  ];
  const nfeConsumidorFinalOptions: SearchableSelectOption[] = [
    { value: "sim", label: "Sim" },
    { value: "nao", label: "Nao" },
  ];
  const nfePresencaOptions: SearchableSelectOption[] = [
    { value: "presencial", label: "Operacao presencial" },
    { value: "internet", label: "Internet" },
    { value: "telefone", label: "Telefone" },
    { value: "nao_se_aplica", label: "Nao se aplica" },
  ];
  const nfePaymentFormOptions: SearchableSelectOption[] = [
    { value: "03", label: "Credito" },
    { value: "04", label: "Debito" },
    { value: "01", label: "Dinheiro" },
    { value: "17", label: "Pix" },
  ];
  const nfePaymentTermOptions: SearchableSelectOption[] = [
    { value: "avista", label: "A vista" },
    { value: "30", label: "30 dias" },
    { value: "60_90", label: "60/90 dias" },
  ];
  const nfeFreightModeOptions: SearchableSelectOption[] = [
    { value: "0", label: "0 - Emitente" },
    { value: "1", label: "1 - Destinatario" },
    { value: "9", label: "9 - Sem frete" },
  ];
  const { data: settings } = useQuery<AppSettings | null>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return null;
      return res.json();
    },
  });
  const companyName = String(settings?.razaoSocial || fallbackCompanyName);
  const companyCnpj = String(settings?.cnpj || fallbackCompanyCnpj);
  const companyIe = String(settings?.ie || fallbackCompanyIe);

  const [formData, setFormData] = useState<{
    customerId: string;
    customerCPFCNPJ: string;
    cfopCode: string;
    scope: "interna" | "interestadual" | "exterior";
    items: FormItem[];
  }>({
    customerId: "",
    customerCPFCNPJ: "",
    cfopCode: "",
    scope: "interna" as "interna" | "interestadual" | "exterior",
    items: [],
  });

  const [nfseIssueDate, setNfseIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [nfseEnvironment, setNfseEnvironment] = useState("homologacao");
  const [nfseOperationType, setNfseOperationType] = useState("prestacao");
  const [nfseSeries] = useState("1");
  const [nfseNumber] = useState("Automatico");
  const [nfseCustomerType, setNfseCustomerType] = useState("pj");
  const [nfseCustomerName, setNfseCustomerName] = useState("");
  const [nfseCustomerDocument, setNfseCustomerDocument] = useState("");
  const [nfseCustomerIeIndicator, setNfseCustomerIeIndicator] =
    useState("nao_contribuinte");
  const [nfseCustomerZip, setNfseCustomerZip] = useState("");
  const [nfseCustomerAddress, setNfseCustomerAddress] = useState("");
  const [nfsePaymentForm, setNfsePaymentForm] = useState("a_vista");
  const [nfsePaymentCondition, setNfsePaymentCondition] = useState("imediato");
  const [nfseAdditionalInfo, setNfseAdditionalInfo] = useState("");
  const [nfseShowTaxDetails, setNfseShowTaxDetails] = useState(false);
  const [nfseItems, setNfseItems] = useState<NfseItem[]>([
    {
      id: "1",
      code: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      discount: "0",
      serviceCode: "",
    },
  ]);

  const toAmount = (value: string | number | undefined | null) => {
    const parsed = Number(String(value ?? "0").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const round2 = (value: number) => Number(value.toFixed(2));
  const addDaysToDateString = (baseDate: string, days: number) => {
    const safeBase = /^\d{4}-\d{2}-\d{2}$/.test(baseDate) ? baseDate : currentDate;
    const [year, month, day] = safeBase.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const buildAutoHeaderTotals = (
    items: FormItem[],
    currentHeader: HeaderTaxTotals,
    explicitTaxTotals?: Partial<{
      icmsTotal: number;
      ipiTotal: number;
      pisTotal: number;
      cofinsTotal: number;
      issTotal: number;
      irrfTotal: number;
    }>
  ): HeaderTaxTotals => {
    const productsTotal = round2(
      items.reduce(
        (acc, item) => acc + toAmount(item.quantity) * toAmount(item.unitPrice),
        0
      )
    );
    const discountTotal = round2(
      items.reduce((acc, item) => acc + toAmount(item.discountValue), 0)
    );
    const bcIcmsTotal = round2(
      items.reduce((acc, item) => acc + toAmount(item.bcIcmsValue), 0)
    );
    const icmsStTotal = round2(
      items.reduce((acc, item) => acc + toAmount(item.icmsStValue), 0)
    );
    const icmsTotal = round2(
      explicitTaxTotals?.icmsTotal ??
        items.reduce((acc, item) => acc + toAmount(item.icmsValue), 0)
    );
    const ipiTotal = round2(
      explicitTaxTotals?.ipiTotal ??
        items.reduce((acc, item) => acc + toAmount(item.ipiValue), 0)
    );
    const pisTotal = round2(
      explicitTaxTotals?.pisTotal ??
        items.reduce((acc, item) => acc + toAmount(item.pisValue), 0)
    );
    const cofinsTotal = round2(
      explicitTaxTotals?.cofinsTotal ??
        items.reduce((acc, item) => acc + toAmount(item.cofinsValue), 0)
    );
    const issTotal = round2(
      explicitTaxTotals?.issTotal ??
        items.reduce((acc, item) => acc + toAmount(item.issValue), 0)
    );
    const irrfTotal = round2(
      explicitTaxTotals?.irrfTotal ??
        items.reduce((acc, item) => acc + toAmount(item.irrfValue), 0)
    );

    const noteTotal = round2(
      productsTotal -
        discountTotal +
        toAmount(currentHeader.otherExpensesTotal) +
        icmsTotal +
        icmsStTotal +
        ipiTotal +
        pisTotal +
        cofinsTotal +
        issTotal +
        irrfTotal
    );

    return {
      ...currentHeader,
      productsTotal: productsTotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      noteTotal: noteTotal.toFixed(2),
      bcIcmsTotal: bcIcmsTotal.toFixed(2),
      icmsTotal: icmsTotal.toFixed(2),
      icmsStTotal: icmsStTotal.toFixed(2),
      ipiTotal: ipiTotal.toFixed(2),
      pisTotal: pisTotal.toFixed(2),
      cofinsTotal: cofinsTotal.toFixed(2),
      issTotal: issTotal.toFixed(2),
      irrfTotal: irrfTotal.toFixed(2),
    };
  };

  // Fetch CFOP codes
  const { data: cfopCodes = [] } = useQuery<CfopCode[]>({
    queryKey: ["cfop-codes"],
    queryFn: async () => {
      const res = await fetch("/api/cfop-codes");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const cfopSelectOptions = useMemo(
    () =>
      cfopCodes.map((cfop) => ({
        ...cfop,
        selectValue: `${cfop.code}::${cfop.id}`,
      })),
    [cfopCodes],
  );

  const selectedCfopOption = cfopSelectOptions.find(
    (option) => option.code === formData.cfopCode,
  );

  const filteredCfopSelectOptions = useMemo(() => {
    const query = cfopSearch.trim().toLowerCase();
    if (!query) return cfopSelectOptions;
    return cfopSelectOptions.filter((cfop) =>
      [cfop.code, cfop.description, cfop.type, cfop.operationType, cfop.scope]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [cfopSearch, cfopSelectOptions]);

  // Search products
  const { data: productResults = [] } = useQuery<Product[]>({
    queryKey: ["products/search", productSearch],
    queryFn: async () => {
      if (!productSearch.trim()) return [];
      const res = await fetch(
        `/api/products/search/${encodeURIComponent(productSearch)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: productSearch.length > 1,
  });

  // Search customers
  const { data: customerResults = [] } = useQuery<Customer[]>({
    queryKey: ["customers/search", customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return [];
      const res = await fetch(
        `/api/customers/search/${encodeURIComponent(customerSearch)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: customerSearch.length > 1,
  });

  const { data: sales = [], isLoading: isLoadingSales } = useQuery<NfceSale[]>({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Erro ao carregar vendas");
      return res.json();
    },
  });

  // Validar NF-e
  const validateNFeMutation = useMutation<any, Error, any>({
    mutationFn: async (data) => {
      const res = await fetch("/api/fiscal/nfe/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("NF-e validada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao validar NF-e: " + error.message);
    },
  });

  // Calcular impostos
  const calculateTaxesMutation = useMutation<any, Error, any>({
    mutationFn: async (data) => {
      const res = await fetch("/api/fiscal/nfe/calculate-taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      const calculations = Array.isArray(data?.calculations)
        ? data.calculations
        : [];
      const totals = data?.totals || {};
      setLastTaxCalculation(data);
      let updatedItemsSnapshot: FormItem[] = [];
      setFormData((prev) => {
        const updatedItems = prev.items.map((item, index) => {
          const calc = calculations[index] || {};
          const subtotal =
            Math.max(0, toAmount(item.quantity)) * Math.max(0, toAmount(item.unitPrice));
          const discount = Math.max(0, toAmount(item.discountValue));
          const taxableBase = Math.max(0, subtotal - discount);
          return {
            ...item,
            bcIcmsValue: String(
              round2(
                toAmount(
                  calc.icmsBaseValue ?? item.bcIcmsValue ?? String(taxableBase)
                )
              )
            ),
            icmsValue: String(round2(toAmount(calc.icmsValue))),
            ipiValue: String(round2(toAmount(calc.ipiValue))),
            pisValue: String(round2(toAmount(calc.pisValue))),
            cofinsValue: String(round2(toAmount(calc.cofinsValue))),
            issValue: String(round2(toAmount(calc.issValue))),
            irrfValue: String(round2(toAmount(calc.irrfValue))),
            totalTaxes: String(
              round2(toAmount(calc.totalTaxes) + toAmount(item.icmsStValue))
            ),
          };
        });
        updatedItemsSnapshot = updatedItems;
        return {
          ...prev,
          items: updatedItems,
        };
      });
      setHeaderTaxes((prev) =>
        buildAutoHeaderTotals(updatedItemsSnapshot, prev, {
          icmsTotal: round2(toAmount(totals.icmsTotal)),
          ipiTotal: round2(toAmount(totals.ipiTotal)),
          pisTotal: round2(toAmount(totals.pisTotal)),
          cofinsTotal: round2(toAmount(totals.cofinsTotal)),
          issTotal: round2(toAmount(totals.issTotal)),
          irrfTotal: round2(toAmount(totals.irrfTotal)),
        })
      );
      setIsNoteClosed(false);
      toast.success("Impostos calculados!");
      console.log("Cálculo de impostos:", data);
    },
  });

  const sendNfceMutation = useMutation<any, Error, number[]>({
    mutationFn: async (saleIds) => {
      const res = await fetch("/api/fiscal/nfce/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleIds }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar NFC-e");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setSelectedNfceIds([]);
      toast.success("Envio de NFC-e iniciado");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelNfceMutation = useMutation<
    any,
    Error,
    { saleId: number; reason: string }
  >({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/nfce/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: payload.saleId,
          reason: payload.reason,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao cancelar NFC-e");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast.success("NFC-e cancelada");
      setCancelNfceDialog({ open: false, saleId: 0, reason: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inutilizeNfceMutation = useMutation<any, Error, typeof inutilizeForm>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/nfce/inutilize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serie: payload.serie,
          startNumber: payload.startNumber,
          endNumber: payload.endNumber,
          reason: payload.reason,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao inutilizar numeracao");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inutilizacao registrada");
      setInutilizeForm({ serie: "", startNumber: "", endNumber: "", reason: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const submitNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xmlContent: payload.xmlContent,
          uf: payload.uf,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar NF-e");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`NF-e enviada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: payload.cancelAccessKey,
          protocol: payload.cancelProtocol,
          reason: payload.cancelReason,
          uf: payload.uf,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao cancelar NF-e");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`NF-e cancelada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cceNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/correction-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: payload.cceAccessKey,
          correctedContent: payload.cceText,
          sequence: Number(payload.cceSequence || "1"),
          uf: payload.uf,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar CC-e");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`CC-e enviada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inutilizeNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/inutilize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: payload.inutilizeSeries,
          startNumber: payload.inutilizeStart,
          endNumber: payload.inutilizeEnd,
          reason: payload.inutilizeReason,
          uf: payload.uf,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao inutilizar numeracao");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Inutilizacao registrada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSelectProduct = (product: Product, itemIndex: number) => {
    const newItems = [...formData.items];
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      productId: product.id,
      productName: product.name,
      description: product.name,
      unitPrice: product.price,
      ncm: product.ncm || "",
      csosn: product.csosnCode || "101",
      cstIcms: product.cstIcms || "00",
      cstIpi: product.cstIpi || "00",
      cstPisCofins: product.cstPisCofins || "00",
      cfop: newItems[itemIndex].cfop || formData.cfopCode || "",
      origin: product.origin || "nacional",
      serviceCode: product.serviceCode || "",
      cest: product.cest || "",
      discountValue: newItems[itemIndex].discountValue || "0",
      bcIcmsValue: newItems[itemIndex].bcIcmsValue || "0",
      icmsAliquot: newItems[itemIndex].icmsAliquot || "18",
      icmsReduction: newItems[itemIndex].icmsReduction || "0",
      ipiAliquot: newItems[itemIndex].ipiAliquot || "0",
      pisAliquot: newItems[itemIndex].pisAliquot || "0",
      cofinsAliquot: newItems[itemIndex].cofinsAliquot || "0",
      issAliquot: newItems[itemIndex].issAliquot || "0",
      irrfAliquot: newItems[itemIndex].irrfAliquot || "0",
      icmsValue: "0",
      ipiValue: "0",
      pisValue: "0",
      cofinsValue: "0",
      issValue: "0",
      irrfValue: "0",
      icmsStValue: "0",
      totalTaxes: "0",
    };
    setFormData({ ...formData, items: newItems });
    setIsNoteClosed(false);
    setProductSearch("");
    setProductSearchOpen(false);
    toast.success(`Produto ${product.name} selecionado! Tributação carregada.`);
  };

  const handleSelectCustomer = (customer: Customer) => {
    const addressParts = [
      customer.address?.trim(),
      [customer.city?.trim(), customer.state?.trim()].filter(Boolean).join("/"),
      customer.zipCode?.trim() ? `CEP ${customer.zipCode.trim()}` : "",
    ].filter(Boolean);

    setSelectedCustomer(customer);
    setFormData((prev) => ({
      ...prev,
      customerId: String(customer.id),
      customerCPFCNPJ: customer.cpfCnpj || "",
    }));
    setNfeDestExtra((prev) => ({
      ...prev,
      email: customer.email || "",
      address: addressParts.join(" - "),
      ieIndicator: customer.isIcmsContributor ? "contribuinte" : "isento",
    }));
    setCustomerSearch("");
    setCustomerSearchOpen(false);
    toast.success(`Cliente ${customer.name} selecionado!`);
  };

  const handleSearchCustomerByDocument = async () => {
    const rawDoc = formData.customerCPFCNPJ?.trim() || "";
    const normalizedDoc = rawDoc.replace(/\D/g, "");

    if (!normalizedDoc) {
      toast.error("Informe o CPF/CNPJ para buscar o cliente.");
      return;
    }

    try {
      const res = await fetch(
        `/api/customers/search/${encodeURIComponent(rawDoc)}`
      );

      if (!res.ok) {
        throw new Error("Falha ao buscar cliente");
      }

      const results: Customer[] = await res.json();
      const exactMatch =
        results.find(
          (customer) =>
            String(customer.cpfCnpj || "").replace(/\D/g, "") === normalizedDoc
        ) || null;

      const customer = exactMatch || results[0] || null;

      if (!customer) {
        toast.error("Cliente nao encontrado.");
        return;
      }

      handleSelectCustomer(customer);
    } catch (error) {
      toast.error("Erro ao buscar cliente.");
    }
  };

  const handleSearchTransporter = async () => {
    const rawDoc = nfeTransport.carrierDocument?.trim() || "";
    const rawName = nfeTransport.carrierName?.trim() || "";
    const query = rawDoc || rawName;
    const normalizedDoc = rawDoc.replace(/\D/g, "");

    if (!query) {
      toast.error("Informe o nome ou CNPJ/CPF da transportadora.");
      return;
    }

    try {
      let results: TransporterLookup[] = [];

      const res = await fetch(
        `/api/transporters/search/${encodeURIComponent(query)}`
      );

      if (res.ok) {
        results = await res.json();
      } else {
        // Fallback para ambientes sem a rota nova (backend sem restart) ou sem permissão específica.
        const allRes = await fetch("/api/transporters");
        if (!allRes.ok) throw new Error("Falha ao buscar transportadoras");
        const allTransporters: TransporterLookup[] = await allRes.json();
        const normalizedQuery = query.toLowerCase();
        results = allTransporters.filter((item) => {
          const name = String(item.name || "").toLowerCase();
          const doc = String(item.cnpjCpf || "");
          return (
            name.includes(normalizedQuery) ||
            doc.toLowerCase().includes(normalizedQuery) ||
            doc.replace(/\D/g, "").includes(normalizedDoc)
          );
        });
      }

      const transporter =
        (normalizedDoc
          ? results.find(
              (item) =>
                String(item.cnpjCpf || "").replace(/\D/g, "") === normalizedDoc
            )
          : undefined) ||
        (rawName
          ? results.find(
              (item) =>
                String(item.name || "").trim().toLowerCase() ===
                rawName.toLowerCase()
            )
          : undefined) ||
        results[0];

      if (!transporter) {
        toast.error("Transportadora nao encontrada.");
        return;
      }

      setNfeTransport((prev) => ({
        ...prev,
        carrierName: transporter.name || "",
        carrierDocument: transporter.cnpjCpf || "",
        rntc: transporter.rntc || "",
      }));

      toast.success(`Transportadora ${transporter.name} selecionada!`);
    } catch {
      toast.error("Erro ao buscar transportadora.");
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          productId: 0,
          productName: "",
          description: "",
          quantity: "1",
          unitPrice: "0",
          ncm: "",
          csosn: "101",
          cstIcms: "00",
          cstIpi: "00",
          cstPisCofins: "00",
          cfop: formData.cfopCode || "",
          origin: "nacional",
          serviceCode: "",
          cest: "",
          discountValue: "0",
          bcIcmsValue: "0",
          icmsAliquot: "18",
          icmsReduction: "0",
          ipiAliquot: "0",
          pisAliquot: "0",
          cofinsAliquot: "0",
          issAliquot: "0",
          irrfAliquot: "0",
          icmsValue: "0",
          ipiValue: "0",
          pisValue: "0",
          cofinsValue: "0",
          issValue: "0",
          irrfValue: "0",
          icmsStValue: "0",
          totalTaxes: "0",
        },
      ],
    });
    setIsNoteClosed(false);
  };

  const handleAddProductFromPicker = (product: Product) => {
    setFormData((prev) => {
      const newIndex = prev.items.length;
      const newItems = [
        ...prev.items,
        {
          productId: product.id,
          productName: product.name,
          description: product.name,
          quantity: "1",
          unitPrice: product.price,
          ncm: product.ncm || "",
          csosn: product.csosnCode || "101",
          cstIcms: product.cstIcms || "00",
          cstIpi: product.cstIpi || "00",
          cstPisCofins: product.cstPisCofins || "00",
          cfop: prev.cfopCode || "",
          origin: product.origin || "nacional",
          serviceCode: product.serviceCode || "",
          cest: product.cest || "",
          discountValue: "0",
          bcIcmsValue: "0",
          icmsAliquot: "18",
          icmsReduction: "0",
          ipiAliquot: "0",
          pisAliquot: "0",
          cofinsAliquot: "0",
          issAliquot: "0",
          irrfAliquot: "0",
          icmsValue: "0",
          ipiValue: "0",
          pisValue: "0",
          cofinsValue: "0",
          issValue: "0",
          irrfValue: "0",
          icmsStValue: "0",
          totalTaxes: "0",
        } as FormItem,
      ];
      setHeaderTaxes((headerPrev) => buildAutoHeaderTotals(newItems, headerPrev));
      setSelectedNfeItemIndex(newIndex);
      setEditingTaxItemIndex(newIndex);
      queueAutoTaxRecalculation(newItems, prev.cfopCode);
      return { ...prev, items: newItems };
    });
    setIsNoteClosed(false);
    setNfeWorkspaceTab("produtos");
    setProductPickerDialogOpen(false);
    setProductSearch("");
    toast.success(`Produto ${product.name} adicionado com tributacao do cadastro.`);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: updatedItems,
    });
    setHeaderTaxes((prev) => buildAutoHeaderTotals(updatedItems, prev));
    queueAutoTaxRecalculation(updatedItems, formData.cfopCode);
    setIsNoteClosed(false);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
    setHeaderTaxes((prev) => buildAutoHeaderTotals(newItems, prev));
    const recalcFields = new Set([
      "quantity",
      "unitPrice",
      "discountValue",
      "bcIcmsValue",
      "icmsAliquot",
      "icmsReduction",
      "ipiAliquot",
      "pisAliquot",
      "cofinsAliquot",
      "issAliquot",
      "irrfAliquot",
      "cfop",
      "cstIcms",
      "cstIpi",
    ]);
    if (recalcFields.has(field)) {
      queueAutoTaxRecalculation(newItems, formData.cfopCode);
    }
    setIsNoteClosed(false);
  };

  const totalValue = useMemo(() => {
    return formData.items.reduce(
      (acc, item) =>
        acc +
        parseFloat(item.unitPrice || "0") * parseInt(item.quantity || "1"),
      0
    );
  }, [formData.items]);

  const totalsFromItems = useMemo(() => {
    const productsTotal = round2(
      formData.items.reduce(
        (acc, item) =>
          acc + Math.max(0, toAmount(item.quantity)) * Math.max(0, toAmount(item.unitPrice)),
        0
      )
    );
    const discountTotal = round2(
      formData.items.reduce((acc, item) => acc + Math.max(0, toAmount(item.discountValue)), 0)
    );
    const bcIcmsTotal = round2(
      formData.items.reduce((acc, item) => acc + Math.max(0, toAmount(item.bcIcmsValue)), 0)
    );
    const icmsStTotal = round2(
      formData.items.reduce((acc, item) => acc + Math.max(0, toAmount(item.icmsStValue)), 0)
    );
    return { productsTotal, discountTotal, bcIcmsTotal, icmsStTotal };
  }, [formData.items]);

  const noteExpectedFromHeader = useMemo(
    () =>
      round2(
        toAmount(headerTaxes.productsTotal) -
          toAmount(headerTaxes.discountTotal) +
          toAmount(headerTaxes.otherExpensesTotal) +
          toAmount(headerTaxes.icmsTotal) +
          toAmount(headerTaxes.icmsStTotal) +
          toAmount(headerTaxes.ipiTotal) +
          toAmount(headerTaxes.pisTotal) +
          toAmount(headerTaxes.cofinsTotal) +
          toAmount(headerTaxes.issTotal) +
          toAmount(headerTaxes.irrfTotal)
      ),
    [headerTaxes]
  );

  const taxTotalsFromItems = useMemo(() => {
    return {
      icmsTotal: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.icmsValue), 0)
      ),
      ipiTotal: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.ipiValue), 0)
      ),
      pisTotal: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.pisValue), 0)
      ),
      cofinsTotal: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.cofinsValue), 0)
      ),
      issTotal: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.issValue), 0)
      ),
      irrfTotal: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.irrfValue), 0)
      ),
      totalTaxes: round2(
        formData.items.reduce((acc, item) => acc + toAmount(item.totalTaxes), 0)
      ),
    };
  }, [formData.items]);

  const syncHeaderWithItems = () => {
    const productsTotal = totalsFromItems.productsTotal;
    const discountTotal = totalsFromItems.discountTotal;
    const bcIcmsTotal = totalsFromItems.bcIcmsTotal;
    const icmsStTotal = totalsFromItems.icmsStTotal;
    const totalTaxes = round2(
      taxTotalsFromItems.icmsTotal +
        taxTotalsFromItems.ipiTotal +
        taxTotalsFromItems.pisTotal +
        taxTotalsFromItems.cofinsTotal +
        taxTotalsFromItems.issTotal +
        taxTotalsFromItems.irrfTotal +
        icmsStTotal
    );
    const noteTotal = round2(
      productsTotal -
        discountTotal +
        totalTaxes +
        toAmount(headerTaxes.otherExpensesTotal)
    );
    setHeaderTaxes((prev) => ({
      ...prev,
      productsTotal: productsTotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      bcIcmsTotal: bcIcmsTotal.toFixed(2),
      icmsStTotal: icmsStTotal.toFixed(2),
      noteTotal: noteTotal.toFixed(2),
    }));
  };

  const headerValidation = useMemo(() => {
    const tolerance = 0.01;
    const mismatch = (a: number, b: number) => Math.abs(a - b) > tolerance;
    const expected = {
      productsTotal: round2(totalsFromItems.productsTotal),
      discountTotal: round2(totalsFromItems.discountTotal),
      bcIcmsTotal: round2(totalsFromItems.bcIcmsTotal),
      icmsTotal: round2(taxTotalsFromItems.icmsTotal),
      icmsStTotal: round2(totalsFromItems.icmsStTotal),
      ipiTotal: round2(taxTotalsFromItems.ipiTotal),
      pisTotal: round2(taxTotalsFromItems.pisTotal),
      cofinsTotal: round2(taxTotalsFromItems.cofinsTotal),
      issTotal: round2(taxTotalsFromItems.issTotal),
      irrfTotal: round2(taxTotalsFromItems.irrfTotal),
    };
    const header = {
      productsTotal: round2(toAmount(headerTaxes.productsTotal)),
      discountTotal: round2(toAmount(headerTaxes.discountTotal)),
      bcIcmsTotal: round2(toAmount(headerTaxes.bcIcmsTotal)),
      icmsTotal: round2(toAmount(headerTaxes.icmsTotal)),
      icmsStTotal: round2(toAmount(headerTaxes.icmsStTotal)),
      ipiTotal: round2(toAmount(headerTaxes.ipiTotal)),
      pisTotal: round2(toAmount(headerTaxes.pisTotal)),
      cofinsTotal: round2(toAmount(headerTaxes.cofinsTotal)),
      issTotal: round2(toAmount(headerTaxes.issTotal)),
      irrfTotal: round2(toAmount(headerTaxes.irrfTotal)),
      noteTotal: round2(toAmount(headerTaxes.noteTotal)),
    };
    const fieldMismatch = {
      productsTotal: mismatch(header.productsTotal, expected.productsTotal),
      discountTotal: mismatch(header.discountTotal, expected.discountTotal),
      bcIcmsTotal: mismatch(header.bcIcmsTotal, expected.bcIcmsTotal),
      icmsTotal: mismatch(header.icmsTotal, expected.icmsTotal),
      icmsStTotal: mismatch(header.icmsStTotal, expected.icmsStTotal),
      ipiTotal: mismatch(header.ipiTotal, expected.ipiTotal),
      pisTotal: mismatch(header.pisTotal, expected.pisTotal),
      cofinsTotal: mismatch(header.cofinsTotal, expected.cofinsTotal),
      issTotal: mismatch(header.issTotal, expected.issTotal),
      irrfTotal: mismatch(header.irrfTotal, expected.irrfTotal),
      noteTotal: mismatch(header.noteTotal, noteExpectedFromHeader),
    };
    const blockingMismatches = Object.entries(fieldMismatch)
      .filter(([, value]) => value)
      .map(([key]) => key);
    return {
      fieldMismatch,
      blockingMismatches,
      expected,
      header,
      canClose: blockingMismatches.length === 0,
    };
  }, [headerTaxes, totalsFromItems, taxTotalsFromItems, noteExpectedFromHeader]);

  const headerFieldClass = (
    field: keyof typeof headerValidation.fieldMismatch
  ) => (headerValidation.fieldMismatch[field] ? "border-red-500 text-red-600" : "");

  const headerFieldLabels: Record<keyof typeof headerValidation.fieldMismatch, string> = {
    productsTotal: "V. total produtos",
    discountTotal: "V. desconto total",
    bcIcmsTotal: "BC ICMS total",
    icmsTotal: "ICMS total",
    icmsStTotal: "ICMS ST total",
    ipiTotal: "IPI total",
    pisTotal: "PIS total",
    cofinsTotal: "COFINS total",
    issTotal: "ISS total",
    irrfTotal: "IRRF total",
    noteTotal: "V. total nota",
  };

  const headerFieldMismatchReason = (
    field: keyof typeof headerValidation.fieldMismatch
  ) => {
    if (!headerValidation.fieldMismatch[field]) return null;
    const expectedValue =
      field === "noteTotal"
        ? noteExpectedFromHeader
        : (headerValidation.expected[field as keyof typeof headerValidation.expected] as number);
    const informedValue = headerValidation.header[field];
    return `${headerFieldLabels[field]} divergente. Esperado: R$ ${expectedValue.toFixed(
      2
    )} | Informado: R$ ${informedValue.toFixed(2)}`;
  };

  const headerTaxGrandTotal = useMemo(
    () =>
      round2(
          toAmount(headerTaxes.icmsTotal) +
          toAmount(headerTaxes.icmsStTotal) +
          toAmount(headerTaxes.ipiTotal) +
          toAmount(headerTaxes.pisTotal) +
          toAmount(headerTaxes.cofinsTotal) +
          toAmount(headerTaxes.issTotal) +
          toAmount(headerTaxes.irrfTotal)
      ),
    [headerTaxes]
  );

  const buildTaxPayloadFromItems = (items: FormItem[], cfopCode: string) => ({
    items: items.map((item) => ({
      productId: item.productId,
      description: item.description,
      cfop: item.cfop || cfopCode,
      cstIcms: item.cstIcms,
      cstIpi: item.cstIpi,
      quantity: Math.max(0, Number(item.quantity || 0)),
      unitPrice: Math.max(0, toAmount(item.unitPrice)),
      discountValue: Math.max(0, toAmount(item.discountValue)),
      bcIcmsValue: Math.max(0, toAmount(item.bcIcmsValue)),
      icmsStValue: Math.max(0, toAmount(item.icmsStValue)),
      icmsAliquot: Math.max(0, toAmount(item.icmsAliquot)),
      icmsReduction: Math.max(0, toAmount(item.icmsReduction)),
      ipiAliquot: Math.max(0, toAmount(item.ipiAliquot)),
      pisAliquot: Math.max(0, toAmount(item.pisAliquot)),
      cofinsAliquot: Math.max(0, toAmount(item.cofinsAliquot)),
      issAliquot: Math.max(0, toAmount(item.issAliquot)),
      irrfAliquot: Math.max(0, toAmount(item.irrfAliquot)),
    })),
  });

  const buildTaxPayload = () => buildTaxPayloadFromItems(formData.items, formData.cfopCode);

  const buildVisualNFeGenerateConfig = () => {
    const companyUf = String(settings?.sefazUf || settings?.state || "MG").toUpperCase();
    const companyZip = String(settings?.zipCode || "").replace(/\D/g, "");
    const customerDoc = String(formData.customerCPFCNPJ || "").replace(/\D/g, "");
    const customerZip = String(selectedCustomer?.zipCode || "").replace(/\D/g, "");

    return {
      companyName: String(settings?.razaoSocial || companyName),
      cnpj: String(settings?.cnpj || companyCnpj).replace(/\D/g, ""),
      ie: String(settings?.ie || companyIe).replace(/\D/g, ""),
      ufCode: ufToCode[companyUf] || "31",
      crt: (String(settings?.crt || "1") as "1" | "2" | "3"),
      regimeTributario: (String(settings?.regimeTributario || "Simples Nacional") as
        | "Simples Nacional"
        | "Lucro Real"
        | "Lucro Presumido"),
      companyState: companyUf,
      companyCityCode: String(settings?.sefazMunicipioCodigo || "3138203"),
      companyCity: String(settings?.city || "LAVRAS"),
      companyAddress: String(settings?.address || "RUA NAO INFORMADA"),
      companyZipCode: companyZip || "37200000",
      customerName: String(selectedCustomer?.name || "CONSUMIDOR"),
      customerCNPJ: customerDoc.length === 14 ? customerDoc : undefined,
      customerCPF: customerDoc.length === 11 ? customerDoc : undefined,
      customerIE: String(nfeDestExtra.ie || "").trim() || undefined,
      customerState: String(selectedCustomer?.state || settings?.state || "MG").toUpperCase(),
      customerCity: String(selectedCustomer?.city || settings?.city || "LAVRAS").trim(),
      customerAddress:
        String(selectedCustomer?.address || nfeDestExtra.address || "RUA NAO INFORMADA").trim(),
      customerZipCode: customerZip || undefined,
      items: formData.items.map((item, index) => ({
        productId: Number(item.productId || index + 1),
        productName: item.productName || item.description || `ITEM ${index + 1}`,
        ncm: item.ncm || "00000000",
        cfop: item.cfop || formData.cfopCode || "5102",
        quantity: Math.max(0.0001, toAmount(item.quantity)),
        unitPrice: Math.max(0, toAmount(item.unitPrice)),
        icmsAliquot: Math.max(0, toAmount(item.icmsAliquot)),
        ipiAliquot: Math.max(0, toAmount(item.ipiAliquot)),
        pisAliquot: Math.max(0, toAmount(item.pisAliquot)),
        cofinsAliquot: Math.max(0, toAmount(item.cofinsAliquot)),
        csosn: item.csosn || "101",
        cstIcms: item.cstIcms || "00",
        cstIpi: item.cstIpi || "99",
        cstPisCofins: item.cstPisCofins || "07",
        origin: item.origin || "nacional",
        icmsReduction: Math.max(0, toAmount(item.icmsReduction)),
        icmsStValue: Math.max(0, toAmount(item.icmsStValue)),
      })),
      cfop: formData.cfopCode || formData.items[0]?.cfop || "5102",
    };
  };

  const queueAutoTaxRecalculation = (items: FormItem[], cfopCode: string) => {
    if (autoTaxRecalcTimeoutRef.current) {
      clearTimeout(autoTaxRecalcTimeoutRef.current);
    }
    const hasCalculableItems = items.some((item) => item.productId > 0);
    if (!hasCalculableItems) return;
    autoTaxRecalcTimeoutRef.current = setTimeout(() => {
      calculateTaxesMutation.mutate(buildTaxPayloadFromItems(items, cfopCode));
      autoTaxRecalcTimeoutRef.current = null;
    }, 450);
  };

  const closeNFeNote = async (
    redirectToFiscalCentral = false,
    submitToSefaz = false
  ) => {
    if (isNoteClosed) {
      toast.info("Nota ja fechada. Edite algum campo para recalcular e fechar novamente.");
      return;
    }
    if (!formData.customerId) {
      toast.error("Selecione um cliente para fechar a nota");
      return;
    }
    if (!formData.cfopCode) {
      toast.error("Selecione um CFOP para fechar a nota");
      return;
    }
    if (formData.items.length === 0 || formData.items.some((i) => i.productId <= 0)) {
      toast.error("Todos os itens precisam ter produto selecionado");
      return;
    }

    const invalidAliquots = formData.items.some((item) => {
      const aliquots = [
        item.icmsAliquot,
        item.icmsReduction,
        item.ipiAliquot,
        item.pisAliquot,
        item.cofinsAliquot,
        item.issAliquot,
        item.irrfAliquot,
      ];
      return aliquots.some((value) => toAmount(value) < 0);
    });
    if (invalidAliquots) {
      toast.error("Existem alíquotas inválidas na tributação dos itens");
      return;
    }
    if (toAmount(headerTaxes.productsTotal) < 0 || toAmount(headerTaxes.noteTotal) < 0) {
      toast.error("Valores de total do cabeçalho inválidos");
      return;
    }
    if (!headerValidation.canClose) {
      toast.error("A capa da nota possui divergências acima de 0,01");
      return;
    }

    try {
      const calculation = await calculateTaxesMutation.mutateAsync(buildTaxPayload());
      const totals = calculation?.totals || {};
      const expectedByHeader = {
        productsTotal: round2(toAmount(headerTaxes.productsTotal)),
        discountTotal: round2(toAmount(headerTaxes.discountTotal)),
        otherExpensesTotal: round2(toAmount(headerTaxes.otherExpensesTotal)),
        noteTotal: round2(toAmount(headerTaxes.noteTotal)),
        bcIcmsTotal: round2(toAmount(headerTaxes.bcIcmsTotal)),
        icmsTotal: round2(toAmount(headerTaxes.icmsTotal)),
        icmsStTotal: round2(toAmount(headerTaxes.icmsStTotal)),
        ipiTotal: round2(toAmount(headerTaxes.ipiTotal)),
        pisTotal: round2(toAmount(headerTaxes.pisTotal)),
        cofinsTotal: round2(toAmount(headerTaxes.cofinsTotal)),
        issTotal: round2(toAmount(headerTaxes.issTotal)),
        irrfTotal: round2(toAmount(headerTaxes.irrfTotal)),
      };
      const calculated = {
        productsTotal: round2(totalsFromItems.productsTotal),
        discountTotal: round2(totalsFromItems.discountTotal),
        otherExpensesTotal: round2(toAmount(headerTaxes.otherExpensesTotal)),
        noteTotal: round2(
          totalsFromItems.productsTotal -
            totalsFromItems.discountTotal +
            toAmount(headerTaxes.otherExpensesTotal) +
            toAmount(totals.totalTaxes) +
            totalsFromItems.icmsStTotal
        ),
        bcIcmsTotal: round2(totalsFromItems.bcIcmsTotal),
        icmsTotal: round2(toAmount(totals.icmsTotal)),
        icmsStTotal: round2(totalsFromItems.icmsStTotal),
        ipiTotal: round2(toAmount(totals.ipiTotal)),
        pisTotal: round2(toAmount(totals.pisTotal)),
        cofinsTotal: round2(toAmount(totals.cofinsTotal)),
        issTotal: round2(toAmount(totals.issTotal)),
        irrfTotal: round2(toAmount(totals.irrfTotal)),
      };
      const mismatches = Object.keys(expectedByHeader).filter((key) => {
        const typedKey = key as keyof typeof expectedByHeader;
        return (
          Math.abs(expectedByHeader[typedKey] - calculated[typedKey]) > 0.01
        );
      });
      if (mismatches.length > 0) {
        const labels: Record<string, string> = {
          productsTotal: "valor total dos produtos",
          discountTotal: "valor total de descontos",
          otherExpensesTotal: "outras despesas",
          noteTotal: "valor total da nota",
          bcIcmsTotal: "base de cálculo do ICMS",
          icmsTotal: "valor do ICMS",
          icmsStTotal: "valor do ICMS substituição",
          ipiTotal: "valor total do IPI",
          pisTotal: "valor do PIS",
          cofinsTotal: "valor do COFINS",
          issTotal: "valor do ISS",
          irrfTotal: "valor do IRRF",
        };
        toast.error(
          `Divergência na capa da nota: ${mismatches
            .map((k) => labels[k] || k)
            .join(", ")}`
        );
        setIsNoteClosed(false);
        return;
      }

      setIsNoteClosed(true);
      let receivableCreated = false;
      try {
        const receivableAmount = expectedByHeader.noteTotal;
        const dueDateBase =
          nfePayments.find((payment) => Number(toAmount(payment.value)) > 0)?.dueDate ||
          nfePayments[0]?.dueDate ||
          nfeIdentification.dataEmissao ||
          new Date().toISOString().slice(0, 10);
        const dueDateIso = `${dueDateBase}T00:00:00.000Z`;
        await fetch("/api/receivables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: `NF-e - ${selectedCustomer?.name || "Cliente"} (${nfeIdentification.naturezaOperacao})`,
            customerId: formData.customerId ? Number(formData.customerId) : null,
            customerName: selectedCustomer?.name || null,
            category: "Vendas",
            amount: receivableAmount.toFixed(2),
            dueDate: dueDateIso,
            status: "Pendente",
            notes: "Gerado automaticamente ao fechar NF-e. Se ja recebido, realizar baixa manual.",
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const err = await res.text().catch(() => "");
            throw new Error(err || "Falha ao criar conta a receber");
          }
        });
        receivableCreated = true;
      } catch (receivableError) {
        toast.error(
          receivableError instanceof Error
            ? `Nota fechada, mas falhou ao criar conta a receber: ${receivableError.message}`
            : "Nota fechada, mas falhou ao criar conta a receber"
        );
      }
      toast.success(
        receivableCreated
          ? `Nota fechada e conta a receber criada com sucesso. Tributos: R$ ${round2(
              toAmount(totals.totalTaxes) + totalsFromItems.icmsStTotal
            ).toFixed(2)}`
          : `Nota fechada com sucesso, mas sem conta a receber. Tributos: R$ ${round2(
              toAmount(totals.totalTaxes) + totalsFromItems.icmsStTotal
            ).toFixed(2)}`
      );

      if (submitToSefaz) {
        const generateConfig = buildVisualNFeGenerateConfig();
        const generateRes = await fetch("/api/fiscal/nfe/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: generateConfig,
            series: "1",
          }),
        });

        const generateData = await generateRes.json().catch(() => ({}));
        if (!generateRes.ok || !generateData?.xml) {
          throw new Error(generateData?.error || "Falha ao gerar XML da NF-e");
        }

        const uf = String(settings?.sefazUf || settings?.state || "MG").toUpperCase();
        setNfeOps((prev) => ({ ...prev, uf, xmlContent: String(generateData.xml) }));

        const submitData = await submitNfeMutation.mutateAsync({
          ...nfeOps,
          uf,
          xmlContent: String(generateData.xml),
        });

        const status = String(submitData?.status || "").trim();
        if (!["100", "150"].includes(status)) {
          toast.warning(
            `NF-e enviada para SEFAZ, mas retorno foi ${status || "sem status"} (${submitData?.message || "em processamento"}).`
          );
        } else {
          toast.success(`NF-e aprovada na SEFAZ (cStat ${status}).`);
        }
      }

      if (redirectToFiscalCentral) {
        window.location.assign("/fiscal-central");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao fechar nota com validação tributária"
      );
    }
  };

  const nfseSubtotal = useMemo(() => {
    return nfseItems.reduce((acc, item) => {
      const quantity = parseFloat(item.quantity || "0");
      const unitPrice = parseFloat(item.unitPrice || "0");
      const discount = parseFloat(item.discount || "0");
      return acc + Math.max(0, quantity * unitPrice - discount);
    }, 0);
  }, [nfseItems]);

  const nfseTaxes = useMemo(() => {
    const rate = 5;
    return nfseSubtotal * (rate / 100);
  }, [nfseSubtotal]);

  const nfseTotal = useMemo(() => {
    return nfseSubtotal + nfseTaxes;
  }, [nfseSubtotal, nfseTaxes]);

  const addNfseItem = () => {
    setNfseItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        code: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
        discount: "0",
        serviceCode: "",
      },
    ]);
  };

  const updateNfseItem = (id: string, field: keyof NfseItem, value: string) => {
    setNfseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeNfseItem = (id: string) => {
    setNfseItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleValidateNFe = () => {
    if (!formData.customerId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!formData.cfopCode) {
      toast.error("Selecione um CFOP");
      return;
    }
    if (formData.items.length === 0 || formData.items[0].productId === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    validateNFeMutation.mutate({
      customerId: parseInt(formData.customerId),
      customerType: "contribuinte",
      originState: "SP",
      destinyState: formData.scope === "interestadual" ? "RJ" : "SP",
      scope: formData.scope,
      cfopCode: formData.cfopCode,
      items: formData.items.map((item) => ({
        productId: item.productId,
        description: item.description,
        ncm: item.ncm,
        cfop: item.cfop || formData.cfopCode,
        csosn: item.csosn,
        cstIcms: item.cstIcms,
        cstIpi: item.cstIpi,
        cstPisCofins: item.cstPisCofins,
        quantity: parseInt(item.quantity),
        unit: item.origin || "UN",
        unitPrice: parseFloat(item.unitPrice),
        totalValue: parseFloat(item.unitPrice) * parseInt(item.quantity),
        icmsValue: 0,
        icmsAliquot: 18,
        piValue: 0,
        cofinsValue: 0,
        ipiValue: 0,
      })),
    });
  };

  const handleCalculateTaxes = () => {
    if (formData.items.length === 0) {
      toast.error("Adicione itens para calcular impostos");
      return;
    }

    calculateTaxesMutation.mutate(buildTaxPayload());
  };

  const selectedNfeItem =
    formData.items.length > 0
      ? formData.items[Math.min(selectedNfeItemIndex, formData.items.length - 1)]
      : null;

  const addNfePayment = () => {
    setNfePayments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        form: "01",
        term: "avista",
        value: "0.00",
        dueDate: currentDate,
        cardBrand: "",
        acquirerCnpj: "",
        authorizationCode: "",
      },
    ]);
  };

  const updateNfePayment = (
    id: string,
    field: keyof NfePaymentDraft,
    value: string
  ) => {
    setNfePayments((prev) =>
      prev.map((payment) =>
        payment.id === id
          ? {
              ...payment,
              [field]: value,
              ...(field === "term"
                ? {
                    dueDate:
                      value === "30"
                        ? addDaysToDateString(nfeIdentification.dataEmissao, 30)
                        : value === "60_90"
                          ? addDaysToDateString(nfeIdentification.dataEmissao, 60)
                          : nfeIdentification.dataEmissao || currentDate,
                  }
                : {}),
            }
          : payment
      )
    );
  };

  const removeNfePayment = (id: string) => {
    setNfePayments((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  const nfceSales = useMemo(() => {
    return sales.map((sale) => ({
      ...sale,
      nfceStatus: sale.nfceStatus || "Pendente",
    }));
  }, [sales]);

  const normalizeNfceStatus = (status: string) => {
    if (status === "Autorizada") return "Autorizada";
    if (status === "Cancelada") return "Cancelada";
    if (status === "Rejeitada") return "Rejeitada";
    return "Pendente";
  };

  const toggleSelectNfce = (saleId: number, checked: boolean) => {
    if (checked) {
      setSelectedNfceIds((prev) => [...prev, saleId]);
    } else {
      setSelectedNfceIds((prev) => prev.filter((id) => id !== saleId));
    }
  };

  const handleBatchSend = () => {
    if (selectedNfceIds.length === 0) {
      toast.error("Selecione NFC-e para envio");
      return;
    }
    sendNfceMutation.mutate(selectedNfceIds);
  };

  const updateNfeOps = (field: keyof typeof nfeOps, value: string) => {
    setNfeOps((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-title">
            Documentos Fiscais
          </h1>
          <p className="text-gray-500 mt-2">
            Emita NF-e, NFC-e com tributação completa validada para Receita
            Federal
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="nfe">NF-e (Modelo 55)</TabsTrigger>
          </TabsList>

          {/* NF-e */}
          <TabsContent value="nfe" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modelo Visual - Emissao de NFe</CardTitle>
                <CardDescription>
                  Layout em abas para ERP (fluxo de preenchimento + validacao + emissao)
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[75vh] space-y-4 overflow-y-auto pr-2">
                <Tabs value={nfeWorkspaceTab} onValueChange={setNfeWorkspaceTab}>
                  <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-3 lg:grid-cols-9">
                    <TabsTrigger value="identificacao">Identificacao</TabsTrigger>
                    <TabsTrigger value="emitente">Emitente</TabsTrigger>
                    <TabsTrigger value="destinatario">Destinatario</TabsTrigger>
                    <TabsTrigger value="produtos">Produtos</TabsTrigger>
                    <TabsTrigger value="totais">Totais</TabsTrigger>
                    <TabsTrigger value="transporte">Transporte</TabsTrigger>
                    <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
                    <TabsTrigger value="informacoes">Info</TabsTrigger>
                    <TabsTrigger value="resptec">Resp. Tec.</TabsTrigger>
                  </TabsList>

                  <TabsContent value="identificacao" className="mt-4 space-y-4">
                    <div>
                      <Label>Natureza da Operacao</Label>
                      <SearchablePopoverSelect
                        value={nfeIdentification.naturezaOperacao}
                        onValueChange={(value) =>
                          setNfeIdentification((p) => ({ ...p, naturezaOperacao: value }))
                        }
                        placeholder="Selecione um CFOP"
                        searchPlaceholder="Pesquisar CFOP..."
                        options={
                          cfopCodes.length > 0
                            ? cfopCodes.map((cfop) => ({
                                value: `${cfop.code} - ${cfop.description}`,
                                label: `${cfop.code} - ${cfop.description}`,
                              }))
                            : [{ value: "sem_cfop", label: "Nenhum CFOP cadastrado" }]
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <Label>Tipo Operacao</Label>
                        <SearchablePopoverSelect
                          value={nfeIdentification.tipoOperacao}
                          onValueChange={(value) =>
                            setNfeIdentification((p) => ({ ...p, tipoOperacao: value }))
                          }
                          options={nfeTipoOperacaoOptions}
                          placeholder="Selecione"
                        />
                      </div>
                      <div>
                        <Label>Finalidade</Label>
                        <SearchablePopoverSelect
                          value={nfeIdentification.finalidade}
                          onValueChange={(value) =>
                            setNfeIdentification((p) => ({ ...p, finalidade: value }))
                          }
                          options={nfeFinalidadeOptions}
                          placeholder="Selecione"
                        />
                      </div>
                      <div>
                        <Label>Consumidor Final</Label>
                        <SearchablePopoverSelect
                          value={nfeIdentification.consumidorFinal}
                          onValueChange={(value) =>
                            setNfeIdentification((p) => ({ ...p, consumidorFinal: value }))
                          }
                          options={nfeConsumidorFinalOptions}
                          placeholder="Selecione"
                        />
                      </div>
                      <div>
                        <Label>Presenca</Label>
                        <SearchablePopoverSelect
                          value={nfeIdentification.presenca}
                          onValueChange={(value) =>
                            setNfeIdentification((p) => ({ ...p, presenca: value }))
                          }
                          options={nfePresencaOptions}
                          placeholder="Selecione"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="emitente" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div><Label>CNPJ (empresa logada)</Label><Input value={companyCnpj} disabled /></div>
                      <div><Label>Razao Social (empresa logada)</Label><Input value={companyName} disabled /></div>
                      <div><Label>IE</Label><Input value={companyIe} disabled /></div>
                      <div><Label>Regime</Label><Input value={companyRegime} disabled /></div>
                    </div>
                  </TabsContent>

                  <TabsContent value="destinatario" className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="md:col-span-2"><Label>CPF/CNPJ</Label><Input value={formData.customerCPFCNPJ} onChange={(e) => setFormData((p) => ({ ...p, customerCPFCNPJ: e.target.value }))} /></div>
                      <div className="flex items-end"><Button className="w-full" variant="outline" onClick={handleSearchCustomerByDocument}>Buscar Cliente</Button></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div><Label>Nome / Razao Social</Label><Input value={selectedCustomer?.name || ""} readOnly /></div>
                      <div><Label>Email</Label><Input value={nfeDestExtra.email} onChange={(e) => setNfeDestExtra((p) => ({ ...p, email: e.target.value }))} /></div>
                      <div><Label>IE</Label><Input value={nfeDestExtra.ie} onChange={(e) => setNfeDestExtra((p) => ({ ...p, ie: e.target.value }))} /></div>
                      <div><Label>Indicador IE</Label><Input value={nfeDestExtra.ieIndicator} onChange={(e) => setNfeDestExtra((p) => ({ ...p, ieIndicator: e.target.value }))} /></div>
                      <div className="md:col-span-2"><Label>Endereco Completo</Label><Input value={nfeDestExtra.address} onChange={(e) => setNfeDestExtra((p) => ({ ...p, address: e.target.value }))} /></div>
                    </div>
                  </TabsContent>

                  <TabsContent value="produtos" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Produtos / Itens (Aba principal)</p>
                        <p className="text-xs text-muted-foreground">Clique no item para abrir painel lateral e duplo clique para tributacao avancada.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setProductPickerDialogOpen(true);
                          setProductSearch("");
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />Adicionar Produto
                      </Button>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Codigo</TableHead>
                              <TableHead>Descricao</TableHead>
                              <TableHead>NCM</TableHead>
                              <TableHead>CFOP</TableHead>
                              <TableHead>Qtd</TableHead>
                              <TableHead>V.Unit</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {formData.items.map((item, index) => (
                              <TableRow key={index} onClick={() => setSelectedNfeItemIndex(index)} onDoubleClick={() => setEditingTaxItemIndex(index)} className={index === selectedNfeItemIndex ? "bg-muted/40" : ""}>
                                <TableCell>{item.productId || "-"}</TableCell>
                                <TableCell>{item.productName || "Produto nao selecionado"}</TableCell>
                                <TableCell>{item.ncm || "-"}</TableCell>
                                <TableCell>{item.cfop || formData.cfopCode || "-"}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>R$ {toAmount(item.unitPrice).toFixed(2)}</TableCell>
                                <TableCell>R$ {(toAmount(item.quantity) * toAmount(item.unitPrice)).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <Card className="h-fit">
                        <CardHeader>
                          <CardTitle className="text-base">Painel Lateral</CardTitle>
                          <CardDescription>Dados do item e tributacao aplicavel</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {selectedNfeItem ? (
                            <>
                              <div><span className="font-medium">Descricao:</span> {selectedNfeItem.description || selectedNfeItem.productName || "-"}</div>
                              <div><span className="font-medium">NCM:</span> {selectedNfeItem.ncm || "-"}</div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <Label>Quantidade</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={selectedNfeItem.quantity}
                                    onChange={(e) =>
                                      handleItemChange(selectedNfeItemIndex, "quantity", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Valor unitario</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={selectedNfeItem.unitPrice}
                                    onChange={(e) =>
                                      handleItemChange(selectedNfeItemIndex, "unitPrice", e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div>
                                <Label>CFOP</Label>
                                <SearchablePopoverSelect
                                  value={selectedNfeItem.cfop || formData.cfopCode || ""}
                                  onValueChange={(value) =>
                                    handleItemChange(selectedNfeItemIndex, "cfop", value)
                                  }
                                  placeholder="Selecione um CFOP"
                                  searchPlaceholder="Pesquisar CFOP..."
                                  options={cfopSelectOptions.map((cfop) => ({
                                    value: cfop.code,
                                    label: `${cfop.code} - ${cfop.description}`,
                                  }))}
                                />
                              </div>
                              <div className="rounded-md border p-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Total do item</span>
                                  <span className="font-semibold">
                                    R$ {(toAmount(selectedNfeItem.quantity) * toAmount(selectedNfeItem.unitPrice)).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div><span className="font-medium">ICMS:</span> CST {selectedNfeItem.cstIcms} / CSOSN {selectedNfeItem.csosn}</div>
                              <div><span className="font-medium">IPI:</span> CST {selectedNfeItem.cstIpi}</div>
                              <div><span className="font-medium">PIS/COFINS:</span> CST {selectedNfeItem.cstPisCofins}</div>
                              <Button type="button" variant="secondary" className="w-full" onClick={() => setEditingTaxItemIndex(selectedNfeItemIndex)}>
                                Abrir tributacao avancada
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                className="w-full"
                                onClick={() => {
                                  handleRemoveItem(selectedNfeItemIndex);
                                  setSelectedNfeItemIndex((prev) => Math.max(0, prev - 1));
                                }}
                              >
                                Excluir produto selecionado
                              </Button>
                            </>
                          ) : (
                            <p className="text-muted-foreground">Nenhum item selecionado.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="totais" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div><Label>Base ICMS</Label><Input value={`R$ ${toAmount(headerTaxes.bcIcmsTotal).toFixed(2)}`} disabled /></div>
                      <div><Label>Valor ICMS</Label><Input value={`R$ ${toAmount(headerTaxes.icmsTotal).toFixed(2)}`} disabled /></div>
                      <div><Label>Valor Produtos</Label><Input value={`R$ ${toAmount(headerTaxes.productsTotal).toFixed(2)}`} disabled /></div>
                      <div><Label>Desconto</Label><Input value={`R$ ${toAmount(headerTaxes.discountTotal).toFixed(2)}`} disabled /></div>
                      <div><Label>Outras despesas</Label><Input value={headerTaxes.otherExpensesTotal} onChange={(e) => setHeaderTaxes((p) => ({ ...p, otherExpensesTotal: e.target.value }))} /></div>
                      <div><Label>VALOR TOTAL NFe</Label><Input value={`R$ ${toAmount(headerTaxes.noteTotal).toFixed(2)}`} disabled /></div>
                    </div>
                  </TabsContent>

                  <TabsContent value="transporte" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>Modalidade Frete</Label>
                        <SearchablePopoverSelect
                          value={nfeTransport.freightMode}
                          onValueChange={(value) =>
                            setNfeTransport((p) => ({ ...p, freightMode: value }))
                          }
                          options={nfeFreightModeOptions}
                          placeholder="Selecione"
                          searchPlaceholder="Pesquisar modalidade..."
                        />
                      </div>
                      <div>
                        <Label>Transportadora</Label>
                        <Input
                          value={nfeTransport.carrierName}
                          onChange={(e) =>
                            setNfeTransport((p) => ({ ...p, carrierName: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          className="w-full"
                          variant="outline"
                          onClick={handleSearchTransporter}
                        >
                          Buscar Transportadora
                        </Button>
                      </div>
                      <div>
                        <Label>CNPJ/CPF</Label>
                        <Input
                          value={nfeTransport.carrierDocument}
                          onChange={(e) =>
                            setNfeTransport((p) => ({ ...p, carrierDocument: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label>RNTC</Label>
                        <Input
                          value={nfeTransport.rntc}
                          onChange={(e) =>
                            setNfeTransport((p) => ({ ...p, rntc: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Placa / UF</Label>
                        <Input
                          value={`${nfeTransport.plate}${nfeTransport.plateUf ? ` - ${nfeTransport.plateUf}` : ""}`}
                          readOnly
                        />
                      </div>
                      <div>
                        <Label>Pesos</Label>
                        <Input
                          value={`${nfeTransport.grossWeight || "0"} / ${nfeTransport.netWeight || "0"}`}
                          readOnly
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="pagamento" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium">Pagamentos</p><Button size="sm" variant="outline" type="button" onClick={addNfePayment}><Plus className="mr-1 h-4 w-4" />Adicionar</Button></div>
                    {nfePayments.map((payment) => (
                      <div key={payment.id} className="grid gap-4 rounded-md border p-3 md:grid-cols-4">
                        <div>
                          <Label>Forma</Label>
                          <SearchablePopoverSelect
                            value={payment.form}
                            onValueChange={(value) => updateNfePayment(payment.id, "form", value)}
                            options={nfePaymentFormOptions}
                            placeholder="Selecione"
                            searchPlaceholder="Pesquisar forma..."
                          />
                        </div>
                        <div>
                          <Label>Condicao</Label>
                          <SearchablePopoverSelect
                            value={payment.term}
                            onValueChange={(value) => updateNfePayment(payment.id, "term", value)}
                            options={nfePaymentTermOptions}
                            placeholder="Selecione"
                            searchPlaceholder="Pesquisar condicao..."
                          />
                        </div>
                        <div>
                          <Label>Valor</Label>
                          <Input value={payment.value} onChange={(e) => updateNfePayment(payment.id, "value", e.target.value)} />
                        </div>
                        <div>
                          <Label>Vencimento</Label>
                          <Input type="date" value={payment.dueDate} onChange={(e) => updateNfePayment(payment.id, "dueDate", e.target.value)} />
                        </div>
                        <div className="md:col-span-4 flex justify-end">
                          <Button type="button" variant="ghost" onClick={() => removeNfePayment(payment.id)}>Remover</Button>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="informacoes" className="mt-4 space-y-4">
                    <div><Label>Informacoes Complementares ao Fisco</Label><Textarea rows={4} value={nfeAdditionalFields.fisco} onChange={(e) => setNfeAdditionalFields((p) => ({ ...p, fisco: e.target.value }))} /></div>
                    <div><Label>Informacoes ao Contribuinte</Label><Textarea rows={4} value={nfeAdditionalFields.contribuinte} onChange={(e) => setNfeAdditionalFields((p) => ({ ...p, contribuinte: e.target.value }))} /></div>
                  </TabsContent>

                  <TabsContent value="resptec" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div><Label>CNPJ</Label><Input value={nfeResponsibleTech.cnpj} onChange={(e) => setNfeResponsibleTech((p) => ({ ...p, cnpj: e.target.value }))} /></div>
                      <div><Label>Nome</Label><Input value={nfeResponsibleTech.name} onChange={(e) => setNfeResponsibleTech((p) => ({ ...p, name: e.target.value }))} /></div>
                      <div><Label>Email</Label><Input value={nfeResponsibleTech.email} onChange={(e) => setNfeResponsibleTech((p) => ({ ...p, email: e.target.value }))} /></div>
                      <div><Label>Telefone</Label><Input value={nfeResponsibleTech.phone} onChange={(e) => setNfeResponsibleTech((p) => ({ ...p, phone: e.target.value }))} /></div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Fluxo ideal: Identificacao, Destinatario, Produtos, Totais, Pagamento, Emitir</p>
                      <p className="text-sm font-semibold">Valor Total: R$ {toAmount(headerTaxes.noteTotal).toFixed(2)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          toast.info("Rascunho salvo. Redirecionando para Central Fiscal...");
                          window.location.assign("/fiscal-central");
                        }}
                      >
                        Salvar Rascunho
                      </Button>
                      <Button type="button" onClick={handleValidateNFe}>Validar Nota</Button>
                      <Button
                        type="button"
                        onClick={() => closeNFeNote(true, true)}
                        disabled={!headerValidation.canClose}
                      >
                        Emitir NFe
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Dialog
              open={productPickerDialogOpen}
              onOpenChange={(open) => {
                setProductPickerDialogOpen(open);
                if (!open) setProductSearch("");
              }}
            >
              <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Adicionar Produto</DialogTitle>
                  <DialogDescription>
                    Pesquise e selecione um produto. Ele sera adicionado com a tributacao do cadastro.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    autoFocus
                    placeholder="Buscar por nome, codigo, EAN..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                    {productSearch.trim().length < 2 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Digite pelo menos 2 caracteres para pesquisar.
                      </div>
                    ) : productResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum produto encontrado.
                      </div>
                    ) : (
                      productResults.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="block w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-accent"
                          onClick={() => handleAddProductFromPicker(product)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground">
                                ID {product.id} | NCM {product.ncm || "N/A"} | CEST {product.cest || "N/A"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                CSOSN {product.csosnCode || "101"} | CST ICMS {product.cstIcms || "00"} | Origem {product.origin || "nacional"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">
                                R$ {toAmount(product.price).toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Clique para adicionar
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={editingTaxItemIndex !== null}
              onOpenChange={(open) => {
                if (!open) setEditingTaxItemIndex(null);
              }}
            >
              <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tributação do Item e Cabeçalho</DialogTitle>
                  <DialogDescription>
                    Ajuste por duplo clique. O fechamento da nota valida os
                    tributos de todos os itens e do cabeçalho.
                  </DialogDescription>
                </DialogHeader>
                {editingTaxItemIndex !== null &&
                formData.items[editingTaxItemIndex] ? (
                  <div className="space-y-4">
                    <div className="rounded-md border p-3">
                      <p className="font-medium">
                        {formData.items[editingTaxItemIndex].productName ||
                          "Item sem produto"}
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.items[editingTaxItemIndex].quantity}
                            onChange={(e) =>
                              handleItemChange(
                                editingTaxItemIndex,
                                "quantity",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label>Valor unitario (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.items[editingTaxItemIndex].unitPrice}
                            onChange={(e) =>
                              handleItemChange(
                                editingTaxItemIndex,
                                "unitPrice",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="flex items-end rounded-md border px-3 py-2 text-sm">
                          <span className="text-muted-foreground mr-2">Total:</span>
                          <span className="font-semibold">
                            R${" "}
                            {(
                              toAmount(formData.items[editingTaxItemIndex].quantity) *
                              toAmount(formData.items[editingTaxItemIndex].unitPrice)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-3">
                      <p className="text-sm font-medium">Quadro DANFE - Classificação e Alíquotas</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label>CFOP item</Label>
                        <SearchablePopoverSelect
                          value={formData.items[editingTaxItemIndex].cfop || formData.cfopCode || ""}
                          onValueChange={(value) =>
                            handleItemChange(editingTaxItemIndex, "cfop", value)
                          }
                          placeholder="Selecione um CFOP"
                          searchPlaceholder="Pesquisar CFOP..."
                          options={cfopSelectOptions.map((cfop) => ({
                            value: cfop.code,
                            label: `${cfop.code} - ${cfop.description}`,
                          }))}
                        />
                      </div>
                      <div>
                        <Label>CST ICMS</Label>
                        <Input
                          value={formData.items[editingTaxItemIndex].cstIcms}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "cstIcms",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>CST IPI</Label>
                        <Input
                          value={formData.items[editingTaxItemIndex].cstIpi}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "cstIpi",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>CST PIS/COFINS</Label>
                        <Input
                          value={formData.items[editingTaxItemIndex].cstPisCofins}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "cstPisCofins",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>V. desconto (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].discountValue}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "discountValue",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>BC ICMS (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].bcIcmsValue}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "bcIcmsValue",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Aliq. ICMS (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].icmsAliquot}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "icmsAliquot",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Redução ICMS (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            formData.items[editingTaxItemIndex].icmsReduction
                          }
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "icmsReduction",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Aliq. IPI (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].ipiAliquot}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "ipiAliquot",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Aliq. PIS (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].pisAliquot}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "pisAliquot",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Aliq. COFINS (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            formData.items[editingTaxItemIndex].cofinsAliquot
                          }
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "cofinsAliquot",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Aliq. ISS (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].issAliquot}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "issAliquot",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label>Aliq. IRRF (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.items[editingTaxItemIndex].irrfAliquot}
                          onChange={(e) =>
                            handleItemChange(
                              editingTaxItemIndex,
                              "irrfAliquot",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">Valores editáveis do item</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <Label>V. ICMS (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.items[editingTaxItemIndex].icmsValue}
                            onChange={(e) =>
                              handleItemChange(editingTaxItemIndex, "icmsValue", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label>V. IPI (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.items[editingTaxItemIndex].ipiValue}
                            onChange={(e) =>
                              handleItemChange(editingTaxItemIndex, "ipiValue", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label>V. ICMS ST (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.items[editingTaxItemIndex].icmsStValue}
                            onChange={(e) =>
                              handleItemChange(
                                editingTaxItemIndex,
                                "icmsStValue",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label>Total tributos item (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.items[editingTaxItemIndex].totalTaxes}
                            onChange={(e) =>
                              handleItemChange(
                                editingTaxItemIndex,
                                "totalTaxes",
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium mb-2">Valores do item</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <span>
                          ICMS: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].icmsValue
                          ).toFixed(2)}
                        </span>
                        <span>
                          IPI: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].ipiValue
                          ).toFixed(2)}
                        </span>
                        <span>
                          PIS: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].pisValue
                          ).toFixed(2)}
                        </span>
                        <span>
                          COFINS: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].cofinsValue
                          ).toFixed(2)}
                        </span>
                        <span>
                          ISS: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].issValue
                          ).toFixed(2)}
                        </span>
                        <span>
                          IRRF: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].irrfValue
                          ).toFixed(2)}
                        </span>
                        <span>
                          ICMS ST: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].icmsStValue
                          ).toFixed(2)}
                        </span>
                        <span className="font-semibold col-span-2">
                          Total item: R${" "}
                          {toAmount(
                            formData.items[editingTaxItemIndex].totalTaxes
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-3">
                      <p className="text-sm font-medium">Tributação do cabeçalho</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <Label>V. total produtos (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("productsTotal")}
                            value={headerTaxes.productsTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                productsTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>V. desconto total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("discountTotal")}
                            value={headerTaxes.discountTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                discountTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>Outras despesas (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={headerTaxes.otherExpensesTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                otherExpensesTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>V. total nota (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("noteTotal")}
                            value={headerTaxes.noteTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                noteTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>BC ICMS total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("bcIcmsTotal")}
                            value={headerTaxes.bcIcmsTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                bcIcmsTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>ICMS total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("icmsTotal")}
                            value={headerTaxes.icmsTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                icmsTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>ICMS ST total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("icmsStTotal")}
                            value={headerTaxes.icmsStTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                icmsStTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>IPI total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("ipiTotal")}
                            value={headerTaxes.ipiTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                ipiTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>PIS total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("pisTotal")}
                            value={headerTaxes.pisTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                pisTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>COFINS total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("cofinsTotal")}
                            value={headerTaxes.cofinsTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                cofinsTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>ISS total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("issTotal")}
                            value={headerTaxes.issTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                issTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                        <div>
                          <Label>IRRF total (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={headerFieldClass("irrfTotal")}
                            value={headerTaxes.irrfTotal}
                            onChange={(e) => {
                              setHeaderTaxes((prev) => ({
                                ...prev,
                                irrfTotal: e.target.value,
                              }));
                              setIsNoteClosed(false);
                            }}
                          />
                        </div>
                      </div>
                      {headerValidation.blockingMismatches.length > 0 && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                          <p className="mb-2 font-medium text-red-700">
                            Motivo dos campos em vermelho
                          </p>
                          <div className="space-y-1 text-red-700">
                            {headerValidation.blockingMismatches.map((field) => (
                              <p key={field}>• {headerFieldMismatchReason(field as keyof typeof headerValidation.fieldMismatch)}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={syncHeaderWithItems}
                      >
                        Recalcular totais pelos itens
                      </Button>
                    </div>
                  </div>
                ) : null}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingTaxItemIndex(null)}>
                    Concluir
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* NFC-e */}
          <TabsContent value="nfce" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestao de NFC-e</CardTitle>
                <CardDescription>
                  NFC-e geradas automaticamente a partir das vendas do PDV
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    A emissao e automatica no PDV. Esta tela e apenas para gestao.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleBatchSend}
                    disabled={sendNfceMutation.isPending}
                    data-testid="button-send-nfce-batch"
                  >
                    {sendNfceMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Enviar selecionadas
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>ID</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Protocolo</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingSales ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">
                            Carregando NFC-e...
                          </TableCell>
                        </TableRow>
                      ) : nfceSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">
                            Nenhuma NFC-e encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        nfceSales.map((sale) => {
                          const normalizedStatus = normalizeNfceStatus(
                            sale.nfceStatus
                          );
                          const canSend =
                            normalizedStatus === "Pendente" ||
                            normalizedStatus === "Rejeitada";
                          const canCancel = normalizedStatus === "Autorizada";
                          return (
                            <TableRow key={sale.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedNfceIds.includes(sale.id)}
                                  onCheckedChange={(checked) =>
                                    toggleSelectNfce(sale.id, !!checked)
                                  }
                                  data-testid={`checkbox-nfce-${sale.id}`}
                                />
                              </TableCell>
                              <TableCell>{sale.id}</TableCell>
                              <TableCell>{sale.customerName}</TableCell>
                              <TableCell>
                                R$ {parseFloat(sale.total).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {normalizedStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>{sale.nfceProtocol || "-"}</TableCell>
                              <TableCell>{sale.nfceError || "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!canSend || sendNfceMutation.isPending}
                                    onClick={() => sendNfceMutation.mutate([sale.id])}
                                    data-testid={`button-send-nfce-${sale.id}`}
                                  >
                                    {normalizedStatus === "Rejeitada"
                                      ? "Reenviar"
                                      : "Enviar"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={!canCancel || cancelNfceMutation.isPending}
                                    onClick={() => {
                                      if (!sale.nfceKey || !sale.nfceProtocol) {
                                        toast.error(
                                          "NFC-e sem chave ou protocolo. Nao e possivel cancelar."
                                        );
                                        return;
                                      }
                                      setCancelNfceDialog({
                                        open: true,
                                        saleId: sale.id,
                                        reason: "",
                                      });
                                    }}
                                    data-testid={`button-cancel-nfce-${sale.id}`}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <Dialog
                  open={cancelNfceDialog.open}
                  onOpenChange={(open) =>
                    setCancelNfceDialog((prev) => ({ ...prev, open }))
                  }
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancelar NFC-e</DialogTitle>
                      <DialogDescription>
                        Informe a justificativa do cancelamento (min 15
                        caracteres).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>Justificativa</Label>
                      <Textarea
                        value={cancelNfceDialog.reason}
                        onChange={(e) =>
                          setCancelNfceDialog((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                        rows={4}
                        data-testid="input-cancel-nfce-reason"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (cancelNfceDialog.reason.trim().length < 15) {
                            toast.error(
                              "Justificativa obrigatoria (min 15 caracteres)"
                            );
                            return;
                          }
                          cancelNfceMutation.mutate({
                            saleId: cancelNfceDialog.saleId,
                            reason: cancelNfceDialog.reason.trim(),
                          });
                        }}
                        disabled={cancelNfceMutation.isPending}
                        data-testid="button-confirm-cancel-nfce"
                      >
                        {cancelNfceMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Confirmar cancelamento
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Card>
                  <CardHeader>
                    <CardTitle>Inutilizar numeracao</CardTitle>
                    <CardDescription>
                      Use quando houver lacuna de numeracao
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Serie</Label>
                        <Input
                          value={inutilizeForm.serie}
                          onChange={(e) =>
                            setInutilizeForm({
                              ...inutilizeForm,
                              serie: e.target.value,
                            })
                          }
                          data-testid="input-inutilize-serie"
                        />
                      </div>
                      <div>
                        <Label>Numero inicial</Label>
                        <Input
                          value={inutilizeForm.startNumber}
                          onChange={(e) =>
                            setInutilizeForm({
                              ...inutilizeForm,
                              startNumber: e.target.value,
                            })
                          }
                          data-testid="input-inutilize-start"
                        />
                      </div>
                      <div>
                        <Label>Numero final</Label>
                        <Input
                          value={inutilizeForm.endNumber}
                          onChange={(e) =>
                            setInutilizeForm({
                              ...inutilizeForm,
                              endNumber: e.target.value,
                            })
                          }
                          data-testid="input-inutilize-end"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Justificativa</Label>
                      <Input
                        value={inutilizeForm.reason}
                        onChange={(e) =>
                          setInutilizeForm({
                            ...inutilizeForm,
                            reason: e.target.value,
                          })
                        }
                        data-testid="input-inutilize-reason"
                      />
                    </div>
                    <Button
                      onClick={() => inutilizeNfceMutation.mutate(inutilizeForm)}
                      disabled={inutilizeNfceMutation.isPending}
                      data-testid="button-inutilize-nfce"
                    >
                      {inutilizeNfceMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Inutilizar numeracao
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

                    {/* NFS-e */}
          <TabsContent value="nfse" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cabecalho da Nota</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Tipo de documento</Label>
                  <Input value="NFS-e" disabled />
                </div>
                <div>
                  <Label>Tipo de operacao</Label>
                  <Select value={nfseOperationType} onValueChange={setNfseOperationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prestacao">Prestacao</SelectItem>
                      <SelectItem value="cancelamento">Cancelamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Numero</Label>
                  <Input value={nfseNumber} disabled />
                </div>
                <div>
                  <Label>Serie</Label>
                  <Input value={nfseSeries} disabled />
                </div>
                <div>
                  <Label>Data de emissao</Label>
                  <Input
                    type="date"
                    value={nfseIssueDate}
                    onChange={(e) => setNfseIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ambiente</Label>
                  <Select value={nfseEnvironment} onValueChange={setNfseEnvironment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologacao</SelectItem>
                      <SelectItem value="producao">Producao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emitente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Razao social</Label>
                  <Input value={companyName} disabled />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={companyCnpj} disabled />
                </div>
                <div>
                  <Label>IE</Label>
                  <Input value={companyIe} disabled />
                </div>
                <div>
                  <Label>IM</Label>
                  <Input value={companyIm} disabled />
                </div>
                <div>
                  <Label>Regime tributario</Label>
                  <Input value={companyRegime} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Destinatario / Tomador</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Tipo</Label>
                  <Select value={nfseCustomerType} onValueChange={setNfseCustomerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Fisica</SelectItem>
                      <SelectItem value="pj">Pessoa Juridica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Indicador IE</Label>
                  <Select
                    value={nfseCustomerIeIndicator}
                    onValueChange={setNfseCustomerIeIndicator}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contribuinte">Contribuinte</SelectItem>
                      <SelectItem value="nao_contribuinte">Nao contribuinte</SelectItem>
                      <SelectItem value="isento">Isento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome / Razao social</Label>
                  <Input
                    value={nfseCustomerName}
                    onChange={(e) => setNfseCustomerName(e.target.value)}
                    placeholder="Nome do tomador"
                  />
                </div>
                <div>
                  <Label>{nfseCustomerType === "pf" ? "CPF" : "CNPJ"}</Label>
                  <Input
                    value={nfseCustomerDocument}
                    onChange={(e) => setNfseCustomerDocument(e.target.value)}
                    placeholder={
                      nfseCustomerType === "pf"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={nfseCustomerZip}
                    onChange={(e) => setNfseCustomerZip(e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <Label>Endereco</Label>
                  <Input
                    value={nfseCustomerAddress}
                    onChange={(e) => setNfseCustomerAddress(e.target.value)}
                    placeholder="Endereco do tomador"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Itens (servicos)</CardTitle>
                <Button variant="outline" size="sm" onClick={addNfseItem}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {nfseItems.map((item) => (
                  <div key={item.id} className="grid gap-3 md:grid-cols-12 items-end">
                    <div className="md:col-span-2">
                      <Label>Codigo</Label>
                      <Input
                        value={item.code}
                        onChange={(e) => updateNfseItem(item.id, "code", e.target.value)}
                        placeholder="Codigo"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label>Descricao</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateNfseItem(item.id, "description", e.target.value)}
                        placeholder="Descricao do servico"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Quantidade</Label>
                      <Input
                        value={item.quantity}
                        onChange={(e) => updateNfseItem(item.id, "quantity", e.target.value)}
                        type="number"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Valor unitario</Label>
                      <Input
                        value={item.unitPrice}
                        onChange={(e) => updateNfseItem(item.id, "unitPrice", e.target.value)}
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Desconto</Label>
                      <Input
                        value={item.discount}
                        onChange={(e) => updateNfseItem(item.id, "discount", e.target.value)}
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label>Codigo de servico</Label>
                      <Input
                        value={item.serviceCode}
                        onChange={(e) => updateNfseItem(item.id, "serviceCode", e.target.value)}
                        placeholder="Codigo"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNfseItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Impostos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de impostos</span>
                  <span className="text-lg font-semibold">R$ {nfseTaxes.toFixed(2)}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setNfseShowTaxDetails(!nfseShowTaxDetails)}
                >
                  {nfseShowTaxDetails ? "Ocultar detalhes" : "Ver detalhes"}
                </Button>
                {nfseShowTaxDetails && (
                  <div className="space-y-2">
                    {nfseItems.map((item) => {
                      const quantity = parseFloat(item.quantity || "0");
                      const unitPrice = parseFloat(item.unitPrice || "0");
                      const discount = parseFloat(item.discount || "0");
                      const base = Math.max(0, quantity * unitPrice - discount);
                      const imposto = base * 0.05;
                      return (
                        <div key={item.id} className="text-sm flex justify-between">
                          <span>{item.description || "Servico"}</span>
                          <span>R$ {imposto.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Totais da Nota</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Servicos</Label>
                  <Input value={`R$ ${nfseSubtotal.toFixed(2)}`} disabled />
                </div>
                <div>
                  <Label>Impostos</Label>
                  <Input value={`R$ ${nfseTaxes.toFixed(2)}`} disabled />
                </div>
                <div>
                  <Label>Valor total</Label>
                  <Input value={`R$ ${nfseTotal.toFixed(2)}`} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Forma</Label>
                  <Select value={nfsePaymentForm} onValueChange={setNfsePaymentForm}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_vista">A vista</SelectItem>
                      <SelectItem value="credito">Credito</SelectItem>
                      <SelectItem value="debito">Debito</SelectItem>
                      <SelectItem value="pix">Pix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Condicao</Label>
                  <Select value={nfsePaymentCondition} onValueChange={setNfsePaymentCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imediato">Imediato</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="30_60">30/60 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Observacoes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={nfseAdditionalInfo}
                  onChange={(e) => setNfseAdditionalInfo(e.target.value)}
                  placeholder="Informacoes complementares"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
