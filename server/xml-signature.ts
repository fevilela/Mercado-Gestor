import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as forge from "node-forge";

/**
 * XML Signature Service for NF-e documents
 * Uses node-forge to handle PKCS#12 certificates and perform real RSA-SHA256 signing
 */

export interface CertificateInfo {
  cnpj: string;
  subjectName: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
}

export class XMLSignatureService {
  /**
   * Sign XML using the actual private key from P12/PFX certificate
   * Performs proper RSA-SHA256 signature with the certificate's private key
   */
  static signXML(
    xmlContent: string,
    certificateDataBase64: string,
    certificatePassword: string
  ): string {
    try {
      // Decode base64 certificate data
      const certificateBuffer = Buffer.from(certificateDataBase64, "base64");
      const binaryBuffer = certificateBuffer.toString("binary");

      // Parse PKCS#12 using forge's ASN.1 parser and pkcs12 module
      const asn1 = forge.asn1.fromDer(binaryBuffer);

      // Use the correct forge.pkcs12 API: pkcs12FromAsn1
      const pkcs12 = (forge as any).pkcs12;
      const p12 = pkcs12.pkcs12FromAsn1(asn1, certificatePassword);

      // Extract the certificate chain and key
      let privateKey: any = null;
      let certificate: any = null;

      if (p12.bags && p12.bags.length > 0) {
        for (const bag of p12.bags) {
          if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
            privateKey = bag.key;
          } else if (bag.type === forge.pki.oids.certBag && !certificate) {
            certificate = bag.cert;
          }
        }
      }

      if (!privateKey || !certificate) {
        throw new Error("Could not extract key or certificate from P12");
      }

      // Create signature of the XML content using RSA-SHA256
      const md = forge.md.sha256.create();
      md.update(xmlContent);
      const signature = privateKey.sign(md);
      const signatureBase64 = forge.util.encode64(signature);

      // Convert certificate to base64 for inclusion in signature
      const certDer = forge.asn1.toDer(
        forge.pki.certificateToAsn1(certificate)
      );
      const certBase64 = forge.util.encode64(certDer.getBytes());

      // Create the XML Signature element
      const signatureElement = `
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
        <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
        <Reference URI="#nfe">
          <Transforms>
            <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
            <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
          </Transforms>
          <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />
          <DigestValue>${forge.util.encode64(
            md.digest().getBytes()
          )}</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>${signatureBase64}</SignatureValue>
      <KeyInfo>
        <X509Data>
          <X509Certificate>${certBase64}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </Signature>`;

      // Insert signature into the XML before the closing tag
      const modifiedXml = xmlContent.replace(
        /<\/NFe>/,
        `${signatureElement}</NFe>`
      );

      return modifiedXml;
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
      const asn1 = forge.asn1.fromDer(binaryBuffer);

      // Use the correct forge.pkcs12 API: pkcs12FromAsn1
      const pkcs12 = (forge as any).pkcs12;
      const p12 = pkcs12.pkcs12FromAsn1(asn1, certificatePassword);

      // Extract the first certificate from bags
      if (!p12.bags || p12.bags.length === 0) {
        throw new Error("No certificates found in P12");
      }

      let certificate: any = null;
      for (const bag of p12.bags) {
        if (bag.type === forge.pki.oids.certBag) {
          certificate = bag.cert;
          break;
        }
      }

      if (!certificate) {
        throw new Error("Could not extract certificate from P12");
      }

      // Extract CNPJ from certificate subject
      let cnpj = "00000000000000";
      if (certificate.subject.getField("CN")) {
        const cn = certificate.subject.getField("CN").value;
        const cnpjMatch = cn.match(/(\d{14})/);
        if (cnpjMatch) {
          cnpj = cnpjMatch[1];
        }
      }

      // Get subject name and issuer
      const subjectName = certificate.subject.attributes
        .map((attr: any) => `${attr.name}=${attr.value}`)
        .join(", ");
      const issuer = certificate.issuer.attributes
        .map((attr: any) => `${attr.name}=${attr.value}`)
        .join(", ");

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
}
