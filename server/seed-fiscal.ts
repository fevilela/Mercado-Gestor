import { db } from "./db";
import { cfopCodes, cstCodes } from "@shared/schema";

export async function seedFiscalData() {
  try {
    const cfopData = [
      {
        code: "1102",
        description: "Compra para revenda",
        type: "entrada",
        operationType: "compra",
        scope: "interna",
      },
      {
        code: "1201",
        description: "Devolução de venda",
        type: "entrada",
        operationType: "devolução",
        scope: "interna",
      },
      {
        code: "2102",
        description: "Compra para revenda",
        type: "entrada",
        operationType: "compra",
        scope: "interestadual",
      },
      {
        code: "2201",
        description: "Devolução de venda",
        type: "entrada",
        operationType: "devolução",
        scope: "interestadual",
      },
      {
        code: "5102",
        description: "Venda de mercadoria",
        type: "saida",
        operationType: "venda",
        scope: "interna",
      },
      {
        code: "5202",
        description: "Devolução de compra",
        type: "saida",
        operationType: "devolução",
        scope: "interna",
      },
      {
        code: "6102",
        description: "Venda de mercadoria",
        type: "saida",
        operationType: "venda",
        scope: "interestadual",
      },
      {
        code: "6202",
        description: "Devolução de compra",
        type: "saida",
        operationType: "devolução",
        scope: "interestadual",
      },
      {
        code: "5103",
        description: "Venda ao consumidor final",
        type: "saida",
        operationType: "venda",
        scope: "interna",
      },
      {
        code: "6103",
        description: "Venda ao consumidor final",
        type: "saida",
        operationType: "venda",
        scope: "interestadual",
      },
    ];

    const cstData = [
      {
        code: "101",
        description: "Tributada com crédito",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "102",
        description: "Tributada sem crédito",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "103",
        description: "Isenção",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "201",
        description: "Substituição tributária",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "300",
        description: "Imune",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "400",
        description: "Não tributada",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "500",
        description: "Diferimento",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "900",
        description: "Outros",
        codeType: "CSOSN",
        taxType: "ICMS",
        regime: "Simples Nacional",
      },
      {
        code: "00",
        description: "Tributação normal",
        codeType: "CST",
        taxType: "ICMS",
        regime: "Lucro Real",
      },
      {
        code: "10",
        description: "Com substituição tributária",
        codeType: "CST",
        taxType: "ICMS",
        regime: "Lucro Real",
      },
    ];

    await db.insert(cfopCodes).values(cfopData).onConflictDoNothing();
    await db.insert(cstCodes).values(cstData).onConflictDoNothing();

    console.log("✓ Fiscal data seeded successfully");
  } catch (error) {
    console.error("Error seeding fiscal data:", error);
  }
}
