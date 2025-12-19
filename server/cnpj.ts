import { Router } from "express";

const router = Router();

router.get("/:cnpj", async (req, res) => {
  const { cnpj } = req.params;

  try {
    const response = await fetch(
      `https://www.receitaws.com.br/v1/cnpj/${cnpj}`
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao consultar CNPJ" });
  }
});

export default router;
