import { z } from "zod";

// Validação base para documentos fiscais
export interface FiscalDocumentBase {
  id?: string;
  companyId: number;
  documentNumber: string;
  documentSeries: string;
  documentDate: Date;
  documentValue: number;
  notes?: string;
}

// ============================================
// NF-e (Modelo 55) - Venda de Produtos
// ============================================
export interface NFe extends FiscalDocumentBase {
  type: "NF-e";
  model: 55;
  customerId: number;
  customerType: "contribuinte" | "nao-contribuinte" | "consumidor";
  originState: string;
  destinyState: string;
  scope: "interna" | "interestadual" | "exterior";
  cfopCode: string;
  items: NFeItem[];
  icmsTotal: number;
  piTotal: number;
  cofinsTotal: number;
  ipiTotal: number;
  discountValue?: number;
  shippingValue?: number;
  insuranceValue?: number;
  otherExpensesValue?: number;
  status: "rascunho" | "emitida" | "cancelada" | "denegada";
  nfeNumber?: string;
  authorizedAt?: Date;
  xmlContent?: string;
}

export interface NFeItem {
  id?: string;
  productId: number;
  description: string;
  ncm: string;
  cfop: string;
  csosn: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  discountValue?: number;
  icmsValue: number;
  icmsAliquot: number;
  piValue: number;
  cofinsValue: number;
  ipiValue: number;
}

// ============================================
// NFC-e (Modelo 65) - Consumidor Final
// ============================================
export interface NFCe extends FiscalDocumentBase {
  type: "NFC-e";
  model: 65;
  customerId?: number;
  customerCPF?: string;
  scope: "interna" | "interestadual";
  cfopCode: string;
  items: NFCeItem[];
  paymentMethod:
    | "01"
    | "02"
    | "03"
    | "04"
    | "05"
    | "10"
    | "11"
    | "12"
    | "13"
    | "14"
    | "15";
  icmsTotal: number;
  piTotal: number;
  cofinsTotal: number;
  ipiTotal: number;
  discountValue?: number;
  status: "rascunho" | "emitida" | "cancelada" | "denegada";
  nfceNumber?: string;
  authorizedAt?: Date;
  qrCode?: string;
}

export interface NFCeItem {
  id?: string;
  productId: number;
  description: string;
  ncm: string;
  csosn: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  discountValue?: number;
  icmsValue: number;
  icmsAliquot: number;
}

// ============================================
// NFS-e (Nota Fiscal de Serviço)
// ============================================
export interface NFSe extends FiscalDocumentBase {
  type: "NFS-e";
  customerId: number;
  customerType: "contribuinte" | "nao-contribuinte" | "consumidor";
  city: string;
  state: string;
  serviceDescription: string;
  serviceCode: string;
  items: NFSeItem[];
  issqnValue: number;
  issqnAliquot: number;
  deductionValue?: number;
  discountValue?: number;
  status: "rascunho" | "emitida" | "cancelada" | "denegada";
  nfseNumber?: string;
  authorizedAt?: Date;
}

export interface NFSeItem {
  id?: string;
  serviceCode: string;
  serviceDescription: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  discountValue?: number;
  issqnValue: number;
  issqnAliquot: number;
}

// ============================================
// CT-e (Conhecimento de Transporte)
// ============================================
export interface CTe extends FiscalDocumentBase {
  type: "CT-e";
  model: 57;
  shipperId: number;
  recipientId: number;
  originCity: string;
  originState: string;
  destinyCity: string;
  destinyState: string;
  transportationType: "01" | "02" | "03" | "04" | "05" | "06";
  cargoQuantity: number;
  cargoType: string;
  cargoValue: number;
  items: CTeItem[];
  icmsValue: number;
  status: "rascunho" | "emitida" | "cancelada" | "denegada";
  cteNumber?: string;
  authorizedAt?: Date;
}

export interface CTeItem {
  id?: string;
  description: string;
  quantity: number;
  weight: number;
  value: number;
}

// ============================================
// MDF-e (Manifesto de Documento Fiscal)
// ============================================
export interface MDFe extends FiscalDocumentBase {
  type: "MDF-e";
  model: 58;
  driverId: number;
  vehiclePlate: string;
  vehicleUF: string;
  transportationType: "01" | "02" | "03" | "04" | "05" | "06";
  originCity: string;
  originState: string;
  destinyCity: string;
  destinyState: string;
  documents: MDFeDocument[];
  totalValue: number;
  cargoQuantity: number;
  cargoType: string;
  status: "rascunho" | "emitida" | "cancelada" | "denegada";
  mdfNumber?: string;
  authorizedAt?: Date;
}

