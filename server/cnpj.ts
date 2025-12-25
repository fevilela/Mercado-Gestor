import { Router } from "express";
import { isValidCNPJ } from "./fiscal-documents";

const router = Router();

router.get("/:cnpj", async (req, res) => {
  const { cnpj } = req.params;

  try {
    // Validar formato básico primeiro
    if (!isValidCNPJ(cnpj)) {
      return res.status(400).json({
        error: "CNPJ inválido",
        cnpj: cnpj.replace(/[^\d]/g, ""),
      });
    }

    const response = await fetch(
      `https://www.receitaws.com.br/v1/cnpj/${cnpj}`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "CNPJ não encontrado na base da Receita Federal",
      });
    }

    const data = await response.json();
    res.json({
      ...data,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao consultar CNPJ",
      message: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

export default router;
