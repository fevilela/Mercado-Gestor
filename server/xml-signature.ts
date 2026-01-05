import { createRequire } from "module";
const require = createRequire(import.meta.url);
const forge = require("node-forge");

import { SignedXml } from "xml-crypto";
import { DOMParser } from "xmldom";

/**
 * XML Signature Service for NF-e documents
 * Uses node-forge to handle PKCS#12 certificates and perform RSA-SHA256 signing
 */

export interface CertificateInfo {
  cnpj: string;
  subjectName: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
}

export interface CertificateData {
  privateKey: any;
  certificate: any;
  info: CertificateInfo;
}

/**
 * Service responsible ONLY for handling A1 certificates (PFX/P12)
 */
export class CertificateService {
  static loadFromBase64(
    certificateDataBase64: string,
    certificatePassword: string
  ): CertificateData {
    const buffer = Buffer.from(certificateDataBase64, "base64");
    return this.loadFromBuffer(buffer, certificatePassword);
  }

  static loadFromBuffer(
    certificateBuffer: Buffer,
    certificatePassword: string
  ): CertificateData {
    const binary = certificateBuffer.toString("binary");
    const asn1 = forge.asn1.fromDer(binary);

    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, certificatePassword);

    const keyBags = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag];

    const certBags = p12.getBags({
      bagType: forge.pki.oids.certBag,
    })[forge.pki.oids.certBag];

    if (!keyBags || keyBags.length === 0) {
      throw new Error("Chave privada não encontrada no certificado");
    }

    if (!certBags || certBags.length === 0) {
      throw new Error("Certificado X509 não encontrado no PFX");
    }

    const privateKey = keyBags[0].key;
    const certificate = certBags[0].cert;

    return {
      privateKey,
      certificate,
      info: this.extractCertificateInfo(certificate),
    };
  }

  private static extractCertificateInfo(certificate: any): CertificateInfo {
    let cnpj = "00000000000000";

    const cnField = certificate.subject.getField("CN");
    if (cnField && cnField.value) {
      const match = cnField.value.match(/(\d{14})/);
      if (match) cnpj = match[1];
    }

    const subjectName = certificate.subject.attributes
      .map((a: any) => `${a.name}=${a.value}`)
      .join(", ");

    const issuer = certificate.issuer.attributes
      .map((a: any) => `${a.name}=${a.value}`)
      .join(", ");

    return {
      cnpj,
      subjectName,
      issuer,
      validFrom: certificate.validity.notBefore,
      validUntil: certificate.validity.notAfter,
    };
  }
}

export class XMLSignatureService {
  static signNFeSEFAZ(
    xmlContent: string,
    certificateBase64: string,
    certificatePassword: string
  ): string {
    const { privateKey, certificate } = CertificateService.loadFromBase64(
      certificateBase64,
      certificatePassword
    );

    // Converte privateKey para PEM
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

    // Certificado em base64 (SEM header/footer)
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate));
    const certBase64 = forge.util.encode64(certDer.getBytes());

    const doc = new DOMParser().parseFromString(xmlContent);

    const sig = new SignedXml({
      canonicalizationAlgorithm:
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
      privateKey: privateKeyPem,
    });

    sig.addReference({
      xpath: "//*[local-name()='infNFe']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    });

    (sig as any).keyInfoProvider = {
      getKeyInfo() {
        return `
          <KeyInfo>
            <X509Data>
              <X509Certificate>${certBase64}</X509Certificate>
            </X509Data>
          </KeyInfo>`;
      },
    };

    sig.computeSignature(doc.toString());

    return sig.getSignedXml();
  }
}
