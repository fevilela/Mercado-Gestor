export type SefazEnvironment = "homologacao" | "producao";

export interface SefazConfig {
  environment: SefazEnvironment;
  uf: string;
  certificatePath: string;
  certificatePassword: string;
  sefazUrl?: string;
  sefazUrls?: Record<SefazEnvironment, Record<string, string>>;
  timeout?: number;
}

export interface SubmissionResult {
  success: boolean;
  protocol: string;
  timestamp: Date;
  status: string;
  message: string;
}

export interface ReceiptQueryResult {
  success: boolean;
  protocol: string;
  timestamp: Date;
  status: string;
  message: string;
}

export class SefazService {
  private config: SefazConfig;

  constructor(config: SefazConfig) {
    this.config = config;
  }

  async submitNFe(xmlContent: string): Promise<SubmissionResult> {
    try {
      const sefazUrl = this.resolveSefazUrl();

      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeDadosMsg>
      <![CDATA[${xmlContent}]]>
    </nfe:nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;

      const response = await fetch(sefazUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "SOAPAction": "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
        },
        body: soapEnvelope,
        signal: this.config.timeout
          ? AbortSignal.timeout(this.config.timeout)
          : undefined,
      });

      const responseText = await response.text();

      return {
        success: response.ok,
        protocol: "",
        timestamp: new Date(),
        status: response.ok ? "submitted" : "error",
        message: response.ok
          ? "NF-e enviada para SEFAZ"
          : `Falha ao enviar NF-e: ${response.status} ${response.statusText} - ${responseText}`,
      };
    } catch (error) {
      return {
        success: false,
        protocol: "",
        timestamp: new Date(),
        status: "error",
        message: error instanceof Error ? error.message : "Erro ao enviar NF-e",
      };
    }
  }

  async queryReceipt(xmlContent: string): Promise<ReceiptQueryResult> {
    try {
      const sefazUrl = this.resolveSefazUrl();

      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeDadosMsg>
      <![CDATA[${xmlContent}]]>
    </nfe:nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;

      const response = await fetch(sefazUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "SOAPAction": "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote",
        },
        body: soapEnvelope,
        signal: this.config.timeout
          ? AbortSignal.timeout(this.config.timeout)
          : undefined,
      });

      const responseText = await response.text();

      return {
        success: response.ok,
        protocol: "",
        timestamp: new Date(),
        status: response.ok ? "submitted" : "error",
        message: response.ok
          ? "Consulta de recibo enviada para SEFAZ"
          : `Falha ao consultar recibo: ${response.status} ${response.statusText} - ${responseText}`,
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

  private resolveSefazUrl(): string {
    const sefazUrl =
      this.config.sefazUrl ??
      this.config.sefazUrls?.[this.config.environment]?.[
        this.config.uf.toUpperCase()
      ];

    if (!sefazUrl) {
      throw new Error(
        `URL SEFAZ não configurada para ${this.config.uf} (${this.config.environment})`
      );
    }

    return sefazUrl;
  }
}
