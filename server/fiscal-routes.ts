import { Router } from "express";
import {
  NFeSalesValidationSchema,
  NFCeValidationSchema,
  NFSeValidationSchema,
  CTeValidationSchema,
  MDFeValidationSchema,
  isValidCNPJ,
  isValidCPF,
  isValidPlate,
} from "./fiscal-documents";
import { CFOPValidator } from "./cfop-validator";
import { CSOSNCalculator } from "./csosn-calculator";
import { TaxCalculator } from "./tax-calculator";
import { TaxMatrixService } from "./tax-matrix";
import { SefazService } from "./sefaz-service";
import { XMLSignatureService } from "./xml-signature";
import { NFCeContingencyService } from "./nfce-contingency";
import { storage } from "./storage";
import { requireAuth, getCompanyId } from "./middleware";

const CEST_REGEX = /^\d{7}$/;
const isCestRequired = (ncm?: string) => Boolean(ncm);
const nfceContingency = new NFCeContingencyService();

const router = Router();

// Adiciona flags de contingencia no XML NFC-e
const applyNFCeContingencyFlags = (xmlContent: string) => {
  const now = new Date().toISOString();
  let updated = xmlContent.replace(
    /<tpEmis>.*?<\/tpEmis>/,
    "<tpEmis>9</tpEmis>"
  );
  if (updated === xmlContent) {
    updated = updated.replace(
      /<ide>/,
      `<ide><tpEmis>9</tpEmis><dhCont>${now}</dhCont>`
    );
  } else {
    updated = updated.replace(/<dhCont>.*?<\/dhCont>/, `<dhCont>${now}</dhCont>`);
  }
  return updated.includes("<dhCont>")
    ? updated
    : updated.replace(/<ide>/, `<ide><dhCont>${now}</dhCont>`);
};

// ============================================
// NF-e (Modelo 55) Routes
// ============================================
router.post("/nfe/validate", requireAuth, async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const validation = NFeSalesValidationSchema.parse(req.body);
    const { ibptToken } = req.body as { ibptToken?: string };

    const companySettings = await storage.getCompanySettings(companyId);
    const taxRegime =
      (companySettings?.regimeTributario as
        | "Simples Nacional"
        | "Lucro Real"
        | "Lucro Presumido") ?? "Simples Nacional";

    // Validar CFOP
    const cfopResult = await CFOPValidator.validateCFOP(validation.cfopCode, {
      direction: "saida",
      scope: validation.scope,
      operationType: "venda",
      originState: validation.originState,
      destinyState: validation.destinyState,
      customerType: validation.customerType,
    });

    if (!cfopResult.valid) {
      return res.status(400).json({
        valid: false,
        error: cfopResult.error,
        suggestions: cfopResult.suggestions,
      });
    }

    const resolvedItems = [];

    // Validar CSOSN para cada item
    for (const item of validation.items) {
      const product = await storage.getProduct(item.productId, companyId);
      if (!product) {
        return res.status(400).json({
          valid: false,
          error: `Produto ${item.productId} não encontrado`,
        });
      }

      const ncm = item.ncm || product.ncm || undefined;
      const cest = product.cest;

      if (isCestRequired(ncm) && !cest) {
        return res.status(400).json({
          valid: false,
          error: `CEST obrigatório para o NCM ${ncm} (produto ${item.productId})`,
        });
      }

      if (cest && !CEST_REGEX.test(cest)) {
        return res.status(400).json({
          valid: false,
          error: `CEST inválido para o produto ${item.productId}`,
        });
      }

      const matrixResult = TaxMatrixService.resolve({
        customerType:
          validation.customerType === "consumidor"
            ? "consumidor_final"
            : "revenda",
        originUF: validation.originState,
        destinationUF: validation.destinyState,
        taxRegime,
      });

      if (item.cfop !== matrixResult.cfop) {
        return res.status(400).json({
          valid: false,
          error: `CFOP inválido para o item ${item.productId}`,
        });
      }

      if (matrixResult.csosn && item.csosn !== matrixResult.csosn) {
        return res.status(400).json({
          valid: false,
          error: `CSOSN inválido para o item ${item.productId}`,
        });
      }

      const csosnResult = await CSOSNCalculator.validateCSOSNxCFOP({
        cfopCode: item.cfop,
        csosnCode: item.csosn,
        direction: "saida",
      });

      if (!csosnResult.valid) {
        return res.status(400).json({
          valid: false,
          error: `Item inválido: ${csosnResult.error}`,
        });
      }

      const ibpt =
        ibptToken && companySettings?.cnpj && ncm
          ? await TaxCalculator.fetchIbptTaxes({
              token: ibptToken,
              cnpj: companySettings.cnpj,
              uf: validation.originState,
              codigo: ncm,
              descricao: item.description,
              unidade: item.unit,
              valor: item.totalValue,
            })
          : null;

      resolvedItems.push({
        ...item,
        ncm,
        cest,
        taxMatrix: matrixResult,
        ibpt,
      });
    }

    res.json({
      valid: true,
      cfop: cfopResult.cfop,
      items: resolvedItems,
      taxRegime,
      message: "NF-e validada com sucesso",
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : "Erro ao validar NF-e",
    });
  }
});

