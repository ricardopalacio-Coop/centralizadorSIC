import React from "react";
import { Search, Loader2, User, ChevronRight } from "lucide-react";
import { exibirCpf } from "../lib/lgpd";

export interface Cooperado {
  id: number;
  document: string;
  registration_number?: number;
  name: string;
  contract_name?: string;
  admission_date?: string;
  status: string;
  email?: string;
  whatsapp_number?: string;
}

interface CooperadoSearchProps {
  query: string;
  setQuery: (q: string) => void;
  cooperados: Cooperado[];
  loading: boolean;
  selectedCpf: string | null;
  onSelectCooperado: (c: Cooperado) => void;
}

export const CooperadoSearch: React.FC<CooperadoSearchProps> = ({
  query,
  setQuery,
  cooperados,
  loading,
  selectedCpf,
  onSelectCooperado,
}) => {
  const formatCpfDisplay = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return val;
  };

  return (
    <div className="space-y-6">
      {/* Campo de Pesquisa Único no Dashboard */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Pesquisa de Cooperado (CPF ou Nome Completo)
        </label>
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o CPF (com ou sem pontuação) ou Nome do Cooperado..."
            className="w-full pl-12 pr-12 py-4 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-base focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-400 font-medium shadow-inner"
          />
          {loading && <Loader2 className="absolute right-4 h-5 w-5 text-sky-600 animate-spin" />}
        </div>
      </div>

      {/* Se houver múltiplos resultados (ex: busca por nome), exibe seletores rápidos */}
      {cooperados.length > 1 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
            Cooperados Encontrados na Busca - Clique para Exibir
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {cooperados.map((c) => {
              const isSelected = selectedCpf === c.document;
              return (
                <button
                  key={c.id || c.document}
                  onClick={() => onSelectCooperado(c)}
                  className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-900 shadow-sm"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800"
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${
                      isSelected ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{c.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{exibirCpf(formatCpfDisplay(c.document))}</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${isSelected ? "text-sky-600" : "text-slate-400"}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
