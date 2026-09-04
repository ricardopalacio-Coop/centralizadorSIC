import React, { useState, useEffect } from "react";
import { X, Pencil, User, Fingerprint, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface EditFichaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedItem: any) => void;
  item: {
    id: string;
    name: string;
    cooperadoName: string;
    cpf?: string | null;
    tipo: string;
    folderName?: string;
  } | null;
  endpointUrl: string;
  title?: string;
}

export const EditFichaModal: React.FC<EditFichaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  item,
  endpointUrl,
  title = "Editar Dados do Cooperado",
}) => {
  const [cooperadoName, setCooperadoName] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formatCpfInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  useEffect(() => {
    if (item) {
      setCooperadoName(item.cooperadoName || "");
      setCpf(item.cpf ? formatCpfInput(item.cpf) : "");
      setError("");
      setSuccess("");
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpfInput(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf && cleanCpf.length !== 11) {
      setError("Por favor, digite um CPF válido com 11 dígitos ou deixe em branco.");
      return;
    }

    if (!cooperadoName.trim()) {
      setError("O Nome do Cooperado não pode ficar vazio.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(endpointUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cooperadoName: cooperadoName.trim().toUpperCase(),
          cpf: cleanCpf || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar alterações.");
      }

      setSuccess("Dados atualizados com sucesso!");
      if (data.item) {
        onSuccess(data.item);
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || "Falha ao atualizar dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="flex items-center space-x-3.5 mb-5 pb-4 border-b border-slate-100">
          <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
            <Pencil className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Edição manual de Nome Completo e CPF
            </p>
          </div>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome do Arquivo (Apenas Leitura) */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Arquivo Original
            </label>
            <div className="flex items-center space-x-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono">
              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate">{item.name}</span>
            </div>
          </div>

          {/* Nome do Cooperado */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Nome do Cooperado <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={cooperadoName}
                onChange={(e) => setCooperadoName(e.target.value)}
                placeholder="NOME COMPLETO DO COOPERADO"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400 placeholder:normal-case"
              />
            </div>
          </div>

          {/* CPF do Cooperado */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              CPF do Cooperado
            </label>
            <div className="relative">
              <Fingerprint className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={cpf}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Digite os 11 dígitos do CPF (a formatação é aplicada automaticamente).
            </p>
          </div>

          {/* Ações do Rodapé */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center space-x-2 shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