router.post("/nfe/calculate-taxes", async (req, res) => {
  try {
    const { items } = req.body;

    const calculations = [];
    let totalICMS = 0;
    let totalIPI = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;
    let totalISS = 0;
    let totalIRRF = 0;
    let totalTaxes = 0;
    let baseValue = 0;

    for (const item of items) {
      const taxes = TaxCalculator.calculateAllTaxes(
        item.quantity,
        item.unitPrice,
        item.icmsAliquot || 18,
        item.icmsReduction || 0,
        item.ipiAliquot || 0,
        item.pisAliquot || 0,
        item.cofinsAliquot || 0,
        item.issAliquot || 0,
        item.irrfAliquot || 0
      );

      const subtotal = item.quantity * item.unitPrice;
      baseValue += subtotal;
      totalICMS += taxes.icmsValue;
      totalIPI += taxes.ipiValue;
      totalPIS += taxes.pisValue;
      totalCOFINS += taxes.cofinsValue;
      totalISS += taxes.issValue;
      totalIRRF += taxes.irrfValue;
      totalTaxes += taxes.totalTaxes;

      calculations.push({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
        ...taxes,
      });
    }

    res.json({
      calculations,
      totals: {
        baseValue: Math.round(baseValue * 100) / 100,
        icmsTotal: Math.round(totalICMS * 100) / 100,
        ipiTotal: Math.round(totalIPI * 100) / 100,
        pisTotal: Math.round(totalPIS * 100) / 100,
        cofinsTotal: Math.round(totalCOFINS * 100) / 100,
        issTotal: Math.round(totalISS * 100) / 100,
        irrfTotal: Math.round(totalIRRF * 100) / 100,
        totalTaxes: Math.round(totalTaxes * 100) / 100,
        grossTotal: Math.round((baseValue + totalTaxes) * 100) / 100,
      },
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Erro ao calcular impostos",
    });
  }
});

// ============================================
// NFC-e (Modelo 65) Routes
// ============================================
router.post("/nfce/validate", async (req, res) => {
  try {
    const validation = NFCeValidationSchema.parse(req.body);

    // Validar CPF se fornecido
    if (validation.customerCPF && !isValidCPF(validation.customerCPF)) {
      return res.status(400).json({
        valid: false,
        error: "CPF do cliente inválido",
      });
    }

    // Validar CFOP (sempre 5103 ou 6103 para NFC-e)
    if (!["5103", "6103"].includes(validation.cfopCode)) {
      return res.status(400).json({
        valid: false,
        error: "NFC-e deve usar CFOP 5103 (interna) ou 6103 (interestadual)",
      });
    }

    res.json({
      valid: true,
      message: "NFC-e validada com sucesso",
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : "Erro ao validar NFC-e",
    });
  }
});

// Salva NFC-e em contingencia (offline)
router.post("/nfce/contingency/save", requireAuth, async (req, res) => {
  try {
    const { xmlContent } = req.body;
    if (!xmlContent) {
      return res.status(400).json({ error: "XML content e obrigatorio" });
    }

    const flaggedXml = applyNFCeContingencyFlags(xmlContent);
    const saved = nfceContingency.enqueue(flaggedXml);

    res.json({
      success: true,
      message: "NFC-e salva em contingencia offline",
      id: saved.id,
      createdAt: saved.createdAt,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Erro ao salvar NFC-e em contingencia",
    });
  }
});

// Lista NFC-e pendentes de reenvio
router.get("/nfce/contingency/pending", requireAuth, async (_req, res) => {
  res.json(nfceContingency.listPending());
});

// Dispara reenvio manual imediato
router.post("/nfce/contingency/resend", requireAuth, async (_req, res) => {
  try {
    await nfceContingency.resendAll();
    res.json({ success: true, message: "Reenvio de NFC-e em contingencia iniciado" });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Erro ao reenviar NFC-e em contingencia",
    });
  }
});

