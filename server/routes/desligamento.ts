import { Router } from "express";
import { authenticateToken } from "../middlewares/auth";
import { consultarDesligamentoEProposta, cleanCpf } from "../services/desligamentoService";
import { generatePropostaAdesaoPdf, generateTermoDesligamentoPdf } from "../services/pdfService";

const router = Router();

// Todas as rotas de desligamento e propostas exigem autenticação do usuário
router.use(authenticateToken);

/**
 * POST /api/desligamento/consultar
 * Consulta status de desligamento e propostas para um CPF de cooperado
 */
router.post("/consultar", async (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) {
      return res.status(400).json({ error: "CPF é obrigatório para consulta." });
    }

    const resultado = await consultarDesligamentoEProposta(cpf);
    return res.json(resultado);
  } catch (error: any) {
    console.error("[Desligamento Route Error]:", error.message);
    return res.status(400).json({ error: error.message || "Falha ao consultar desligamento/proposta." });
  }
});

/**
 * GET /api/desligamento/:cpf/proposta-pdf
 * Retorna o PDF da Proposta de Adesão / Admissão
 */
router.get("/:cpf/proposta-pdf", async (req, res) => {
  try {
    const numericCpf = cleanCpf(req.params.cpf || "");
    const resultado = await consultarDesligamentoEProposta(numericCpf);
    const pdfBuffer = await generatePropostaAdesaoPdf(resultado.proposal?.data || {}, numericCpf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="proposta-adesao-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[Desligamento PDF Error]:", error.message);
    return res.status(500).json({ error: "Falha ao gerar o PDF da proposta de adesão." });
  }
});

/**
 * GET /api/desligamento/:cpf/desligamento-pdf
 * Retorna o PDF do Termo de Desligamento
 */
router.get("/:cpf/desligamento-pdf", async (req, res) => {
  try {
    const numericCpf = cleanCpf(req.params.cpf || "");
    const resultado = await consultarDesligamentoEProposta(numericCpf);
    const pdfBuffer = await generateTermoDesligamentoPdf(resultado.termination || {}, numericCpf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="termo-desligamento-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[Desligamento PDF Error]:", error.message);
    return res.status(500).json({ error: "Falha ao gerar o PDF do termo de desligamento." });
  }
});

/**
 * GET /api/desligamento/:cpf
 * Rota GET alternativa por conveniência
 */
router.get("/:cpf", async (req, res) => {
  try {
    const { cpf } = req.params;
    const resultado = await consultarDesligamentoEProposta(cpf);
    return res.json(resultado);
  } catch (error: any) {
    console.error("[Desligamento Route Error]:", error.message);
    return res.status(400).json({ error: error.message || "Falha ao consultar desligamento/proposta." });
  }
});

export default router;
