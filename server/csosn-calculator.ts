import { db } from "./db";
import { cstCodes, taxAliquots } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface CSOSNValidationContext {
  cfopCode: string;
  csosnCode: string;
  direction: "entrada" | "saida";
}

export interface CSOSNValidationResult {
  valid: boolean;
  csosn?: {
    code: string;
    description: string;
    codeType: string;
    regime: string;
  };
  error?: string;
}

export interface ICMSCalculationRequest {
  baseValue: number;
  csosnCode: string;
  companyState: string;
  destinationState?: string;
  icmsAliquot?: number;
  icmsReduction?: number;
}

export interface ICMSCalculationResult {
  baseValue: number;
  csosnCode: string;
  csosnDescription: string;
  icmsOwnTax: number;
  icmsSTTax: number;
  totalICMS: number;
  observations: string[];
}

export class CSOSNCalculator {
  // CSOSN Regime rules
  static readonly CSOSN_SIMPLE_NATIONAL = {
    101: {
      description: "Tributada com crédito",
      hasOwnICMS: true,
      hasST: false,
      allowsCredit: true,
    },
    102: {
      description: "Tributada sem crédito",
      hasOwnICMS: true,
      hasST: false,
      allowsCredit: false,
    },
    103: {
      description: "Isenção",
      hasOwnICMS: false,
      hasST: false,
      allowsCredit: false,
    },
    201: {
      description: "Substituição tributária",
      hasOwnICMS: false,
      hasST: true,
      allowsCredit: false,
    },
    202: {
      description: "Com ST (Substituição Tributária) - parte não retida",
      hasOwnICMS: true,
      hasST: true,
      allowsCredit: false,
    },
    203: {
      description: "Com ST (Substituição Tributária) - isenta do ST",
      hasOwnICMS: false,
      hasST: false,
      allowsCredit: false,
    },
    300: {
      description: "Imune",
      hasOwnICMS: false,
      hasST: false,
      allowsCredit: false,
    },
    400: {
      description: "Não tributada",
      hasOwnICMS: false,
      hasST: false,
      allowsCredit: false,
    },
    500: {
      description: "Diferimento",
      hasOwnICMS: false,
      hasST: false,
      allowsCredit: false,
    },
    900: {
      description: "Outros",
      hasOwnICMS: false,
      hasST: false,
      allowsCredit: false,
    },
  };

