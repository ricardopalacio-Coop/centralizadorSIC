import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ExternalLink,
  Info,
  Copy,
} from "lucide-react";
import { SicBookmarkletSection } from "./SicBookmarkletSection";

interface SicConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated?: () => void;
}

interface SicStatus {
  active: boolean;
  expiresAt: string | null;
  remainingMinutes: number;
  user: string | null;
  source: string;
}

export const SicConnectionModal: React.FC<SicConnectionModalProps> = ({
  isOpen,
  onClose,
  onSessionUpdated,
}) => {
  const [tokenInput, setTokenInput] = useState("");
  const [status, setStatus] = useState<SicStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sic/status", { credentials: "include" });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        active: false,
        expiresAt: null,
        remainingMinutes: 0,
        user: null,
        source: "Erro ao conectar",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      fetchStatus();
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setMessage({ text: "Por favor, cole o cookie ou token do SIC.", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/sic/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tokenOrCookie: tokenInput.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message || "Sessão do SIC salva e validada com sucesso!", type: "success" });
        setTokenInput("");
        await fetchStatus();
        if (onSessionUpdated) onSessionUpdated();
      } else {
        setMessage({ text: data.error || "Falha ao validar o token.", type: "error" });
      }
    } catch {
      setMessage({ text: "Erro de conexão ao salvar sessão do SIC.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/sic/test", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ text: "Conexão com a API do portal SIC validada com sucesso!", type: "success" });
        await fetchStatus();
      } else {
        setMessage({ text: data.error || "Sessão inválida ou expirada.", type: "error" });
      }
    } catch {
      setMessage({ text: "Erro de rede ao testar conexão com o SIC.", type: "error" });
    } finally {
      setTesting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/sic/refresh", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ text: "Sessão renovada com sucesso via API oficial do SIC!", type: "success" });
        await fetchStatus();
        if (onSessionUpdated) onSessionUpdated();
      } else {
        setMessage({ text: data.error || data.message || "Falha ao renovar a sessão do SIC.", type: "error" });
      }
    } catch {
      setMessage({ text: "Erro de conexão ao solicitar renovação de sessão.", type: "error" });
    } finally {
      setRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Key className="h-5 w-5 text-sky-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Conexão Oficial com o Portal SIC</h3>
              <p className="text-xs text-sky-100">Gerenciamento da Sessão Web de Atendimento do SIC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-sky-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Card de Status Atual */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            status?.active ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
          }`}>
            <div className="flex items-center space-x-3">
              {status?.active ? (
                <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              )}
              <div>
                <h4 className="font-semibold text-sm">
                  {status?.active ? "Sessão Web Ativa no SIC" : "Sessão Web Expirada ou Não Configurada"}
                </h4>
                <p className="text-xs opacity-90">
                  {status?.active
                    ? `Expira em ${status.remainingMinutes} min (${new Date(status.expiresAt!).toLocaleTimeString("pt-BR")}) • Usuário: ${status.user || "Operador"}`
                    : "Comprovantes de pagamento e demonstrativos oficiais necessitam do token atualizado."}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading || !status?.active}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#005487] hover:bg-[#0c2856] text-white shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-40"
                title="Renova o token JWT na API oficial do SIC"
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Renovar Agora</span>
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || loading}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm transition-all flex items-center space-x-1"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Testar</span>
              </button>
            </div>
          </div>

          {/* Feedback */}
          {message && (
            <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2 border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}>
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Sincronização em 1 Clique (Zero F12) */}
          <SicBookmarkletSection />

          {/* Formulário para colar novo token manualmente (Fallback) */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Ou cole o Cookie / Token manualmente (Fallback):
              </label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder='Exemplo: coopedu-auth-prod=%7B%22key%22%3A%22coopedu-auth-prod%22... ou o token iniciando com eyJhbGciOi...'
                rows={4}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !tokenInput.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#005487] hover:bg-[#0c2856] disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center space-x-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Validar e Salvar Conexão</span>
              </button>
            </div>
          </form>

          {/* Guia Rápido Passo a Passo */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-2.5">
            <div className="flex items-center space-x-2 font-semibold text-slate-800">
              <Info className="h-4 w-4 text-sky-600" />
              <span>Como obter o cookie de sessão no navegador:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed text-slate-600">
              <li>
                Acesse o portal oficial do SIC:{" "}
                <a
                  href="https://ui.coopedu.app.br"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 font-medium hover:underline inline-flex items-center gap-0.5"
                >
                  ui.coopedu.app.br <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Faça login normalmente com suas credenciais de Atendimento.</li>
              <li>Pressione <kbd className="px-1 py-0.5 bg-slate-200 rounded text-slate-800 font-mono">F12</kbd> (Ferramentas do Desenvolvedor) e abra a aba <strong>Aplicativo (Application)</strong>.</li>
              <li>No menu lateral esquerdo, expanda <strong>Cookies</strong> e clique em <code className="text-sky-700 font-mono">https://ui.coopedu.app.br</code>.</li>
              <li>Clique com o botão direito no cookie <strong>coopedu-auth-prod</strong> e selecione <strong>Copiar</strong>.</li>
              <li>Cole no campo de texto acima e clique em <strong>Validar e Salvar Conexão</strong>.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
