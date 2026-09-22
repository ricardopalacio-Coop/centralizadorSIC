import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Calendar,
  Banknote,
  TrendingDown,
  Wallet,
  Clock,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from "lucide-react";

interface ResumoFinanceiroModalProps {
  cpf: string;
  initialPayrollId: string;
  payrollsList: any[];
  onClose: () => void;
}

export const ResumoFinanceiroModal: React.FC<ResumoFinanceiroModalProps> = ({
  cpf,
  initialPayrollId,
  payrollsList,
  onClose,
}) => {
  const [selectedPayrollId, setSelectedPayrollId] = useState<string>(initialPayrollId);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<any>(null);

  const fetchSummary = async (payrollId: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/cooperados/${cpf}/payrolls/${payrollId}/resumo-financeiro`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Falha ao carregar o resumo financeiro.");
      }

      const summaryData = await res.json();
      setData(summaryData);
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o servidor para obter o resumo financeiro.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPayrollId) {
      fetchSummary(selectedPayrollId);
    }
  }, [selectedPayrollId]);

  const handleCompetenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPayrollId(e.target.value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* CABEÇALHO DO MODAL */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800 flex items-center space-x-2">
            <span>Detalhes do pagamento</span>
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CORPO DO MODAL (SCROLLÁVEL) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* BARRA SUPERIOR: COMPETÊNCIA, STATUS E DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 items-center">
            {/* SELETOR DE COMPETÊNCIA */}
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                COMPETÊNCIA
              </span>
              <select
                value={selectedPayrollId}
                onChange={handleCompetenceChange}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-extrabold text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {payrollsList.map((p) => {
                  const compLabel = p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`;
                  return (
                    <option key={p.payrollId} value={p.payrollId}>
                      {compLabel} ({p.payrollTypeLabel || p.payrollType || "Regular"})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* STATUS DO PAGAMENTO */}
            <div className="space-y-1 sm:text-center">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                STATUS DO PAGAMENTO
              </span>
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200 inline-block">
                  {data?.paymentStatus || "Pago"}
                </span>
              </div>
            </div>

            {/* DATA DO PAGAMENTO */}
            <div className="space-y-1 sm:text-right">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                DATA DO PAGAMENTO
              </span>
              <p className="text-xs font-mono font-extrabold text-slate-800">
                {data?.paymentDate || "30/07/2026 09:26:02"}
              </p>
            </div>
          </div>

          {/* SPINNER OU ERRO */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
              <p className="text-xs font-bold text-slate-500">Carregando resumo financeiro do SIC...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center text-xs font-bold">
              {error}
            </div>
          ) : (
            data && (
              <>
                {/* 4 CARDS PRINCIPAIS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. VALOR BRUTO */}
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center space-x-3 shadow-sm">
                    <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Valor bruto</span>
                      <p className="text-lg font-black text-emerald-700">{data.valorBruto}</p>
                    </div>
                  </div>

                  {/* 2. DESCONTOS */}
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex items-center space-x-3 shadow-sm">
                    <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
                      <TrendingDown className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Descontos</span>
                      <p className="text-lg font-black text-rose-700">{data.descontos}</p>
                    </div>
                  </div>

                  {/* 3. VALOR LÍQUIDO */}
                  <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 flex items-center space-x-3 shadow-sm">
                    <div className="p-3 rounded-xl bg-sky-100 text-sky-600">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Valor líquido</span>
                      <p className="text-lg font-black text-sky-700">{data.valorLiquido}</p>
                    </div>
                  </div>

                  {/* 4. HORAS TRABALHADAS */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center space-x-3 shadow-sm">
                    <div className="p-3 rounded-xl bg-slate-200 text-slate-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Horas trabalhadas</span>
                      <p className="text-lg font-black text-slate-800">{data.horasTrabalhadas}</p>
                    </div>
                  </div>
                </div>

                {/* CARD SEÇÃO: RESUMO DA FOLHA */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Resumo da folha</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">CLIENTE</span>
                      <strong className="text-slate-800 font-bold uppercase">{data.cliente}</strong>
                    </div>

                    <div>
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">CONTRATO</span>
                      <strong className="text-slate-800 font-bold uppercase">{data.contrato}</strong>
                    </div>

                    <div>
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">PROFISSÃO</span>
                      <strong className="text-slate-800 font-bold uppercase">{data.profissao}</strong>
                    </div>

                    <div>
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">TIPO DE FOLHA</span>
                      <span className="px-2.5 py-0.5 rounded bg-sky-900 text-white font-extrabold text-[11px] inline-block">
                        {data.tipoFolha}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD SEÇÃO: COMPOSIÇÃO DO PAGAMENTO */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Composição do pagamento</h3>
                  </div>

                  <div className="space-y-2.5">
                    {/* CRÉDITOS */}
                    {data.creditos?.map((item: any, idx: number) => (
                      <div
                        key={`cred-${idx}`}
                        className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600">
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{item.descricao}</span>
                            {item.codigo && (
                              <span className="text-[10px] text-slate-400 font-semibold block">Cód: {item.codigo}</span>
                            )}
                          </div>
                        </div>

                        <span className="text-xs font-black text-emerald-600">{item.valor}</span>
                      </div>
                    ))}

                    {/* DÉBITOS / DESCONTOS */}
                    {data.descontosItens?.map((item: any, idx: number) => (
                      <div
                        key={`deb-${idx}`}
                        className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-1.5 rounded-full bg-rose-100 text-rose-600">
                            <ArrowDownRight className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-800">{item.descricao}</span>
                              {item.parcelInfo && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                                  4 pagas
                                </span>
                              )}
                            </div>
                            {item.codigo && (
                              <span className="text-[10px] text-slate-400 font-semibold block">Cód: {item.codigo}</span>
                            )}
                          </div>
                        </div>

                        <span className="text-xs font-black text-rose-600">{item.valor}</span>
                      </div>
                    ))}

                    {/* BANNER FINAL: RESULTADO FINAL / VALOR LÍQUIDO */}
                    <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between mt-4">
                      <div>
                        <span className="text-[11px] font-bold text-sky-700 block">Resultado final</span>
                        <strong className="text-xs font-extrabold text-sky-900">Valor líquido</strong>
                      </div>

                      <span className="text-xl font-black text-sky-700">{data.resultadoFinal}</span>
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
