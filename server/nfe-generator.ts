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
  pisAliquot?: number;
  cofinsAliquot?: number;
  csosn?: string;
  cstIcms?: string;
  cstIpi?: string;
  cstPisCofins?: string;
  cstPis?: string;
  cstCofins?: string;
  origin?: string;
  icmsReduction?: number;
  icmsStValue?: number;
  icmsStAliquot?: number;
  destinationIcmsAliquot?: number;
  fcpAliquot?: number;
  cBenef?: string;
  motDesIcms?: string;
  icmsDesonValue?: number;
}

export interface NFEConfig {
  companyName: string;
  cnpj: string;
  ie: string;
  ufCode: string;
  crt?: "1" | "2" | "3";
  regimeTributario?: "Simples Nacional" | "Lucro Real" | "Lucro Presumido";
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
  customerIeIndicator?: "1" | "2" | "9";
  naturezaOperacao?: string;
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

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

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

const resolveCRT = (config: NFEConfig): "1" | "2" | "3" => {
  if (config.crt === "1" || config.crt === "2" || config.crt === "3") {
    return config.crt;
  }
  if (config.regimeTributario === "Lucro Real") return "3";
  if (config.regimeTributario === "Lucro Presumido") return "3";
  return "1";
};

const resolveOrigin = (origin?: string) => {
  const normalized = String(origin || "")
    .trim()
    .toLowerCase();
  if (/^[0-8]$/.test(normalized)) return normalized;
  if (normalized.includes("import")) return "1";
  return "0";
};

const shouldHighlightIcmsForCst = (cst: string) =>
  ["00", "10", "20", "70", "90"].includes(cst);

const buildBenefitXml = (params: {
  cBenef?: string;
  icmsDesonValue?: number;
  motDesIcms?: string;
}) => {
  const cBenef = String(params.cBenef || "").trim();
  const icmsDesonValue = Math.max(0, toNumber(params.icmsDesonValue, 0));
  const motDesIcms = String(params.motDesIcms || "").trim();
  let xml = "";
  if (cBenef) xml += `\n            <cBenef>${escapeXml(cBenef)}</cBenef>`;
  if (icmsDesonValue > 0) {
    xml += `\n            <vICMSDeson>${asMoney(icmsDesonValue)}</vICMSDeson>`;
    if (motDesIcms) {
      xml += `\n            <motDesICMS>${escapeXml(motDesIcms)}</motDesICMS>`;
    }
  }
  return xml;
};

const buildIcmsForSimples = (params: {
  csosn: string;
  orig: string;
  base: number;
  icmsAliquot: number;
  icmsValue: number;
  icmsStValue: number;
  icmsReduction: number;
  cBenef?: string;
  motDesIcms?: string;
  icmsDesonValue?: number;
}) => {
  const { csosn, orig, base, icmsAliquot, icmsValue, icmsStValue, icmsReduction } =
    params;
  const vBC = asMoney(base);
  const pICMS = asMoney(icmsAliquot);
  const vICMS = asMoney(icmsValue);
  const vBCST = asMoney(base);
  const vICMSST = asMoney(icmsStValue);
  const pRedBC = asMoney(icmsReduction);
  const benefitXml = buildBenefitXml(params);

  if (csosn === "101") {
    // Quando nao ha credito de ICMS informado, evita montar 101 com credito zero
    // e usa 102 para manter consistencia fiscal/schema.
    if (icmsAliquot <= 0 || icmsValue <= 0) {
      return `<ICMSSN102>
            <orig>${orig}</orig>
            <CSOSN>102</CSOSN>
            ${benefitXml}
          </ICMSSN102>`;
    }
    return `<ICMSSN101>
            <orig>${orig}</orig>
            <CSOSN>101</CSOSN>
            <pCredSN>${pICMS}</pCredSN>
            <vCredICMSSN>${vICMS}</vCredICMSSN>
          </ICMSSN101>`;
  }

  if (["102", "103", "300", "400"].includes(csosn)) {
    return `<ICMSSN${csosn}>
            <orig>${orig}</orig>
            <CSOSN>${csosn}</CSOSN>
            ${benefitXml}
          </ICMSSN${csosn}>`;
  }

  if (csosn === "201" || csosn === "202") {
    return `<ICMSSN${csosn}>
            <orig>${orig}</orig>
            <CSOSN>${csosn}</CSOSN>
            <modBCST>4</modBCST>
            <pMVAST>0.00</pMVAST>
            <pRedBCST>${pRedBC}</pRedBCST>
            <vBCST>${vBCST}</vBCST>
            <pICMSST>${pICMS}</pICMSST>
            <vICMSST>${vICMSST}</vICMSST>
            ${benefitXml}
          </ICMSSN${csosn}>`;
  }

  if (csosn === "203") {
    return `<ICMSSN203>
            <orig>${orig}</orig>
            <CSOSN>203</CSOSN>
            ${benefitXml}
          </ICMSSN203>`;
  }

  if (csosn === "500") {
    return `<ICMSSN500>
            <orig>${orig}</orig>
            <CSOSN>500</CSOSN>
            <vBCSTRet>${vBCST}</vBCSTRet>
            <vICMSSTRet>${vICMSST}</vICMSSTRet>
            ${benefitXml}
          </ICMSSN500>`;
  }

  if (csosn === "900") {
    return `<ICMSSN900>
            <orig>${orig}</orig>
            <CSOSN>900</CSOSN>
            <modBC>3</modBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
            ${benefitXml}
          </ICMSSN900>`;
  }

  throw new Error(
    `CSOSN ${csosn} nao suportado no gerador NF-e. Ajuste o cadastro fiscal do produto.`,
  );
};

const buildIcmsForRegimeNormal = (params: {
  cst: string;
  orig: string;
  base: number;
  icmsAliquot: number;
  icmsValue: number;
  icmsStValue: number;
  icmsReduction: number;
  cBenef?: string;
  motDesIcms?: string;
  icmsDesonValue?: number;
}) => {
  const { cst, orig, base, icmsAliquot, icmsValue, icmsStValue, icmsReduction } =
    params;
  const vBC = asMoney(base);
  const pICMS = asMoney(icmsAliquot);
  const vICMS = asMoney(icmsValue);
  const vBCST = asMoney(base);
  const vICMSST = asMoney(icmsStValue);
  const pRedBC = asMoney(icmsReduction);
  const benefitXml = buildBenefitXml(params);

  if (cst === "00") {
    return `<ICMS00>
            <orig>${orig}</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
            ${benefitXml}
          </ICMS00>`;
  }

  if (cst === "10" || cst === "70") {
    return `<ICMS${cst}>
            <orig>${orig}</orig>
            <CST>${cst}</CST>
            <modBC>3</modBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
            <modBCST>4</modBCST>
            <pMVAST>0.00</pMVAST>
            <pRedBCST>${pRedBC}</pRedBCST>
            <vBCST>${vBCST}</vBCST>
            <pICMSST>${pICMS}</pICMSST>
            <vICMSST>${vICMSST}</vICMSST>
            ${benefitXml}
          </ICMS${cst}>`;
  }

  if (cst === "20") {
    return `<ICMS20>
            <orig>${orig}</orig>
            <CST>20</CST>
            <modBC>3</modBC>
            <pRedBC>${pRedBC}</pRedBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
            ${benefitXml}
          </ICMS20>`;
  }

  if (["40", "41", "50"].includes(cst)) {
    return `<ICMS40>
            <orig>${orig}</orig>
            <CST>${cst}</CST>
            ${benefitXml}
          </ICMS40>`;
  }

  if (cst === "60") {
    return `<ICMS60>
            <orig>${orig}</orig>
            <CST>60</CST>
            <vBCSTRet>${vBCST}</vBCSTRet>
            <vICMSSTRet>${vICMSST}</vICMSSTRet>
            ${benefitXml}
          </ICMS60>`;
  }

  return `<ICMS90>
            <orig>${orig}</orig>
            <CST>${cst}</CST>
            <modBC>3</modBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
            ${benefitXml}
          </ICMS90>`;
};

const buildPisXml = (params: {
  cst: string;
  base: number;
  aliquot: number;
  value: number;
}) => {
  const cstInput = padNumber(params.cst || "07", 2);
  const aliquot = Math.max(0, toNumber(params.aliquot, 0));
  const cst = cstInput === "00" && aliquot <= 0 ? "07" : cstInput;
  if ((cst === "01" || cst === "02") && aliquot > 0) {
    return `<PIS>
          <PISAliq>
            <CST>${cst}</CST>
            <vBC>${asMoney(params.base)}</vBC>
            <pPIS>${asMoney(aliquot)}</pPIS>
            <vPIS>${asMoney(params.value)}</vPIS>
          </PISAliq>
        </PIS>`;
  }
  return `<PIS>
          <PISNT>
            <CST>${cst}</CST>
          </PISNT>
        </PIS>`;
};

const buildCofinsXml = (params: {
  cst: string;
  base: number;
  aliquot: number;
  value: number;
}) => {
  const cstInput = padNumber(params.cst || "07", 2);
  const aliquot = Math.max(0, toNumber(params.aliquot, 0));
  const cst = cstInput === "00" && aliquot <= 0 ? "07" : cstInput;
  if ((cst === "01" || cst === "02") && aliquot > 0) {
    return `<COFINS>
          <COFINSAliq>
            <CST>${cst}</CST>
            <vBC>${asMoney(params.base)}</vBC>
            <pCOFINS>${asMoney(aliquot)}</pCOFINS>
            <vCOFINS>${asMoney(params.value)}</vCOFINS>
          </COFINSAliq>
        </COFINS>`;
  }
  return `<COFINS>
          <COFINSNT>
            <CST>${cst}</CST>
          </COFINSNT>
        </COFINS>`;
};

const buildIpiXml = (params: {
  cst: string;
  base: number;
  aliquot: number;
  value: number;
}) => {
  const cst = padNumber(params.cst || "99", 2);
  const aliquot = Math.max(0, toNumber(params.aliquot, 0));
  if (aliquot <= 0) return "";

  return `<IPI>
          <cEnq>999</cEnq>
          <IPITrib>
            <CST>${cst}</CST>
            <vBC>${asMoney(params.base)}</vBC>
            <pIPI>${asMoney(aliquot)}</pIPI>
            <vIPI>${asMoney(params.value)}</vIPI>
          </IPITrib>
        </IPI>`;
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
    const nNF = padNumber(Math.floor(Math.random() * 999999999) + 1, 9);
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
    const cnpjDest = String(config.customerCNPJ || "").replace(/\D/g, "");
    const cpfDest = String(config.customerCPF || "").replace(/\D/g, "");
    const destIeDigits = String(config.customerIE || "").replace(/\D/g, "");

    const destUF = (config.customerState || emitUF || "MG").toUpperCase();
    const interstate = destUF !== emitUF;
    const idDest = interstate ? "2" : "1";
    const destCMun = padNumber(config.customerCityCode || cMunFG, 7);
    const destXMun = escapeXml(config.customerCity || config.companyCity || "LAVRAS");
    const destXLgr = escapeXml(config.customerAddress || "RUA NAO INFORMADA");
    const destNro = escapeXml(config.customerNumber || "S/N");
    const destXBairro = escapeXml(config.customerNeighborhood || "CENTRO");
    const destCEP = padNumber(config.customerZipCode || emitCEP || "37200000", 8);
    const companyCnpj = padNumber(config.cnpj, 14);
    const emitIE = String(config.ie || "").replace(/\D/g, "") || "ISENTO";
    const crt = resolveCRT(config);
    const natOp = escapeXml(config.naturezaOperacao || "Venda");
    const requestedIndIEDest = String(config.customerIeIndicator || "9");
    const normalizedIndIEDest =
      requestedIndIEDest === "1" ||
      requestedIndIEDest === "2" ||
      requestedIndIEDest === "9"
        ? requestedIndIEDest
        : "9";
    const indIEDest =
      cpfDest.length === 11 || (normalizedIndIEDest === "1" && !destIeDigits)
        ? "9"
        : normalizedIndIEDest;

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
            pisAliquot: 0,
            cofinsAliquot: 0,
            csosn: "102",
            cstIcms: "00",
          },
        ];

    let totalProd = 0;
    let totalBcIcms = 0;
    let totalIcms = 0;
    let totalIcmsDeson = 0;
    let totalSt = 0;
    let totalDifal = 0;
    let totalFcpDifal = 0;
    let totalIpi = 0;
    let totalPis = 0;
    let totalCofins = 0;
    let totalTrib = 0;

    const detXml = items
      .map((item, idx) => {
        const qty = Math.max(0.0001, toNumber(item.quantity, 1));
        const unitPrice = Math.max(0, toNumber(item.unitPrice, 0));
        const subtotal = round2(qty * unitPrice);
        const base = subtotal;

        const icmsAliquot = Math.max(0, toNumber(item.icmsAliquot, 0));
        const icmsReduction = Math.max(0, toNumber(item.icmsReduction, 0));
        const icmsBase = round2(base * (1 - icmsReduction / 100));
        const icmsStAliquot = Math.max(0, toNumber(item.icmsStAliquot, 0));
        let icmsStValue = Math.max(0, toNumber(item.icmsStValue, 0));
        if (icmsStValue <= 0 && icmsStAliquot > 0) {
          icmsStValue = round2(Math.max(0, (icmsBase * icmsStAliquot) / 100 - 0));
        }
        const ipiAliquot = Math.max(0, toNumber(item.ipiAliquot, 0));
        const pisAliquot = Math.max(0, toNumber(item.pisAliquot, 0));
        const cofinsAliquot = Math.max(0, toNumber(item.cofinsAliquot, 0));
        const destinationIcmsAliquot = Math.max(
          0,
          toNumber(item.destinationIcmsAliquot, 18),
        );
        const fcpAliquot = Math.max(0, toNumber(item.fcpAliquot, 0));
        const cBenef = String(item.cBenef || "").trim();
        const motDesIcms = String(item.motDesIcms || "").trim();
        let icmsDesonValue = Math.max(0, toNumber(item.icmsDesonValue, 0));

        const csosn = padNumber(item.csosn || "102", 3);
        const cstIcms = padNumber(item.cstIcms || "00", 2);
        const cstIpi = padNumber(item.cstIpi || "99", 2);
        const cstPis = padNumber(item.cstPis || item.cstPisCofins || "07", 2);
        const cstCofins = padNumber(item.cstCofins || item.cstPisCofins || "07", 2);
        const orig = resolveOrigin(item.origin);

        const icmsValue =
          crt === "1" || crt === "2"
            ? csosn === "900"
              ? round2((icmsBase * icmsAliquot) / 100)
              : 0
            : shouldHighlightIcmsForCst(cstIcms)
              ? round2((icmsBase * icmsAliquot) / 100)
              : 0;
        if (icmsDesonValue <= 0 && motDesIcms && icmsValue > 0) {
          icmsDesonValue = 0;
        }
        const applyDifal = interstate && indIEDest === "9";
        const difalRate = applyDifal
          ? Math.max(0, destinationIcmsAliquot - icmsAliquot)
          : 0;
        const difalValue = round2((icmsBase * difalRate) / 100);
        const fcpDifalValue = round2((icmsBase * fcpAliquot) / 100);
        const ipiValue = round2((base * ipiAliquot) / 100);
        const pisValue = round2((base * pisAliquot) / 100);
        const cofinsValue = round2((base * cofinsAliquot) / 100);

        totalProd += subtotal;
        totalBcIcms += icmsValue > 0 ? icmsBase : 0;
        totalIcms += icmsValue;
        totalIcmsDeson += icmsDesonValue;
        totalSt += icmsStValue;
        totalDifal += difalValue;
        totalFcpDifal += fcpDifalValue;
        totalIpi += ipiValue;
        totalPis += pisValue;
        totalCofins += cofinsValue;
        totalTrib +=
          icmsValue +
          icmsStValue +
          difalValue +
          fcpDifalValue +
          ipiValue +
          pisValue +
          cofinsValue;

        const cProd = String(item.productId || idx + 1);
        const xProd = escapeXml(item.productName || `ITEM ${idx + 1}`);
        const ncm = padNumber(item.ncm || "00000000", 8);
        const cfop = padNumber(item.cfop || config.cfop || "5102", 4);
        const vProd = asMoney(subtotal);
        const vUnCom = asMoney(unitPrice);
        const qCom = asQty(qty);

        const icmsXmlByRegime =
          crt === "1" || crt === "2"
            ? buildIcmsForSimples({
                csosn,
                orig,
                base: icmsBase,
                icmsAliquot,
                icmsValue,
                icmsStValue,
                icmsReduction,
                cBenef,
                motDesIcms,
                icmsDesonValue,
              })
            : buildIcmsForRegimeNormal({
                cst: cstIcms,
                orig,
                base: icmsBase,
                icmsAliquot,
                icmsValue,
                icmsStValue,
                icmsReduction,
                cBenef,
                motDesIcms,
                icmsDesonValue,
              });

        const difalXml =
          applyDifal && (difalValue > 0 || fcpDifalValue > 0)
            ? `
        <ICMSUFDest>
          <vBCUFDest>${asMoney(icmsBase)}</vBCUFDest>
          <pFCPUFDest>${asMoney(fcpAliquot)}</pFCPUFDest>
          <pICMSUFDest>${asMoney(destinationIcmsAliquot)}</pICMSUFDest>
          <pICMSInter>${asMoney(icmsAliquot)}</pICMSInter>
          <pICMSInterPart>100.00</pICMSInterPart>
          <vFCPUFDest>${asMoney(fcpDifalValue)}</vFCPUFDest>
          <vICMSUFDest>${asMoney(difalValue)}</vICMSUFDest>
          <vICMSUFRemet>0.00</vICMSUFRemet>
        </ICMSUFDest>`
            : "";

        const ipiXml = buildIpiXml({
          cst: cstIpi,
          base,
          aliquot: ipiAliquot,
          value: ipiValue,
        });
        const pisXml = buildPisXml({
          cst: cstPis,
          base,
          aliquot: pisAliquot,
          value: pisValue,
        });
        const cofinsXml = buildCofinsXml({
          cst: cstCofins,
          base,
          aliquot: cofinsAliquot,
          value: cofinsValue,
        });

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
          ${icmsXmlByRegime}
        </ICMS>
        ${difalXml}
        ${ipiXml}
        ${pisXml}
        ${cofinsXml}
      </imposto>
    </det>`;
      })
      .join("");

    const vProd = asMoney(totalProd);
    const vBC = asMoney(totalBcIcms);
    const vIcms = asMoney(totalIcms);
    const vIcmsDeson = asMoney(totalIcmsDeson);
    const vSt = asMoney(totalSt);
    const vFcpDifal = asMoney(totalFcpDifal);
    const vIcmsUfDest = asMoney(totalDifal);
    const vIpi = asMoney(totalIpi);
    const vPis = asMoney(totalPis);
    const vCofins = asMoney(totalCofins);
    const vTotTrib = asMoney(totalTrib);
    const vNF = asMoney(totalProd + totalIpi + totalSt + totalDifal + totalFcpDifal);

    const destDocXml =
      cnpjDest.length === 14
        ? `<CNPJ>${cnpjDest}</CNPJ>`
        : `<CPF>${padNumber(cpfDest || "00000000000", 11)}</CPF>`;
    const destIeXml = indIEDest === "1" && destIeDigits ? `<IE>${destIeDigits}</IE>` : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${nfeKey}" versao="4.00">
    <ide>
      <cUF>${padNumber(config.ufCode || "31", 2)}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${natOp}</natOp>
      <mod>55</mod>
      <serie>${serieXml}</serie>
      <nNF>${parseInt(nNF, 10)}</nNF>
      <dhEmi>${emissionDateTime}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${idDest}</idDest>
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
      <CRT>${crt}</CRT>
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
      ${destIeXml}
      <indIEDest>${indIEDest}</indIEDest>
    </dest>${detXml}
    <total>
      <ICMSTot>
        <vBC>${vBC}</vBC>
        <vICMS>${vIcms}</vICMS>
        <vICMSDeson>${vIcmsDeson}</vICMSDeson>
        <vFCPUFDest>${vFcpDifal}</vFCPUFDest>
        <vICMSUFDest>${vIcmsUfDest}</vICMSUFDest>
        <vICMSUFRemet>0.00</vICMSUFRemet>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>${vSt}</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${vProd}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>${vIpi}</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${vPis}</vPIS>
        <vCOFINS>${vCofins}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${vNF}</vNF>
        <vTotTrib>${vTotTrib}</vTotTrib>
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
