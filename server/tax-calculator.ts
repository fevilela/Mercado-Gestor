// Calculadora de Impostos para Notas Fiscais
export interface TaxCalculation {
  icmsValue: number;
  icmsAliquot: number;
  ipiValue: number;
  ipiAliquot: number;
  pisValue: number;
  pisAliquot: number;
  cofinsValue: number;
  cofinsAliquot: number;
  issValue: number;
  issAliquot: number;
  irrfValue: number;
  irrfAliquot: number;
  totalTaxes: number;
}

export interface IbptQueryParams {
  token: string;
  cnpj: string;
  uf: string;
  codigo: string;
  descricao: string;
  unidade: string;
  valor: number;
  gtin?: string;
  ex?: string;
  baseUrl?: string;
}

export interface IbptTaxResult {
  federal: number;
  estadual: number;
  municipal: number;
  importado?: number;
  total?: number;
  chave?: string;
  versao?: string;
  fonte?: string;
}

export class TaxCalculator {
  // Calcula ICMS (Imposto sobre Circulação de Mercadorias e Serviços)
  static calculateICMS(
    baseValue: number,
    aliquot: number,
    reduction: number = 0
  ): number {
    const effectiveAliquot = aliquot * (1 - reduction / 100);
    return (baseValue * effectiveAliquot) / 100;
  }

  // Calcula IPI (Imposto sobre Produtos Industrializados)
  static calculateIPI(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  // Calcula PIS (Programa de Integração Social)
  static calculatePIS(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  // Calcula COFINS (Contribuição para Financiamento da Seguridade Social)
  static calculateCOFINS(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  // Calcula ISS (Imposto Sobre Serviços)
  static calculateISS(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  // Calcula IRRF (Imposto de Renda Retido na Fonte)
  static calculateIRRF(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  // Calcula todas as tributações de um item
  static calculateAllTaxes(
    quantity: number,
    unitPrice: number,
    icmsAliquot: number = 0,
    icmsReduction: number = 0,
    ipiAliquot: number = 0,
    pisAliquot: number = 0,
    cofinsAliquot: number = 0,
    issAliquot: number = 0,
    irrfAliquot: number = 0
  ): TaxCalculation {
    const subtotal = quantity * unitPrice;

    const icmsValue = this.calculateICMS(subtotal, icmsAliquot, icmsReduction);
    const ipiValue = this.calculateIPI(subtotal, ipiAliquot);
    const pisValue = this.calculatePIS(subtotal, pisAliquot);
    const cofinsValue = this.calculateCOFINS(subtotal, cofinsAliquot);
    const issValue = this.calculateISS(subtotal, issAliquot);
    const irrfValue = this.calculateIRRF(subtotal, irrfAliquot);

    return {
      icmsValue: Math.round(icmsValue * 100) / 100,
      icmsAliquot,
      ipiValue: Math.round(ipiValue * 100) / 100,
      ipiAliquot,
      pisValue: Math.round(pisValue * 100) / 100,
      pisAliquot,
      cofinsValue: Math.round(cofinsValue * 100) / 100,
      cofinsAliquot,
      issValue: Math.round(issValue * 100) / 100,
      issAliquot,
      irrfValue: Math.round(irrfValue * 100) / 100,
      irrfAliquot,
      totalTaxes:
        Math.round(
          (icmsValue +
            ipiValue +
            pisValue +
            cofinsValue +
            issValue +
            irrfValue) *
            100
        ) / 100,
    };
  }

  // Calcula IBPT (Imposto Básico de Produtos Tributados)
  static calculateIBPT(baseValue: number, ibptRate: number): number {
    return (baseValue * ibptRate) / 100;
  }

  // Retorna alíquota padrão por CST/CSOSN
  static getDefaultAliquotByCST(
    cst: string,
    taxType: "icms" | "ipi" | "pis" | "cofins" = "icms"
  ): number {
    // Alíquotas padrão conforme CST/CSOSN
    const aliquots: Record<string, Record<string, number>> = {
      icms: {
        "00": 18, // Tributada com crédito
        "10": 18, // Tributada sem crédito
        "20": 0, // Submetida à substituição
        "30": 0, // Isenta ou não tributada
        "40": 0, // Isenta
        "41": 0, // Não tributada
        "50": 0, // Suspensão
        "60": 18, // ICMS cobrado por ST
        "70": 18, // Diferimento
        "90": 18, // Outras operações
        "101": 0, // Sem movimento
        "102": 0, // Microempresa
        "103": 0, // ME/EPP
        "300": 0, // Isenta
        "400": 0, // Não tributada
        "500": 0, // Suspensão
        "900": 0, // Outras
      },
      ipi: {
        "00": 0,
        "49": 0,
        "50": 0,
        "99": 0,
      },
      pis: {
        "01": 1.65,
        "02": 7.6,
        "03": 1.65,
        "04": 0,
        "05": 0,
        "06": 0,
        "07": 0,
        "08": 0,
        "09": 0,
      },
      cofins: {
        "01": 7.6,
        "02": 7.6,
        "03": 7.6,
        "04": 0,
        "05": 0,
        "06": 0,
        "07": 0,
        "08": 0,
        "09": 0,
      },
    };

    return aliquots[taxType]?.[cst] ?? 0;
  }

  static async fetchIbptTaxes(
    params: IbptQueryParams
  ): Promise<IbptTaxResult> {
    const endpoint = params.baseUrl ?? "https://api.ibpt.org.br/ibpt/consultar";
    const url = new URL(endpoint);
    url.searchParams.set("token", params.token);
    url.searchParams.set("cnpj", params.cnpj);
    url.searchParams.set("uf", params.uf);
    url.searchParams.set("codigo", params.codigo);
    url.searchParams.set("descricao", params.descricao);
    url.searchParams.set("unidade", params.unidade);
    url.searchParams.set("valor", params.valor.toString());
    if (params.gtin) url.searchParams.set("gtin", params.gtin);
    if (params.ex) url.searchParams.set("ex", params.ex);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      const message =
        typeof data?.message === "string" ? data.message : "Erro na API IBPT";
      throw new Error(message);
    }

    const toNumber = (value: unknown): number => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const normalized = value.replace(",", ".");
        const parsed = Number(normalized);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    return {
      federal: toNumber(data?.federal),
      estadual: toNumber(data?.estadual),
      municipal: toNumber(data?.municipal),
      importado: data?.importado !== undefined ? toNumber(data.importado) : undefined,
      total: data?.total !== undefined ? toNumber(data.total) : undefined,
      chave: typeof data?.chave === "string" ? data.chave : undefined,
      versao: typeof data?.versao === "string" ? data.versao : undefined,
      fonte: typeof data?.fonte === "string" ? data.fonte : undefined,
    };
  }
}
