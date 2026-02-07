import { Builder } from "xml2js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as crypto from "crypto";
import { XMLSignatureService } from "./xml-signature";

export interface NFEItem {
  productId: number;
  productName: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitPrice: number;
  icmsAliquot: number;
  ipiAliquot: number;
  csosn?: string;
}

export interface NFEConfig {
  companyName: string;
  cnpj: string;
  ie: string;
  ufCode: string;
  customerName: string;
  customerCNPJ?: string;
  customerCPF?: string;
  customerIE?: string;
  items: NFEItem[];
  cfop: string;
}

export class NFEGenerator {
  static generateNFENumber(): string {
    // Gera número sequencial único para NF-e
    const timestamp = Date.now();
    const random = Math.random().toString().slice(2, 7);
    return `${timestamp}${random}`;
  }

  static generateNFEKey(): string {
    // Gera chave de acesso da NF-e (43 dígitos)
    // Formato: UFAAMMDD + CNPJ + modelo + série + número + algarismo verificador + IND
    const uf = "35"; // SP
    const date = new Date();
    const yyyy = date.getFullYear().toString().slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    let key = uf + yyyy + mm + dd;
    key += "12345678000195"; // CNPJ placeholder
    key += "55"; // Modelo NF-e
    key += "0001"; // Série
    key += Math.random().toString().slice(2, 11).padStart(9, "0");

    // Calcular dígito verificador (modulo 11)
    let sum = 0;
    let multiplier = 2;
    for (let i = key.length - 1; i >= 0; i--) {
      sum += parseInt(key[i]) * multiplier;
      multiplier++;
      if (multiplier > 9) multiplier = 2;
    }
    const verifierDigit = ((sum * 10) % 11) % 10;
    return key + verifierDigit;
  }