  static async validateCSOSNxCFOP(
    context: CSOSNValidationContext
  ): Promise<CSOSNValidationResult> {
    try {
      const [csosn] = await db
        .select()
        .from(cstCodes)
        .where(
          and(
            eq(cstCodes.code, context.csosnCode),
            eq(cstCodes.codeType, "CSOSN"),
            eq(cstCodes.regime, "Simples Nacional")
          )
        );

      if (!csosn) {
        return {
          valid: false,
          error: `CSOSN ${context.csosnCode} não encontrado para Simples Nacional`,
        };
      }

      // Validações básicas CSOSN x CFOP
      const csosnNum = parseInt(context.csosnCode);

      // ST (201-203) é para saída apenas
      if ([201, 202, 203].includes(csosnNum) && context.direction !== "saida") {
        return {
          valid: false,
          error: `CSOSN ${context.csosnCode} (ST) é válido apenas para saída`,
        };
      }

      // 101-103 podem ser para entrada e saída
      if ([101, 102, 103].includes(csosnNum)) {
        // Validação adicional por tipo de operação se necessário
      }

      return {
        valid: true,
        csosn: {
          code: csosn.code,
          description: csosn.description,
          codeType: csosn.codeType,
          regime: csosn.regime,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: `Erro ao validar CSOSN: ${
          error instanceof Error ? error.message : "desconhecido"
        }`,
      };
    }
  }

  static async calculateICMS(
    request: ICMSCalculationRequest
  ): Promise<ICMSCalculationResult> {
    const observations: string[] = [];
    let icmsOwnTax = 0;
    let icmsSTTax = 0;

    try {
      const [csosn] = await db
        .select()
        .from(cstCodes)
        .where(
          and(
            eq(cstCodes.code, request.csosnCode),
            eq(cstCodes.codeType, "CSOSN"),
            eq(cstCodes.regime, "Simples Nacional")
          )
        );

      if (!csosn) {
        throw new Error(`CSOSN ${request.csosnCode} não encontrado`);
      }

      const csosnNum = parseInt(request.csosnCode);
      const csosnRules =
        this.CSOSN_SIMPLE_NATIONAL[
          csosnNum as keyof typeof this.CSOSN_SIMPLE_NATIONAL
        ];

      if (!csosnRules) {
        throw new Error(
          `CSOSN ${request.csosnCode} não possui regras definidas`
        );
      }

      const baseValue = request.baseValue;

      // Cálculo de ICMS próprio
      if (csosnRules.hasOwnICMS && request.icmsAliquot) {
        const aliquot = request.icmsAliquot;
        const reduction = request.icmsReduction || 0;
        const reducedAliquot = aliquot - reduction;

        icmsOwnTax = (baseValue * reducedAliquot) / 100;

        observations.push(
          `ICMS próprio: ${reducedAliquot}% de R$ ${baseValue.toFixed(
            2
          )} = R$ ${icmsOwnTax.toFixed(2)}`
        );

        if (reduction > 0) {
          observations.push(`Redução de base aplicada: ${reduction}%`);
        }
      }

      // Cálculo de ICMS ST
      if (csosnRules.hasST) {
        if (csosnNum === 201) {
          // 201: Substituição tributária (sem ICMS próprio)
          observations.push("CSOSN 201: Substituição tributária aplicada");
          observations.push(
            "O ICMS é retido pelo substituto tributário na operação anterior"
          );
        } else if (csosnNum === 202) {
          // 202: ST mas com parte não retida
          observations.push(
            "CSOSN 202: Substituição tributária com parte não retida"
          );
          observations.push("Aplicar alíquota de substituição tributária");
        } else if (csosnNum === 203) {
          // 203: Isenta do ST
          observations.push("CSOSN 203: Isento de substituição tributária");
        }
      }

      // Observações por código
      switch (csosnNum) {
        case 101:
          observations.push("Contribuinte do ICMS: aproveita crédito integral");
          break;
        case 102:
          observations.push(
            "Contribuinte do ICMS: não aproveita crédito (operação interna ou substituta)"
          );
          break;
        case 103:
          observations.push("Operação isenta do ICMS");
          break;
        case 300:
          observations.push("Operação imune do ICMS (ex: livros, jornais)");
          break;
        case 400:
          observations.push("Operação não tributada pelo ICMS");
          break;
        case 500:
          observations.push(
            "Operação com diferimento: ICMS é diferido para etapa posterior"
          );
          break;
        case 900:
          observations.push(
            "Outras operações: verificar regulamentação específica"
          );
          break;
      }

      return {
        baseValue: request.baseValue,
        csosnCode: request.csosnCode,
        csosnDescription: csosn.description,
        icmsOwnTax: parseFloat(icmsOwnTax.toFixed(2)),
        icmsSTTax: parseFloat(icmsSTTax.toFixed(2)),
        totalICMS: parseFloat((icmsOwnTax + icmsSTTax).toFixed(2)),
        observations,
      };
    } catch (error) {
      throw new Error(
        `Erro ao calcular ICMS: ${
          error instanceof Error ? error.message : "desconhecido"
        }`
      );
    }
  }

  static async getAllCSOSNs() {
    return await db
      .select()
      .from(cstCodes)
      .where(
        and(
          eq(cstCodes.codeType, "CSOSN"),
          eq(cstCodes.regime, "Simples Nacional")
        )
      );
  }

  static async getCSOSNByCode(code: string) {
    const [csosn] = await db
      .select()
      .from(cstCodes)
      .where(
        and(
          eq(cstCodes.code, code),
          eq(cstCodes.codeType, "CSOSN"),
          eq(cstCodes.regime, "Simples Nacional")
        )
      );
    return csosn;
  }
}
