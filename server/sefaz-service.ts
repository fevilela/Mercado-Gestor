import { Tools } from "node-sped-nfe";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as https from "https";
import * as zlib from "zlib";
import { createRequire } from "module";
import { XMLSignatureService } from "./xml-signature";
import {
  resolveNfceWsEndpoints,
  resolveSefazEventEndpoints,
} from "./sefaz-endpoints";

const require = createRequire(path.join(process.cwd(), "package.json"));

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
  sentXmlPath?: string;
  sentXmlSha256?: string;
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

export interface DistributionDocument {
  nsu?: string;
  schema?: string;
  documentKey?: string;
  issuerCnpj?: string;
  receiverCnpj?: string;
  xmlContent: string;
}

export interface DistributionResult {
  success: boolean;
  status?: string;
  message: string;
  lastNSU?: string;
  maxNSU?: string;
  documents: DistributionDocument[];
  rawResponse?: string;
}

export interface ManifestationResult {
  success: boolean;
  status?: string;
  message: string;
  protocol?: string;
  eventId?: string;
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

const normalizeXmlForTransmission = (xmlContent: string): string => {
  return String(xmlContent || "")
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .trim();
};

const sanitizeXmlPayload = (xmlContent: string): string => {
  let source = String(xmlContent || "").trim();
  if (
    (source.startsWith('"') && source.endsWith('"')) ||
    (source.startsWith("'") && source.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(source);
      if (typeof parsed === "string") {
        source = parsed;
      }
    } catch {
      source = source.slice(1, -1);
    }
  }
  return normalizeXmlForTransmission(source);
};

const readTpAmb = (xmlContent: string): string => {
  const match = String(xmlContent || "").match(/<tpAmb>(\d)<\/tpAmb>/);
  return match?.[1] || "";
};

const forceTpAmb = (xmlContent: string, tpAmb: "1" | "2"): string => {
  if (/<tpAmb>\d<\/tpAmb>/.test(xmlContent)) {
    return xmlContent.replace(/<tpAmb>\d<\/tpAmb>/, `<tpAmb>${tpAmb}</tpAmb>`);
  }
  return xmlContent;
};

const hasSignature = (xmlContent: string): boolean =>
  /<\s*Signature\b/.test(xmlContent);

const extractInfNFeId = (xmlContent: string): string => {
  const match = String(xmlContent || "").match(/<infNFe[^>]*Id="([^"]+)"/i);
  return match?.[1] || "";
};

