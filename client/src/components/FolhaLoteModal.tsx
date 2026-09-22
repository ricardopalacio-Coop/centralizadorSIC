import React, { useState, useMemo, useEffect } from "react";
import { X, Calendar, CheckSquare, Square, FileDown, Layers, Loader2 } from "lucide-react";

export interface CompetenciaItem {
  ano: number;
  mes: number;
  folha: number;
  tomador?: string;
  valor_liquido?: number | string;
}

interface FolhaLoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  competencias: CompetenciaItem[];
  cooperadoName: string;
  cpf: string;
  onGenerate: (selected: { ano: number; mes: number; folha: number }[]) => void;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const FolhaLoteModal: React.FC<FolhaLoteModalProps> = ({
  isOpen,
  onClose,
  competencias,
  cooperadoName,
  cpf,
  onGenerate,
}) => {
  // Lista de anos disponíveis ordenados decrescente
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(competencias.map((c) => Number(c.ano)))).filter(Boolean);
    years.sort((a, b) => b - a);
    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [competencias]);

  const [selectedYear, setSelectedYear] = useState<number | "TODOS">(availableYears[0] || "TODOS");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Atualiza ano selecionado quando availableYears mudar
  useEffect(() => {
    if (selectedYear !== "TODOS" && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Pré-seleciona meses do ano atual ou de todos os anos ao abrir o modal ou mudar o filtro
  useEffect(() => {
    if (isOpen && competencias.length > 0) {
      if (selectedYear === "TODOS") {
        const initialKeys = new Set(competencias.map((c) => `${c.ano}_${c.mes}_${c.folha}`));
        setSelectedKeys(initialKeys);
      } else {
        const yearComp = competencias.filter((c) => Number(c.ano) === selectedYear);
        const initialKeys = new Set(yearComp.map((c) => `${c.ano}_${c.mes}_${c.folha}`));
        setSelectedKeys(initialKeys);
      }
    }
  }, [isOpen, selectedYear, competencias]);

  if (!isOpen) return null;

  // Competências do ano selecionado ou todas
  const compsOfYear = selectedYear === "TODOS"
    ? [...competencias].sort((a, b) => {
        if (b.ano !== a.ano) return b.ano - a.ano;
        return b.mes - a.mes;
      })
    : competencias
        .filter((c) => Number(c.ano) === selectedYear)
        .sort((a, b) => a.mes - b.mes);

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isAllYearSelected = compsOfYear.length > 0 && compsOfYear.every((c) => selectedKeys.has(`${c.ano}_${c.mes}_${c.folha}`));

  const toggleAllYear = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (isAllYearSelected) {
        compsOfYear.forEach((c) => next.delete(`${c.ano}_${c.mes}_${c.folha}`));
      } else {
        compsOfYear.forEach((c) => next.add(`${c.ano}_${c.mes}_${c.folha}`));
      }
      return next;
    });
  };

  const handleGenerate = () => {
    const selectedList: { ano: number; mes: number; folha: number }[] = [];
    selectedKeys.forEach((key) => {
      const parts = key.split("_").map(Number);
      if (parts.length === 3) {
        selectedList.push({ ano: parts[0], mes: parts[1], folha: parts[2] });
      }
    });

    // Ordenação cronológica
    selectedList.sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.mes - b.mes;
    });

    onGenerate(selectedList);
    onClose();
  };

  const formatMoney = (val?: number | string) => {
    const n = Number(val || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                EXPORTAR DEMONSTRATIVOS EM LOTE (PDF)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {cooperadoName} • CPF: {cpf}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Seletor de Anos */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>Selecione o Ano Base</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                key="todos"
                onClick={() => setSelectedYear("TODOS")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  selectedYear === "TODOS"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Todos os Anos
              </button>
              {availableYears.map((ano) => (
                <button
                  key={ano}
                  onClick={() => setSelectedYear(ano)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    selectedYear === ano
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Ano {ano}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Meses do Ano */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700">
                Competências Disponíveis ({compsOfYear.length})
              </span>
              <button
                onClick={toggleAllYear}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
              >
                {isAllYearSelected ? (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    <span>
                      {selectedYear === "TODOS"
                        ? "Desmarcar Todas as Competências"
                        : `Desmarcar Todos do Ano ${selectedYear}`}
                    </span>
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" />
                    <span>
                      {selectedYear === "TODOS"
                        ? "Selecionar Todas as Competências"
                        : `Selecionar Todos do Ano ${selectedYear}`}
                    </span>
                  </>
                )}
              </button>
            </div>

            {compsOfYear.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                {selectedYear === "TODOS"
                  ? "Nenhuma folha de pagamento registrada para o cooperado."
                  : `Nenhuma folha de pagamento registrada para o ano ${selectedYear}.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {compsOfYear.map((c) => {
                  const key = `${c.ano}_${c.mes}_${c.folha}`;
                  const isChecked = selectedKeys.has(key);
                  const monthName = MONTH_NAMES[c.mes - 1] || `Mês ${c.mes}`;

                  return (
                    <div
                      key={key}
                      onClick={() => toggleKey(key)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? "bg-indigo-50/70 border-indigo-300 shadow-sm"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          className="h-4 w-4 text-indigo-600 rounded border-slate-300 pointer-events-none"
                        />
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">
                            {String(c.mes).padStart(2, "0")}/{c.ano} - {monthName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[170px]">
                            {c.tomador || "Coopedu Sede"}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 font-mono">
                        {formatMoney(c.valor_liquido)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-5 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-600">
            Total Selecionado:{" "}
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-black">
              {selectedKeys.size} {selectedKeys.size === 1 ? "demonstrativo" : "demonstrativos"}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleGenerate}
              disabled={selectedKeys.size === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <FileDown className="h-4 w-4" />
              <span>Gerar PDF em Lote ({selectedKeys.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
