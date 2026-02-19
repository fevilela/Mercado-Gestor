import * as crypto from "crypto";
import * as forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const forgeLib: any = (forge as any).asn1 ? forge : require("node-forge");

/**
 * XML Signature Service for NF-e documents
 * Uses node-forge to handle PKCS#12 certificates and perform RSA-SHA1 signing
 */

export interface CertificateInfo {
  cnpj: string;
  subjectName: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
}

export interface CertificateCnpjCandidate {
  cnpj: string;
  source: string;
  raw?: string;
}

export class XMLSignatureService {
  /**
   * Sign XML using the actual private key from P12/PFX certificate
   * Performs RSA-SHA1 signature compatible with NF-e PL_009_V4 xmldsig schema
   */
  static signXML(
    xmlContent: string,
    certificateDataBase64: string,
    certificatePassword: string,
    referenceId: string = "nfe"
  ): string {
    try {
      // Decode base64 certificate data
      const certificateBuffer = Buffer.from(certificateDataBase64, "base64");
      const binaryBuffer = certificateBuffer.toString("binary");

      // Parse PKCS#12 using forge's ASN.1 parser and pkcs12 module
      const asn1 = forgeLib.asn1.fromDer(binaryBuffer);

      // Use the correct forge.pkcs12 API: pkcs12FromAsn1
      const pkcs12 = (forgeLib as any).pkcs12;
      const p12 = pkcs12.pkcs12FromAsn1(asn1, certificatePassword);

      // Extract the certificate chain and key
      let privateKey: any = null;
      let certificate: any = null;

      try {
        const keyBags =
          p12.getBags({ bagType: forgeLib.pki.oids.pkcs8ShroudedKeyBag })[
            forgeLib.pki.oids.pkcs8ShroudedKeyBag
          ] || [];
        if (keyBags.length > 0) {
          privateKey = keyBags[0]?.key ?? null;
        }

        const certBags =
          p12.getBags({ bagType: forgeLib.pki.oids.certBag })[
            forgeLib.pki.oids.certBag
          ] || [];
        if (certBags.length > 0) {
          certificate = certBags[0]?.cert ?? null;
        }
      } catch {
        if (p12.bags && p12.bags.length > 0) {
          for (const bag of p12.bags) {
            if (bag.type === forgeLib.pki.oids.pkcs8ShroudedKeyBag) {
              privateKey = bag.key;
            } else if (bag.type === forgeLib.pki.oids.certBag && !certificate) {
              certificate = bag.cert;
            }
          }
        }
      }

      if (!privateKey || !certificate) {
        throw new Error("Could not extract key or certificate from P12");
      }

      const privateKeyPem = forgeLib.pki.privateKeyToPem(privateKey);
      const certDer = forgeLib.asn1.toDer(
        forgeLib.pki.certificateToAsn1(certificate)
      );
      const certBase64 = forgeLib.util.encode64(certDer.getBytes());

      const signedXml = new SignedXml();
      const signedXmlAny = signedXml as any;
      signedXmlAny.idAttributes = ["Id"];
      signedXmlAny.signatureAlgorithm =
        "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
      signedXmlAny.canonicalizationAlgorithm =
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
      signedXmlAny.signingKey = privateKeyPem;
      signedXmlAny.privateKey = privateKeyPem;
      const keyInfoProvider = {
        getKeyInfo() {
          return `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>`;
        },
        getKey() {
          return privateKeyPem;
        },
      } as any;
      signedXmlAny.keyInfoProvider = keyInfoProvider;
      signedXmlAny.addReference({
        xpath: `//*[@Id='${referenceId}']`,
        transforms: [
          "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
          "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
        uri: `#${referenceId}`,
      });
      const signatureAnchor = "//*[local-name()='infNFe']";
      signedXmlAny.computeSignature(xmlContent, {
        location: {
          reference: signatureAnchor,
          action: "after",
        },
        keyInfoProvider,
      });

      const signed = signedXmlAny.getSignedXml();
      if (signed.includes("<KeyInfo>")) {
        return signed;
      }
      const keyInfo = `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>`;
      return signed.replace(
        /<\/SignatureValue>/,
        `</SignatureValue>${keyInfo}`
      );
    } catch (error) {
      throw new Error(
        `Failed to sign XML: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Extract certificate information from base64 encoded P12
   * Parses the actual certificate using node-forge
   */
  static extractCertificateInfo(
    certificateDataBase64: string,
    certificatePassword: string
  ): CertificateInfo {
    try {
      // Decode base64 certificate data
      const certificateBuffer = Buffer.from(certificateDataBase64, "base64");
      const binaryBuffer = certificateBuffer.toString("binary");

      // Parse PKCS#12 using forge's ASN.1 parser
      const asn1 = forgeLib.asn1.fromDer(binaryBuffer);

      // Use the correct forge.pkcs12 API: pkcs12FromAsn1
      const pkcs12 = (forgeLib as any).pkcs12;
      const p12 = pkcs12.pkcs12FromAsn1(asn1, certificatePassword);

      const bags =
        p12.getBags({ bagType: forgeLib.pki.oids.certBag })[
          forgeLib.pki.oids.certBag
        ] || [];
      const certificates = bags.map((bag: any) => bag.cert).filter(Boolean);

      if (certificates.length === 0) {
        throw new Error("No certificates found in P12");
      }

      const collectAsn1Strings = (node: any, out: string[]) => {
        if (!node) return;
        if (typeof node.value === "string") {
          out.push(node.value);
          return;
        }
        if (Array.isArray(node.value)) {
          for (const child of node.value) collectAsn1Strings(child, out);
        }
      };

      const isValidCnpj = (cnpj: string) => {
        const clean = cnpj.replace(/\D/g, "");
        if (clean.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(clean)) return false;
        let size = 12;
        let numbers = clean.substring(0, size);
        let digits = clean.substring(size);
        let sum = 0;
        let pos = size - 7;
        for (let i = size; i >= 1; i--) {
          sum += Number(numbers.charAt(size - i)) * pos--;
          if (pos < 2) pos = 9;
        }
        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== Number(digits.charAt(0))) return false;
        size = 13;
        numbers = clean.substring(0, size);
        sum = 0;
        pos = size - 7;
        for (let i = size; i >= 1; i--) {
          sum += Number(numbers.charAt(size - i)) * pos--;
          if (pos < 2) pos = 9;
        }
        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return result === Number(digits.charAt(1));
      };

      const extractCnpjFromText = (value?: string | null) => {
        if (!value) return null;
        const digits = value.replace(/\D/g, "");
        if (digits.length < 14) return null;
        for (let i = 0; i <= digits.length - 14; i++) {
          const candidate = digits.slice(i, i + 14);
          if (isValidCnpj(candidate)) return candidate;
        }
        return digits.slice(0, 14);
      };

      const collectCandidates = (value: string, source: string) => {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 14) return [];
        const results: CertificateCnpjCandidate[] = [];
        for (let i = 0; i <= digits.length - 14; i++) {
          const cnpj = digits.slice(i, i + 14);
          if (isValidCnpj(cnpj)) {
            results.push({ cnpj, source, raw: value });
          }
        }
        return results;
      };

      const extractCnpjCandidatesFromCert = (cert: any) => {
        const candidates: CertificateCnpjCandidate[] = [];
        const san = cert.getExtension("subjectAltName");
        if (san?.altNames?.length) {
          for (const alt of san.altNames) {
            if (alt.type === 0 && alt.typeId === "2.16.76.1.3.3") {
              try {
                if (typeof alt.value === "string") {
                  const asn1Value = forgeLib.asn1.fromDer(alt.value);
                  const values: string[] = [];
                  collectAsn1Strings(asn1Value, values);
                  candidates.push(
                    ...collectCandidates(values.join(" "), "san:2.16.76.1.3.3")
                  );
                }
              } catch {
                candidates.push(
                  ...collectCandidates(String(alt.value), "san:2.16.76.1.3.3")
                );
              }
            }
          }
        }

        for (const attr of cert.subject.attributes || []) {
          if (attr.type === "2.16.76.1.3.3") {
            candidates.push(
              ...collectCandidates(String(attr.value), "subject:2.16.76.1.3.3")
            );
          }
          if (attr.shortName === "serialNumber" || attr.name === "serialNumber") {
            candidates.push(
              ...collectCandidates(String(attr.value), "subject:serialNumber")
            );
          }
          if (attr.shortName === "CN" || attr.name === "commonName") {
            candidates.push(
              ...collectCandidates(String(attr.value), "subject:CN")
            );
          }
        }

        return candidates;
      };

      const pickBestCandidate = (candidates: CertificateCnpjCandidate[]) => {
        if (candidates.length === 0) return null;
        const counts = new Map<string, number>();
        for (const cand of candidates) {
          counts.set(cand.cnpj, (counts.get(cand.cnpj) || 0) + 1);
        }
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        return sorted[0]?.[0] || candidates[0].cnpj;
      };

      let certificate =
        certificates.find(
          (cert: any) => (extractCnpjCandidatesFromCert(cert) || []).length
        ) ||
        certificates.find(
          (cert: any) => !cert.getExtension("basicConstraints")?.cA
        ) ||
        certificates[0];

      if (!certificate) {
        throw new Error("Could not extract certificate from P12");
      }

      const candidates = extractCnpjCandidatesFromCert(certificate);
      let cnpj = pickBestCandidate(candidates) || "00000000000000";

      // Get subject name and issuer
      const subjectName = certificate.subject.attributes
        .map((attr: any) => `${attr.name}=${attr.value}`)
        .join(", ");
      const issuer = certificate.issuer.attributes
        .map((attr: any) => `${attr.name}=${attr.value}`)
        .join(", ");

      if (cnpj === "00000000000000") {
        const fromSubject = extractCnpjFromText(subjectName);
        if (fromSubject && isValidCnpj(fromSubject)) {
          cnpj = fromSubject;
        }
      }

      return {
        cnpj,
        subjectName,
        issuer,
        validFrom: certificate.validity.notBefore,
        validUntil: certificate.validity.notAfter,
      };
    } catch (error) {
      throw new Error(
        `Failed to extract certificate info: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate if certificate is still valid
   */
  static isCertificateValid(validUntil: Date): boolean {
    return new Date() < validUntil;
  }

  /**
   * Get days until certificate expires
   */
  static getDaysUntilExpiration(validUntil: Date): number {
    const now = new Date();
    const diffTime = validUntil.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static extractCertificateCnpjCandidates(
    certificateDataBase64: string,
    certificatePassword: string
  ): CertificateCnpjCandidate[] {
    try {
      const certificateBuffer = Buffer.from(certificateDataBase64, "base64");
      const binaryBuffer = certificateBuffer.toString("binary");
      const asn1 = forgeLib.asn1.fromDer(binaryBuffer);
      const pkcs12 = (forgeLib as any).pkcs12;
      const p12 = pkcs12.pkcs12FromAsn1(asn1, certificatePassword);
      const bags =
        p12.getBags({ bagType: forgeLib.pki.oids.certBag })[
          forgeLib.pki.oids.certBag
        ] || [];
      const certificates = bags.map((bag: any) => bag.cert).filter(Boolean);
      if (certificates.length === 0) return [];

      const collectAsn1Strings = (node: any, out: string[]) => {
        if (!node) return;
        if (typeof node.value === "string") {
          out.push(node.value);
          return;
        }
        if (Array.isArray(node.value)) {
          for (const child of node.value) collectAsn1Strings(child, out);
        }
      };

      const isValidCnpj = (cnpj: string) => {
        const clean = cnpj.replace(/\D/g, "");
        if (clean.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(clean)) return false;
        let size = 12;
        let numbers = clean.substring(0, size);
        let digits = clean.substring(size);
        let sum = 0;
        let pos = size - 7;
        for (let i = size; i >= 1; i--) {
          sum += Number(numbers.charAt(size - i)) * pos--;
          if (pos < 2) pos = 9;
        }
        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== Number(digits.charAt(0))) return false;
        size = 13;
        numbers = clean.substring(0, size);
        sum = 0;
        pos = size - 7;
        for (let i = size; i >= 1; i--) {
          sum += Number(numbers.charAt(size - i)) * pos--;
          if (pos < 2) pos = 9;
        }
        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return result === Number(digits.charAt(1));
      };

      const collectCandidates = (value: string, source: string) => {
        const digits = value.replace(/\D/g, "");
        const matches = digits.match(/\d{14}/g) || [];
        return matches
          .filter((cnpj) => isValidCnpj(cnpj))
          .map((cnpj) => ({ cnpj, source, raw: value }));
      };

      const candidates: CertificateCnpjCandidate[] = [];
      const cert = certificates[0];
      const subjectName = cert.subject.attributes
        .map((attr: any) => `${attr.name}=${attr.value}`)
        .join(", ");
      const san = cert.getExtension("subjectAltName");
      if (san?.altNames?.length) {
        for (const alt of san.altNames) {
          if (alt.type === 0 && alt.typeId === "2.16.76.1.3.3") {
            try {
              if (typeof alt.value === "string") {
                const asn1Value = forgeLib.asn1.fromDer(alt.value);
                const values: string[] = [];
                collectAsn1Strings(asn1Value, values);
                candidates.push(
                  ...collectCandidates(values.join(" "), "san:2.16.76.1.3.3")
                );
              }
            } catch {
              candidates.push(
                ...collectCandidates(String(alt.value), "san:2.16.76.1.3.3")
              );
            }
          }
        }
      }

      for (const attr of cert.subject.attributes || []) {
        if (attr.type === "2.16.76.1.3.3") {
          candidates.push(
            ...collectCandidates(String(attr.value), "subject:2.16.76.1.3.3")
          );
        }
        if (attr.shortName === "serialNumber" || attr.name === "serialNumber") {
          candidates.push(
            ...collectCandidates(String(attr.value), "subject:serialNumber")
          );
        }
        if (attr.shortName === "CN" || attr.name === "commonName") {
          candidates.push(
            ...collectCandidates(String(attr.value), "subject:CN")
          );
        }
      }

      candidates.push(
        ...collectCandidates(String(subjectName), "subjectName")
      );

      return candidates;
    } catch {
      return [];
    }
  }
}