const saveSubmitDebugXml = async (params: {
  xmlContent: string;
  docType: "nfe" | "nfce";
  uf: string;
  environment: "homologacao" | "producao";
}) => {
  const debugEnabled = process.env.SEFAZ_DEBUG_XML === "true";
  const sha256 = crypto
    .createHash("sha256")
    .update(params.xmlContent, "utf8")
    .digest("hex");
  if (!debugEnabled) {
    return { path: undefined as string | undefined, sha256 };
  }

  const dir = path.join(process.cwd(), "server", "logs");
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${params.docType}-submit-${params.environment}-${params.uf.toLowerCase()}-${Date.now()}-${sha256.slice(
    0,
    12,
  )}.xml`;
  const fullPath = path.join(dir, filename);
  await fs.promises.writeFile(fullPath, params.xmlContent, "utf8");
  return { path: fullPath, sha256 };
};

const stripWrappingQuotes = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const patchPemPkcs12ReaderWithForge = () => {
  try {
    const pem = require("pem");
    if ((pem as any).__zyvoPkcs12Patched) return;
    const forge = require("node-forge");

    const originalReadPkcs12 = pem.readPkcs12?.bind(pem);
    pem.readPkcs12 = (pfxInput: any, options: any, callback: any) => {
      try {
        const cb = typeof callback === "function" ? callback : () => undefined;
        const opts = options || {};
        const password = String(opts.p12Password || opts.password || "");

        let pfxBuffer: Buffer;
        if (Buffer.isBuffer(pfxInput)) {
          pfxBuffer = pfxInput;
        } else if (typeof pfxInput === "string" && fs.existsSync(pfxInput)) {
          pfxBuffer = fs.readFileSync(pfxInput);
        } else if (typeof pfxInput === "string") {
          pfxBuffer = Buffer.from(pfxInput, "binary");
        } else {
          throw new Error("Formato de certificado PKCS#12 invalido");
        }

        const asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
        const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

        const keyBags =
          p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
            forge.pki.oids.pkcs8ShroudedKeyBag
          ] || [];
        const certBags =
          p12.getBags({ bagType: forge.pki.oids.certBag })[
            forge.pki.oids.certBag
          ] || [];

        const privateKey = keyBags[0]?.key;
        const certs = certBags
          .map((bag: any) => bag?.cert)
          .filter(Boolean)
          .map((cert: any) => forge.pki.certificateToPem(cert));

        if (!privateKey || certs.length === 0) {
          throw new Error("Nao foi possivel extrair chave/certificado do PFX");
        }

        const payload = {
          key: forge.pki.privateKeyToPem(privateKey),
          cert: certs[0],
          ca: certs.slice(1),
          pem: certs[0],
        };
        return cb(null, payload);
      } catch (error) {
        if (typeof originalReadPkcs12 === "function") {
          return originalReadPkcs12(pfxInput, options, callback);
        }
        return callback(error);
      }
    };

    (pem as any).__zyvoPkcs12Patched = true;
  } catch {
    // noop
  }
};

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

const extractSoapFaultMessage = (xmlContent: string): string => {
  const reason =
    extractTag("Text", xmlContent) ||
    extractTag("faultstring", xmlContent) ||
    "";
  return reason.trim();
};

const extractDocZipNodes = (
  xmlContent: string,
): Array<{ nsu?: string; schema?: string; payload: string }> => {
  const nodes: Array<{ nsu?: string; schema?: string; payload: string }> = [];
  const regex = /<docZip([^>]*)>([\s\S]*?)<\/docZip>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(xmlContent)) !== null) {
    const attrs = match[1] || "";
    const payload = String(match[2] || "").trim();
    const nsu = attrs.match(/NSU="([^"]+)"/i)?.[1];
    const schema = attrs.match(/schema="([^"]+)"/i)?.[1];
    if (payload) nodes.push({ nsu, schema, payload });
  }
  return nodes;
};

const decodeDocZipPayload = (payload: string): string => {
  const buffer = Buffer.from(payload, "base64");
  try {
    return zlib.gunzipSync(buffer).toString("utf8");
  } catch {
    return buffer.toString("utf8");
  }
};

const describeUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || "Erro desconhecido";
  }
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      reason?: unknown;
      faultstring?: unknown;
      name?: unknown;
      code?: unknown;
    };
    const directMessage =
      (typeof candidate.message === "string" && candidate.message.trim()) ||
      (typeof candidate.reason === "string" && candidate.reason.trim()) ||
      (typeof candidate.faultstring === "string" &&
        candidate.faultstring.trim());
    if (directMessage) return directMessage;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error || "Erro desconhecido");
};

export class SefazService {
  private config: SefazConfig;

  constructor(config: SefazConfig) {
    this.config = config;
  }

  private buildTools(
    mod: "55" | "65",
    options?: { skipXmllint?: boolean }
  ) {
    patchPemPkcs12ReaderWithForge();

    const resolveOpenSSLPath = () => {
      const configured = stripWrappingQuotes(
        this.config.opensslPath ||
          process.env.OPENSSL_PATH ||
          process.env.OPENSSL_BIN,
      );
      if (configured) return configured;

      if (process.platform === "win32") {
        const candidates = [
          "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
          "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
          "C:\\Program Files (x86)\\GnuWin32\\bin\\openssl.exe",
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) return candidate;
        }
      }
      return undefined;
    };

    const ensureLegacyOpenSSLConfig = (opensslPath?: string) => {
      if (process.platform !== "win32") return;
      if (!opensslPath || !fs.existsSync(opensslPath)) return;
      if (process.env.OPENSSL_CONF) return;

      const opensslBinDir = path.dirname(opensslPath);
      const opensslRootDir = path.dirname(opensslBinDir);
      const modulesCandidates = [
        path.join(opensslRootDir, "lib", "ossl-modules"),
        path.join(opensslRootDir, "lib64", "ossl-modules"),
        path.join(opensslBinDir, "ossl-modules"),
      ];
      const modulesDir = modulesCandidates.find((candidate) =>
        fs.existsSync(candidate),
      );
      if (modulesDir && !process.env.OPENSSL_MODULES) {
        process.env.OPENSSL_MODULES = modulesDir;
      }

      const legacyConfigPath = path.join(
        os.tmpdir(),
        "openssl-legacy-auto.cnf",
      );
      if (!fs.existsSync(legacyConfigPath)) {
        const configContent = [
          "openssl_conf = openssl_init",
          "",
          "[openssl_init]",
          "providers = provider_sect",
          "",
          "[provider_sect]",
          "default = default_sect",
          "legacy = legacy_sect",
          "",
          "[default_sect]",
          "activate = 1",
          "",
          "[legacy_sect]",
          "activate = 1",
          "",
        ].join("\n");
        fs.writeFileSync(legacyConfigPath, configContent, "utf8");
      }
      process.env.OPENSSL_CONF = legacyConfigPath;
    };

    const toolsConfig: any = {
      mod,
      UF: this.config.uf,
      tpAmb: this.config.environment === "producao" ? 1 : 2,
      versao: "4.00",
      timeout:
        this.config.timeout ??
        Number(process.env.SEFAZ_REQUEST_TIMEOUT_SECONDS || "60"),
      CNPJ: this.config.cnpj ?? "",
    };
    if (!options?.skipXmllint) {
      toolsConfig.xmllint =
        this.config.xmllintPath ?? process.env.XMLLINT_PATH ?? "xmllint";
    }
    const opensslPath = resolveOpenSSLPath();
    if (opensslPath) {
      toolsConfig.openssl = opensslPath;
      // pem (usado internamente) le OPENSSL_BIN, nao OPENSSL_PATH
      process.env.OPENSSL_BIN = opensslPath;
      ensureLegacyOpenSSLConfig(opensslPath);
      try {
        // Garante que o modulo pem use o mesmo binario explicitamente
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pemOpenSSL = require("pem/lib/openssl");
        if (typeof pemOpenSSL?.set === "function") {
          pemOpenSSL.set("pathOpenSSL", opensslPath);
        }
      } catch {
        // noop
      }
    }
    const tempPfxPath = path.join(
      os.tmpdir(),
      `sefaz-cert-${crypto.randomBytes(8).toString("hex")}.pfx`,
    );
    fs.writeFileSync(tempPfxPath, this.config.certificateBuffer);

    return new Tools(
      toolsConfig,
      {
        // node-sped-nfe/pem expects a filesystem path for pfx
        pfx: tempPfxPath,
        senha: this.config.certificatePassword,
      },
    );
  }

  async signNFe(xmlContent: string): Promise<string> {
    const expectedTpAmb: "1" | "2" =
      this.config.environment === "producao" ? "1" : "2";
    let xmlBody = normalizeXmlForTransmission(stripEnviNFe(xmlContent));
    xmlBody = forceTpAmb(xmlBody, expectedTpAmb);
    const referenceId = extractInfNFeId(xmlBody);
    if (!referenceId) {
      throw new Error("XML invalido: infNFe Id nao encontrado para assinatura");
    }
    return XMLSignatureService.signXML(
      xmlBody,
      this.config.certificateBuffer.toString("base64"),
      this.config.certificatePassword,
      referenceId,
    );
  }

  async signNFeWithTools(xmlContent: string): Promise<string> {
    const tools = this.buildTools("55");
    const expectedTpAmb: "1" | "2" =
      this.config.environment === "producao" ? "1" : "2";
    let xmlBody = normalizeXmlForTransmission(stripEnviNFe(xmlContent));
    xmlBody = forceTpAmb(xmlBody, expectedTpAmb);
    return tools.xmlSign(xmlBody, { tag: "infNFe" });
  }

  async submitNFe(xmlContent: string): Promise<SubmissionResult> {
    try {
      const tools = this.buildTools("55");
      const loteId = String(Date.now());
      const expectedTpAmb: "1" | "2" =
        this.config.environment === "producao" ? "1" : "2";
      const strippedXml = stripEnviNFe(sanitizeXmlPayload(xmlContent));
      const alreadySigned = hasSignature(strippedXml);
      let xmlBody = normalizeXmlForTransmission(strippedXml);
      const currentTpAmb = readTpAmb(xmlBody);

      if (currentTpAmb && currentTpAmb !== expectedTpAmb && alreadySigned) {
        throw new Error(
          `XML assinado com tpAmb=${currentTpAmb}, mas envio esta em ${
            expectedTpAmb === "1" ? "producao" : "homologacao"
          }. Gere/assine novamente no ambiente correto.`,
        );
      }

      if (!alreadySigned) {
        xmlBody = forceTpAmb(xmlBody, expectedTpAmb);
      }

      const signedXml = alreadySigned
        ? xmlBody
        : await this.signNFe(xmlBody);
      const submitDebug = await saveSubmitDebugXml({
        xmlContent: signedXml,
        docType: "nfe",
        uf: this.config.uf,
        environment: this.config.environment,
      });

      // Valida schema localmente para retornar erro objetivo antes de chamar a SEFAZ.
      try {
        await tools.validarNFe(signedXml);
      } catch (validationError) {
        const message = describeUnknownError(validationError);
        if (/xmllint/i.test(message)) {
          console.warn(
            "[SEFAZ] Validacao de schema local indisponivel (xmllint nao encontrado). Prosseguindo com envio para a SEFAZ.",
          );
        } else {
          throw new Error(`XML invalido no schema local: ${message}`);
        }
      }

      const response = await tools.sefazEnviaLote(
        signedXml,
        {
          idLote: loteId,
          indSinc: 1,
          compactar: false,
        } as any,
      );

      const parsed = resolveFinalStatus(String(response || ""));
      const status = parsed.status || "0";
      const soapFault = extractSoapFaultMessage(String(response || ""));
      const message =
        parsed.message ||
        (soapFault ? `Fault SOAP da SEFAZ: ${soapFault}` : "") ||
        "Resposta SEFAZ sem cStat";
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
        sentXmlPath: submitDebug.path,
        sentXmlSha256: submitDebug.sha256,
      };
    } catch (error) {
      const detailedMessage = describeUnknownError(error);
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        status: "error",
        message:
          detailedMessage.toLowerCase().includes("could not find openssl")
            ? "OpenSSL nao encontrado no servidor. Configure OPENSSL_PATH no .env (Windows ex.: C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe)."
            : detailedMessage || "Erro ao enviar NF-e",
      };
    }
  }

  async submitNFCe(xmlContent: string): Promise<SubmissionResult> {
    try {
      const tools = this.buildTools("65");
      const expectedTpAmb: "1" | "2" =
        this.config.environment === "producao" ? "1" : "2";
      const strippedXml = stripEnviNFe(sanitizeXmlPayload(xmlContent));
      const alreadySigned = hasSignature(strippedXml);
      const xmlBody = normalizeXmlForTransmission(strippedXml);
      if (!alreadySigned) {
        throw new Error("XML NFC-e sem assinatura. Assine antes do envio.");
      }
      const currentTpAmb = readTpAmb(xmlBody);
      if (currentTpAmb && currentTpAmb !== expectedTpAmb) {
        throw new Error(
          `XML NFC-e assinado com tpAmb=${currentTpAmb}, mas envio esta em ${
            expectedTpAmb === "1" ? "producao" : "homologacao"
          }.`,
        );
      }

      const response = await tools.sefazEnviaLote(
        xmlBody,
        {
          idLote: String(Date.now()),
          indSinc: 1,
          compactar: false,
        } as any,
      );
      const submitDebug = await saveSubmitDebugXml({
        xmlContent: xmlBody,
        docType: "nfce",
        uf: this.config.uf,
        environment: this.config.environment,
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
        sentXmlPath: submitDebug.path,
        sentXmlSha256: submitDebug.sha256,
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
        nSerie: Number(series),
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
    try {
      const xmlContent = String(_xmlContent || "");
      const receipt = extractTag("nRec", xmlContent).replace(/\D/g, "");
      const accessKey = (
        extractTag("chNFe", xmlContent) ||
        xmlContent.match(/<infNFe[^>]*Id="NFe(\d{44})"/i)?.[1] ||
        ""
      )
        .trim()
        .replace(/\D/g, "");
      const modFromXml = extractTag("mod", xmlContent);
      const mod: "55" | "65" = modFromXml === "65" ? "65" : "55";

      // If XML already contains final authorization result, return it directly.
      const initialParsed = resolveFinalStatus(xmlContent);
      if (["100", "150", "110", "301", "302", "303", "304"].includes(initialParsed.status)) {
        return {
          success: ["100", "150"].includes(initialParsed.status),
          protocol: initialParsed.protocol || "",
          timestamp: new Date(),
          status: initialParsed.status || "0",
          message: initialParsed.message || "Retorno processado",
          key: initialParsed.key || accessKey || undefined,
          rawResponse: xmlContent,
        };
      }

      if (accessKey && accessKey.length === 44) {
        if (mod === "65") {
          const nfceWs = resolveNfceWsEndpoints(
            this.config.uf,
            this.config.environment,
          );
          if (nfceWs?.NFeConsultaProtocolo) {
            const cert = (await this.buildTools(mod).getCertificado()) as {
              key?: string;
              cert?: string;
              ca?: string[];
            };
            const tpAmb = this.config.environment === "producao" ? "1" : "2";
            const body =
              `<?xml version="1.0" encoding="utf-8"?>` +
              `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">` +
              `<soap:Body><nfe:nfeDadosMsg>` +
              `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
              `<tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${accessKey}</chNFe>` +
              `</consSitNFe></nfe:nfeDadosMsg></soap:Body></soap:Envelope>`;
            const responseXml = await new Promise<string>((resolve, reject) => {
              const req = https.request(
                nfceWs.NFeConsultaProtocolo,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/soap+xml; charset=utf-8",
                    "Content-Length": Buffer.byteLength(body),
                  },
                  rejectUnauthorized: false,
                  key: cert?.key,
                  cert: cert?.cert,
                  ca: cert?.ca,
                },
                (res) => {
                  let data = "";
                  res.on("data", (chunk) => {
                    data += String(chunk);
                  });
                  res.on("end", () => resolve(data));
                },
              );
              req.setTimeout((this.config.timeout ?? 60) * 1000, () => {
                req.destroy(new Error("Timeout ao consultar NFC-e por chave"));
              });
              req.on("error", reject);
              req.write(body);
              req.end();
            });
            const parsed = resolveFinalStatus(String(responseXml || ""));
            const status = parsed.status || "0";
            return {
              success: ["100", "150", "135", "136", "155"].includes(status),
              protocol: parsed.protocol || "",
              timestamp: new Date(),
              status,
              message: parsed.message || "Consulta de chave NFC-e realizada",
              key: parsed.key || accessKey,
              rawResponse: String(responseXml || ""),
            };
          }
        }
        const tools = this.buildTools(mod);
        const response = await tools.consultarNFe(accessKey);
        const parsed = resolveFinalStatus(String(response || ""));
        const status = parsed.status || "0";
        return {
          success: ["100", "150", "135", "136", "155"].includes(status),
          protocol: parsed.protocol || "",
          timestamp: new Date(),
          status,
          message: parsed.message || "Consulta de chave realizada",
          key: parsed.key || accessKey,
          rawResponse: String(response || ""),
        };
      }

      if (!receipt || receipt.length !== 15) {
        return {
          success: false,
          protocol: "",
          timestamp: new Date(),
          status: initialParsed.status || "0",
          message:
            initialParsed.message ||
            "Nao foi possivel identificar nRec/chNFe para consulta",
          rawResponse: xmlContent,
        };
      }

      const tools = this.buildTools(mod);
      const cert = (await tools.getCertificado()) as {
        key?: string;
        cert?: string;
        ca?: string[];
      };

      const nfceWs =
        mod === "65"
          ? resolveNfceWsEndpoints(this.config.uf, this.config.environment)
          : null;
      const endpoints = resolveSefazEventEndpoints(this.config.uf, "4.00") as any;
      const envKey =
        this.config.environment === "producao" ? "producao" : "homologacao";
      const ws =
        nfceWs?.NFeRetAutorizacao ||
        endpoints?.[`mod${mod}`]?.[envKey]?.NFeRetAutorizacao ||
        endpoints?.[envKey]?.NFeRetAutorizacao;

      if (!ws) {
        return {
          success: false,
          protocol: "",
          timestamp: new Date(),
          status: "0",
          message: `Webservice de recibo indisponivel para UF ${this.config.uf}/mod ${mod}`,
        };
      }

      const tpAmb = this.config.environment === "producao" ? "1" : "2";
      const body =
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">` +
        `<soap:Body><nfe:nfeDadosMsg>` +
        `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
        `<tpAmb>${tpAmb}</tpAmb><nRec>${receipt}</nRec>` +
        `</consReciNFe></nfe:nfeDadosMsg></soap:Body></soap:Envelope>`;

      const responseXml = await new Promise<string>((resolve, reject) => {
        const req = https.request(
          ws,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/soap+xml; charset=utf-8",
              "Content-Length": Buffer.byteLength(body),
            },
            rejectUnauthorized: false,
            key: cert?.key,
            cert: cert?.cert,
            ca: cert?.ca,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += String(chunk);
            });
            res.on("end", () => resolve(data));
          },
        );

        req.setTimeout((this.config.timeout ?? 60) * 1000, () => {
          req.destroy(new Error("Timeout ao consultar recibo"));
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });

      const parsed = resolveFinalStatus(responseXml);
      const status = parsed.status || "0";
      return {
        success: ["100", "150", "104", "135", "136", "155"].includes(status),
        protocol: parsed.protocol || "",
        timestamp: new Date(),
        status,
        message: parsed.message || "Consulta de recibo realizada",
        key: parsed.key || accessKey || undefined,
        rawResponse: responseXml,
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        status: "error",
        message:
          error instanceof Error ? error.message : "Erro ao consultar recibo",
      };
    }
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

  async distributeDFe(params?: {
    ultNSU?: string;
    accessKey?: string;
  }): Promise<DistributionResult> {
    try {
      const accessKey = String(params?.accessKey || "").replace(/\D/g, "") || undefined;
      const ultNSU = String(params?.ultNSU || "").replace(/\D/g, "") || undefined;
      if (!accessKey && !ultNSU) {
        throw new Error("Informe ultNSU ou chave de acesso para distribuicao DF-e");
      }

      const envKey = this.config.environment === "producao" ? "producao" : "homologacao";
      const eventEndpoints = resolveSefazEventEndpoints("AN", "4.00");
      const distEndpoint =
        eventEndpoints?.mod55?.[envKey]?.NFeDistribuicaoDFe ||
        (envKey === "producao"
          ? "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
          : "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx");
      if (!distEndpoint) {
        throw new Error("Endpoint NFeDistribuicaoDFe nao encontrado");
      }

      const certTools = this.buildTools("55", { skipXmllint: true });
      const cert = (await certTools.getCertificado()) as {
        key?: string;
        cert?: string;
        ca?: string[];
      };

      const ufToCode: Record<string, string> = {
        RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
        MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
        SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
        SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
      };
      const cUFAutor = ufToCode[String(this.config.uf || "").toUpperCase()] || "35";
      const tpAmb = this.config.environment === "producao" ? "1" : "2";
      const cnpj = String(this.config.cnpj || "").replace(/\D/g, "");
      if (cnpj.length !== 14) {
        throw new Error("CNPJ da empresa invalido para distribuicao DF-e");
      }

      const distSelector = accessKey
        ? `<consChNFe><chNFe>${accessKey}</chNFe></consChNFe>`
        : `<distNSU><ultNSU>${String(ultNSU).padStart(15, "0")}</ultNSU></distNSU>`;

      const body =
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
        `<soap:Body>` +
        `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
        `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
        `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<cUFAutor>${cUFAutor}</cUFAutor>` +
        `<CNPJ>${cnpj}</CNPJ>` +
        distSelector +
        `</distDFeInt>` +
        `</nfeDadosMsg>` +
        `</nfeDistDFeInteresse>` +
        `</soap:Body>` +
        `</soap:Envelope>`;

      const xml = await new Promise<string>((resolve, reject) => {
        const req = https.request(
          distEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/soap+xml; charset=utf-8",
              "Content-Length": Buffer.byteLength(body),
            },
            rejectUnauthorized: false,
            key: cert?.key,
            cert: cert?.cert,
            ca: cert?.ca,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += String(chunk);
            });
            res.on("end", () => resolve(String(data || "")));
          },
        );
        req.setTimeout((this.config.timeout ?? 60) * 1000, () => {
          req.destroy(new Error("Timeout na distribuicao DF-e"));
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });

      const status = extractTag("cStat", xml) || "0";
      const message = extractTag("xMotivo", xml) || "Resposta sem xMotivo";
      const lastNSU = extractTag("ultNSU", xml) || undefined;
      const maxNSU = extractTag("maxNSU", xml) || undefined;

      const documents = extractDocZipNodes(xml).map((node) => {
        const decoded = decodeDocZipPayload(node.payload);
        const documentKey =
          extractTag("chNFe", decoded) ||
          decoded.match(/<infNFe[^>]*Id="NFe(\d{44})"/i)?.[1] ||
          "";
        const issuerCnpj =
          extractTag("CNPJ", extractBlock("emit", decoded)) ||
          extractTag("CPF", extractBlock("emit", decoded)) ||
          "";
        const receiverCnpj =
          extractTag("CNPJ", extractBlock("dest", decoded)) ||
          extractTag("CPF", extractBlock("dest", decoded)) ||
          "";
        return {
          nsu: node.nsu,
          schema: node.schema,
          documentKey: documentKey || undefined,
          issuerCnpj: issuerCnpj || undefined,
          receiverCnpj: receiverCnpj || undefined,
          xmlContent: decoded,
        };
      });

      return {
        success: ["138", "137", "656"].includes(status),
        status,
        message,
        lastNSU,
        maxNSU,
        documents,
        rawResponse: xml,
      };
    } catch (error) {
      let detailedMessage = "Erro na distribuicao de DF-e";
      if (error instanceof Error) {
        detailedMessage = error.message || detailedMessage;
      } else if (typeof error === "string" && error.trim()) {
        detailedMessage = error.trim();
      } else if (error && typeof error === "object") {
        try {
          const serialized = JSON.stringify(error);
          if (serialized && serialized !== "{}") {
            detailedMessage = serialized;
          }
        } catch {
          // keep fallback message
        }
      }
      return {
        success: false,
        message: detailedMessage,
        documents: [],
      };
    }
  }

  async sendManifestationEvent(params: {
    accessKey: string;
    eventType:
      | "ciencia_da_operacao"
      | "confirmacao_da_operacao"
      | "desconhecimento_da_operacao"
      | "operacao_nao_realizada";
    reason?: string;
    sequence?: number;
  }): Promise<ManifestationResult> {
    try {
      const tools = this.buildTools("55", { skipXmllint: true });
      const eventMap: Record<string, string> = {
        ciencia_da_operacao: "210210",
        confirmacao_da_operacao: "210200",
        desconhecimento_da_operacao: "210220",
        operacao_nao_realizada: "210240",
      };
      const tpEvento = eventMap[params.eventType];
      if (!tpEvento) {
        return {
          success: false,
          status: "0",
          message: "Tipo de evento de manifestacao invalido",
        };
      }

      const response = await tools.sefazEvento({
        chNFe: params.accessKey,
        tpEvento,
        xJust:
          params.eventType === "operacao_nao_realizada"
            ? String(params.reason || "").trim()
            : undefined,
        nSeqEvento:
          typeof params.sequence === "number" && params.sequence > 0
            ? params.sequence
            : 1,
      });

      const parsed = resolveEventStatus(String(response || ""));
      const status = parsed.status || "0";
      const success = ["135", "136", "155"].includes(status);

      return {
        success,
        status,
        message: parsed.message || "Resposta sem xMotivo",
        protocol: parsed.protocol || undefined,
        eventId: `ID${tpEvento}${params.accessKey}${String(
          params.sequence || 1,
        ).padStart(2, "0")}`,
        rawResponse: String(response || ""),
      };
    } catch (error) {
      return {
        success: false,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Erro ao manifestar destinatario",
      };
    }
  }
}
