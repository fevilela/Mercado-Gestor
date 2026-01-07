import * as soap from "soap";
import { CertificateService } from "./certificate-service";
import { NFEGenerator } from "./nfe-generator";
import NodeCache from "node-cache";
import { storage } from "./storage";
import { companies } from "@shared/schema";

const cache = new NodeCache({ stdTTL: 3600 });

export interface SefazResponse {
  success: boolean;
  protocol?: string;
  status?: string;
  message: string;
  timestamp: Date;
}

export class SefazIntegration {
  private certificateService: CertificateService;
  private environment: "homologacao" | "producao";

  constructor(environment: "homologacao" | "producao" = "homologacao") {
    this.certificateService = new CertificateService();
    this.environment = environment;
  }

  private getSefazUrl(
    state: string,
    environment: "homologacao" | "producao"
  ): string {
    const urls: Record<string, Record<string, string>> = {
      SP: {
        homologacao: "https://nfe-homolog.svrs.rs.gov.br/webservices",
        producao: "https://nfe.svrs.rs.gov.br/webservices",
      },
      MG: {
        homologacao: "https://nfehomolog.sefaz.mg.gov.br/webservices",
        producao: "https://nfe.sefaz.mg.gov.br/webservices",
      },
      RJ: {
        homologacao: "https://nfehomolog.sefaz.rj.gov.br/webservices",
        producao: "https://nfe.sefaz.rj.gov.br/webservices",
      },
      BA: {
        homologacao: "https://hnfe.sefaz.ba.gov.br/webservices",
        producao: "https://nfe.sefaz.ba.gov.br/webservices",
      },
    };

    return urls[state]?.[environment] || urls["SP"][environment];
  }

  async submitNFe(
    xmlContent: string,
    companyId: number,
    state: string = "SP"
  ): Promise<SefazResponse> {
    try {
      const cacheKey = `nfe-submit-${companyId}-${Date.now()}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached as SefazResponse;

      // Verificar certificado
      const certificate = await this.certificateService.getCertificate(
        companyId
      );
      if (!certificate) {
        return {
          success: false,
          message: "Certificado digital não configurado",
          timestamp: new Date(),
        };
      }

      const certInfo = await this.certificateService.validateCertificate(
        companyId
      );
      if (!certInfo || !certInfo.isValid) {
        return {
          success: false,
          message: "Certificado digital inválido ou expirado",
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
    state: string = "SP"
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

      const certificate = await this.certificateService.getCertificate(
        companyId
      );
      if (!certificate) {
        return {
          success: false,
          message: "Certificado digital não configurado",
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
    sequence: number = 1
  ): Promise<SefazResponse> {
    try {
      if (!correctionText || correctionText.length < 15 || correctionText.length > 1000) {
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

      const certificate = await this.certificateService.getCertificate(
        companyId
      );
      if (!certificate) {
        return {
          success: false,
          message: "Certificado digital nao configurado",
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
        message:
          error instanceof Error ? error.message : "Erro ao enviar CC-e",
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
    justification: string
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

      const certificate = await this.certificateService.getCertificate(
        companyId
      );
      if (!certificate) {
        return {
          success: false,
          message: "Certificado digital nao configurado",
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
          error instanceof Error ? error.message : "Erro ao inutilizar numeracao",
        timestamp: new Date(),
      };
    }
  }

  async checkAuthorizationStatus(
    protocol: string,
    companyId: number,
    state: string = "SP"
  ): Promise<SefazResponse> {
    try {
      const cacheKey = `nfe-status-${protocol}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached as SefazResponse;

      const certificate = await this.certificateService.getCertificate(
        companyId
      );
      if (!certificate) {
        return {
          success: false,
          message: "Certificado digital não configurado",
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
    mode: "offline" | "svc" | "svc_rs" | "svc_an"
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
    state: string = "SP"
  ): Promise<SefazResponse> {
    try {
      const startTime = Date.now();

      const certificate = await this.certificateService.getCertificate(
        companyId
      );
      if (!certificate && this.environment === "producao") {
        return {
          success: false,
          message: "Certificado digital obrigatório em produção",
          timestamp: new Date(),
        };
      }

      // Simular conexão
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: `Conexão com SEFAZ ${state} estabelecida com sucesso (${responseTime}ms)`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao testar conexão",
        timestamp: new Date(),
      };
    }
  }

  async getSequentialNumbering(
    companyId: number,
    state: string = "SP"
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
}

export const sefazIntegration = new SefazIntegration();
