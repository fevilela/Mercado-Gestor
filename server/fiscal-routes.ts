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
import {
  requireAuth,
  getCompanyId,
  requirePermission,
  requireValidFiscalCertificate,
} from "./middleware";

const CEST_REGEX = /^\d{7}$/;
const isCestRequired = (ncm?: string) => Boolean(ncm);
const nfceContingency = new NFCeContingencyService();

const router = Router();

const extractAccessKey = (xmlContent: string): string => {
  const chMatch = xmlContent.match(/<chNFe>(\d{44})<\/chNFe>/);
  if (chMatch?.[1]) return chMatch[1];
  const idMatch = xmlContent.match(/<infNFe[^>]*Id="NFe(\d{44})"/);
  return idMatch?.[1] ?? "";
};

const resolveSefazEnvironment = async (
  companyId: number,
  environment?: string
): Promise<"homologacao" | "producao"> => {
  if (environment === "producao") {
    return "producao";
  }
  const settings = await storage.getCompanySettings(companyId);
  return settings?.fiscalEnvironment === "producao"
    ? "producao"
    : "homologacao";
};

const logSefazTransmission = async (data: {
  companyId: number;
  action: string;
  environment: "homologacao" | "producao";
  requestPayload?: any;
  responsePayload?: any;
  success?: boolean;
}) => {
  try {
    await storage.createSefazTransmissionLog({
      companyId: data.companyId,
      action: data.action,
      environment: data.environment,
      requestPayload: data.requestPayload ?? null,
      responsePayload: data.responsePayload ?? null,
      success: data.success ?? false,
    });
  } catch {
    return;
  }
};

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
router.post(
  "/nfce/contingency/save",
  requireAuth,
  requireValidFiscalCertificate(),
  async (req, res) => {
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
  }
);

// Lista NFC-e pendentes de reenvio
router.get("/nfce/contingency/pending", requireAuth, async (_req, res) => {
  res.json(nfceContingency.listPending());
});

// Dispara reenvio manual imediato
router.post(
  "/nfce/contingency/resend",
  requireAuth,
  requireValidFiscalCertificate(),
  async (_req, res) => {
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
  }
);

router.post(
  "/nfce/send",
  requireAuth,
  requirePermission("fiscal:emit_nfce"),
  requireValidFiscalCertificate(),
  async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Nao autenticado" });
      }

      const saleIds = Array.isArray(req.body.saleIds)
        ? req.body.saleIds.map((id: any) => Number(id)).filter((id: number) => id > 0)
        : [];

      if (saleIds.length === 0) {
        return res.status(400).json({ error: "Nenhuma venda informada" });
      }

      const results = [];
      for (const saleId of saleIds) {
        const sale = await storage.getSale(saleId, companyId);
        if (!sale) {
          results.push({ id: saleId, success: false, error: "Venda nao encontrada" });
          continue;
        }

        const status = String(sale.nfceStatus || "Pendente");
        if (status === "Autorizada" || status === "Cancelada") {
          results.push({
            id: saleId,
            success: false,
            error: "Status nao permite envio",
          });
          continue;
        }

        await storage.updateSaleNfceStatus(
          saleId,
          companyId,
          "Pendente",
          sale.nfceProtocol || null,
          sale.nfceKey || null,
          null
        );
        results.push({ id: saleId, success: true });
      }

      res.json({ success: true, results });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao enviar NFC-e",
      });
    }
  }
);

router.post(
  "/nfce/cancel",
  requireAuth,
  requirePermission("fiscal:cancel_nfce"),
  requireValidFiscalCertificate(),
  async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Nao autenticado" });
      }

      const saleId = Number(req.body.saleId);
      if (!saleId) {
        return res.status(400).json({ error: "Venda nao informada" });
      }

      const sale = await storage.getSale(saleId, companyId);
      if (!sale) {
        return res.status(404).json({ error: "Venda nao encontrada" });
      }

      if (sale.nfceStatus !== "Autorizada") {
        return res.status(400).json({
          error: "Apenas NFC-e autorizada pode ser cancelada",
        });
      }

      const createdAt = sale.createdAt ? new Date(sale.createdAt) : null;
      if (createdAt) {
        const diffMs = Date.now() - createdAt.getTime();
        if (diffMs > 24 * 60 * 60 * 1000) {
          return res.status(400).json({
            error: "Prazo legal para cancelamento expirado",
          });
        }
      }

      const updated = await storage.updateSaleNfceStatus(
        saleId,
        companyId,
        "Cancelada",
        sale.nfceProtocol || null,
        sale.nfceKey || null,
        null
      );

      res.json({ success: true, sale: updated });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao cancelar NFC-e",
      });
    }
  }
);

