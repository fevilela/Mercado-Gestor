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

const parseRulesFromEnv = (): TaxMatrixRule[] => {
  const raw = process.env.TAX_MATRIX_RULES_JSON;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((rule) => rule && typeof rule === "object")
      .map((rule): TaxMatrixRule => {
        const typed = rule as Record<string, unknown>;
        const customerType: CustomerType =
          typed.customerType === "revenda" ? "revenda" : "consumidor_final";
        const regime: TaxRegime =
          typed.regime === "Lucro Real" || typed.regime === "Lucro Presumido"
            ? (typed.regime as TaxRegime)
            : "Simples Nacional";

        return {
          customerType,
          interstate: Boolean(typed.interstate),
          regime,
          cfop: String(typed.cfop || "").trim(),
          cst: typed.cst ? String(typed.cst).trim() : undefined,
          csosn: typed.csosn ? String(typed.csosn).trim() : undefined,
        };
      })
      .filter((rule) => rule.cfop.length === 4);
  } catch {
    return [];
  }
};

const resolveDefaultRule = (
  context: TaxMatrixContext,
  interstate: boolean,
): TaxMatrixRule => {
  const cfop =
    context.customerType === "revenda"
      ? interstate
        ? "6102"
        : "5102"
      : interstate
        ? "6103"
        : "5103";

  if (context.taxRegime === "Simples Nacional") {
    return {
      customerType: context.customerType,
      interstate,
      regime: context.taxRegime,
      cfop,
      csosn: context.customerType === "revenda" ? "101" : "102",
    };
  }

  return {
    customerType: context.customerType,
    interstate,
    regime: context.taxRegime,
    cfop,
    cst: "00",
  };
};

export class TaxMatrixService {
  private static runtimeRules: TaxMatrixRule[] = [];

  static setRules(rules: TaxMatrixRule[]) {
    this.runtimeRules = Array.isArray(rules) ? [...rules] : [];
  }

  static resolve(context: TaxMatrixContext): TaxMatrixResult {
    const interstate =
      context.originUF.toUpperCase() !== context.destinationUF.toUpperCase();

    const mergedRules = [
      ...this.runtimeRules,
      ...parseRulesFromEnv(),
      resolveDefaultRule(context, interstate),
    ];

    const rule = mergedRules.find(
      (item) =>
        item.customerType === context.customerType &&
        item.interstate === interstate &&
        item.regime === context.taxRegime,
    );

    if (!rule) {
      throw new Error("Matriz tributaria nao encontrada para o contexto");
    }

    return {
      cfop: rule.cfop,
      cst: rule.cst,
      csosn: rule.csosn,
    };
  }
}
