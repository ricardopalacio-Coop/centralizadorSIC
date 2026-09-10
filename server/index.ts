import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { initDb } from "./db";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import cooperadoRoutes from "./routes/cooperados";
import desligamentoRoutes from "./routes/desligamento";
import apiTokensRoutes from "./routes/apiTokens";
import apiV1Routes from "./routes/apiV1";
import plugsignRoutes from "./routes/plugsign";
import googleDriveRoutes from "./routes/googleDrive";
import googleDriveDesligamentoRoutes from "./routes/googleDriveDesligamento";
import easycoopRoutes from "./routes/easycoop";
import sicSettingsRoutes from "./routes/sicSettings";
import dossierRoutes from "./routes/dossier";
import { startSicAutoRefreshWorker } from "./services/sicBrowserAutomation";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// 1. Cabeçalhos de Segurança HTTP com Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// 2. Parser de Cookies
app.use(cookieParser());

// 3. Parser de JSON e URL Encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Configuração de CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// 5. Rate Limiting para a rota de Login e API v1
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas de login. Por favor, aguarde 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiV1Limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 reqs/minuto
  message: { error: "Limite de requisições excedido para a API V1. Aguarde 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/v1", apiV1Limiter);

// 6. Rotas da API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cooperados", cooperadoRoutes);
app.use("/api/desligamento", desligamentoRoutes);
app.use("/api/tokens", apiTokensRoutes);
app.use("/api/v1", apiV1Routes);
app.use("/api/plugsign", plugsignRoutes);
app.use("/api/drive/desligamento", googleDriveDesligamentoRoutes);
app.use("/api/drive", googleDriveRoutes);
app.use("/api/easycoop", easycoopRoutes);
app.use("/api/sic", sicSettingsRoutes);
app.use("/api/dossie", dossierRoutes);

// Rota de teste de saúde da API
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "Centralizador SIC API", db: "centralizador_sic_db" });
});

// 67. Serve frontend estático em produção com resolução dinâmica de caminhos
import fs from "fs";

let clientDist = path.join(__dirname, "../client/dist");
if (!fs.existsSync(clientDist)) {
  clientDist = path.join(__dirname, "../../client/dist");
}
if (!fs.existsSync(clientDist)) {
  clientDist = path.join(process.cwd(), "client/dist");
}

app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  const indexPath = path.join(clientDist, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send("Frontend não encontrado em " + clientDist);
});

// Inicialização do Servidor e Banco (Apenas se não estiver rodando como Vercel Serverless Function)
if (process.env.VERCEL !== "1") {
  initDb()
    .then(() => {
      startSicAutoRefreshWorker();
      app.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(`🚀 Centralizador SIC Backend & Frontend rodando na porta ${PORT}`);
        console.log(`🔒 Banco de Dados Dedicado: centralizador_sic_db (3307)`);
        console.log(`==================================================`);
      });
    })
    .catch((err) => {
      console.error("❌ Falha ao conectar ao MySQL dedicado:", err.message);
      process.exit(1);
    });
}

export default app;
export { app };