router.post(
  "/nfce/inutilize",
  requireAuth,
  requirePermission("fiscal:manage"),
  requireValidFiscalCertificate(),
  async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Nao autenticado" });
      }

      const serie = String(req.body.serie || "").trim();
      const startNumber = Number(req.body.startNumber);
      const endNumber = Number(req.body.endNumber);
      const reason = String(req.body.reason || "").trim();

      if (!serie || !startNumber || !endNumber) {
        return res.status(400).json({ error: "Dados de numeracao invalidos" });
      }

      if (startNumber > endNumber) {
        return res.status(400).json({ error: "Intervalo de numeracao invalido" });
      }

      if (reason.length < 15) {
        return res.status(400).json({
          error: "Justificativa obrigatoria (min 15 caracteres)",
        });
      }

      const record = await storage.createNfeNumberInutilization({
        companyId,
        nfeSeries: serie,
        startNumber,
        endNumber,
        reason,
      });

      res.json({ success: true, record });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao inutilizar numeracao",
      });
    }
  }
);

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
router.post(
  "/nfe/generate",
  requireAuth,
  requireValidFiscalCertificate(),
  async (req, res) => {
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
  }
);

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
router.post(
  "/sefaz/submit",
  requireAuth,
  requireValidFiscalCertificate(),
  async (req, res) => {
  try {
    const { xmlContent, environment, uf } = req.body;
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

    const resolvedEnvironment = await resolveSefazEnvironment(
      companyId,
      environment
    );

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
      await logSefazTransmission({
        companyId,
        action: "submit",
        environment: resolvedEnvironment,
        requestPayload: { xmlContent, uf },
        responsePayload: {
          error:
            signError instanceof Error ? signError.message : "Erro ao assinar XML",
        },
        success: false,
      });
      console.error("Erro ao assinar XML:", signError);
      return res.status(400).json({
        error: `Falha ao assinar XML: ${
          signError instanceof Error ? signError.message : "Desconhecido"
        }`,
      });
    }

    const sefazService = new SefazService({
      environment: resolvedEnvironment,
      uf,
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.submitNFe(signedXml);
    await logSefazTransmission({
      companyId,
      action: "submit",
      environment: resolvedEnvironment,
      requestPayload: { xmlContent: signedXml, uf, signed },
      responsePayload: result,
      success: result.success,
    });
    if (result.success) {
      const accessKey = extractAccessKey(signedXml);
      if (accessKey) {
        const authorizedAt = result.timestamp ?? new Date();
        const expiresAt = new Date(
          authorizedAt.getTime() + 5 * 365 * 24 * 60 * 60 * 1000
        );
        await storage.saveFiscalXml({
          companyId,
          documentType: "NFe",
          documentKey: accessKey,
          xmlContent: signedXml,
          authorizedAt,
          expiresAt,
        });
      }
    }
    res.json({
      ...result,
      signed,
      message: `NF-e ${signed ? "assinada" : "gerada"} e enviada para SEFAZ`,
    });
  } catch (error) {
    const companyId = getCompanyId(req);
    if (companyId) {
      const resolvedEnvironment = await resolveSefazEnvironment(
        companyId,
        req.body?.environment
      );
      await logSefazTransmission({
        companyId,
        action: "submit",
        environment: resolvedEnvironment,
        requestPayload: { xmlContent: req.body?.xmlContent, uf: req.body?.uf },
        responsePayload: {
          error: error instanceof Error ? error.message : "Erro ao submeter NF-e",
        },
        success: false,
      });
    }
    res.status(400).json({
      error: error instanceof Error ? error.message : "Erro ao submeter NF-e",
    });
  }
  }
);

router.post(
  "/sefaz/cancel",
  requireAuth,
  requirePermission("fiscal:cancel_nfe"),
  requireValidFiscalCertificate(),
  async (req, res) => {
    try {
      const { nfeNumber, nfeSeries, reason, environment, uf } = req.body;
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Empresa nao identificada" });
      }
      if (!nfeNumber || !nfeSeries || !reason) {
        return res.status(400).json({ error: "Campos obrigatorios ausentes" });
      }

      const resolvedEnvironment = await resolveSefazEnvironment(
        companyId,
        environment
      );

      const sefazService = new SefazService({
        environment: resolvedEnvironment,
        uf: uf || "SP",
        certificatePath: "",
        certificatePassword: "",
      });

      const result = await sefazService.cancelNFe(
        String(nfeNumber),
        String(nfeSeries),
        String(reason)
      );

      await logSefazTransmission({
        companyId,
        action: "cancel",
        environment: resolvedEnvironment,
        requestPayload: { nfeNumber, nfeSeries, reason, uf },
        responsePayload: result,
        success: result.success,
      });

      res.json({
        success: result.success,
        message: result.message,
        protocol: result.protocol,
        eventId: result.eventId,
        timestamp: result.timestamp,
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao cancelar NF-e",
      });
    }
  }
);

