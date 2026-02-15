import { Tools } from "node-sped-nfe";

export interface SefazConfig {
  environment: "homologacao" | "producao";
  uf: string;
  certificateBuffer: Buffer;
  certificatePassword: string;
  cnpj?: string;
  timeout?: number;
  xmllintPath?: string;
  opensslPath?: string;
}

export interface SubmissionResult {
  success: boolean;
  protocol: string;
  timestamp: Date;
  status: string;
  message: string;
  key?: string;
  signedXml?: string;
  rawResponse?: string;
}

export interface CancellationResult {
  success: boolean;
  protocol: string;
  timestamp: Date;
  eventId?: string;
  message: string;
  status?: string;
  rawResponse?: string;
}

export interface CorrectionLetterResult {
  success: boolean;
  protocol: string;
  timestamp: Date;
  message: string;
  status?: string;
  rawResponse?: string;
}

export interface InutilizationResult {
  success: boolean;
  protocol: string;
  timestamp: Date;
  message: string;
  status?: string;
  rawResponse?: string;
}

const extractTag = (tag: string, source: string): string => {
  const match = source.match(
    new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<\\/[^>]*${tag}>`),
  );
  return match?.[1] ?? "";
};

const extractBlock = (tag: string, source: string): string => {
  const match = source.match(
    new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`),
  );
  return match?.[1] ?? "";
};

const stripEnviNFe = (xmlContent: string): string => {
  if (!xmlContent.includes("<enviNFe")) return xmlContent;
  const nfeMatch = xmlContent.match(/<NFe[\s\S]*<\/NFe>/);
  return nfeMatch?.[0] ?? xmlContent;
};

const hasSignature = (xmlContent: string): boolean =>
  /<\s*Signature\b/.test(xmlContent);

const resolveFinalStatus = (xmlContent: string) => {
  const outerStatus = extractTag("cStat", xmlContent);
  const outerMessage = extractTag("xMotivo", xmlContent);
  let status = outerStatus;
  let message = outerMessage;
  let protocol = extractTag("nProt", xmlContent);
  let key = extractTag("chNFe", xmlContent);

  const protBlock = extractBlock("protNFe", xmlContent);
  if (protBlock) {
    const innerStatus = extractTag("cStat", protBlock);
    const innerMessage = extractTag("xMotivo", protBlock);
    const innerProtocol = extractTag("nProt", protBlock);
    const innerKey = extractTag("chNFe", protBlock);
    if (innerStatus) status = innerStatus;
    if (innerMessage) message = innerMessage;
    if (innerProtocol) protocol = innerProtocol;
    if (innerKey) key = innerKey;
  }

  return { status, message, protocol, key };
};

const resolveEventStatus = (xmlContent: string) => {
  const outerStatus = extractTag("cStat", xmlContent);
  const outerMessage = extractTag("xMotivo", xmlContent);
  let status = outerStatus;
  let message = outerMessage;
  let protocol = extractTag("nProt", xmlContent);
  const inner =
    extractBlock("infEvento", xmlContent) ||
    extractBlock("infRetEvento", xmlContent);
  if (inner) {
    const innerStatus = extractTag("cStat", inner);
    const innerMessage = extractTag("xMotivo", inner);
    const innerProtocol = extractTag("nProt", inner);
    if (innerStatus) status = innerStatus;
    if (innerMessage) message = innerMessage;
    if (innerProtocol) protocol = innerProtocol;
  }
  return { status, message, protocol };
};

export class SefazService {
  private config: SefazConfig;

  constructor(config: SefazConfig) {
    this.config = config;
  }

  private buildTools(mod: "55" | "65") {
    return new Tools(
      {
        mod,
        UF: this.config.uf,
        tpAmb: this.config.environment === "producao" ? 1 : 2,
        versao: "4.00",
        timeout: this.config.timeout ?? 30,
        xmllint: this.config.xmllintPath ?? process.env.XMLLINT_PATH ?? "xmllint",
        openssl: this.config.opensslPath ?? undefined,
        CNPJ: this.config.cnpj,
      },
      {
        pfx: this.config.certificateBuffer,
        senha: this.config.certificatePassword,
      },
    );
  }

  async submitNFe(xmlContent: string): Promise<SubmissionResult> {
    try {
      const tools = this.buildTools("55");
      const xmlBody = stripEnviNFe(xmlContent);
      const signedXml = hasSignature(xmlBody)
        ? xmlBody
        : await tools.xmlSign(xmlBody, { tag: "infNFe" });

      const response = await tools.sefazEnviaLote(signedXml, {
        idLote: Date.now(),
        indSinc: 1,
        compactar: false,
      });

      const parsed = resolveFinalStatus(String(response || ""));
      const status = parsed.status || "0";
      const message = parsed.message || "Resposta SEFAZ sem cStat";
      const success = status === "100" || status === "150";

      return {
        success,
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        status,
        message,
        key: parsed.key || "",
        signedXml,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        status: "error",
        message:
          error instanceof Error ? error.message : "Erro ao enviar NF-e",
      };
    }
  }