export interface MDFeDocument {
  id?: string;
  documentNumber: string;
  documentSeries: string;
  documentType: "NF-e" | "NFC-e" | "CT-e" | "NFS-e";
  value: number;
}

// ============================================
// Validação com Zod
// ============================================

export const NFeItemSchema = z.object({
  productId: z.number(),
  description: z.string(),
  ncm: z.string().length(8),
  cfop: z.string().regex(/^\d{4}$/),
  csosn: z.string().regex(/^\d{3}$/),
  cstIcms: z.string().optional(),
  cstIpi: z.string().optional(),
  cstPisCofins: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string(),
  unitPrice: z.number().positive(),
  totalValue: z.number().positive(),
  discountValue: z.number().nonnegative().optional(),
  icmsValue: z.number().nonnegative(),
  icmsAliquot: z.number().min(0).max(100),
  icmsStAliquot: z.number().min(0).max(100).optional(),
  destinationIcmsAliquot: z.number().min(0).max(100).optional(),
  fcpAliquot: z.number().min(0).max(100).optional(),
  piValue: z.number().nonnegative(),
  cofinsValue: z.number().nonnegative(),
  ipiValue: z.number().nonnegative(),
  cBenef: z.string().optional(),
  motDesIcms: z.string().optional(),
  icmsDesonValue: z.number().nonnegative().optional(),
});

export const NFeSalesValidationSchema = z.object({
  customerId: z.number(),
  customerType: z.enum(["contribuinte", "nao-contribuinte", "consumidor"]),
  originState: z.string().length(2),
  destinyState: z.string().length(2),
  scope: z.enum(["interna", "interestadual", "exterior"]),
  cfopCode: z.string().regex(/^\d{4}$/),
  items: z.array(NFeItemSchema),
});

export const NFCeValidationSchema = z.object({
  customerCPF: z.string().optional(),
  scope: z.enum(["interna", "interestadual"]),
  cfopCode: z.string().regex(/^\d{4}$/),
  items: z.array(NFeItemSchema),
  paymentMethod: z.enum([
    "01",
    "02",
    "03",
    "04",
    "05",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
  ]),
});

export const NFSeValidationSchema = z.object({
  customerId: z.number(),
  customerType: z.enum(["contribuinte", "nao-contribuinte", "consumidor"]),
  city: z.string(),
  state: z.string().length(2),
  serviceCode: z.string(),
  serviceDescription: z.string(),
  items: z.array(
    z.object({
      serviceCode: z.string(),
      serviceDescription: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      totalValue: z.number().positive(),
      discountValue: z.number().nonnegative().optional(),
      issqnValue: z.number().nonnegative(),
      issqnAliquot: z.number().min(0).max(100),
    })
  ),
});

export const CTeValidationSchema = z.object({
  shipperId: z.number(),
  recipientId: z.number(),
  originCity: z.string(),
  originState: z.string().length(2),
  destinyCity: z.string(),
  destinyState: z.string().length(2),
  transportationType: z.enum(["01", "02", "03", "04", "05", "06"]),
  cargoQuantity: z.number().positive(),
  cargoType: z.string(),
  cargoValue: z.number().positive(),
});

export const MDFeValidationSchema = z.object({
  driverId: z.number(),
  vehiclePlate: z.string().regex(/^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/),
  vehicleUF: z.string().length(2),
  transportationType: z.enum(["01", "02", "03", "04", "05", "06"]),
  originCity: z.string(),
  originState: z.string().length(2),
  destinyCity: z.string(),
  destinyState: z.string().length(2),
  documents: z.array(
    z.object({
      documentNumber: z.string(),
      documentSeries: z.string(),
      documentType: z.enum(["NF-e", "NFC-e", "CT-e", "NFS-e"]),
      value: z.number().positive(),
    })
  ),
});

// ============================================
// Validação de CNPJ melhorada
// ============================================
export function isValidCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, "");

  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  let digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

// ============================================
// Validação de CPF melhorada
// ============================================
export function isValidCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/[^\d]/g, "");

  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum: number = 0;
  let remainder: number;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = Number((sum * 10) % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = Number((sum * 10) % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

// ============================================
// Validação de Placa de Veículo
// ============================================
export function isValidPlate(plate: string): boolean {
  // Placa antiga: XXX-9999
  // Placa Mercosul: XXX9X99
  const oldPlate = /^[A-Z]{3}-?\d{4}$/;
  const mercosulPlate = /^[A-Z]{3}\d[A-Z]\d{2}$/;

  return oldPlate.test(plate) || mercosulPlate.test(plate);
}
