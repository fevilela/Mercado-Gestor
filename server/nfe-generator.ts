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
  companyState?: string;
  companyCityCode?: string;
  companyCity?: string;
  companyAddress?: string;
  companyNumber?: string;
  companyNeighborhood?: string;
  companyZipCode?: string;
  customerName: string;
  customerCNPJ?: string;
  customerCPF?: string;
  customerIE?: string;
  customerState?: string;
  customerCityCode?: string;
  customerCity?: string;
  customerAddress?: string;
  customerNumber?: string;
  customerNeighborhood?: string;
  customerZipCode?: string;
  items: NFEItem[];
  cfop: string;
}

const padNumber = (value: string | number, len: number) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .padStart(len, "0")
    .slice(-len);

const asMoney = (value: number) =>
  Number.isFinite(value) ? Number(value).toFixed(2) : "0.00";

const asQty = (value: number) =>
  Number.isFinite(value) ? Number(value).toFixed(4) : "0.0000";

const escapeXml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatDateTimeWithOffset = (date: Date) => {
  const pad = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, "0");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const hh = pad(offsetMinutes / 60);
  const mm = pad(offsetMinutes % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${hh}:${mm}`;
};

export class NFEGenerator {
  static generateNFENumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString().slice(2, 7);
    return `${timestamp}${random}`;
  }

  static generateNFEKey(params: {
    ufCode: string;
    cnpj: string;
    series: string;
    nNF: string;
    cNF: string;
    tpEmis?: string;
  }): string {
    const date = new Date();
    const aa = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const cUF = padNumber(params.ufCode || "31", 2);
    const cnpj = padNumber(params.cnpj || "", 14);
    const serie = padNumber(params.series || "1", 3);
    const nNF = padNumber(params.nNF || "1", 9);
    const tpEmis = padNumber(params.tpEmis || "1", 1) || "1";
    const cNF = padNumber(params.cNF || "0", 8);

    const base43 = `${cUF}${aa}${mm}${cnpj}55${serie}${nNF}${tpEmis}${cNF}`;
    let sum = 0;
    let multiplier = 2;
    for (let i = base43.length - 1; i >= 0; i--) {
      sum += parseInt(base43[i], 10) * multiplier;
      multiplier++;
      if (multiplier > 9) multiplier = 2;
    }
    const mod = sum % 11;
    const dv = mod === 0 || mod === 1 ? 0 : 11 - mod;
    return `${base43}${dv}`;
  }

  static generateXML(
    config: NFEConfig,
    series = "1",
    certificateBuffer?: Buffer,
    certificatePassword?: string,
    environment: "homologacao" | "producao" = "homologacao",
  ): { xml: string; signed?: boolean } {
    const nNF = padNumber(
      Math.floor(Math.random() * 999999999) + 1,
      9,
    );
    const cNF = padNumber(Math.floor(Math.random() * 99999999), 8);
    const nfeKey = this.generateNFEKey({
      ufCode: config.ufCode || "31",
      cnpj: config.cnpj,
      series,
      nNF,
      cNF,
      tpEmis: "1",
    });
    const serieXml = String(parseInt(padNumber(series || "1", 3), 10));
    const tpAmb = environment === "producao" ? "1" : "2";
    const emissionDateTime = formatDateTimeWithOffset(new Date());
    const emitUF = (config.companyState || "MG").toUpperCase();
    const cMunFG = padNumber(config.companyCityCode || "3138203", 7);
    const emitXMun = escapeXml(config.companyCity || "LAVRAS");
    const emitXLgr = escapeXml(config.companyAddress || "RUA NAO INFORMADA");
    const emitNro = escapeXml(config.companyNumber || "S/N");
    const emitXBairro = escapeXml(config.companyNeighborhood || "CENTRO");
    const emitCEP = padNumber(config.companyZipCode || "37200000", 8);

    const destUF = (config.customerState || emitUF || "MG").toUpperCase();
    const destCMun = padNumber(config.customerCityCode || cMunFG, 7);
    const destXMun = escapeXml(config.customerCity || config.companyCity || "LAVRAS");
    const destXLgr = escapeXml(config.customerAddress || "RUA NAO INFORMADA");
    const destNro = escapeXml(config.customerNumber || "S/N");
    const destXBairro = escapeXml(config.customerNeighborhood || "CENTRO");
    const destCEP = padNumber(config.customerZipCode || emitCEP || "37200000", 8);
    const companyCnpj = padNumber(config.cnpj, 14);
    const emitIE = String(config.ie || "").replace(/\D/g, "") || "ISENTO";

    const items = Array.isArray(config.items) && config.items.length > 0
      ? config.items
      : [
          {
            productId: 1,
            productName: "PRODUTO DE TESTE",
            ncm: "28112090",
            cfop: config.cfop || "5102",
            quantity: 1,
            unitPrice: 0.01,
            icmsAliquot: 0,
            ipiAliquot: 0,
            csosn: "102",
          },
        ];

    let totalProd = 0;
    // Para ICMSSN102 (Simples Nacional sem destaque), nao ha destaque de ICMS na NF-e.
    let totalIcms = 0;
    let totalIpi = 0;

    const detXml = items
      .map((item, idx) => {
        const qty = Number(item.quantity || 0) || 1;
        const unitPrice = Number(item.unitPrice || 0);
        const subtotal = qty * unitPrice;
        const icmsValue = 0;
        const ipiValue = subtotal * (Number(item.ipiAliquot || 0) / 100);
        totalProd += subtotal;
        totalIcms += icmsValue;
        totalIpi += ipiValue;
        const cProd = String(item.productId || idx + 1);
        const xProd = escapeXml(item.productName || `ITEM ${idx + 1}`);
        const ncm = padNumber(item.ncm || "00000000", 8);
        const cfop = padNumber(item.cfop || config.cfop || "5102", 4);
        const csosn = padNumber(item.csosn || "102", 3);
        const icmsXmlByCsosn = (() => {
          if (csosn === "101") {
            return `<ICMSSN101>
            <orig>0</orig>
            <CSOSN>101</CSOSN>
            <pCredSN>0.00</pCredSN>
            <vCredICMSSN>0.00</vCredICMSSN>
          </ICMSSN101>`;
          }
          if (["102", "103", "300", "400"].includes(csosn)) {
            return `<ICMSSN${csosn}>
            <orig>0</orig>
            <CSOSN>${csosn}</CSOSN>
          </ICMSSN${csosn}>`;
          }
          throw new Error(
            `CSOSN ${csosn} nao suportado no gerador NF-e para CRT=1. Ajuste o cadastro fiscal do produto ou implemente a regra especifica.`,
          );
        })();
        const vProd = asMoney(subtotal);
        const vUnCom = asMoney(unitPrice);
        const qCom = asQty(qty);
        return `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${escapeXml(cProd)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${xProd}</xProd>
        <NCM>${ncm}</NCM>
        <CFOP>${cfop}</CFOP>
        <uCom>UN</uCom>
        <qCom>${qCom}</qCom>
        <vUnCom>${vUnCom}</vUnCom>
        <vProd>${vProd}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>${qCom}</qTrib>
        <vUnTrib>${vUnCom}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          ${icmsXmlByCsosn}
        </ICMS>
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>
      </imposto>
    </det>`;
      })
      .join("");

    const vProd = asMoney(totalProd);
    const vIcms = asMoney(totalIcms);
    const vIpi = asMoney(totalIpi);
    const vNF = asMoney(totalProd + totalIpi);

    const cnpjDest = String(config.customerCNPJ || "").replace(/\D/g, "");
    const cpfDest = String(config.customerCPF || "").replace(/\D/g, "");
    const destDocXml =
      cnpjDest.length === 14
        ? `<CNPJ>${cnpjDest}</CNPJ>`
        : `<CPF>${padNumber(cpfDest || "00000000000", 11)}</CPF>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${nfeKey}" versao="4.00">
    <ide>
      <cUF>${padNumber(config.ufCode || "31", 2)}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>Venda</natOp>
      <mod>55</mod>
      <serie>${serieXml}</serie>
      <nNF>${parseInt(nNF, 10)}</nNF>
      <dhEmi>${emissionDateTime}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${cMunFG}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${nfeKey.slice(-1)}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>4.0</verProc>
    </ide>
    <emit>
      <CNPJ>${companyCnpj}</CNPJ>
      <xNome>${escapeXml(config.companyName || "EMPRESA")}</xNome>
      <enderEmit>
        <xLgr>${emitXLgr}</xLgr>
        <nro>${emitNro}</nro>
        <xBairro>${emitXBairro}</xBairro>
        <cMun>${cMunFG}</cMun>
        <xMun>${emitXMun}</xMun>
        <UF>${emitUF}</UF>
        <CEP>${emitCEP}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>${emitIE}</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      ${destDocXml}
      <xNome>${escapeXml(config.customerName || "CONSUMIDOR")}</xNome>
      <enderDest>
        <xLgr>${destXLgr}</xLgr>
        <nro>${destNro}</nro>
        <xBairro>${destXBairro}</xBairro>
        <cMun>${destCMun}</cMun>
        <xMun>${destXMun}</xMun>
        <UF>${destUF}</UF>
        <CEP>${destCEP}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>9</indIEDest>
    </dest>${detXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>${vIcms}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${vProd}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>${vIpi}</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${vNF}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${vNF}</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;

    if (certificateBuffer && certificatePassword) {
      try {
        const certificateBase64 = certificateBuffer.toString("base64");
        const signedXml = XMLSignatureService.signXML(
          xml,
          certificateBase64,
          certificatePassword,
          `NFe${nfeKey}`,
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
    } catch {
      return {
        status: "error",
        errorMessage: "Erro ao parsear resposta",
      };
    }
  }
}
