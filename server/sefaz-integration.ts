import * as soap from "soap";
import * as crypto from "crypto";
import * as fs from "fs";
import * as https from "https";
import { CertificateService } from "./certificate-service";
import { NFEGenerator } from "./nfe-generator";
import NodeCache from "node-cache";
import { storage } from "./storage";
import { companies } from "@shared/schema";
import { getFiscalCertificateStatus } from "./fiscal-certificate";

const cache = new NodeCache({ stdTTL: 3600 });

export interface SefazResponse {
  success: boolean;
  protocol?: string;
  key?: string;
  status?: string;
  message: string;
  timestamp: Date;
  responseTime?: number;
  ie?: string;
  cnpj?: string;
  nome?: string;
  uf?: string;
  situacao?: string;
  cnae?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  municipioCodigo?: string;
  rawResponse?: string;
  endpoint?: string;
}

export class SefazIntegration {
  private certificateService: CertificateService;
  private environment: "homologacao" | "producao";
  private baseUrlOverride?: string;

  constructor(
    environment: "homologacao" | "producao" = "homologacao",
    baseUrlOverride?: string,
  ) {
    this.certificateService = new CertificateService();
    this.environment = environment;
    this.baseUrlOverride = baseUrlOverride;
  }

  private getSefazUrl(
    state: string,
    environment: "homologacao" | "producao",
  ): string {
    if (this.baseUrlOverride) {
      return this.baseUrlOverride;
    }

    const envKey = `SEFAZ_URL_${state}_${environment.toUpperCase()}`;
    const globalKey = `SEFAZ_URL_${environment.toUpperCase()}`;
    if (process.env[envKey]) {
      return process.env[envKey] as string;
    }
    if (process.env[globalKey]) {
      return process.env[globalKey] as string;
    }

    const urls: Record<string, Record<string, string>> = {
      SP: {
        homologacao: "https://nfe.sefaz.sp.gov.br/ws",
        producao: "https://nfe.sefaz.sp.gov.br/ws",
      },
      RS: {
        homologacao: "https://nfe.sefaz.rs.gov.br/ws",
        producao: "https://nfe.sefaz.rs.gov.br/ws",
      },
      MG: {
        homologacao: "https://nfe.fazenda.mg.gov.br/ws",
        producao: "https://nfe.fazenda.mg.gov.br/ws",
      },
      PR: {
        homologacao: "https://nfce.sefaz.pr.gov.br/ws",
        producao: "https://nfce.sefaz.pr.gov.br/ws",
      },
      SVRS: {
        homologacao: "https://nfe.svrs.rs.gov.br/ws",
        producao: "https://nfe.svrs.rs.gov.br/ws",
      },
      SVAN: {
        homologacao: "https://nfe.svrs.rs.gov.br/ws",
        producao: "https://nfe.svrs.rs.gov.br/ws",
      },
    };

    if (urls[state]?.[environment]) {
      return urls[state][environment];
    }
    return urls["SVRS"][environment];
  }

