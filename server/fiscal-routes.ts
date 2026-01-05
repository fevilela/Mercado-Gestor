import { Router, Request, Response } from "express";
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
import { SefazService } from "./sefaz-service";
import { XMLSignatureService } from "./xml-signature";
import { storage } from "./storage";
import { requireAuth, getCompanyId } from "./middleware";

const router = Router();

// ============================================
// NF-e (Modelo 55) Routes
// ============================================
router.post("/nfe/validate", async (req, res) => {
  try {
    const validation = NFeSalesValidationSchema.parse(req.body);

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

    // Validar CSOSN para cada item
    for (const item of validation.items) {
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
    }

    res.json({
      valid: true,
      cfop: cfopResult.cfop,
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
      message: `NF-e ${nfeResult.signed ? "assinada ✓" : "gerada"}`,
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
router.post("/sefaz/submit", requireAuth, async (req, res) => {
  try {
    const { xmlContent, environment = "homologacao" } = req.body;
    const companyId = getCompanyId(req);

    if (!xmlContent) {
      return res.status(400).json({ error: "XML content é obrigatório" });
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

    // Assinar XML com certificado
    let signedXml = xmlContent;
    let signed = false;
    try {
      const { signedXml: signed_content } = XMLSignatureService.signNFe(
        xmlContent,
        certificateBuffer,
        certificatePassword
      );
      signedXml = signed_content;
      signed = true;
    } catch (signError) {
      console.error("Erro ao assinar XML:", signError);
      return res.status(400).json({
        error: `Falha ao assinar XML: ${
          signError instanceof Error ? signError.message : "Desconhecido"
        }`,
      });
    }

    // Submeter para SEFAZ
    const sefazService = new SefazService({
      environment: environment as "homologacao" | "producao",
      certificatePath: "",
      certificatePassword: certificatePassword,
    });

    const result = await sefazService.submitNFe(signedXml);
    res.json({
      ...result,
      signed,
      message: `NF-e assinada ${signed ? "✓" : "✗"} e enviada para SEFAZ`,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Erro ao submeter NF-e",
    });
  }
});

// Cancelar NF-e
router.post("/sefaz/cancel", async (req, res) => {
  try {
    const {
      nfeNumber,
      nfeSeries,
      reason,
      environment = "homologacao",
    } = req.body;

    if (!nfeNumber || !nfeSeries || !reason) {
      return res.status(400).json({
        error: "nfeNumber, nfeSeries e reason são obrigatórios",
      });
    }

    const sefazService = new SefazService({
      environment: environment as "homologacao" | "producao",
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.cancelNFe(nfeNumber, nfeSeries, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Erro ao cancelar NF-e",
    });
  }
});

// Enviar Carta de Correção
router.post("/sefaz/correction-letter", async (req, res) => {
  try {
    const {
      nfeNumber,
      nfeSeries,
      correctionReason,
      correctedContent,
      environment = "homologacao",
    } = req.body;

    if (!nfeNumber || !nfeSeries || !correctionReason || !correctedContent) {
      return res.status(400).json({
        error:
          "nfeNumber, nfeSeries, correctionReason e correctedContent são obrigatórios",
      });
    }

    const sefazService = new SefazService({
      environment: environment as "homologacao" | "producao",
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.sendCorrectionLetter(
      nfeNumber,
      nfeSeries,
      {
        correctionReason,
        correctedContent,
      }
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Erro ao enviar Carta de Correção",
    });
  }
});

// Inutilizar Numeração
router.post("/sefaz/inutilize", async (req, res) => {
  try {
    const {
      series,
      startNumber,
      endNumber,
      reason,
      environment = "homologacao",
    } = req.body;

    if (!series || !startNumber || !endNumber || !reason) {
      return res.status(400).json({
        error: "series, startNumber, endNumber e reason são obrigatórios",
      });
    }

    const sefazService = new SefazService({
      environment: environment as "homologacao" | "producao",
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.inutilizeNumbers(
      series,
      parseInt(startNumber),
      parseInt(endNumber),
      reason
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Erro ao inutilizar numeração",
    });
  }
});

// Ativar Modo Contingência
router.post("/sefaz/contingency", async (req, res) => {
  try {
    const { mode = "offline" } = req.body;

    if (!["offline", "svc", "svc_rs", "svc_an"].includes(mode)) {
      return res.status(400).json({
        error: "Modo de contingência inválido (offline, svc, svc_rs, svc_an)",
      });
    }

    const sefazService = new SefazService({
      environment: "homologacao",
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.activateContingencyMode(
      mode as "offline" | "svc" | "svc_rs" | "svc_an"
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Erro ao ativar modo contingência",
    });
  }
});

// Consultar Status de Autorização
router.get("/sefaz/status/:protocol", async (req, res) => {
  try {
    const { protocol } = req.params;

    if (!protocol) {
      return res.status(400).json({ error: "Protocol é obrigatório" });
    }

    const sefazService = new SefazService({
      environment: "homologacao",
      certificatePath: "",
      certificatePassword: "",
    });

    const result = await sefazService.checkAuthorizationStatus(protocol);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Erro ao consultar status",
    });
  }
});

// Testar Conexão com SEFAZ
router.post(
  "/sefaz/test-connection",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { environment = "homologacao" } = req.body;
      const companyId = getCompanyId(req);

      if (!companyId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      // Em PRODUÇÃO, certificado é obrigatório
      if (environment === "producao") {
        const certificate = await storage.getDigitalCertificate(companyId);
        if (!certificate) {
          return res.status(400).json({
            error:
              "Certificado digital não configurado. Instale um certificado e-CNPJ antes de testar em PRODUÇÃO.",
            certificateRequired: true,
          });
        }

        // Validar se certificado ainda é válido
        const validation = await storage.validateDigitalCertificate(companyId);
        if (!validation.isValid) {
          return res.status(400).json({
            error: validation.message,
            certificateRequired: true,
          });
        }
      } else {
        // Em HOMOLOGAÇÃO, certificado é opcional para testes
        const certificate = await storage.getDigitalCertificate(companyId);
        if (certificate) {
          const validation = await storage.validateDigitalCertificate(
            companyId
          );
          if (!validation.isValid) {
            return res.status(400).json({
              error: validation.message,
              certificateRequired: false,
              message:
                "Certificado inválido, mas você pode continuar testando em homologação sem certificado",
            });
          }
        }
      }

      const sefazService = new SefazService({
        environment: environment as "homologacao" | "producao",
        certificatePath: "",
        certificatePassword: "",
      });

      const result = await sefazService.testConnection();
      res.json({
        ...result,
        environment,
        message:
          environment === "homologacao"
            ? "Teste de conexão em HOMOLOGAÇÃO (sem assinatura obrigatória)"
            : "Teste de conexão em PRODUÇÃO (certificado obrigatório)",
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao testar conexão",
      });
    }
  }
);

export default router;