// Iniciar rotina de reenvio automatico (handler deve ser configurado em tempo de execucao)
nfceContingency.startAutoResend();

// ============================================
// NFS-e Routes
// ============================================
router.post("/nfse/validate", async (req, res) => {
  try {
    const validation = NFSeValidationSchema.parse(req.body);

    // Validar código de serviço (LC 116/03 - CNAE)
    if (!validation.serviceCode.match(/^\d{4}\d{2}$/)) {
      return res.status(400).json({
        valid: false,
        error: "Código de serviço inválido (deve ser 6 dígitos)",
      });
    }

    res.json({
      valid: true,
      message: "NFS-e validada com sucesso",
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : "Erro ao validar NFS-e",
    });
  }
});

// ============================================
// CT-e Routes
// ============================================
router.post("/cte/validate", async (req, res) => {
  try {
    const validation = CTeValidationSchema.parse(req.body);

    // Validar tipo de transporte
    const validTransportTypes: Record<string, string> = {
      "01": "Rodovia",
      "02": "Ferrovia",
      "03": "Aerovia",
      "04": "Hidrovia",
      "05": "Dutoduvia",
      "06": "Multimodal",
    };

    if (!validTransportTypes[validation.transportationType]) {
      return res.status(400).json({
        valid: false,
        error: "Tipo de transporte inválido",
      });
    }

    res.json({
      valid: true,
      message: "CT-e validado com sucesso",
      transportationType: validTransportTypes[validation.transportationType],
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : "Erro ao validar CT-e",
    });
  }
});

// ============================================
// MDF-e Routes
// ============================================
router.post("/mdfe/validate", async (req, res) => {
  try {
    const validation = MDFeValidationSchema.parse(req.body);

    // Validar placa
    if (!isValidPlate(validation.vehiclePlate)) {
      return res.status(400).json({
        valid: false,
        error: "Placa de veículo inválida",
      });
    }

    // Validar documentos
    const validDocTypes = ["NF-e", "NFC-e", "CT-e", "NFS-e"];
    for (const doc of validation.documents) {
      if (!validDocTypes.includes(doc.documentType)) {
        return res.status(400).json({
          valid: false,
          error: `Tipo de documento inválido: ${doc.documentType}`,
        });
      }
    }

    const totalValue = validation.documents.reduce(
      (sum, doc) => sum + doc.value,
      0
    );

    res.json({
      valid: true,
      message: "MDF-e validado com sucesso",
      totalValue,
      documentCount: validation.documents.length,
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error instanceof Error ? error.message : "Erro ao validar MDF-e",
    });
  }
});

// ============================================
// Validações auxiliares
// ============================================

router.post("/validate/cnpj", (req, res) => {
  const { cnpj } = req.body;

  if (!cnpj) {
    return res.status(400).json({ valid: false, error: "CNPJ não fornecido" });
  }

  const valid = isValidCNPJ(cnpj);
  res.json({
    valid,
    cnpj: cnpj.replace(/[^\d]/g, ""),
    message: valid ? "CNPJ válido" : "CNPJ inválido",
  });
});

router.post("/validate/cpf", (req, res) => {
  const { cpf } = req.body;

  if (!cpf) {
    return res.status(400).json({ valid: false, error: "CPF não fornecido" });
  }

  const valid = isValidCPF(cpf);
  res.json({
    valid,
    cpf: cpf.replace(/[^\d]/g, ""),
    message: valid ? "CPF válido" : "CPF inválido",
  });
});

router.post("/validate/plate", (req, res) => {
  const { plate } = req.body;

  if (!plate) {
    return res.status(400).json({ valid: false, error: "Placa não fornecida" });
  }

  const valid = isValidPlate(plate);
  res.json({
    valid,
    plate: plate.toUpperCase(),
    message: valid
      ? "Placa válida"
      : "Placa inválida (use formato XXX-9999 ou XXX9X99)",
  });
});

// Get supported CFOP for a context
router.get("/cfop/suggestions", async (req, res) => {
  try {
    const { direction, scope } = req.query;

    if (!direction || !scope) {
      return res.status(400).json({
        error: "direction e scope são obrigatórios",
      });
    }

    const suggestions = await CFOPValidator.getValidCFOPsForContext({
      direction: direction as "entrada" | "saida",
      scope: scope as "interna" | "interestadual" | "exterior",
      operationType: "venda",
    });

    res.json(suggestions);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Erro ao buscar sugestões de CFOP",
    });
  }
});