router.post(
  "/sefaz/correction-letter",
  requireAuth,
  requirePermission("fiscal:manage"),
  requireValidFiscalCertificate(),
  async (req, res) => {
    try {
      const {
        nfeNumber,
        nfeSeries,
        correctionReason,
        correctedContent,
        environment,
        uf,
      } = req.body;
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Empresa nao identificada" });
      }
      if (!nfeNumber || !nfeSeries || !correctionReason || !correctedContent) {
        return res.status(400).json({ error: "Campos obrigatorios ausentes" });
      }

      const resolvedEnvironment = await resolveSefazEnvironment(
        companyId,
        environment
      );

      const sefazService = new SefazService({
        environment: resolvedEnvironment,
        uf: uf || "SP",
        certificatePath: "",
        certificatePassword: "",
      });

      const result = await sefazService.sendCorrectionLetter(
        String(nfeNumber),
        String(nfeSeries),
        { correctionReason, correctedContent }
      );

      await logSefazTransmission({
        companyId,
        action: "correction-letter",
        environment: resolvedEnvironment,
        requestPayload: {
          nfeNumber,
          nfeSeries,
          correctionReason,
          correctedContent,
          uf,
        },
        responsePayload: result,
        success: result.success,
      });

      res.json({
        success: result.success,
        message: result.message,
        protocol: result.protocol,
        timestamp: result.timestamp,
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao enviar Carta de Correcao",
      });
    }
  }
);

router.post(
  "/sefaz/inutilize",
  requireAuth,
  requirePermission("fiscal:manage"),
  requireValidFiscalCertificate(),
  async (req, res) => {
    try {
      const { series, startNumber, endNumber, reason, environment, uf } = req.body;
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Empresa nao identificada" });
      }
      if (!series || !startNumber || !endNumber || !reason) {
        return res.status(400).json({ error: "Campos obrigatorios ausentes" });
      }

      const resolvedEnvironment = await resolveSefazEnvironment(
        companyId,
        environment
      );

      const sefazService = new SefazService({
        environment: resolvedEnvironment,
        uf: uf || "SP",
        certificatePath: "",
        certificatePassword: "",
      });

      const result = await sefazService.inutilizeNumbers(
        String(series),
        Number(startNumber),
        Number(endNumber),
        String(reason)
      );

      await logSefazTransmission({
        companyId,
        action: "inutilize",
        environment: resolvedEnvironment,
        requestPayload: { series, startNumber, endNumber, reason, uf },
        responsePayload: result,
        success: result.success,
      });

      res.json({
        success: result.success,
        message: result.message,
        protocol: result.protocol,
        timestamp: result.timestamp,
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao inutilizar numeracao",
      });
    }
  }
);

router.post(
  "/manifestation/download",
  requireAuth,
  requirePermission("fiscal:manage"),
  async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Nao autenticado" });
      }

      const company =
        (await storage.getCompanyById(companyId)) ||
        (await storage.getCompanySettings(companyId));
      const receiverCnpj = String((company as any)?.cnpj || "").replace(/\D/g, "");
      if (!receiverCnpj) {
        return res.status(400).json({ error: "CNPJ da empresa nao encontrado" });
      }

      const documents = Array.isArray(req.body.documents) ? req.body.documents : [];
      if (documents.length === 0) {
        return res.status(400).json({ error: "Nenhum documento informado" });
      }

      const results = [];
      for (const doc of documents) {
        const documentKey = String(doc.documentKey || "").trim();
        const issuerCnpj = String(doc.issuerCnpj || "").replace(/\D/g, "");
        const xmlContent = String(doc.xmlContent || "");
        if (!documentKey || !issuerCnpj || !xmlContent) {
          results.push({ documentKey, success: false, error: "Dados incompletos" });
          continue;
        }

        const stored = await storage.saveManifestDocument({
          companyId,
          documentKey,
          issuerCnpj,
          receiverCnpj,
          xmlContent,
          downloadedAt: new Date(),
        });
        results.push({ documentKey, success: true, id: stored.id });
      }

      res.json({ success: true, results });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao baixar manifestacao",
      });
    }
  }
);

router.get(
  "/manifestation",
  requireAuth,
  requirePermission("fiscal:view"),
  async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Nao autenticado" });
      }

      const documents = await storage.listManifestDocuments(companyId);
      res.json(documents);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao listar manifestacoes",
      });
    }
  }
);

// Consultar Recibo SEFAZ
router.post("/sefaz/receipt", async (req, res) => {
  try {
    const { xmlContent, environment, uf, sefazUrl } = req.body;
    const companyId = getCompanyId(req);

    if (!xmlContent) {
      return res.status(400).json({ error: "XML content e obrigatorio" });
    }

    if (!uf) {
      return res.status(400).json({ error: "UF e obrigatoria" });
    }

    const resolvedEnvironment = companyId
      ? await resolveSefazEnvironment(companyId, environment)
      : environment === "producao"
        ? "producao"
        : "homologacao";

    const sefazService = new SefazService({
      environment: resolvedEnvironment,
      uf,
      certificatePath: "",
      certificatePassword: "",
      sefazUrl,
    });

    const result = await sefazService.queryReceipt(xmlContent);
    if (companyId) {
      await logSefazTransmission({
        companyId,
        action: "receipt",
        environment: resolvedEnvironment,
        requestPayload: { xmlContent, uf, sefazUrl },
        responsePayload: result,
        success: result.success ?? false,
      });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Erro ao consultar recibo",
    });
  }
});

export default router;
