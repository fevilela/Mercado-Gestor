import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { db } from "./db";
import { digitalCertificates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface CertificateInfo {
  isValid: boolean;
  validFrom: Date;
  validUntil: Date;
  subject: string;
  issuer: string;
  thumbprint: string;
  daysUntilExpiry: number;
}

export class CertificateService {
  private certificateCache = new Map<number, Buffer>();

  async uploadCertificate(
    companyId: number,
    certificateBuffer: Buffer,
    password: string,
    cnpj: string = "00000000000000"
  ): Promise<{
    success: boolean;
    message: string;
    thumbprint?: string;
  }> {
    try {
      // Validar se é um certificado válido
      // Em produção, parsear o PKCS#12 usando biblioteca como node-forge
      const thumbprint = crypto
        .createHash("sha1")
        .update(certificateBuffer)
        .digest("hex")
        .toUpperCase();

      // Criptografar certificado antes de armazenar
      const encryptedCert = this.encryptCertificate(certificateBuffer);

      // Salvar no banco
      await db
        .delete(digitalCertificates)
        .where(eq(digitalCertificates.companyId, companyId));

      await db.insert(digitalCertificates).values({
        companyId,
        cnpj: cnpj.replace(/\D/g, ""),
        certificateData: encryptedCert.toString("base64"),
        certificatePassword: this.encryptPassword(password),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      });

      this.certificateCache.delete(companyId);

      return {
        success: true,
        message: "Certificado carregado com sucesso",
        thumbprint,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao carregar certificado",
      };
    }
  }

  async getCertificate(companyId: number): Promise<Buffer | null> {
    try {
      if (this.certificateCache.has(companyId)) {
        return this.certificateCache.get(companyId) || null;
      }

      const [cert] = await db
        .select()
        .from(digitalCertificates)
        .where(
          and(
            eq(digitalCertificates.companyId, companyId),
            eq(digitalCertificates.isActive, true)
          )
        )
        .limit(1);

      if (!cert || !cert.certificateData) {
        return null;
      }

      const decrypted = this.decryptCertificate(
        Buffer.from(cert.certificateData, "base64")
      );
      this.certificateCache.set(companyId, decrypted);
      return decrypted;
    } catch (error) {
      console.error("Erro ao obter certificado:", error);
      return null;
    }
  }

  async getCertificatePassword(companyId: number): Promise<string | null> {
    try {
      const [cert] = await db
        .select()
        .from(digitalCertificates)
        .where(eq(digitalCertificates.companyId, companyId))
        .limit(1);

      if (!cert || !cert.certificatePassword) {
        return null;
      }

      return this.decryptPassword(cert.certificatePassword);
    } catch (error) {
      return null;
    }
  }

  async validateCertificate(
    companyId: number
  ): Promise<CertificateInfo | null> {
    try {
      const [cert] = await db
        .select()
        .from(digitalCertificates)
        .where(eq(digitalCertificates.companyId, companyId))
        .limit(1);

      if (!cert) {
        return null;
      }

      const validUntil = new Date(cert.validUntil!);
      const now = new Date();
      const daysUntilExpiry = Math.floor(
        (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        isValid: daysUntilExpiry > 0,
        validFrom: cert.validFrom!,
        validUntil,
        subject: cert.subjectName || "Certificado e-CNPJ",
        issuer: cert.issuer || "Autoridade Certificadora",
        thumbprint: "",
        daysUntilExpiry,
      };
    } catch (error) {
      return null;
    }
  }

  private encryptCertificate(buffer: Buffer): Buffer {
    const key = Buffer.from(
      process.env.CERT_ENCRYPTION_KEY || "default-key-change-in-production",
      "utf-8"
    ).slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  }

  private decryptCertificate(buffer: Buffer): Buffer {
    const key = Buffer.from(
      process.env.CERT_ENCRYPTION_KEY || "default-key-change-in-production",
      "utf-8"
    ).slice(0, 32);
    const iv = buffer.slice(0, 16);
    const encrypted = buffer.slice(16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private encryptPassword(password: string): string {
    const key = Buffer.from(
      process.env.PASSWORD_ENCRYPTION_KEY || "default-key-change-in-production",
      "utf-8"
    ).slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([
      iv,
      cipher.update(password, "utf-8"),
      cipher.final(),
    ]);
    return encrypted.toString("base64");
  }

  private decryptPassword(encrypted: string): string {
    const key = Buffer.from(
      process.env.PASSWORD_ENCRYPTION_KEY || "default-key-change-in-production",
      "utf-8"
    ).slice(0, 32);
    const buffer = Buffer.from(encrypted, "base64");
    const iv = buffer.slice(0, 16);
    const encryptedData = buffer.slice(16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]).toString("utf-8");
  }
}

export const certificateService = new CertificateService();