  async submitNFCe(xmlContent: string): Promise<SubmissionResult> {
    try {
      const tools = this.buildTools("65");
      const xmlBody = stripEnviNFe(xmlContent);
      if (!hasSignature(xmlBody)) {
        throw new Error("XML NFC-e sem assinatura. Assine antes do envio.");
      }

      const response = await tools.sefazEnviaLote(xmlBody, {
        idLote: Date.now(),
        indSinc: 1,
        compactar: false,
      });

      const parsed = resolveFinalStatus(String(response || ""));
      const status = parsed.status || "0";
      const message = parsed.message || "Resposta SEFAZ sem cStat";
      const success = status === "100" || status === "150";

      return {
        success,
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        status,
        message,
        key: parsed.key || "",
        signedXml: xmlBody,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        status: "error",
        message:
          error instanceof Error ? error.message : "Erro ao enviar NFC-e",
      };
    }
  }

  async cancelNFe(
    accessKey: string,
    protocol: string,
    reason: string,
  ): Promise<CancellationResult> {
    try {
      const tools = this.buildTools("55");
      const response = await tools.sefazEvento({
        chNFe: accessKey,
        tpEvento: "110111",
        nProt: protocol,
        xJust: reason,
        nSeqEvento: 1,
      });

      const parsed = resolveEventStatus(String(response || ""));
      const status = parsed.status || "0";
      const success = ["135", "136", "155"].includes(status);

      return {
        success,
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        eventId: `ID110111${accessKey}01`,
        message: parsed.message || "Resposta SEFAZ sem xMotivo",
        status,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        message:
          error instanceof Error ? error.message : "Erro ao cancelar NF-e",
      };
    }
  }

  async cancelNFCe(
    accessKey: string,
    protocol: string,
    reason: string,
  ): Promise<CancellationResult> {
    try {
      const tools = this.buildTools("65");
      const response = await tools.sefazEvento({
        chNFe: accessKey,
        tpEvento: "110111",
        nProt: protocol,
        xJust: reason,
        nSeqEvento: 1,
      });

      const parsed = resolveEventStatus(String(response || ""));
      const status = parsed.status || "0";
      const success = ["135", "136", "155"].includes(status);

      return {
        success,
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        eventId: `ID110111${accessKey}01`,
        message: parsed.message || "Resposta SEFAZ sem xMotivo",
        status,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        message:
          error instanceof Error ? error.message : "Erro ao cancelar NFC-e",
      };
    }
  }

  async sendCorrectionLetter(
    accessKey: string,
    correctionText: string,
    sequence: number = 1,
  ): Promise<CorrectionLetterResult> {
    try {
      const tools = this.buildTools("55");
      const response = await tools.sefazEvento({
        chNFe: accessKey,
        tpEvento: "110110",
        xJust: correctionText,
        nSeqEvento: sequence,
      });

      const parsed = resolveEventStatus(String(response || ""));
      const status = parsed.status || "0";
      const success = ["135", "136", "155"].includes(status);

      return {
        success,
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        message: parsed.message || "Resposta SEFAZ sem xMotivo",
        status,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        message:
          error instanceof Error
            ? error.message
            : "Erro ao enviar Carta de Correcao",
      };
    }
  }

  async inutilizeNumbers(
    series: string,
    startNumber: number,
    endNumber: number,
    reason: string,
    mod: "55" | "65" = "55",
  ): Promise<InutilizationResult> {
    try {
      const tools = this.buildTools(mod);
      const response = await tools.sefazInutiliza({
        nSerie: String(series),
        nIni: Number(startNumber),
        nFin: Number(endNumber),
        xJust: reason,
      });

      const parsed = resolveFinalStatus(String(response || ""));
      const status = parsed.status || "0";
      const success = ["102", "135", "155"].includes(status);

      return {
        success,
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        message: parsed.message || "Resposta SEFAZ sem xMotivo",
        status,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        message:
          error instanceof Error
            ? error.message
            : "Erro ao inutilizar numeracao",
      };
    }
  }

  async queryReceipt(_xmlContent: string): Promise<SubmissionResult> {
    return {
      success: false,
      protocol: "",
      timestamp: new Date(),
      status: "error",
      message: "Consulta de recibo nao suportada nesta integracao",
    };
  }

  async checkAuthorizationStatus(accessKey: string): Promise<any> {
    try {
      const tools = this.buildTools("55");
      const response = await tools.consultarNFe(accessKey);
      const parsed = resolveFinalStatus(String(response || ""));
      return {
        success: true,
        status: parsed.status,
        message: parsed.message,
        authorizedAt: new Date(),
        protocol: parsed.protocol,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao consultar status",
      };
    }
  }
}
