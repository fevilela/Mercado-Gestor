export type SefazDefaults = {
  sefazUrlHomologacao: string;
  sefazUrlProducao: string;
  sefazQrCodeUrlHomologacao?: string;
  sefazQrCodeUrlProducao?: string;
};

const SEFAZ_BASE_URLS: Record<string, { homologacao: string; producao: string }> = {
  SP: {
    homologacao: "https://nfe.sefaz.sp.gov.br/ws",
    producao: "https://nfe.sefaz.sp.gov.br/ws",
  },
  RS: {
    homologacao: "https://nfe.sefaz.rs.gov.br/ws",
    producao: "https://nfe.sefaz.rs.gov.br/ws",
  },
  MG: {
    homologacao: "https://hnfe.fazenda.mg.gov.br/nfe2/services",
    producao: "https://nfe.fazenda.mg.gov.br/nfe2/services",
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

const SEFAZ_QR_URLS: Record<string, { homologacao?: string; producao?: string }> = {
  SP: {
    homologacao: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode",
    producao: "https://www.nfce.fazenda.sp.gov.br/qrcode",
  },
  MG: {
    homologacao: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
    producao: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
  },
  PR: {
    homologacao: "https://www.fazenda.pr.gov.br/nfce/qrcode",
    producao: "https://www.fazenda.pr.gov.br/nfce/qrcode",
  },
  RS: {
    homologacao: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
    producao: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
  },
};

export const getSefazDefaults = (uf: string): SefazDefaults => {
  const normalized = String(uf || "").toUpperCase();
  const base = SEFAZ_BASE_URLS[normalized] || SEFAZ_BASE_URLS.SVRS;
  const qr = SEFAZ_QR_URLS[normalized] || {};
  return {
    sefazUrlHomologacao: base.homologacao,
    sefazUrlProducao: base.producao,
    sefazQrCodeUrlHomologacao: qr.homologacao,
    sefazQrCodeUrlProducao: qr.producao,
  };
};
