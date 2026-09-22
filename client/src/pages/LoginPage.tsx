import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { MarcaProduto } from "../components/MarcaProduto";
import { Lock, Mail, AlertCircle, Loader2, ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";

// ============================================================================
// UNICO BLOCO QUE MUDA POR PRODUTO
// ============================================================================
const PRODUTO = {
  nome: "Centralizador",

  /**
   * Fundo da tela de entrada. O padrao da familia e VIDEO institucional:
   *   { tipo: "video", src: "/login-video.mp4" }
   * Enquanto o video nao for informado, fica o fundo institucional estatico.
   */
  fundo: { tipo: "imagem" as "imagem" | "video", src: "/fundo-sic.jpg" },

  /** Tres palavras da assinatura, mostradas na apresentacao. */
  assinatura: ["Cooperados", "Contratos", "Documentos"],

  /** Rodape discreto no pe da tela. */
  rodape: "CENTRALIZADOR SIC - 2026 - COOPEDU",

  emailPlaceholder: "voce@coopedu.com.br",
};

// Tempos da entrada: abertura -> apresentacao da marca -> formulario.
const OPENING_MS = 1800;
const SPLASH_MS = 4200;

type Fase = "abertura" | "apresentacao" | "formulario";

const animacoes = `
@keyframes sic-brilho { 0%,100% { opacity:.55; transform:scale(.98) } 50% { opacity:1; transform:scale(1.02) } }
@keyframes sic-surge  { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
@keyframes sic-salto  { 0% { opacity:0; transform:scale(.7) } 60% { opacity:1; transform:scale(1.06) } 100% { transform:scale(1) } }
@keyframes sic-barra  { from { width:0 } to { width:100% } }
@keyframes sic-flutua { 0%,100% { transform:translateY(0) rotate(0deg) } 50% { transform:translateY(-18px) rotate(6deg) } }
.sic-brilho { animation: sic-brilho 1.6s ease-in-out infinite }
.sic-surge  { animation: sic-surge .7s ease-out both }
.sic-salto  { animation: sic-salto .9s cubic-bezier(.2,1.4,.4,1) both }
.sic-barra  { animation: sic-barra 4.2s linear forwards }
.sic-flutua { animation: sic-flutua 9s ease-in-out infinite }
`;

/** Quadrados da marca flutuando ao fundo da apresentacao. */
const Quadrados: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block" aria-hidden>
    {[
      { t: "12%", l: "14%", s: 200, d: "0s" },
      { t: "52%", l: "72%", s: 240, d: "1.4s" },
      { t: "74%", l: "24%", s: 120, d: "2.6s" },
    ].map((q, i) => (
      <svg
        key={i}
        className="absolute sic-flutua opacity-30"
        style={{ top: q.t, left: q.l, width: q.s, height: q.s, animationDelay: q.d }}
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7cc243" />
            <stop offset="100%" stopColor="#00b7ff" />
          </linearGradient>
        </defs>
        <rect x="12" y="12" width="176" height="176" rx="34" stroke={`url(#grad-${i})`} strokeWidth="21" />
      </svg>
    ))}
  </div>
);

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [fase, setFase] = useState<Fase>("abertura");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFase("apresentacao"), OPENING_MS);
    const t2 = setTimeout(() => setFase("formulario"), OPENING_MS + SPLASH_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      setAutorizado(true);
    } catch (err: any) {
      setError(err.message || "E-mail ou senha incorretos.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Fase 1: abertura ----------
  if (fase === "abertura") {
    return (
      <div className="fixed inset-0 bg-[#04101f] flex items-center justify-center">
        <style>{animacoes}</style>
        <img src="/logo-coopedu-branco.png" alt="Coopedu" className="w-72 md:w-96 object-contain sic-brilho" />
      </div>
    );
  }

  // ---------- Fase 2: apresentacao da marca ----------
  if (fase === "apresentacao") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: "radial-gradient(ellipse at center, #ffffff 0%, #e8f0f7 60%, #d7e5f0 100%)" }}
      >
        <style>{animacoes}</style>
        <Quadrados />

        <div className="relative z-10 flex flex-col items-center px-6">
          <img
            src="/logo-sic.png"
            alt="SiC - sistema integrado de cooperativas"
            className="w-[290px] md:w-[420px] object-contain sic-surge"
          />
          <div className="sic-salto mt-1" style={{ animationDelay: ".45s" }}>
            <MarcaProduto altura={78} />
          </div>

          <div className="flex items-center gap-3 mt-7 sic-surge" style={{ animationDelay: ".9s" }}>
            {PRODUTO.assinatura.map((palavra, i) => (
              <React.Fragment key={palavra}>
                {i > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#3ab54a]" />}
                <span className="text-sm md:text-base font-semibold text-slate-600 uppercase tracking-[0.18em]">
                  {palavra}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="mt-10 w-64 h-1 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full sic-barra bg-gradient-to-r from-blue-600 to-[#7cc243]" />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Fase 3: formulario ----------
  return (
    <div className="fixed inset-0 overflow-y-auto">
      <style>{animacoes}</style>

      {/* Fundo: video quando houver, imagem institucional enquanto nao houver */}
      {PRODUTO.fundo.tipo === "video" ? (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={PRODUTO.fundo.src}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      ) : (
        <img src={PRODUTO.fundo.src} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Veu: garante contraste do cartao sobre qualquer fundo */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(15,23,42,0.40) 0%, rgba(15,23,42,0.80) 100%)" }}
      />

      <img
        src="/logo-coopedu-branco.png"
        alt="Coopedu"
        className="absolute top-8 left-8 w-64 md:w-80 object-contain drop-shadow-lg z-10 hidden sm:block"
      />
      <img
        src="/somoscoop.png"
        alt="SomosCoop"
        className="absolute bottom-10 left-8 w-[109px] md:w-[136px] object-contain z-10 hidden sm:block"
      />

      <div className="relative z-20 min-h-full flex items-center justify-center lg:justify-end px-4 py-10 lg:pr-[7vw]">
        <div className="relative w-full max-w-[440px] sic-surge">
          {/* Brilho da borda na assinatura da marca */}
          <div
            className="absolute -inset-[3px] rounded-[34px] blur-md opacity-40"
            style={{ background: "linear-gradient(90deg, #2f9be0, #7cc243, #2f9be0)" }}
            aria-hidden
          />

          <div className="relative bg-white/85 backdrop-blur-xl border border-slate-300/40 rounded-[30px] p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-7">
              <img
                src="/logo-sic.png"
                alt="SiC - sistema integrado de cooperativas"
                className="w-[290px] object-contain"
              />
              <MarcaProduto altura={60} className="-mt-3" />
              <p className="text-xs text-slate-500 mt-3">Gestão e consulta de cooperados</p>
            </div>

            {error && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-blue-600 tracking-wider mb-2">
                  E-mail de acesso
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={PRODUTO.emailPlaceholder}
                    required
                    autoFocus
                    className="w-full py-4 pl-12 pr-4 rounded-xl bg-slate-100/90 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-blue-600 tracking-wider mb-2">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={verSenha ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full py-4 pl-12 pr-12 rounded-xl bg-slate-100/90 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    title={verSenha ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || autorizado}
                className={`w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-90 ${
                  autorizado ? "bg-[#3ab54a]" : "bg-gradient-to-r from-blue-600 to-blue-800"
                }`}
                style={{ boxShadow: "0 10px 30px rgba(37,99,235,0.35)" }}
              >
                {autorizado ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Autorizado
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Autenticando...
                  </>
                ) : (
                  <>
                    Entrar no sistema <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 mt-6 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3ab54a]" />
              Ambiente seguro
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] uppercase tracking-[0.2em] text-slate-300/70 z-10">
        {PRODUTO.rodape}
      </div>
    </div>
  );
};
