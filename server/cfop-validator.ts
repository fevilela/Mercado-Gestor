import { db } from "./db";
import { cfopCodes } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface CFOPValidationContext {
  direction: "entrada" | "saida";
  scope: "interna" | "interestadual" | "exterior";
  operationType:
    | "venda"
    | "devolução"
    | "bonificação"
    | "remessa"
    | "industrialização"
    | "compra"
    | "outros";
  originState?: string;
  destinyState?: string;
  customerType?: "contribuinte" | "nao-contribuinte" | "consumidor";
}

export interface CFOPValidationResult {
  valid: boolean;
  cfop?: {
    code: string;
    description: string;
    type: string;
    operationType: string;
    scope: string;
  };
  error?: string;
  suggestions?: Array<{
    code: string;
    description: string;
  }>;
}

export class CFOPValidator {
  static async validateCFOP(
    cfopCode: string,
    context: CFOPValidationContext
  ): Promise<CFOPValidationResult> {
    try {
      const [cfop] = await db
        .select()
        .from(cfopCodes)
        .where(eq(cfopCodes.code, cfopCode));

      if (!cfop) {
        return {
          valid: false,
          error: `CFOP ${cfopCode} não encontrado no sistema`,
          suggestions: await this.suggestValidCFOPs(context),
        };
      }

      // Validações básicas
      if (cfop.type !== context.direction) {
        return {
          valid: false,
          error: `CFOP ${cfopCode} é para ${cfop.type}, mas operação é ${context.direction}`,
          suggestions: await this.suggestValidCFOPs(context),
        };
      }

      if (cfop.scope !== context.scope) {
        return {
          valid: false,
          error: `CFOP ${cfopCode} é para operação ${cfop.scope}, mas operação é ${context.scope}`,
          suggestions: await this.suggestValidCFOPs(context),
        };
      }

      // Validações adicionais por tipo de operação
      if (
        context.operationType === "venda" &&
        !cfop.operationType.toLowerCase().includes("venda")
      ) {
        if (!cfop.operationType.toLowerCase().includes("consumidor")) {
          return {
            valid: false,
            error: `CFOP ${cfopCode} não é adequado para venda`,
            suggestions: await this.suggestValidCFOPs(context),
          };
        }
      }

      // Validação de devolução
      if (
        context.operationType === "devolução" &&
        !cfop.description.toLowerCase().includes("devolução")
      ) {
        return {
          valid: false,
          error: `CFOP ${cfopCode} não é adequado para devolução`,
          suggestions: await this.suggestValidCFOPs(context),
        };
      }

      // Validações de UF (origem/destino)
      if (context.scope === "interestadual") {
        if (
          context.originState &&
          context.destinyState &&
          context.originState === context.destinyState
        ) {
          return {
            valid: false,
            error: `Operação interestadual não pode ter origem e destino no mesmo estado`,
            suggestions: await this.suggestValidCFOPs(context),
          };
        }
      }

      // Validação de tipo de cliente para saída
      if (context.direction === "saida" && context.customerType) {
        if (context.customerType === "consumidor") {
          // Para consumidor final, usar CFOP 5103 (interna) ou 6103 (interestadual)
          if (!cfop.code.match(/5103|6103/)) {
            if (!cfop.description.toLowerCase().includes("consumidor final")) {
              return {
                valid: false,
                error: `Para venda a consumidor final, deve-se usar CFOP adequado (5103 ou 6103)`,
                suggestions: await this.suggestValidCFOPs(context),
              };
            }
          }
        }
      }

      return {
        valid: true,
        cfop: {
          code: cfop.code,
          description: cfop.description,
          type: cfop.type,
          operationType: cfop.operationType,
          scope: cfop.scope,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: `Erro ao validar CFOP: ${
          error instanceof Error ? error.message : "desconhecido"
        }`,
      };
    }
  }

  static async suggestValidCFOPs(
    context: CFOPValidationContext
  ): Promise<Array<{ code: string; description: string }>> {
    try {
      const suggestions = await db
        .select({
          code: cfopCodes.code,
          description: cfopCodes.description,
        })
        .from(cfopCodes)
        .where(
          and(
            eq(cfopCodes.type, context.direction),
            eq(cfopCodes.scope, context.scope)
          )
        )
        .limit(5);

      return suggestions;
    } catch {
      return [];
    }
  }

  static async getValidCFOPsForContext(context: CFOPValidationContext): Promise<
    Array<{
      code: string;
      description: string;
      operationType: string;
    }>
  > {
    try {
      const query = await db
        .select({
          code: cfopCodes.code,
          description: cfopCodes.description,
          operationType: cfopCodes.operationType,
        })
        .from(cfopCodes)
        .where(
          and(
            eq(cfopCodes.type, context.direction),
            eq(cfopCodes.scope, context.scope)
          )
        );

      // Filtrar por tipo de operação se especificado
      if (context.operationType) {
        return query.filter((cfop) =>
          cfop.operationType
            .toLowerCase()
            .includes(context.operationType.toLowerCase())
        );
      }

      return query;
    } catch {
      return [];
    }
  }

  static async getAllCFOPs(): Promise<
    Array<{
      code: string;
      description: string;
      type: string;
      operationType: string;
      scope: string;
    }>
  > {
    try {
      return await db.select().from(cfopCodes);
    } catch {
      return [];
    }
  }
}