  static generateXML(
    config: NFEConfig,
    series: string = "1",
    certificateBuffer?: Buffer,
    certificatePassword?: string
  ): { xml: string; signed?: boolean } {
    const nfeNumber = this.generateNFENumber();
    const nfeKey = this.generateNFEKey();
    const emissionDate = new Date().toISOString().split("T")[0];
    const emissionTime = new Date().toISOString().split("T")[1].split(".")[0];

    let totalValue = 0;
    let totalICMS = 0;
    let totalIPI = 0;

    const itemsXML = config.items
      .map((item) => {
        const subtotal = item.quantity * item.unitPrice;
        const icmsValue = (subtotal * item.icmsAliquot) / 100;
        const ipiValue = (subtotal * item.ipiAliquot) / 100;

        totalValue += subtotal;
        totalICMS += icmsValue;
        totalIPI += ipiValue;

        return `
      <det nItem="1">
        <infNF>
          <ide>
            <NCM>${item.ncm}</NCM>
            <CFOP>${item.cfop}</CFOP>
          </ide>
          <prod>
            <descr>${item.productName}</descr>
            <qCom>${item.quantity}</qCom>
            <vUnCom>${item.unitPrice}</vUnCom>
            <vItem>${subtotal}</vItem>
          </prod>
          <imposto>
            <ICMS>
              <ICMS00>
                <CST>${item.csosn || "00"}</CST>
                <p>${item.icmsAliquot}</p>
                <v>${icmsValue}</v>
              </ICMS00>
            </ICMS>
            <IPI>
              <IPITrib>
                <CST>50</CST>
                <p>${item.ipiAliquot}</p>
                <v>${ipiValue}</v>
              </IPITrib>
            </IPI>
          </imposto>
        </infNF>
      </det>
        `;
      })
      .join("");

    const grossTotal = totalValue + totalICMS + totalIPI;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${nfeKey}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${nfeNumber}</cNF>
      <assinaturaQRCode></assinaturaQRCode>
      <mod>55</mod>
      <serie>${series}</serie>
      <nNF>${parseInt(nfeNumber.slice(0, 9))}</nNF>
      <dhEmi>${emissionDate}T${emissionTime}</dhEmi>
      <dhSaiEnt>${emissionDate}T${emissionTime}</dhSaiEnt>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3530805</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${nfeKey.slice(-1)}</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>4.0</verProc>
    </ide>
    <emit>
      <CNPJ>${config.cnpj.replace(/\D/g, "")}</CNPJ>
      <xNome>${config.companyName}</xNome>
      <IE>${config.ie}</IE>
      <IEST></IEST>
      <IM></IM>
      <CNAE>4721301</CNAE>
      <CRT>1</CRT>
    </emit>
    <dest>
      ${
        config.customerCNPJ
          ? `<CNPJ>${config.customerCNPJ.replace(/\D/g, "")}</CNPJ>`
          : `<CPF>${config.customerCPF}</CPF>`
      }
      <xNome>${config.customerName}</xNome>
      ${config.customerIE ? `<IE>${config.customerIE}</IE>` : ""}
      <indIEDest>9</indIEDest>
    </dest>
    <det nItem="1">
      <prod>
        <code>001</code>
        <cEAN>SEM GTIN</cEAN>
        <xProd>PRODUTO DE TESTE</xProd>
        <NCM>28112090</NCM>
        <CFOP>${config.cfop}</CFOP>
        <uCom>UN</uCom>
        <qCom>1.00</qCom>
        <vUnCom>100.00</vUnCom>
        <vItem>100.00</vItem>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <CST>00</CST>
            <mod>55</mod>
            <vBC>${totalValue}</vBC>
            <pICMS>18</pICMS>
            <vICMS>${totalICMS}</vICMS>
          </ICMS00>
        </ICMS>
        <IPI>
          <IPITRIB>
            <CST>50</CST>
            <vBC>${totalValue}</vBC>
            <pIPI>0</pIPI>
            <vIPI>${totalIPI}</vIPI>
          </IPITRIB>
        </IPI>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vBC>${totalValue}</vBC>
        <vICMS>${totalICMS}</vICMS>
        <vBCST>0</vBCST>
        <vST>0</vST>
        <vProd>${totalValue}</vProd>
        <vFrete>0</vFrete>
        <vSeg>0</vSeg>
        <vDesc>0</vDesc>
        <vII>0</vII>
        <vIPI>${totalIPI}</vIPI>
        <vPIS>0</vPIS>
        <vCOFINS>0</vCOFINS>
        <vOutro>0</vOutro>
        <vNF>${grossTotal}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <cobr></cobr>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${grossTotal}</vPag>
      </detPag>
    </pag>
    <infAdic></infAdic>
    <exporta></exporta>
    <compra></compra>
    <cana></cana>
    <infRespTrib></infRespTrib>
  </infNFe>
</NFe>`;

    if (certificateBuffer && certificatePassword) {
      try {
        const certificateBase64 = certificateBuffer.toString("base64");
        const signedXml = XMLSignatureService.signXML(
          xml,
          certificateBase64,
          certificatePassword,
          `NFe${nfeKey}`
        );
        return { xml: signedXml, signed: true };
      } catch (error) {
        console.error("Erro ao assinar XML:", error);
        return { xml, signed: false };
      }
    }

    return { xml, signed: false };
  }

  static parseXMLResponse(xmlResponse: string): {
    status: string;
    protocol?: string;
    errorMessage?: string;
  } {
    try {
      // Simples parsing de resposta SEFAZ
      if (xmlResponse.includes("infProt")) {
        const protocolMatch = xmlResponse.match(/<nProt>(\d+)<\/nProt>/);
        const statusMatch = xmlResponse.match(/<cStat>(\d+)<\/cStat>/);

        return {
          status: statusMatch ? statusMatch[1] : "unknown",
          protocol: protocolMatch ? protocolMatch[1] : undefined,
        };
      }

      const errorMatch = xmlResponse.match(/<xMotivo>([^<]+)<\/xMotivo>/);
      return {
        status: "error",
        errorMessage: errorMatch ? errorMatch[1] : "Erro desconhecido",
      };
    } catch (error) {
      return {
        status: "error",
        errorMessage: "Erro ao parsear resposta",
      };
    }
  }
}
