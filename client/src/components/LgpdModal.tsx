import React, { useEffect, useState } from "react";
import { X, ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface LgpdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DADOS_PROTEGIDOS = [
  "CPF (exibido como ***.456.789-**)",
  "RG, PIS/NIS, CTPS, CNH e título de eleitor",
  "Telefones e e-mails",
  "Endereço completo e CEP",
  "Data e local de nascimento, filiação",
  "Dados bancários e chave PIX",
];

/** Chave global de mascaramento LGPD. Somente o SuperAdmin acessa. */
export const LgpdModal: React.FC<LgpdModalProps> = ({ isOpen, onClose }) => {
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setErro("");
    setSucesso("");
    setCarregando(true);
    fetch("/api/lgpd", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setAtivo(!!data.ativo))
      .catch(() => setErro("Não foi possível consultar a configuração da LGPD."))
      .finally(() => setCarregando(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const alternar = async () => {
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const res = await fetch("/api/lgpd", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ativo: !ativo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar a configuração.");
      setAtivo(!!data.ativo);
      setSucesso(data.message);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">LGPD — proteção de dados</h3>
            <p className="text-xs text-slate-500">Lei nº 13.709/2018 · vale para todos os usuários</p>
          </div>
        </div>

        {erro && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
        {sucesso && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{sucesso}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div>
            <p className="text-sm font-semibold text-slate-800">Mascarar dados sensíveis</p>
            <p className="text-xs text-slate-500">
              {carregando ? "Consultando..." : ativo ? "Ativo: usuários veem os dados mascarados." : "Desativado: todos veem os dados completos."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ativo}
            onClick={alternar}
            disabled={carregando || salvando}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              ativo ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            {salvando ? (
              <Loader2 className="absolute left-1/2 -translate-x-1/2 h-4 w-4 animate-spin text-white" />
            ) : (
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-6" : "translate-x-1"}`} />
            )}
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Dados mascarados quando ativo</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {DADOS_PROTEGIDOS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#7cc243] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            O SuperAdmin continua vendo os dados completos. Com a LGPD ativa, os demais perfis não conseguem gravar
            dados mascarados por cima dos originais.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
