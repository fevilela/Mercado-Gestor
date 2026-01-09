import { storage } from "./storage";

export type FiscalCertificateState =
  | "SEM_CERTIFICADO"
  | "CERTIFICADO_INVALIDO"
  | "CERTIFICADO_EXPIRADO"
  | "CERTIFICADO_VALIDO";

export type FiscalCertificateStatus = {
  state: FiscalCertificateState;
  isValid: boolean;
  message: string;
};

export async function getFiscalCertificateStatus(
  companyId: number
): Promise<FiscalCertificateStatus> {
  const cert = await storage.getDigitalCertificate(companyId);

  if (!cert || cert.isActive === false) {
    return {
      state: "SEM_CERTIFICADO",
      isValid: false,
      message:
        "Operacao fiscal bloqueada: certificado digital A1 nao instalado.",
    };
  }

  const validFrom = cert.validFrom ? new Date(cert.validFrom) : null;
  const validUntil = cert.validUntil ? new Date(cert.validUntil) : null;

  if (
    !validUntil ||
    Number.isNaN(validUntil.getTime()) ||
    (validFrom && Number.isNaN(validFrom.getTime()))
  ) {
    return {
      state: "CERTIFICADO_INVALIDO",
      isValid: false,
      message: "Operacao fiscal bloqueada: certificado digital A1 invalido.",
    };
  }

  const now = new Date();
  if (validFrom && validFrom > now) {
    return {
      state: "CERTIFICADO_INVALIDO",
      isValid: false,
      message: "Operacao fiscal bloqueada: certificado digital A1 invalido.",
    };
  }

  if (validUntil < now) {
    return {
      state: "CERTIFICADO_EXPIRADO",
      isValid: false,
      message: "Operacao fiscal bloqueada: certificado digital A1 vencido.",
    };
  }

  return {
    state: "CERTIFICADO_VALIDO",
    isValid: true,
    message: "Certificado digital A1 valido.",
  };
}
