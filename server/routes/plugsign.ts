import { Router, Response } from "express";
import multer from "multer";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import {
  processPlugSignWorkbook,
  getJob,
  cancelJob,
  PlugSignProgressUpdate,
} from "../services/plugsignService";

const router = Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Middleware de autenticação para todas as rotas do PlugSign
router.use(authenticateToken);

/**
 * POST /api/plugsign/analyze-stream
 * Recebe a planilha Excel e envia o progresso linha a linha via Server-Sent Events (SSE)
 */
router.post(
  "/analyze-stream",
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: "Nenhum arquivo Excel foi enviado." });
      return;
    }

    const originalName = req.file.originalname || "planilha.xlsx";

    // Configura cabeçalhos para Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Desativa buffering no Nginx se houver
    res.flushHeaders?.();

    const sendEvent = (data: PlugSignProgressUpdate) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await processPlugSignWorkbook(
        req.file.buffer,
        originalName,
        (update) => {
          sendEvent(update);
        }
      );

      // Envia notificação de conclusão
      sendEvent({
        jobId: result.jobId,
        totalRows: result.summary.totalRows,
        processedRows: result.summary.processedRows,
        signedCount: result.summary.signedCount,
        unsignedCount: result.summary.unsignedCount,
        percent: 100,
        isCompleted: true,
      });

      res.end();
    } catch (err: any) {
      console.error("[PlugSign Router Error]:", err.message);
      sendEvent({
        jobId: "error",
        totalRows: 0,
        processedRows: 0,
        signedCount: 0,
        unsignedCount: 0,
        percent: 0,
        isCompleted: true,
        error: err.message || "Falha ao processar a planilha do PlugSign.",
      });
      res.end();
    }
  }
);

/**
 * GET /api/plugsign/download/:jobId
 * Permite o download do arquivo Excel modificado com a Coluna J e marcação amarela
 */
router.get("/download/:jobId", (req: AuthenticatedRequest, res: Response): void => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  if (!jobId) {
    res.status(400).json({ error: "ID do job é obrigatório." });
    return;
  }

  const job = getJob(jobId);
  if (!job || !job.buffer) {
    res.status(404).json({ error: "Arquivo processado não encontrado ou já expirou." });
    return;
  }

  const baseName = job.originalFileName.replace(/\.[^/.]+$/, "");
  const downloadName = `${baseName}_analisado_plugsign.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(downloadName)}"`
  );
  res.setHeader("Content-Length", job.buffer.length);
  res.send(job.buffer);
});

/**
 * POST /api/plugsign/cancel/:jobId
 * Permite interromper o processamento em andamento
 */
router.post("/cancel/:jobId", (req: AuthenticatedRequest, res: Response): void => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  if (!jobId) {
    res.status(400).json({ error: "ID do job é obrigatório." });
    return;
  }

  const success = cancelJob(jobId);
  res.json({ success, message: success ? "Cancelamento solicitado com sucesso." : "Job não encontrado ou já finalizado." });
});

export default router;
