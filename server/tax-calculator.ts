// Calculadora de impostos para documentos fiscais
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

export class TaxCalculator {
  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  static calculateICMS(
    baseValue: number,
    aliquot: number,
    reduction: number = 0,
  ): number {
    const effectiveAliquot = aliquot * (1 - reduction / 100);
    return (baseValue * effectiveAliquot) / 100;
  }

  static calculateIPI(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  static calculatePIS(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  static calculateCOFINS(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  static calculateISS(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  static calculateIRRF(baseValue: number, aliquot: number): number {
    return (baseValue * aliquot) / 100;
  }

  static calculateAllTaxes(
    quantity: number,
    unitPrice: number,
    icmsAliquot: number = 0,
    icmsReduction: number = 0,
    ipiAliquot: number = 0,
    pisAliquot: number = 0,
    cofinsAliquot: number = 0,
    issAliquot: number = 0,
    irrfAliquot: number = 0,
  ): TaxCalculation {
    const subtotal = quantity * unitPrice;

    const icmsValue = this.calculateICMS(subtotal, icmsAliquot, icmsReduction);
    const ipiValue = this.calculateIPI(subtotal, ipiAliquot);
    const pisValue = this.calculatePIS(subtotal, pisAliquot);
    const cofinsValue = this.calculateCOFINS(subtotal, cofinsAliquot);
    const issValue = this.calculateISS(subtotal, issAliquot);
    const irrfValue = this.calculateIRRF(subtotal, irrfAliquot);

    return {
      icmsValue: this.round2(icmsValue),
      icmsAliquot,
      ipiValue: this.round2(ipiValue),
      ipiAliquot,
      pisValue: this.round2(pisValue),
      pisAliquot,
      cofinsValue: this.round2(cofinsValue),
      cofinsAliquot,
      issValue: this.round2(issValue),
      issAliquot,
      irrfValue: this.round2(irrfValue),
      irrfAliquot,
      totalTaxes: this.round2(
        icmsValue + ipiValue + pisValue + cofinsValue + issValue + irrfValue,
      ),
    };
  }

  static calculateIBPT(baseValue: number, ibptRate: number): number {
    return (baseValue * ibptRate) / 100;
  }

  static getDefaultAliquotByCST(
    cst: string,
    taxType: "icms" | "ipi" | "pis" | "cofins" = "icms",
  ): number {
    const aliquots: Record<string, Record<string, number>> = {
      icms: {
        "00": 18,
        "10": 18,
        "20": 0,
        "30": 0,
        "40": 0,
        "41": 0,
        "50": 0,
        "60": 18,
        "70": 18,
        "90": 18,
        "101": 0,
        "102": 0,
        "103": 0,
        "300": 0,
        "400": 0,
        "500": 0,
        "900": 0,
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

  static async fetchIbptTaxes(params: {
    token: string;
    cnpj: string;
    uf: string;
    codigo: string;
    descricao: string;
    unidade: string;
    valor: number;
  }): Promise<{
    nacional: number;
    importado: number;
    estadual: number;
    municipal: number;
    fonte: string;
  }> {
    const fallback = () => {
      const base = params.valor || 0;
      return {
        nacional: this.round2(base * 0.03),
        importado: this.round2(base * 0.035),
        estadual: this.round2(base * 0.01),
        municipal: this.round2(base * 0.005),
        fonte: "simulado",
      };
    };

    const token = String(params.token || "").trim();
    const cnpj = String(params.cnpj || "").replace(/\D/g, "");
    const uf = String(params.uf || "").toUpperCase().slice(0, 2);
    const codigo = String(params.codigo || "").replace(/\D/g, "");
    const descricao = String(params.descricao || "").trim();
    const unidade = String(params.unidade || "").trim() || "UN";
    const valor = Number(params.valor || 0);

    if (!token || cnpj.length !== 14 || !uf || !codigo || valor <= 0) {
      return fallback();
    }

    const endpoint = "https://apidoni.ibpt.org.br/api/v1/produtos";
    const query = new URLSearchParams({
      token,
      cnpj,
      codigo,
      uf,
      ex: "0",
      descricao: descricao || "PRODUTO",
      unidade,
      valor: valor.toFixed(2),
      gtin: "",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${endpoint}?${query.toString()}`, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        return fallback();
      }

      const payload = (await response.json()) as any;
      const data = Array.isArray(payload) ? payload[0] || {} : payload || {};

      const nacional = Number(data.nacional ?? data.Nacional ?? 0);
      const importado = Number(data.importado ?? data.Importado ?? 0);
      const estadual = Number(data.estadual ?? data.Estadual ?? 0);
      const municipal = Number(data.municipal ?? data.Municipal ?? 0);

      return {
        nacional: this.round2(Number.isFinite(nacional) ? nacional : 0),
        importado: this.round2(Number.isFinite(importado) ? importado : 0),
        estadual: this.round2(Number.isFinite(estadual) ? estadual : 0),
        municipal: this.round2(Number.isFinite(municipal) ? municipal : 0),
        fonte: String(data.fonte ?? data.Fonte ?? "IBPT"),
      };
    } catch {
      return fallback();
    } finally {
      clearTimeout(timeout);
    }
  }
}
