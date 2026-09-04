import http from "http";
import url from "url";
import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PORT = 3333;
const REDIRECT_URI = "http://localhost:" + PORT + "/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("ERRO: GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET devem estar definidos no .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

console.log("");
console.log("=======================================================");
console.log("AUTENTICACAO DO GOOGLE DRIVE - CENTRALIZADOR SIC");
console.log("=======================================================");
console.log("");
console.log("1. Abrindo a tela de autorizacao no seu navegador...");
console.log("2. Caso nao abra automaticamente, acesse este link:");
console.log("");
console.log(authUrl);
console.log("");
console.log("=======================================================");
console.log("");

// Abre o navegador padrão no Windows
try {
  exec('start "" "' + authUrl + '"');
} catch (e) {
  // Ignora erro de exec
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = url.parse(req.url || "", true);
    if (reqUrl.pathname === "/oauth2callback") {
      const code = reqUrl.query.code as string;
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h3>Codigo de autorizacao nao recebido. Tente novamente.</h3>");
        return;
      }

      console.log("Recebido codigo de autorizacao! Trocando por tokens...");
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      // Salvar no .env
      const envPath = path.resolve(process.cwd(), ".env");
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

      if (refreshToken) {
        if (envContent.includes("GOOGLE_OAUTH_REFRESH_TOKEN=")) {
          envContent = envContent.replace(/GOOGLE_OAUTH_REFRESH_TOKEN=.*/g, "GOOGLE_OAUTH_REFRESH_TOKEN=" + refreshToken);
        } else {
          envContent += "\nGOOGLE_OAUTH_REFRESH_TOKEN=" + refreshToken + "\n";
        }
        fs.writeFileSync(envPath, envContent, "utf8");
        console.log("GOOGLE_OAUTH_REFRESH_TOKEN salvo com sucesso no arquivo .env!");
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <div style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #0f172a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 500px; border: 1px solid #e2e8f0;">
            <div style="font-size: 50px; margin-bottom: 20px;">OK</div>
            <h2 style="color: #0284c7; margin-bottom: 10px;">Google Drive Conectado!</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
              A autorizacao foi concluida com sucesso e o token permanente foi salvo no <strong>Centralizador SIC</strong>.
            </p>
            <p style="margin-top: 25px; font-size: 13px; font-weight: bold; color: #10b981;">
              Voce ja pode fechar esta aba e voltar ao sistema.
            </p>
          </div>
        </div>
      `);

      setTimeout(() => {
        server.close(() => {
          console.log("Servidor temporario de autenticacao finalizado.");
          process.exit(0);
        });
      }, 2000);
    }
  } catch (err: any) {
    console.error("Erro ao processar callback OAuth:", err.message);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h3>Erro na autenticacao: " + err.message + "</h3>");
  }
});

server.listen(PORT, () => {
  console.log("Servidor local aguardando autorizacao em http://localhost:" + PORT + "/oauth2callback ...");
});