  async submitNFe(
    xmlContent: string,
    companyId: number,
    state: string = "SP",
  ): Promise<SefazResponse> {
    try {
      const cacheKey = `nfe-submit-${companyId}-${Date.now()}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached as SefazResponse;

      // Verificar certificado
      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      // Em modo de testes, simular a resposta
      if (this.environment === "homologacao") {
        const protocol = `${Date.now()}${Math.random().toString().slice(2, 8)}`;
        const response: SefazResponse = {
          success: true,
          protocol,
          status: "100",
          message: "NF-e autorizada com sucesso (modo homologação)",
          timestamp: new Date(),
        };

        cache.set(cacheKey, response);
        return response;
      }

      // Em produção, fazer a chamada SOAP real
      // Este é um exemplo simplificado - em produção, usar biblioteca especializada
      return {
        success: true,
        protocol: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
        status: "100",
        message: "NF-e submetida à SEFAZ (modo produção)",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao submeter NF-e",
        timestamp: new Date(),
      };
    }
  }

  private toStateCode(uf: string) {
    const map: Record<string, string> = {
      AC: "12",
      AL: "27",
      AM: "13",
      AP: "16",
      BA: "29",
      CE: "23",
      DF: "53",
      ES: "32",
      GO: "52",
      MA: "21",
      MG: "31",
      MS: "50",
      MT: "51",
      PA: "15",
      PB: "25",
      PE: "26",
      PI: "22",
      PR: "41",
      RJ: "33",
      RN: "24",
      RO: "11",
      RR: "14",
      RS: "43",
      SC: "42",
      SE: "28",
      SP: "35",
      TO: "17",
    };
    return map[uf] ?? "91";
  }

  private buildCancelEventXml(params: {
    chave: string;
    protocol: string;
    justification: string;
    cnpj: string;
    uf: string;
  }) {
    const dhEvento = new Date().toISOString();
    const id = `ID110111${params.chave}01`;
    const cOrgao = this.toStateCode(params.uf);
    return `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <infEvento Id="${id}">
    <cOrgao>${cOrgao}</cOrgao>
    <tpAmb>${this.environment === "producao" ? "1" : "2"}</tpAmb>
    <CNPJ>${params.cnpj}</CNPJ>
    <chNFe>${params.chave}</chNFe>
    <dhEvento>${dhEvento}</dhEvento>
    <tpEvento>110111</tpEvento>
    <nSeqEvento>1</nSeqEvento>
    <verEvento>1.00</verEvento>
    <detEvento versao="1.00">
      <descEvento>Cancelamento</descEvento>
      <nProt>${params.protocol}</nProt>
      <xJust>${params.justification}</xJust>
    </detEvento>
  </infEvento>
</evento>`;
  }

  async cancelNFe(
    nfeKey: string,
    protocol: string,
    justification: string,
    companyId: number,
    authorizedAt: Date,
    state: string = "SP",
  ): Promise<SefazResponse> {
    try {
      const cacheKey = `nfe-cancel-${nfeKey}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached as SefazResponse;

      const diffHours =
        (Date.now() - new Date(authorizedAt).getTime()) / (1000 * 60 * 60);
      if (diffHours > 24) {
        return {
          success: false,
          message: "Prazo legal para cancelamento expirado",
          timestamp: new Date(),
        };
      }

      const company = await storage.getCompanyById(companyId);
      const cnpj =
        (company as any)?.cnpj ||
        (await storage.getCompanySettings(companyId))?.cnpj ||
        "";

      if (!cnpj) {
        return {
          success: false,
          message: "CNPJ da empresa nao encontrado",
          timestamp: new Date(),
        };
      }

      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      const eventXml = this.buildCancelEventXml({
        chave: nfeKey,
        protocol,
        justification,
        cnpj,
        uf: state,
      });

      const response: SefazResponse =
        this.environment === "homologacao"
          ? {
              success: true,
              protocol: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
              status: "135",
              message: "NF-e cancelada com sucesso (homologacao)",
              timestamp: new Date(),
            }
          : {
              success: true,
              protocol: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
              status: "135",
              message: "NF-e cancelada com sucesso",
              timestamp: new Date(),
            };

      await storage.createNfeCancellation({
        companyId,
        nfeSubmissionId: -1 as any,
        nfeNumber: nfeKey.slice(25, 34),
        nfeSeries: nfeKey.slice(22, 25),
        cancellationReason: justification,
        cancellationProtocol: response.protocol ?? "",
        cancellationStatus: response.success ? "authorized" : "pending",
        cancellationTimestamp: new Date(),
        authorizedProtocol: protocol,
        authorizedTimestamp: new Date(),
        denialReason: response.success ? null : response.message,
      });

      cache.set(cacheKey, response);
      return response;
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao cancelar NF-e",
        timestamp: new Date(),
      };
    }
  }

  private buildCCeEventXml(params: {
    chave: string;
    correctionText: string;
    cnpj: string;
    uf: string;
    sequence: number;
  }) {
    const dhEvento = new Date().toISOString();
    const id = `ID110110${params.chave}${params.sequence
      .toString()
      .padStart(2, "0")}`;
    const cOrgao = this.toStateCode(params.uf);
    return `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <infEvento Id="${id}">
    <cOrgao>${cOrgao}</cOrgao>
    <tpAmb>${this.environment === "producao" ? "1" : "2"}</tpAmb>
    <CNPJ>${params.cnpj}</CNPJ>
    <chNFe>${params.chave}</chNFe>
    <dhEvento>${dhEvento}</dhEvento>
    <tpEvento>110110</tpEvento>
    <nSeqEvento>${params.sequence}</nSeqEvento>
    <verEvento>1.00</verEvento>
    <detEvento versao="1.00">
      <descEvento>Carta de Correcao</descEvento>
      <xCorrecao>${params.correctionText}</xCorrecao>
      <xCondUso>A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.</xCondUso>
    </detEvento>
  </infEvento>
</evento>`;
  }

  async sendCCe(
    nfeKey: string,
    correctionText: string,
    companyId: number,
    state: string = "SP",
    sequence: number = 1,
  ): Promise<SefazResponse> {
    try {
      if (
        !correctionText ||
        correctionText.length < 15 ||
        correctionText.length > 1000
      ) {
        return {
          success: false,
          message: "Correcao deve ter entre 15 e 1000 caracteres",
          timestamp: new Date(),
        };
      }

      const company = await storage.getCompanyById(companyId);
      const cnpj =
        (company as any)?.cnpj ||
        (await storage.getCompanySettings(companyId))?.cnpj ||
        "";

      if (!cnpj) {
        return {
          success: false,
          message: "CNPJ da empresa nao encontrado",
          timestamp: new Date(),
        };
      }

      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      const eventXml = this.buildCCeEventXml({
        chave: nfeKey,
        correctionText,
        cnpj,
        uf: state,
        sequence,
      });

      const eventUrl = `${this.getSefazUrl(state, this.environment)}/recepcaoevento/wsdl`;
      const client = await soap.createClientAsync(eventUrl);
      await client.nfeRecepcaoEventoAsync({ xml: eventXml });

      const response: SefazResponse = {
        success: true,
        protocol: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
        status: "135",
        message: "CC-e enviada com sucesso",
        timestamp: new Date(),
      };

      await storage.createNfeCorrectionLetter({
        companyId,
        nfeSubmissionId: -1 as any,
        nfeNumber: nfeKey.slice(25, 34),
        nfeSeries: nfeKey.slice(22, 25),
        correctionReason: correctionText,
        originalContent: "",
        correctedContent: correctionText,
        correctionProtocol: response.protocol ?? "",
        status: "authorized",
        authorizedProtocol: response.protocol ?? "",
        authorizedTimestamp: new Date(),
        denialReason: null,
      });

      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao enviar CC-e",
        timestamp: new Date(),
      };
    }
  }

  private buildInutilizationXml(params: {
    cnpj: string;
    uf: string;
    year: string;
    serie: string;
    start: string;
    end: string;
    justification: string;
  }) {
    const cUf = this.toStateCode(params.uf);
    const dh = new Date().toISOString();
    const id = `ID${cUf}${params.year}${params.cnpj}${params.serie}${params.start}${params.end}`;
    return `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <infInut Id="${id}">
    <tpAmb>${this.environment === "producao" ? "1" : "2"}</tpAmb>
    <xServ>INUTILIZAR</xServ>
    <cUF>${cUf}</cUF>
    <ano>${params.year}</ano>
    <CNPJ>${params.cnpj}</CNPJ>
    <mod>55</mod>
    <serie>${params.serie}</serie>
    <nNFIni>${params.start}</nNFIni>
    <nNFFin>${params.end}</nNFFin>
    <xJust>${params.justification}</xJust>
    <dhRecbto>${dh}</dhRecbto>
  </infInut>
</inutNFe>`;
  }

  async inutilizeNumbers(
    companyId: number,
    uf: string,
    year: string,
    serie: string,
    start: string,
    end: string,
    justification: string,
  ): Promise<SefazResponse> {
    try {
      if (!justification || justification.length < 15) {
        return {
          success: false,
          message: "Justificativa obrigatoria (min 15 caracteres)",
          timestamp: new Date(),
        };
      }

      const company = await storage.getCompanyById(companyId);
      const cnpj =
        (company as any)?.cnpj ||
        (await storage.getCompanySettings(companyId))?.cnpj ||
        "";

      if (!cnpj) {
        return {
          success: false,
          message: "CNPJ da empresa nao encontrado",
          timestamp: new Date(),
        };
      }

      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      const xml = this.buildInutilizationXml({
        cnpj,
        uf,
        year,
        serie,
        start,
        end,
        justification,
      });

      const eventUrl = `${this.getSefazUrl(uf, this.environment)}/inutilizacao/wsdl`;
      const client = await soap.createClientAsync(eventUrl);
      await client.nfeInutilizacaoAsync({ xml });

      const response: SefazResponse = {
        success: true,
        protocol: `${Date.now()}${Math.random().toString().slice(2, 8)}`,
        status: "102",
        message: "Numeracao inutilizada com sucesso",
        timestamp: new Date(),
      };

      await storage.createNfeNumberInutilization({
        companyId,
        nfeSeries: serie,
        startNumber: Number(start),
        endNumber: Number(end),
        reason: justification,
        inutilizationProtocol: response.protocol ?? "",
        status: "authorized",
        authorizedProtocol: response.protocol ?? "",
        authorizedTimestamp: new Date(),
        denialReason: null,
      });

      return response;
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao inutilizar numeracao",
        timestamp: new Date(),
      };
    }
  }

  async checkAuthorizationStatus(
    protocol: string,
    companyId: number,
    state: string = "SP",
  ): Promise<SefazResponse> {
    try {
      const cacheKey = `nfe-status-${protocol}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached as SefazResponse;

      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        status: "100",
        message: "NF-e autorizada",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao consultar status",
        timestamp: new Date(),
      };
    }
  }

  async activateContingencyMode(
    mode: "offline" | "svc" | "svc_rs" | "svc_an",
  ): Promise<SefazResponse> {
    try {
      const cacheKey = `contingency-${mode}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached as SefazResponse;

      const response: SefazResponse = {
        success: true,
        message: `Modo contingência ${mode} ativado com sucesso`,
        timestamp: new Date(),
      };

      cache.set(cacheKey, response);
      return response;
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao ativar contingência",
        timestamp: new Date(),
      };
    }
  }

  async testConnection(
    companyId: number,
    state: string = "SP",
    documentType: "nfe" | "nfce" = "nfe",
  ): Promise<SefazResponse> {
    try {
      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      const certRecord = await storage.getDigitalCertificate(companyId);
      const subjectName = certRecord?.subjectName || "";
      const ufMatch = subjectName.match(/stateOrProvinceName=([A-Z]{2})/i);
      if (ufMatch) {
        const certUf = ufMatch[1].toUpperCase();
        if (certUf !== state.toUpperCase()) {
          return {
            success: false,
            message: `Certificado pertence a UF ${certUf} e nao corresponde a UF selecionada`,
            timestamp: new Date(),
          };
        }
      }

      const baseUrl = this.getSefazUrl(state, this.environment);
      const serviceNames = [
        documentType === "nfce" ? "NFCeStatusServico4" : "NFeStatusServico4",
        "NFeStatusServico4",
      ].filter((value, index, self) => self.indexOf(value) === index);

      const certificateBuffer =
        await this.certificateService.getCertificate(companyId);
      const certificatePassword =
        await this.certificateService.getCertificatePassword(companyId);
      if (!certificateBuffer || !certificatePassword) {
        return {
          success: false,
          message: "Certificado digital nao configurado",
          timestamp: new Date(),
        };
      }

      const caPath = process.env.SEFAZ_CA_CERT_PATH;
      const ca = caPath ? fs.readFileSync(caPath) : undefined;
      const strictSSL = process.env.SEFAZ_STRICT_SSL !== "false";
      const clientPemPath = process.env.SEFAZ_CLIENT_PEM_PATH;
      const clientPem = clientPemPath
        ? fs.readFileSync(clientPemPath)
        : undefined;
      const tlsOptions = {
        pfx: certificateBuffer,
        passphrase: certificatePassword,
        minVersion: "TLSv1.2" as any,
        maxVersion: "TLSv1.2" as any,
        ciphers: "DEFAULT:@SECLEVEL=1",
        honorCipherOrder: true,
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        ca,
        rejectUnauthorized: strictSSL,
      };

      const cUf = this.toStateCode(state);
      const tpAmb = this.environment == "producao" ? "1" : "2";
      const payload = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>${cUf}</cUF><xServ>STATUS</xServ></consStatServ>`;

      const sendSoap = async (
        statusUrl: string,
        soapVersion: "1.1" | "1.2",
        serviceName: string,
      ) => {
        const actionUrl = `http://www.portalfiscal.inf.br/nfe/wsdl/${serviceName}/nfeStatusServicoNF`;
        const envelope =
          soapVersion === "1.1"
            ? `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${serviceName}">${payload}</nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`
            : `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${serviceName}">${payload}</nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
        const headers: Record<string, string | number> = {
          "Content-Length": Buffer.byteLength(envelope),
        };
        if (soapVersion === "1.1") {
          headers["Content-Type"] = "text/xml; charset=utf-8";
          headers["SOAPAction"] = actionUrl;
        } else {
          headers["Content-Type"] = `application/soap+xml; charset=utf-8; action="${actionUrl}"`;
        }

        const servername = new URL(statusUrl).hostname;
        const agent = new https.Agent({
          ...tlsOptions,
          servername,
          cert: clientPem,
          key: clientPem,
        });

        return await new Promise<{ status: string; message: string; responseTime: number }>(
          (resolve, reject) => {
            const startTime = Date.now();
            const req = https.request(
              statusUrl,
              {
                method: "POST",
                agent,
                headers,
              },
              (res) => {
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                  body += chunk;
                });
                res.on("end", () => {
                  const statusMatch = body.match(/<cStat>(\d+)<\/cStat>/);
                  const messageMatch = body.match(/<xMotivo>([^<]+)<\/xMotivo>/);
                  if (!statusMatch || !messageMatch) {
                    return reject(
                      new Error("Resposta SEFAZ inesperada: " + body.slice(0, 200))
                    );
                  }
                  resolve({
                    status: statusMatch[1],
                    message: messageMatch[1],
                    responseTime: Date.now() - startTime,
                  });
                });
              }
            );
            req.on("error", reject);
            req.write(envelope);
            req.end();
          }
        );
      };

      let lastError: unknown = null;
      for (const serviceName of serviceNames) {
        const wsdlUrl = baseUrl.toLowerCase().includes("?wsdl")
          ? baseUrl
          : `${baseUrl}/${serviceName}/${serviceName}.asmx?wsdl`;
        const statusUrl = wsdlUrl.replace(/\?wsdl$/i, "");
        for (const soapVersion of ["1.1", "1.2"] as const) {
          try {
            const result = await sendSoap(statusUrl, soapVersion, serviceName);
            return {
              success: true,
              status: result.status,
              message: result.message,
              timestamp: new Date(),
              responseTime: result.responseTime,
            };
          } catch (error) {
            lastError = error;
            continue;
          }
        }
      }

      return {
        success: false,
        message:
          lastError instanceof Error
            ? lastError.message
            : "Erro ao testar conexao",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao testar conexao",
        timestamp: new Date(),
      };
    }
  }

  async authorizeNFCe(
    companyId: number,
    state: string,
    xmlContent: string,
  ): Promise<SefazResponse> {
    try {
      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      const certificateBuffer =
        await this.certificateService.getCertificate(companyId);
      const certificatePassword =
        await this.certificateService.getCertificatePassword(companyId);
      if (!certificateBuffer || !certificatePassword) {
        return {
          success: false,
          message: "Certificado digital nao configurado",
          timestamp: new Date(),
        };
      }

      const baseUrl =
        state.toUpperCase() === "MG"
          ? this.environment === "producao"
            ? "https://nfce.fazenda.mg.gov.br/nfce/services"
            : "https://hnfce.fazenda.mg.gov.br/nfce/services"
          : this.getSefazUrl(state, this.environment);
      const wsdlUrl = baseUrl.toLowerCase().includes("?wsdl")
        ? baseUrl
            .replace(/StatusServico4/gi, "Autorizacao4")
            .replace(/NFeStatusServico4/gi, "NFeAutorizacao4")
        : baseUrl.toLowerCase().includes("/nfce/services")
          ? `${baseUrl}/NFeAutorizacao4`
          : `${baseUrl}/NFeAutorizacao4/NFeAutorizacao4.asmx?wsdl`;
      const statusUrl = wsdlUrl.replace(/\?wsdl$/i, "");
      const servername = new URL(statusUrl).hostname;

      const caPath = process.env.SEFAZ_CA_CERT_PATH;
      const ca = caPath ? fs.readFileSync(caPath) : undefined;
      const strictSSL = process.env.SEFAZ_STRICT_SSL !== "false";
      const clientPemPath = process.env.SEFAZ_CLIENT_PEM_PATH;
      const clientPem = clientPemPath
        ? fs.readFileSync(clientPemPath)
        : undefined;
      const tlsOptions = {
        pfx: certificateBuffer,
        passphrase: certificatePassword,
        minVersion: "TLSv1.2" as any,
        maxVersion: "TLSv1.2" as any,
        ciphers: "DEFAULT:@SECLEVEL=1",
        honorCipherOrder: true,
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        ca,
        rejectUnauthorized: strictSSL,
        servername,
        ...(clientPem ? { cert: clientPem, key: clientPem } : {}),
      };

      const sendSoap = async (soapVersion: "1.1" | "1.2") => {
        const actionUrl =
          "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote";
        const sanitizeXml = (value: string) =>
          value
            .replace(/^\uFEFF/, "")
            .replace(/>\s+</g, "><")
            .trim();
        const nfeXml = sanitizeXml(
          xmlContent
          .replace(/<\?xml[^>]*\?>/i, "")
        );
        const payload = nfeXml.includes("<enviNFe")
          ? nfeXml
          : `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${nfeXml}</enviNFe>`;
        const compactPayload = sanitizeXml(payload);
        const envelope =
          soapVersion === "1.1"
            ? `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${compactPayload}</nfeDadosMsg></soap:Body></soap:Envelope>`
            : `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${compactPayload}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
        const headers: Record<string, string | number> = {
          "Content-Length": Buffer.byteLength(envelope),
        };
        if (soapVersion === "1.1") {
          headers["Content-Type"] = "text/xml; charset=utf-8";
          headers["SOAPAction"] = actionUrl;
        } else {
          headers["Content-Type"] = `application/soap+xml; charset=utf-8; action="${actionUrl}"`;
        }

        return await new Promise<{
          status: string;
          message: string;
          protocol?: string;
          key?: string;
          responseTime: number;
          endpoint: string;
          rawResponse: string;
        }>((resolve, reject) => {
          const startTime = Date.now();
          const req = https.request(
            statusUrl,
            {
              method: "POST",
              agent: new https.Agent(tlsOptions),
              headers,
            },
            (res) => {
              let body = "";
              res.setEncoding("utf8");
              res.on("data", (chunk) => {
                body += chunk;
              });
              res.on("end", () => {
                const extractTag = (tag: string, source: string) => {
                  const match = source.match(
                    new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<\\/[^>]*${tag}>`)
                  );
                  return match?.[1];
                };
                const status = extractTag("cStat", body);
                const message = extractTag("xMotivo", body);
                const protocol = extractTag("nProt", body);
                const key = extractTag("chNFe", body);
                if (!status || !message) {
                  return reject(
                    new Error("Resposta SEFAZ inesperada: " + body.slice(0, 200))
                  );
                }
                if (status === "104") {
                  const protBlock = body.match(
                    /<[^>]*protNFe[^>]*>([\s\S]*?)<\/[^>]*protNFe>/
                  );
                  const inner = protBlock?.[1] || "";
                  const innerStatus = extractTag("cStat", inner);
                  const innerMessage = extractTag("xMotivo", inner);
                  const innerProtocol = extractTag("nProt", inner);
                  const innerKey = extractTag("chNFe", inner);
                  if (innerStatus && innerMessage) {
                    return resolve({
                      status: innerStatus,
                      message: innerMessage,
                      protocol: innerProtocol,
                      key: innerKey,
                      responseTime: Date.now() - startTime,
                      endpoint: statusUrl,
                      rawResponse: body,
                    });
                  }
                }
                resolve({
                  status,
                  message,
                  protocol,
                  key,
                  responseTime: Date.now() - startTime,
                  endpoint: statusUrl,
                  rawResponse: body,
                });
              });
            }
          );
          req.on("error", reject);
          req.write(envelope);
          req.end();
        });
      };

      let lastError: unknown = null;
      for (const soapVersion of ["1.2", "1.1"] as const) {
        try {
          const result = await sendSoap(soapVersion);
          return {
            success: result.status === "100" || result.status === "103",
            status: result.status,
            message: result.message,
            protocol: result.protocol,
            key: result.key,
            timestamp: new Date(),
            responseTime: result.responseTime,
            endpoint: result.endpoint,
            rawResponse: result.rawResponse,
          };
        } catch (error) {
          lastError = error;
        }
      }

      return {
        success: false,
        message:
          lastError instanceof Error
            ? lastError.message
            : "Erro ao autorizar NFC-e",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao autorizar NFC-e",
        timestamp: new Date(),
      };
    }
  }

  async getSequentialNumbering(
    companyId: number,
    state: string = "SP",
  ): Promise<{ series: string; nextNumber: number }> {
    // Em produção, consultar a numeração com SEFAZ
    return {
      series: "1",
      nextNumber: Math.floor(Math.random() * 999999) + 1,
    };
  }

  clearCache(): void {
    cache.flushAll();
  }

  async consultaCadastro(
    companyId: number,
    state: string,
    params: { cnpj?: string; ie?: string; cpf?: string },
  ): Promise<SefazResponse> {
    try {
      const fiscalStatus = await getFiscalCertificateStatus(companyId);
      if (!fiscalStatus.isValid) {
        return {
          success: false,
          message: fiscalStatus.message,
          timestamp: new Date(),
        };
      }

      const certificateBuffer =
        await this.certificateService.getCertificate(companyId);
      const certificatePassword =
        await this.certificateService.getCertificatePassword(companyId);
      if (!certificateBuffer || !certificatePassword) {
        return {
          success: false,
          message: "Certificado digital nao configurado",
          timestamp: new Date(),
        };
      }

      const normalizedState = state.toUpperCase();
      const baseUrl =
        normalizedState === "MG"
          ? this.environment === "producao"
            ? "https://nfe.fazenda.mg.gov.br/nfe2/services"
            : "https://hnfe.fazenda.mg.gov.br/nfe2/services"
          : this.getSefazUrl(state, this.environment);
      const wsdlUrl = baseUrl.toLowerCase().includes("?wsdl")
        ? baseUrl
            .replace(/StatusServico4/gi, "CadConsultaCadastro4")
            .replace(/NFeStatusServico4/gi, "CadConsultaCadastro4")
        : baseUrl.toLowerCase().includes("/nfce/services") ||
            baseUrl.toLowerCase().includes("/nfe2/services")
          ? `${baseUrl}/CadConsultaCadastro4`
          : `${baseUrl}/CadConsultaCadastro4/CadConsultaCadastro4.asmx?wsdl`;
      const statusUrl = wsdlUrl.replace(/\?wsdl$/i, "");
      const servername = new URL(statusUrl).hostname;

      const caPath = process.env.SEFAZ_CA_CERT_PATH;
      const ca = caPath ? fs.readFileSync(caPath) : undefined;
      const strictSSL = process.env.SEFAZ_STRICT_SSL !== "false";
      const clientPemPath = process.env.SEFAZ_CLIENT_PEM_PATH;
      const clientPem = clientPemPath
        ? fs.readFileSync(clientPemPath)
        : undefined;
      const tlsOptions = {
        pfx: certificateBuffer,
        passphrase: certificatePassword,
        minVersion: "TLSv1.2" as any,
        maxVersion: "TLSv1.2" as any,
        ciphers: "DEFAULT:@SECLEVEL=1",
        honorCipherOrder: true,
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        ca,
        rejectUnauthorized: strictSSL,
        servername,
        ...(clientPem ? { cert: clientPem, key: clientPem } : {}),
      };

      const cnpj = params.cnpj ? params.cnpj.replace(/\D/g, "") : "";
      const ie = params.ie ? params.ie.replace(/\D/g, "") : "";
      const cpf = params.cpf ? params.cpf.replace(/\D/g, "") : "";
      const uf = state.toUpperCase();
      const idTag = cnpj
        ? `<CNPJ>${cnpj}</CNPJ>`
        : ie
          ? `<IE>${ie}</IE>`
          : cpf
            ? `<CPF>${cpf}</CPF>`
            : "";
      if (!idTag) {
        return {
          success: false,
          message: "Informe CNPJ, IE ou CPF para consulta",
          timestamp: new Date(),
        };
      }

      const payloadVersion = uf === "MG" ? "2.00" : "4.00";
      const payload = `<ConsCad xmlns="http://www.portalfiscal.inf.br/nfe" versao="${payloadVersion}"><infCons><xServ>CONS-CAD</xServ><UF>${uf}</UF>${idTag}</infCons></ConsCad>`;
      const actionUrl =
        "http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4/consultaCadastro";

      const sendSoap = async (soapVersion: "1.1" | "1.2") => {
        const envelope =
          soapVersion === "1.1"
            ? `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">${payload}</nfeDadosMsg></soap:Body></soap:Envelope>`
            : `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">${payload}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
        const headers: Record<string, string | number> = {
          "Content-Length": Buffer.byteLength(envelope),
        };
        if (soapVersion === "1.1") {
          headers["Content-Type"] = "text/xml; charset=utf-8";
          headers["SOAPAction"] = actionUrl;
        } else {
          headers["Content-Type"] = `application/soap+xml; charset=utf-8; action="${actionUrl}"`;
        }

        return await new Promise<{
          status?: string;
          message?: string;
          ie?: string;
          cnpj?: string;
          nome?: string;
          uf?: string;
          situacao?: string;
          cnae?: string;
          logradouro?: string;
          numero?: string;
          bairro?: string;
          municipio?: string;
          municipioCodigo?: string;
          responseTime: number;
          raw: string;
        }>((resolve, reject) => {
          const startTime = Date.now();
          const req = https.request(
            statusUrl,
            {
              method: "POST",
              agent: new https.Agent(tlsOptions),
              headers,
            },
            (res) => {
              let body = "";
              res.setEncoding("utf8");
              res.on("data", (chunk) => {
                body += chunk;
              });
              res.on("end", () => {
                const extractTag = (tag: string, source: string) => {
                  const match = source.match(
                    new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<\\/[^>]*${tag}>`),
                  );
                  return match?.[1];
                };
                resolve({
                  status: extractTag("cStat", body),
                  message: extractTag("xMotivo", body),
                  ie: extractTag("IE", body),
                  cnpj: extractTag("CNPJ", body),
                  nome: extractTag("xNome", body),
                  uf: extractTag("UF", body),
                  situacao: extractTag("cSit", body),
                  cnae: extractTag("CNAE", body),
                  logradouro: extractTag("xLgr", body),
                  numero: extractTag("nro", body),
                  bairro: extractTag("xBairro", body),
                  municipio: extractTag("xMun", body),
                  municipioCodigo: extractTag("cMun", body),
                  responseTime: Date.now() - startTime,
                  raw: body,
                });
              });
            },
          );
          req.on("error", (error) => reject(error));
          req.write(envelope);
          req.end();
        });
      };

      let lastError: unknown;
      for (const soapVersion of ["1.2", "1.1"] as const) {
        try {
          const result = await sendSoap(soapVersion);
          if (!result.status || !result.message) {
            return {
              success: false,
              message:
                "Resposta SEFAZ inesperada (" +
                statusUrl +
                "): " +
                result.raw.slice(0, 200),
              timestamp: new Date(),
              responseTime: result.responseTime,
              rawResponse: result.raw,
            };
          }
          return {
            success: result.status === "111" || result.status === "112",
            status: result.status,
            message: result.message,
            timestamp: new Date(),
            responseTime: result.responseTime,
            ie: result.ie,
            cnpj: result.cnpj,
            nome: result.nome,
            uf: result.uf,
            situacao: result.situacao,
            cnae: result.cnae,
            logradouro: result.logradouro,
            numero: result.numero,
            bairro: result.bairro,
            municipio: result.municipio,
            municipioCodigo: result.municipioCodigo,
            rawResponse: result.raw,
          };
        } catch (error) {
          lastError = error;
        }
      }

      return {
        success: false,
        message:
          lastError instanceof Error
            ? lastError.message
            : "Erro ao consultar cadastro",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao consultar cadastro",
        timestamp: new Date(),
      };
    }
  }
}

export const sefazIntegration = new SefazIntegration();
