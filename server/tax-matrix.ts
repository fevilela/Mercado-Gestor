export type CustomerType = "consumidor_final" | "revenda";
export type TaxRegime = "Simples Nacional" | "Lucro Real" | "Lucro Presumido";

export interface TaxMatrixContext {
  customerType: CustomerType;
  originUF: string;
  destinationUF: string;
  taxRegime: TaxRegime;
}

export interface TaxMatrixResult {
  cfop: string;
  cst?: string;
  csosn?: string;
}

interface TaxMatrixRule {
  customerType: CustomerType;
  interstate: boolean;
  regime: TaxRegime;
  cfop: string;
  cst?: string;
  csosn?: string;
}

const TAX_MATRIX_RULES: TaxMatrixRule[] = [
  {
    customerType: "consumidor_final",
    interstate: false,
    regime: "Simples Nacional",
    cfop: "5103",
    csosn: "102",
  },
  {
    customerType: "consumidor_final",
    interstate: true,
    regime: "Simples Nacional",
    cfop: "6103",
    csosn: "102",
  },
  {
    customerType: "revenda",
    interstate: false,
    regime: "Simples Nacional",
    cfop: "5102",
    csosn: "101",
  },
  {
    customerType: "revenda",
    interstate: true,
    regime: "Simples Nacional",
    cfop: "6102",
    csosn: "101",
  },
  {
    customerType: "consumidor_final",
    interstate: false,
    regime: "Lucro Real",
    cfop: "5103",
    cst: "00",
  },
  {
    customerType: "consumidor_final",
    interstate: true,
    regime: "Lucro Real",
    cfop: "6103",
    cst: "00",
  },
  {
    customerType: "revenda",
    interstate: false,
    regime: "Lucro Real",
    cfop: "5102",
    cst: "00",
  },
  {
    customerType: "revenda",
    interstate: true,
    regime: "Lucro Real",
    cfop: "6102",
    cst: "00",
  },
  {
    customerType: "consumidor_final",
    interstate: false,
    regime: "Lucro Presumido",
    cfop: "5103",
    cst: "00",
  },
  {
    customerType: "consumidor_final",
    interstate: true,
    regime: "Lucro Presumido",
    cfop: "6103",
    cst: "00",
  },
  {
    customerType: "revenda",
    interstate: false,
    regime: "Lucro Presumido",
    cfop: "5102",
    cst: "00",
  },
  {
    customerType: "revenda",
    interstate: true,
    regime: "Lucro Presumido",
    cfop: "6102",
    cst: "00",
  },
];

export class TaxMatrixService {
  static resolve(context: TaxMatrixContext): TaxMatrixResult {
    const interstate =
      context.originUF.toUpperCase() !== context.destinationUF.toUpperCase();
    const rule = TAX_MATRIX_RULES.find(
      (item) =>
        item.customerType === context.customerType &&
        item.interstate === interstate &&
        item.regime === context.taxRegime
    );

    if (!rule) {
      throw new Error("Matriz tributária não encontrada para o contexto");
    }

    return {
      cfop: rule.cfop,
      cst: rule.cst,
      csosn: rule.csosn,
    };
  }
}