// Get all CSOSN codes
router.get("/csosn/all", async (req, res) => {
  try {
    const csosns = await CSOSNCalculator.getAllCSOSNs();
    res.json(csosns);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Erro ao buscar CSOSN",
    });
  }
});

// ============================================
// SEFAZ INTEGRATION ROUTES
// ============================================

// Gerar NF-e com assinatura automática
router.post("/nfe/generate", requireAuth, async (req, res) => {
  try {
    const { config, series = "1", environment = "homologacao" } = req.body;
    const companyId = getCompanyId(req);

    if (!config) {
      return res
        .status(400)
        .json({ error: "Configuração de NF-e é obrigatória" });
    }

    if (!companyId) {
      return res.status(401).json({ error: "Empresa não identificada" });
    }

    // Obter certificado da empresa
    const { CertificateService } = await import("./certificate-service");
    const certService = new CertificateService();
    const certificateBuffer = await certService.getCertificate(companyId);
    const certificatePassword = await certService.getCertificatePassword(
      companyId
    );

    if (!certificateBuffer || !certificatePassword) {
      return res.status(400).json({
        error: "Certificado digital não configurado para esta empresa",
      });
    }

    // Gerar XML com assinatura
    const { NFEGenerator } = await import("./nfe-generator");
    const nfeResult = NFEGenerator.generateXML(
      config,
      series,
      certificateBuffer,
      certificatePassword
    );

    res.json({
      success: true,
      xml: nfeResult.xml,
      signed: nfeResult.signed,
      message: `NF-e ${nfeResult.signed ? "assinada" : "gerada"}`,
      readyForSubmission: nfeResult.signed,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Erro ao gerar NF-e",
    });
  }
});

// Listar notas fiscais pendentes de envio
router.get("/nfe/pending", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Erro ao buscar NF-es pendentes",
    });
  }
});

// Submeter NF-e para SEFAZ com assinatura automática
// Submeter NF-e para SEFAZ com assinatura automatica
router.post("/sefaz/submit", requireAuth, async (req, res) => {
  try {
    const { xmlContent, environment = "homologacao", uf } = req.body;
    const companyId = getCompanyId(req);

    if (!xmlContent) {
      return res.status(400).json({ error: "XML content e obrigatorio" });
    }

    if (!uf) {
      return res.status(400).json({ error: "UF e obrigatoria" });
    }

    if (!companyId) {
      return res.status(401).json({ error: "Empresa nao identificada" });
    }

    const { CertificateService } = await import("./certificate-service");
    const certService = new CertificateService();
    const certificateBuffer = await certService.getCertificate(companyId);
    const certificatePassword = await certService.getCertificatePassword(companyId);

    if (!certificateBuffer || !certificatePassword) {
      return res.status(400).json({
        error: "Certificado digital nao configurado para esta empresa",
      });
    }

    let signedXml = xmlContent;
    let signed = false;
    try {
      const certificateBase64 = certificateBuffer.toString("base64");
      signedXml = XMLSignatureService.signXML(
        xmlContent,
        certificateBase64,
        certificatePassword
      );
      signed = true;
    } catch (signError) {
      console.error("Erro ao assinar XML:", signError);
      return res.status(400).json({
        error: `Falha ao assinar XML: ${
          signError instanceof Error ? signError.message : "Desconhecido"
        }`,
      });
    }

    const sefazService = new SefazService({
      environment: environment as "homologacao" | "producao",
      uf,
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.submitNFe(signedXml);
    res.json({
      ...result,
      signed,
      message: `NF-e ${signed ? "assinada" : "gerada"} e enviada para SEFAZ`,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Erro ao submeter NF-e",
    });
  }
});

// Consultar Recibo SEFAZ
router.post("/sefaz/receipt", async (req, res) => {
  try {
    const { xmlContent, environment = "homologacao", uf, sefazUrl } = req.body;

    if (!xmlContent) {
      return res.status(400).json({ error: "XML content é obrigatório" });
    }

    if (!uf) {
      return res.status(400).json({ error: "UF é obrigatória" });
    }

    const sefazService = new SefazService({
      environment: environment as "homologacao" | "producao",
      uf,
      certificatePath: "",
      certificatePassword: "",
      sefazUrl,
    });

    const result = await sefazService.queryReceipt(xmlContent);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Erro ao consultar recibo",
    });
  }
});

export default router;
