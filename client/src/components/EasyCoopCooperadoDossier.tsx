import React, { useState, useEffect } from 'react';
import {
  Users,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  ShieldAlert,
  Clock,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Landmark,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  BarChart3,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Award,
  X,
  FileDown,
  Info,
  Printer,
  CheckSquare,
  Square,
  FileCheck2,
} from 'lucide-react';
import { PdfViewerModal } from './PdfViewerModal';
import { FolhaLoteModal } from './FolhaLoteModal';

export function toUpperNoAccents(str: any): string {
  if (str === null || str === undefined) return '';
  let s = String(str);
  try {
    if (/[\u00c0-\u00ff]/.test(s)) {
      const dec = decodeURIComponent(escape(s));
      if (dec.length < s.length) s = dec;
    }
  } catch {}
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export interface EasyCoopCooperadoDossierProps {
  selectedCpf: string;
  hideTopHeader?: boolean;
}

const CONTRACT_COLORS = [
  { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300', active: 'bg-sky-600 text-white border-sky-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', active: 'bg-emerald-600 text-white border-emerald-600' },
  { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-300', active: 'bg-indigo-600 text-white border-indigo-600' },
  { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', active: 'bg-amber-600 text-white border-amber-600' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300', active: 'bg-purple-600 text-white border-purple-600' },
  { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300', active: 'bg-rose-600 text-white border-rose-600' },
  { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300', active: 'bg-teal-600 text-white border-teal-600' },
  { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-300', active: 'bg-cyan-600 text-white border-cyan-600' },
];

export const EasyCoopCooperadoDossier: React.FC<EasyCoopCooperadoDossierProps> = ({
  selectedCpf,
  hideTopHeader = false,
}) => {
  const [coopFullData, setCoopFullData] = useState<any>(null);
  const [coopFullLoading, setCoopFullLoading] = useState(false);
  const [activeCoopTab, setActiveCoopTab] = useState<
    'cadastral' | 'financeiro' | 'folha' | 'esocial' | 'alocacoes' | 'dependentes' | 'documentos'
  >('cadastral');

  // Filtros Financeiros do Cooperado
  const [selectedAno, setSelectedAno] = useState<number>(0);
  const [selectedMes, setSelectedMes] = useState<number>(0);
  const [selectedContratoFiltro, setSelectedContratoFiltro] = useState<string>('TODOS');
  const [financialData, setFinancialData] = useState<any>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [expandedLancamentoId, setExpandedLancamentoId] = useState<number | null>(null);
  const [lancamentoItens, setLancamentoItens] = useState<{ [key: string]: any[] }>({});
  const [loadingItens, setLoadingItens] = useState<{ [key: string]: boolean }>({});
  const [showProductivityChart, setShowProductivityChart] = useState<boolean>(false);
  const [selectedLancamentoIds, setSelectedLancamentoIds] = useState<number[]>([]);

  // Estado da Aba Folha de Pagamento
  const [folhaData, setFolhaData] = useState<any>(null);
  const [folhaLoading, setFolhaLoading] = useState(false);
  const [selectedFolhaComp, setSelectedFolhaComp] = useState<{ ano: number; mes: number; folha: number } | null>(null);
  const [isFolhaLoteModalOpen, setIsFolhaLoteModalOpen] = useState(false);

  // Estado da Aba eSocial
  const [esocialData, setEsocialData] = useState<any>(null);
  const [esocialLoading, setEsocialLoading] = useState(false);
  const [esocialAno, setEsocialAno] = useState<number>(0);
  const [esocialMes, setEsocialMes] = useState<number>(0);
  const [esocialEvento, setEsocialEvento] = useState<string>('TODOS');
  const [expandedEsocialId, setExpandedEsocialId] = useState<number | null>(null);
  const [selectedEsocialIds, setSelectedEsocialIds] = useState<number[]>([]);

  // Modal Único de Visualização e Download de PDF Vetorial
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    subtitle?: string;
    filename?: string;
  }>({
    isOpen: false,
    url: '',
    title: '',
  });

  // Carregar dados completos do cooperado selecionado
  useEffect(() => {
    setCoopFullData(null);
    setFinancialData(null);
    setFolhaData(null);
    setEsocialData(null);
    setExpandedLancamentoId(null);
    setLancamentoItens({});
    setSelectedLancamentoIds([]);
    setSelectedEsocialIds([]);
    setSelectedContratoFiltro('TODOS');
    setSelectedAno(0);
    setSelectedMes(0);

    if (!selectedCpf) {
      return;
    }

    const fetchFull = async () => {
      setCoopFullLoading(true);
      try {
        const res = await fetch(`/api/easycoop/cooperados/${selectedCpf}/full`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setCoopFullData(data);
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes do cooperado:', err);
      } finally {
        setCoopFullLoading(false);
      }
    };

    fetchFull();
  }, [selectedCpf]);

  // Carregar dados financeiros ao selecionar cooperado ou alterar período/contrato
  useEffect(() => {
    if (!selectedCpf) return;

    const fetchFinancial = async () => {
      setFinancialLoading(true);
      try {
        let url = `/api/easycoop/cooperados/${selectedCpf}/financeiro`;
        const params: string[] = [];
        if (selectedAno > 0) params.push(`ano=${selectedAno}`);
        if (selectedMes > 0) params.push(`mes=${selectedMes}`);
        if (selectedContratoFiltro !== 'TODOS') params.push(`tomador=${encodeURIComponent(selectedContratoFiltro)}`);
        if (params.length > 0) url += `?${params.join('&')}`;

        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setFinancialData(data);
          if (data.fechamentos && Array.isArray(data.fechamentos)) {
            setSelectedLancamentoIds(data.fechamentos.map((f: any) => f.id));
          }
        }
      } catch (err) {
        console.error('Erro ao consultar financeiro:', err);
      } finally {
        setFinancialLoading(false);
      }
    };

    fetchFinancial();
  }, [selectedCpf, selectedAno, selectedMes, selectedContratoFiltro]);

  // Carregar Folha de Pagamento
  useEffect(() => {
    if (!selectedCpf || activeCoopTab !== 'folha') return;

    const fetchFolha = async () => {
      setFolhaLoading(true);
      try {
        let url = `/api/easycoop/cooperados/${selectedCpf}/folha`;
        if (selectedFolhaComp) {
          url += `?ano=${selectedFolhaComp.ano}&mes=${selectedFolhaComp.mes}&folha=${selectedFolhaComp.folha}`;
        }
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setFolhaData(data);
        }
      } catch (err) {
        console.error('Erro ao consultar folha:', err);
      } finally {
        setFolhaLoading(false);
      }
    };

    fetchFolha();
  }, [selectedCpf, activeCoopTab, selectedFolhaComp]);

  // Carregar dados do eSocial
  useEffect(() => {
    if (!selectedCpf || activeCoopTab !== 'esocial') return;

    const fetchEsocial = async () => {
      setEsocialLoading(true);
      try {
        let url = `/api/easycoop/cooperados/${selectedCpf}/esocial`;
        const params: string[] = [];
        if (esocialAno > 0) params.push(`ano=${esocialAno}`);
        if (esocialMes > 0) params.push(`mes=${esocialMes}`);
        if (esocialEvento !== 'TODOS') params.push(`evento=${encodeURIComponent(esocialEvento)}`);
        if (params.length > 0) url += `?${params.join('&')}`;

        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setEsocialData(data);
          if (data.eventos && Array.isArray(data.eventos)) {
            setSelectedEsocialIds(data.eventos.map((ev: any) => ev.id));
          }
        }
      } catch (err) {
        console.error('Erro ao consultar eSocial:', err);
      } finally {
        setEsocialLoading(false);
      }
    };

    fetchEsocial();
  }, [selectedCpf, activeCoopTab, esocialAno, esocialMes, esocialEvento]);

  // Carregar itens detalhados de um lançamento
  const toggleLancamentoItens = async (f: any) => {
    const key = `${f.ano}_${f.mes}_${f.folha}`;
    if (expandedLancamentoId === f.id) {
      setExpandedLancamentoId(null);
      return;
    }
    setExpandedLancamentoId(f.id);

    if (lancamentoItens[key]) return;

    setLoadingItens((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/easycoop/cooperados/${selectedCpf}/folha?ano=${f.ano}&mes=${f.mes}&folha=${f.folha}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (res.ok && data.folha) {
        const itens = [
          ...(data.folha.proventos || []).map((p: any) => ({ ...p, tipo: 'C' })),
          ...(data.folha.descontos || []).map((d: any) => ({ ...d, tipo: 'D' })),
        ];
        setLancamentoItens((prev) => ({ ...prev, [key]: itens }));
      }
    } catch (err) {
      console.error('Erro ao carregar itens do lançamento:', err);
    } finally {
      setLoadingItens((prev) => ({ ...prev, [key]: false }));
    }
  };

  const formatCpf = (val: string) => {
    if (!val) return '-';
    const d = val.replace(/\D/g, '');
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return val;
  };

  const formatMoney = (val?: number | string) => {
    const n = Number(val || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (val?: string) => {
    if (!val) return '-';
    try {
      const parts = val.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return val;
    } catch {
      return val;
    }
  };

  const getGenderLabel = (val?: string) => {
    if (!val) return 'Não informado';
    const v = String(val).trim().toUpperCase();
    if (v === 'M' || v === 'MASCULINO' || v === '1') return 'Masculino';
    if (v === 'F' || v === 'FEMININO' || v === '2') return 'Feminino';
    return val;
  };

  const getFormattedBank = (bankCode?: string, bankName?: string) => {
    const code = String(bankCode || '').trim();
    const name = String(bankName || '').trim();
    if (
      code === '770' ||
      code === '450' ||
      name.includes('770') ||
      name.toUpperCase().includes('FITBANK') ||
      name.toUpperCase().includes('OWL') ||
      !name
    ) {
      return {
        code: '450',
        name: 'BANCO OWL',
      };
    }
    return {
      code: code || '-',
      name: name.replace(/\s*\(\d+\)\s*$/, '').trim() || 'Banco não cadastrado',
    };
  };

  const formatCompactMoney = (val?: number | string) => {
    const n = Number(val || 0);
    if (n >= 1000) {
      return `R$ ${(n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
    }
    return `R$ ${n.toFixed(0)}`;
  };

  const isDescansoOuSobras = (desc?: string) => {
    if (!desc) return false;
    const d = desc.toUpperCase();
    return d.includes('DESCANSO') || d.includes('DAR') || d.includes('SOBRA');
  };

  const maxBarValue = Math.max(
    ...(financialData?.fechamentos?.map((f: any) => Number(f.valor_bruto || 0)) || [1000]),
    1000
  );

  const handleToggleLancamento = (id: number) => {
    setSelectedLancamentoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllLancamentos = () => {
    if (!financialData?.fechamentos) return;
    if (selectedLancamentoIds.length === financialData.fechamentos.length) {
      setSelectedLancamentoIds([]);
    } else {
      setSelectedLancamentoIds(financialData.fechamentos.map((f: any) => f.id));
    }
  };

  const handleToggleEsocial = (id: number) => {
    setSelectedEsocialIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllEsocial = () => {
    if (!esocialData?.eventos) return;
    if (selectedEsocialIds.length === esocialData.eventos.length) {
      setSelectedEsocialIds([]);
    } else {
      setSelectedEsocialIds(esocialData.eventos.map((ev: any) => ev.id));
    }
  };

  if (coopFullLoading) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
        <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Carregando dossiê EasyCoop...</p>
      </div>
    );
  }

  if (!coopFullData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Cartão de Identificação Superior com Botão FICHA COOPERADO (PDF) */}
      {!hideTopHeader && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 font-black text-2xl shadow-inner">
                {coopFullData.name ? coopFullData.name.charAt(0) : 'C'}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    {coopFullData.name}
                  </h2>
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                      coopFullData.status === 'Ativo'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {coopFullData.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1.5">
                  <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    CPF: {formatCpf(coopFullData.document)}
                  </span>
                  {coopFullData.registration_number && (
                    <span>Matrícula: #{coopFullData.registration_number}</span>
                  )}
                  {coopFullData.position && <span>• Atividade: {coopFullData.position}</span>}
                  {coopFullData.city && (
                    <span>
                      • {coopFullData.city}/{coopFullData.state}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botão Ficha Cooperado (PDF) e Tomador */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 self-stretch md:self-auto border-t md:border-t-0 md:border-l border-slate-700/80 pt-4 md:pt-0 md:pl-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Tomador / Prefeitura
                </span>
                <span className="text-sm font-bold text-sky-300">
                  {coopFullData.contrato_atual?.tomador_nome || coopFullData.contract_name || 'Coopedu Sede'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Admissão: {formatDate(coopFullData.admission_date)}
                </span>
              </div>

              <button
                onClick={() =>
                  setPdfModal({
                    isOpen: true,
                    url: `/api/easycoop/cooperados/${selectedCpf}/pdf/ficha`,
                    title: 'Ficha Cadastral e Financeira do Cooperado',
                    subtitle: coopFullData.name,
                    filename: `ficha-${selectedCpf}.pdf`,
                  })
                }
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30 hover:from-sky-600 hover:to-indigo-700 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Ficha Cooperado (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Abas do Cooperado */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-1.5 uppercase font-bold text-xs">
        <button
          onClick={() => setActiveCoopTab('cadastral')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'cadastral'
              ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="h-4 w-4 text-sky-600" />
          <span>FICHA CADASTRAL</span>
        </button>

        <button
          onClick={() => setActiveCoopTab('financeiro')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'financeiro'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <span>FINANCEIRO / REPASSES</span>
        </button>

        <button
          onClick={() => setActiveCoopTab('folha')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'folha'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Receipt className="h-4 w-4 text-indigo-600" />
          <span>FOLHA DE PAGAMENTO</span>
        </button>

        <button
          onClick={() => setActiveCoopTab('esocial')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'esocial'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <span>E-SOCIAL ({esocialData?.metricas?.totalTransmissoes || '...'})</span>
        </button>

        <button
          onClick={() => setActiveCoopTab('alocacoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'alocacoes'
              ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="h-4 w-4 text-amber-600" />
          <span>ALOCACOES ({coopFullData.alocacoes?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveCoopTab('dependentes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'dependentes'
              ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="h-4 w-4 text-purple-600" />
          <span>DEPENDENTES ({coopFullData.dependentes?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveCoopTab('documentos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeCoopTab === 'documentos'
              ? 'bg-slate-900 text-white border border-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="h-4 w-4 text-sky-400" />
          <span>TERMOS ASSINADOS</span>
        </button>
      </div>

      {/* ABA 1: FICHA CADASTRAL */}
      {activeCoopTab === 'cadastral' && (
        <div className="space-y-6 animate-in fade-in">
          {coopFullData.contrato_atual && (
            <div className="bg-gradient-to-r from-sky-50 via-indigo-50/50 to-white p-6 rounded-3xl border border-sky-200 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 rounded-2xl bg-sky-600 text-white shadow-md">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-sky-700 block">
                      CONTRATO E TOMADOR ATUAL
                    </span>
                    <h3 className="text-lg font-black text-slate-900 uppercase">
                      {toUpperNoAccents(coopFullData.contrato_atual.tomador_nome || coopFullData.contract_name || 'COOPEDU')}
                    </h3>
                    <span className="text-xs text-slate-500 font-bold uppercase">
                      {toUpperNoAccents(coopFullData.contrato_atual.contrato_descricao || 'CONTRATO OPERACIONAL')} • DOC Nº{' '}
                      {coopFullData.contrato_atual.contrato_numero || coopFullData.contrato_atual.contrato_id}
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                  STATUS: {toUpperNoAccents(coopFullData.contrato_atual.status_alocacao || 'ATIVO')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-sky-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-bold uppercase">ATIVIDADE NO CONTRATO</span>
                  <span className="font-extrabold text-slate-800 uppercase">
                    {isDescansoOuSobras(coopFullData.contrato_atual.contrato_descricao)
                      ? 'NAO SE APLICA'
                      : toUpperNoAccents(coopFullData.cargo_contrato || coopFullData.position || '-')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase">CARGA HORARIA</span>
                  <span className="font-extrabold text-slate-800 uppercase">
                    {toUpperNoAccents(coopFullData.contrato_atual.horas || '40H SEMANAIS')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase">VIGENCIA DA ALOCACAO</span>
                  <span className="font-extrabold text-slate-800 uppercase">
                    {formatDate(coopFullData.contrato_atual.data_inicio)} ATE{' '}
                    {formatDate(coopFullData.contrato_atual.data_fim)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                <Award className="h-4 w-4 text-amber-600" />
                <span className="uppercase">VINCULO COOPERATIVO & CAPITAL SOCIAL</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">DATA DE ADMISSAO</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatDate(coopFullData.admission_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">DATA DE DESLIGAMENTO</span>
                  <span className="font-extrabold text-slate-900 text-sm uppercase">
                    {coopFullData.termination_date ? formatDate(coopFullData.termination_date) : 'VINCULO ATIVO'}
                  </span>
                </div>
                <div className="col-span-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase block text-[11px]">
                    TEMPO TOTAL NA COOPERATIVA
                  </span>
                  <span className="font-black text-sky-700 text-sm block mt-0.5 uppercase">
                    {toUpperNoAccents(coopFullData.tempo_cooperativa_formatado)}
                  </span>
                </div>
                <div className="col-span-2 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80">
                  <span className="text-amber-800 font-black block text-[11px] uppercase">
                    QUOTAS-PARTE DO CAPITAL SOCIAL
                  </span>
                  <span className="font-black text-slate-900 text-sm block mt-0.5 uppercase">
                    {toUpperNoAccents(coopFullData.quotas_info?.texto || '0 DE 10 QUOTAS (R$ 0,00)')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block mt-0.5">
                    STATUS: {coopFullData.quotas_info?.concluida ? 'CAPITAL TOTALMENTE INTEGRALIZADO' : 'EM INTEGRALIZACAO'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 flex flex-col gap-1">
                  <span className="text-slate-400 font-bold text-[11px] uppercase block">
                    ATIVIDADE OFICIAL (CONTRATO VIGENTE):
                  </span>
                  <span className="font-black text-slate-900 text-sm block uppercase">
                    {toUpperNoAccents(coopFullData.position || coopFullData.cargo_contrato || 'COOPERADO')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                <UserCheck className="h-4 w-4 text-sky-600" />
                <span className="uppercase">IDENTIFICACAO CIVIL & PESSOAL</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="col-span-2 bg-sky-50/70 p-3 rounded-2xl border border-sky-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-sky-800 font-black block text-[10px] uppercase">
                      CPF DO COOPERADO
                    </span>
                    <span className="font-mono font-black text-slate-900 text-base">
                      {formatCpf(coopFullData.document)}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-200/80 text-sky-900 uppercase">
                    DOCUMENTO OFICIAL
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">DATA DE NASCIMENTO</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(coopFullData.birth_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">SEXO</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {coopFullData.gender === 'F' ? 'FEMININO' : 'MASCULINO'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">RG / EXPEDICAO</span>
                  <span className="font-bold text-slate-800">
                    {coopFullData.rg_number || '-'} {coopFullData.rg_issuer ? `(${toUpperNoAccents(coopFullData.rg_issuer)})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">CTPS / SERIE</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {coopFullData.ctps_number || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">PIS / PASEP / NIT</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {coopFullData.pis_number || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">NATURALIDADE</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {coopFullData.birth_city ? `${toUpperNoAccents(coopFullData.birth_city)}/${toUpperNoAccents(coopFullData.birth_state)}` : '-'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-bold uppercase block">FILIACAO</span>
                  <span className="font-bold text-slate-800 block uppercase">
                    MAE: {toUpperNoAccents(coopFullData.mother_name) || '-'}
                  </span>
                  <span className="font-bold text-slate-800 block mt-0.5 uppercase">
                    PAI: {toUpperNoAccents(coopFullData.father_name) || '-'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 font-bold uppercase block text-[10px]">CATEGORIA E-SOCIAL (TABELA 01)</span>
                    <span className="font-extrabold text-blue-700 block text-xs mt-0.5 uppercase">
                      {coopFullData.categoria_esocial?.completo || '731 - CONTRIBUINTE INDIVIDUAL - COOPERADO QUE PRESTA SERVICOS POR INTERMEDIO DE COOPERATIVA DE TRABALHO'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 uppercase shrink-0">
                    CÓD 731
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                <Landmark className="h-4 w-4 text-emerald-600" />
                <span className="uppercase">DADOS BANCARIOS PARA REPASSE</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="col-span-2">
                  <span className="text-slate-400 font-bold uppercase block">INSTITUICAO FINANCEIRA</span>
                  <span className="font-extrabold text-emerald-700 text-sm uppercase">
                    {toUpperNoAccents(getFormattedBank(coopFullData.bank_code, coopFullData.bank_name).name)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold uppercase block">
                    CODIGO FEBRABAN: {getFormattedBank(coopFullData.bank_code, coopFullData.bank_name).code}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">AGENCIA BANCARIA</span>
                  <span className="font-bold text-slate-800">{coopFullData.agency || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">CONTA CORRENTE</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {coopFullData.account_number}
                    {coopFullData.account_digit ? `-${coopFullData.account_digit}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">TIPO DE CONTA</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {toUpperNoAccents(coopFullData.account_type || 'CONTA-CORRENTE')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">CHAVE PIX</span>
                  <span className="font-bold text-slate-800 font-mono block break-all text-[11px] leading-tight select-all">
                    {coopFullData.pix_key || 'NAO CADASTRADA'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                <Phone className="h-4 w-4 text-sky-600" />
                <span className="uppercase">CONTATOS & ENDERECO</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">WHATSAPP / CELULAR</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {coopFullData.whatsapp_number || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">TELEFONE DE CONTATO</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {coopFullData.secondary_phone || coopFullData.whatsapp_number || '-'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-bold uppercase block">E-MAIL</span>
                  <span className="font-bold text-slate-800 break-all uppercase">
                    {toUpperNoAccents(coopFullData.email || '-')}
                  </span>
                </div>
                <div className="col-span-2 space-y-1 pt-1 border-t border-slate-100">
                  <span className="text-slate-400 font-bold uppercase block">ENDERECO RESIDENCIAL COMPLETO</span>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-slate-800 space-y-1 uppercase font-bold">
                    <p>
                      {toUpperNoAccents(coopFullData.street || '-')}, Nº {toUpperNoAccents(coopFullData.number || 'S/N')}
                    </p>
                    <p className="text-slate-600 font-medium text-[11px]">
                      BAIRRO: {toUpperNoAccents(coopFullData.neighborhood || '-')} • CIDADE: {toUpperNoAccents(coopFullData.city || '-')}/{toUpperNoAccents(coopFullData.state || '-')}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      CEP: {coopFullData.zip_code || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: FINANCEIRO / REPASSES */}
      {activeCoopTab === 'financeiro' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            {(() => {
              const availableContracts = (financialData?.contratos && financialData.contratos.length > 0)
                ? financialData.contratos
                : (financialData?.tomadores || []);

              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-sky-600" />
                      <span>FILTRAR POR CONTRATO / TOMADOR</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold uppercase">
                      {availableContracts.length} CONTRATOS REGISTRADOS
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => setSelectedContratoFiltro('TODOS')}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                        selectedContratoFiltro === 'TODOS'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      TODOS OS CONTRATOS
                    </button>

                    {availableContracts.map((tom: string, idx: number) => {
                      const isSelected = selectedContratoFiltro === tom;
                      const colorScheme = CONTRACT_COLORS[idx % CONTRACT_COLORS.length];

                      return (
                        <button
                          key={tom}
                          onClick={() => setSelectedContratoFiltro(tom)}
                          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                            isSelected
                              ? colorScheme.active + ' shadow-md'
                              : `${colorScheme.bg} ${colorScheme.text} ${colorScheme.border} hover:opacity-80`
                          }`}
                        >
                          {tom}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-emerald-600" />
              <select
                value={selectedAno}
                onChange={(e) => setSelectedAno(parseInt(e.target.value, 10))}
                className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value={0}>TODOS OS ANOS</option>
                {financialData?.anos?.map((ano: number) => (
                  <option key={ano} value={ano}>
                    ANO {ano}
                  </option>
                ))}
              </select>

              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(parseInt(e.target.value, 10))}
                className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value={0}>TODOS OS MESES</option>
                {[
                  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
                  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
                ].map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowProductivityChart((prev) => !prev)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
                showProductivityChart
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>{showProductivityChart ? 'OCULTAR GRAFICO' : 'GERAR GRAFICO DE PRODUTIVIDADE'}</span>
            </button>
          </div>

          {showProductivityChart && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-top-3 duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <span>HISTORICO DE PRODUTIVIDADE</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 uppercase">
                    PRODUCAO MENSAL DO COOPERADO ({selectedContratoFiltro === 'TODOS' ? 'TODOS OS CONTRATOS' : selectedContratoFiltro})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 uppercase">
                    MEDIA MENSAL: {formatMoney(financialData?.totais?.totalBruto / (financialData?.fechamentos?.length || 1))}
                  </span>

                  <button
                    onClick={() => {
                      const params: string[] = [];
                      if (selectedAno > 0) params.push(`ano=${selectedAno}`);
                      if (selectedMes > 0) params.push(`mes=${selectedMes}`);
                      if (selectedContratoFiltro !== 'TODOS') params.push(`contrato=${encodeURIComponent(selectedContratoFiltro)}`);
                      const queryString = params.length > 0 ? `?${params.join('&')}` : '';

                      setPdfModal({
                        isOpen: true,
                        url: `/api/easycoop/cooperados/${selectedCpf}/pdf/grafico${queryString}`,
                        title: 'Gráfico de Produtividade Mensal',
                        subtitle: `${coopFullData.name} • ${selectedContratoFiltro === 'TODOS' ? 'Todos os Contratos' : selectedContratoFiltro}`,
                        filename: `grafico-produtividade-${selectedCpf}.pdf`,
                      });
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>GERAR PDF DO GRAFICO</span>
                  </button>
                </div>
              </div>

              {financialData?.fechamentos?.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs uppercase font-bold">
                  SEM LANCAMENTOS NO PERIODO SELECIONADO PARA DESENHAR O GRAFICO.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end gap-3 h-64 overflow-x-auto pb-4 pt-10 px-2 border-b border-slate-100">
                    {financialData?.fechamentos
                      ?.slice(0, 18)
                      .reverse()
                      .map((f: any) => {
                        const valor = Number(f.valor_bruto || 0);
                        const heightPercent = Math.max(12, Math.min(100, Math.round((valor / maxBarValue) * 100)));

                        return (
                          <div
                            key={f.id}
                            className="flex-1 min-w-[55px] max-w-[75px] flex flex-col items-center gap-1.5 group relative"
                          >
                            <span className="text-[9px] font-mono font-black text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/70 shadow-2xs whitespace-nowrap">
                              {formatCompactMoney(valor)}
                            </span>

                            <div className="text-[10px] font-mono font-bold text-slate-100 bg-slate-900 px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-8 z-10 pointer-events-none">
                              {formatMoney(valor)}
                            </div>

                            <div className="w-full bg-slate-100 rounded-xl h-44 flex items-end p-1">
                              <div
                                style={{ height: `${heightPercent}%` }}
                                className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-lg transition-all duration-300 shadow-sm hover:brightness-110"
                              />
                            </div>

                            <span className="text-[10px] font-mono font-bold text-slate-600">
                              {String(f.mes).padStart(2, '0')}/{String(f.ano).slice(2)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  <span className="text-[11px] text-slate-400 block text-right uppercase">
                    * VALORES BRUTOS CALCULADOS MES A MES COM BASE NOS FECHAMENTOS DA BASE ERP
                  </span>
                </div>
              )}
            </div>
          )}

          {financialData?.totais && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">PRODUCAO BRUTA</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">
                  {formatMoney(financialData.totais.totalBruto)}
                </span>
              </div>

              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  LIQUIDO REPASSADO
                </span>
                <span className="text-lg font-black text-emerald-700 mt-1 block">
                  {formatMoney(financialData.totais.totalLiquido)}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">RETENCAO INSS</span>
                <span className="text-lg font-black text-rose-600 mt-1 block">
                  {formatMoney(financialData.totais.totalInss)}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">RETENCAO IRRF</span>
                <span className="text-lg font-black text-amber-600 mt-1 block">
                  {formatMoney(financialData.totais.totalIrrf)}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">TAXA ADM.</span>
                <span className="text-lg font-black text-slate-700 mt-1 block">
                  {formatMoney(financialData.totais.totalTaxaAdm)}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleToggleAllLancamentos}
                  className="text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                  title="Selecionar / Desmarcar Todos"
                >
                  {financialData?.fechamentos?.length > 0 &&
                  selectedLancamentoIds.length === financialData.fechamentos.length ? (
                    <CheckSquare className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  LANCAMENTOS NO PERIODO SELECIONADO ({financialData?.fechamentos?.length || 0})
                </span>
                {selectedLancamentoIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                    {selectedLancamentoIds.length} SELECIONADOS
                  </span>
                )}
              </div>

              {selectedLancamentoIds.length > 0 && (
                <button
                  onClick={() =>
                    setPdfModal({
                      isOpen: true,
                      url: `/api/easycoop/cooperados/${selectedCpf}/pdf/lancamentos?ids=${selectedLancamentoIds.join(',')}`,
                      title: 'Extrato de Lançamentos e Repasses Selecionados',
                      subtitle: `${selectedLancamentoIds.length} competências selecionadas • ${coopFullData.name}`,
                      filename: `lancamentos-${selectedCpf}.pdf`,
                    })
                  }
                  className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <FileDown className="h-4 w-4" />
                  <span>GERAR PDF DOS SELECIONADOS ({selectedLancamentoIds.length})</span>
                </button>
              )}
            </div>

            {financialLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2 font-bold uppercase">
                <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
                <span>CARREGANDO REPASSES...</span>
              </div>
            ) : financialData?.fechamentos?.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase">
                NENHUM REPASSE REGISTRADO PARA OS FILTROS APLICADOS.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {financialData?.fechamentos?.map((f: any) => {
                  const isExpanded = expandedLancamentoId === f.id;
                  const key = `${f.ano}_${f.mes}_${f.folha}`;
                  const itens = lancamentoItens[key] || [];
                  const loadingItem = loadingItens[key];
                  const isChecked = selectedLancamentoIds.includes(f.id);

                  return (
                    <div key={f.id} className="transition-colors hover:bg-slate-50/70">
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3.5">
                          <button
                            onClick={() => handleToggleLancamento(f.id)}
                            className="text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer shrink-0"
                          >
                            {isChecked ? (
                              <CheckSquare className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Square className="h-5 w-5" />
                            )}
                          </button>

                          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 font-black text-xs font-mono shrink-0">
                            {String(f.mes).padStart(2, '0')}/{f.ano}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-900 block">
                              {f.tomador || 'Coopedu Sede'}
                            </span>
                            <span className="text-xs text-sky-700 font-semibold block mt-0.5">
                              Contrato: {f.contrato_descricao || f.tomador || 'Contrato Operacional'}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Folha: {f.folha}</span>
                              <span>•</span>
                              <span>Pago em: {formatDate(f.data_pagamento)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 self-end sm:self-auto">
                          <div className="text-right space-y-0.5">
                            <div className="text-xs text-slate-500 flex items-center justify-end gap-1.5">
                              <span>
                                Bruto: <strong className="text-slate-800 font-mono font-bold">{formatMoney(f.valor_bruto)}</strong>
                              </span>
                              {Number(f.total_descontos || (Number(f.inss || 0) + Number(f.irrf || 0) + Number(f.taxa_adm || 0))) > 0 && (
                                <span className="text-rose-500 font-mono font-bold text-[11px]">
                                  (-{formatMoney(f.total_descontos || (Number(f.inss || 0) + Number(f.irrf || 0) + Number(f.taxa_adm || 0)))})
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-black text-emerald-600 font-mono">
                              Líquido: {formatMoney(f.valor_liquido)}
                            </div>
                          </div>

                          <button
                            onClick={() => toggleLancamentoItens(f)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                            title="Expandir Rubricas"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100 space-y-3">
                          {Number(f.outros_creditos) > 0 && (
                            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5 shadow-2xs">
                              <span className="text-base leading-none">💡</span>
                              <div>
                                <span className="font-extrabold block text-sky-950">Composição da Remuneração Bruta:</span>
                                <span className="text-sky-800">
                                  Produção Base: <strong className="font-mono text-slate-900">{formatMoney(f.valor_producao)}</strong> + Benefícios / Verbas Adicionais: <strong className="font-mono text-slate-900">{formatMoney(f.outros_creditos)}</strong> = Total Bruto: <strong className="font-mono text-sky-950">{formatMoney(f.valor_bruto)}</strong>.
                                </span>
                              </div>
                            </div>
                          )}

                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                            Detalhamento de Rubricas Oficiais (EasyCoop):
                          </span>

                          {loadingItem ? (
                            <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                              <span>Carregando rubricas...</span>
                            </div>
                          ) : (
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-2.5">Rubrica</th>
                                    <th className="px-4 py-2.5 text-center">Tipo</th>
                                    <th className="px-4 py-2.5 text-right">Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {itens.map((it, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-4 py-2 font-medium text-slate-800">{it.descricao}</td>
                                      <td className="px-4 py-2 text-center">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            it.tipo === 'C' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                          }`}
                                        >
                                          {it.tipo === 'C' ? 'Crédito (+)' : 'Débito (-)'}
                                        </span>
                                      </td>
                                      <td className={`px-4 py-2 text-right font-bold font-mono ${it.tipo === 'C' ? 'text-emerald-700' : 'text-rose-600'}`}>
                                        {formatMoney(it.valor)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: FOLHA DE PAGAMENTO */}
      {activeCoopTab === 'folha' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Receipt className="h-4 w-4 text-indigo-600" />
              <select
                value={selectedFolhaComp ? `${selectedFolhaComp.ano}_${selectedFolhaComp.mes}_${selectedFolhaComp.folha}` : ''}
                onChange={(e) => {
                  const parts = e.target.value.split('_');
                  if (parts.length === 3) {
                    setSelectedFolhaComp({
                      ano: parseInt(parts[0], 10),
                      mes: parseInt(parts[1], 10),
                      folha: parseInt(parts[2], 10),
                    });
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                {folhaData?.competencias?.map((cp: any, idx: number) => (
                  <option key={idx} value={`${cp.ano}_${cp.mes}_${cp.folha}`}>
                    {String(cp.mes).padStart(2, '0')}/{cp.ano} - {cp.tomador} ({formatMoney(cp.valor_liquido)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsFolhaLoteModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <FileDown className="h-4 w-4 text-indigo-600" />
                <span>Gerar PDF em Lote (Ano / Meses)</span>
              </button>

              <button
                onClick={() => {
                  const comp = selectedFolhaComp || (folhaData?.folha ? { ano: folhaData.folha.ano, mes: folhaData.folha.mes, folha: folhaData.folha.folha || 1 } : null) || (folhaData?.competencias?.[0] || { ano: selectedAno || 2024, mes: selectedMes || 1, folha: 1 });
                  setPdfModal({
                    isOpen: true,
                    url: `/api/easycoop/cooperados/${selectedCpf}/pdf/folha-lote?ano=${comp.ano}&mes=${comp.mes}&folha=${comp.folha || 1}`,
                    title: 'Demonstrativo Mensal de Produtividade',
                    subtitle: `Competência ${String(comp.mes).padStart(2, '0')}/${comp.ano} • ${coopFullData.name}`,
                    filename: `demonstrativo-${comp.ano}-${comp.mes}-${selectedCpf}.pdf`,
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Gerar PDF do Demonstrativo</span>
              </button>
            </div>
          </div>

          {folhaLoading ? (
            <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-600">Carregando folha de pagamento...</p>
            </div>
          ) : !folhaData?.folha ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs shadow-sm">
              Nenhum demonstrativo de folha encontrado para a competência selecionada.
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden space-y-6 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div className="flex items-center space-x-4">
                  <img src="/logo_sic.svg" alt="SIC Logo" className="h-12 w-auto object-contain" />
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      COOPEDU - COOPERATIVA DE EDUCAÇÃO E SAÚDE
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      DEMONSTRATIVO MENSAL DE REPASSE E PRODUTIVIDADE COOPERATIVA
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-bold block">COMPETÊNCIA</span>
                  <span className="text-xl font-black text-indigo-700 font-mono">
                    {folhaData.folha.competencia_str}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Cooperado</span>
                  <span className="font-extrabold text-slate-900">{folhaData.folha.cooperado.nome}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">CPF / Matrícula</span>
                  <span className="font-extrabold text-slate-900 font-mono">
                    {formatCpf(folhaData.folha.cooperado.cpf)} (#{folhaData.folha.cooperado.matricula})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Atividade</span>
                  <span className="font-extrabold text-slate-900">{folhaData.folha.cooperado.cargo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Tomador de Serviço</span>
                  <span className="font-extrabold text-indigo-700">{folhaData.folha.tomador}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-emerald-200 overflow-hidden shadow-sm">
                  <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-200 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Proventos / Créditos (+)
                    </span>
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2">Descrição</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {folhaData.folha.proventos?.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{it.descricao}</td>
                          <td className="px-4 py-2.5 text-right font-black font-mono text-emerald-700">
                            {formatMoney(it.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-2xl border border-rose-200 overflow-hidden shadow-sm">
                  <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-800">
                      Descontos / Retenções (-)
                    </span>
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2">Descrição</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {folhaData.folha.descontos?.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{it.descricao}</td>
                          <td className="px-4 py-2.5 text-right font-black font-mono text-rose-600">
                            {formatMoney(it.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-bold text-xs block">Total de Proventos</span>
                  <span className="text-lg font-black text-emerald-700">
                    {formatMoney(folhaData.folha.totais.totalProventos)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-bold text-xs block">Total de Descontos</span>
                  <span className="text-lg font-black text-rose-600">
                    {formatMoney(folhaData.folha.totais.totalDescontos)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
                  <span className="text-emerald-100 font-bold text-xs block">VALOR LÍQUIDO A RECEBER</span>
                  <span className="text-2xl font-black font-mono">
                    {formatMoney(folhaData.folha.totais.valorLiquido)}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-600">
                <div>
                  <span className="text-slate-400 block">Base INSS:</span>
                  <span className="font-bold">{formatMoney(folhaData.folha.bases_calculo.baseInss)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Base IRRF:</span>
                  <span className="font-bold">{formatMoney(folhaData.folha.bases_calculo.baseIrrf)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Depósito em Conta:</span>
                  <span className="font-bold">
                    {getFormattedBank(folhaData.folha.cooperado.banco, folhaData.folha.cooperado.banco).name} Ag: {folhaData.folha.cooperado.agencia} CC: {folhaData.folha.cooperado.conta}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Pago em:</span>
                  <span className="font-bold">{formatDate(folhaData.folha.data_pagamento)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 4: E-SOCIAL (RENOMEADA) */}
      {activeCoopTab === 'esocial' && (
        <div className="space-y-6 animate-in fade-in">
          {/* BANNER OFICIAL: CATEGORIA E-SOCIAL DO COOPERADO */}
          <div className="bg-gradient-to-r from-blue-50/90 via-sky-50/80 to-indigo-50/90 p-5 rounded-3xl border border-blue-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center font-black shadow-md shadow-blue-600/20 shrink-0">
                <span className="text-[10px] leading-none uppercase tracking-wider text-blue-200 font-bold">CÓD</span>
                <span className="text-base leading-tight font-black">{esocialData?.categoria?.codigo || coopFullData?.categoria_esocial?.codigo || '731'}</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-100/90 px-2.5 py-0.5 rounded-md border border-blue-200">
                    Categoria eSocial Oficial (Tabela 01)
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Código {esocialData?.categoria?.codigo || coopFullData?.categoria_esocial?.codigo || '731'}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900 leading-snug">
                  {esocialData?.categoria?.descricao || coopFullData?.categoria_esocial?.descricao || 'Contribuinte individual - Cooperado que presta serviços por intermédio de cooperativa de trabalho'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Enquadramento legal para Cooperativas de Trabalho conforme leiaute oficial do eSocial (Governo Federal).
                </p>
              </div>
            </div>
            <div className="shrink-0 self-start md:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Homologado no eSocial
              </span>
            </div>
          </div>

          {esocialData?.metricas && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Transmitido</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {esocialData.metricas.totalTransmissoes}
                </span>
                <span className="text-[11px] text-slate-500">Eventos enviados</span>
              </div>

              <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Aceitos com Recibo</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {esocialData.metricas.totalAceitos}
                </span>
                <span className="text-[11px] text-emerald-600">Validados no governo</span>
              </div>

              <div className="bg-rose-50 p-5 rounded-3xl border border-rose-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">Rejeições / Erros</span>
                <span className="text-2xl font-black text-rose-700 mt-1 block">
                  {esocialData.metricas.totalErros}
                </span>
                <span className="text-[11px] text-rose-600">Requerem correção</span>
              </div>

              <div className="bg-blue-50 p-5 rounded-3xl border border-blue-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">Último Protocolo</span>
                <span className="text-xs font-mono font-extrabold text-blue-900 mt-1 block truncate">
                  {esocialData.metricas.ultimoProtocolo}
                </span>
                <span className="text-[11px] text-blue-600">Protocolo S-1200/1210</span>
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-blue-600" />
              <select
                value={esocialAno}
                onChange={(e) => setEsocialAno(parseInt(e.target.value, 10))}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
              >
                <option value={0}>Todos os Anos</option>
                {esocialData?.anos?.map((ano: number) => (
                  <option key={ano} value={ano}>Ano {ano}</option>
                ))}
              </select>

              <select
                value={esocialMes}
                onChange={(e) => setEsocialMes(parseInt(e.target.value, 10))}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
              >
                <option value={0}>Todos os Meses</option>
                {[
                  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
                ].map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={esocialEvento}
                onChange={(e) => setEsocialEvento(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
              >
                <option value="TODOS">Todos os Eventos</option>
                {esocialData?.tiposEventos?.map((ev: string) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
            </div>

            {selectedEsocialIds.length > 0 && (
              <button
                onClick={() =>
                  setPdfModal({
                    isOpen: true,
                    url: `/api/easycoop/cooperados/${selectedCpf}/pdf/esocial?ids=${selectedEsocialIds.join(',')}`,
                    title: 'Comprovantes de Transmissão - e-Social',
                    subtitle: `${selectedEsocialIds.length} eventos selecionados • ${coopFullData.name}`,
                    filename: `esocial-${selectedCpf}.pdf`,
                  })
                }
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <FileDown className="h-4 w-4" />
                <span>Gerar PDF dos Selecionados ({selectedEsocialIds.length})</span>
              </button>
            )}
          </div>

          <div className="bg-gradient-to-r from-blue-50/80 via-emerald-50/80 to-slate-50 p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
              <Info className="h-4 w-4 text-blue-600" />
              <span>Guia Oficial das Cores, Protocolos e Recibos do e-Social</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-2xl border border-sky-100 shadow-2xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">S-1200 (Azul)</span>
                  <strong className="text-slate-800 text-[11px]">Remuneração</strong>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Declaração mensal de produção, proventos e bases de incidência de INSS e IRRF perante o Fisco Federal.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">S-1210 (Verde)</span>
                  <strong className="text-slate-800 text-[11px]">Pagamento em Conta</strong>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Comprova a quitação financeira do valor líquido depositado e fixa o fato gerador do Imposto de Renda.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Recibo Oficial</span>
                  <strong className="text-slate-800 text-[11px]">Comprovação Máxima</strong>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Número definitivo gerado pela Receita Federal. Alimenta a DCTFWeb e averba no CNIS / Meu INSS.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleToggleAllEsocial}
                  className="text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
                  title="Selecionar / Desmarcar Todos"
                >
                  {esocialData?.eventos?.length > 0 &&
                  selectedEsocialIds.length === esocialData.eventos.length ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Histórico de Transmissões Governamentais ({esocialData?.eventos?.length || 0})
                </span>
                {selectedEsocialIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                    {selectedEsocialIds.length} selecionados
                  </span>
                )}
              </div>
            </div>

            {esocialLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                <span>Carregando eventos do e-Social...</span>
              </div>
            ) : esocialData?.eventos?.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Nenhum evento do e-Social encontrado para este cooperado no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-8"></th>
                      <th className="px-4 py-3">Evento</th>
                      <th className="px-4 py-3">Competência</th>
                      <th className="px-4 py-3">Data / Hora Envio</th>
                      <th className="px-4 py-3">Protocolo Oficial</th>
                      <th className="px-4 py-3">Recibo eSocial</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {esocialData?.eventos?.map((ev: any) => {
                      const isExpanded = expandedEsocialId === ev.id;
                      const isAceito = ev.status?.includes('Recibo');
                      const isErro = ev.status?.includes('Erro') || ev.status?.includes('Rejeitado');
                      const isChecked = selectedEsocialIds.includes(ev.id);

                      return (
                        <React.Fragment key={ev.id}>
                          <tr className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleEsocial(ev.id)}
                                className="text-slate-400 hover:text-blue-700 transition-colors cursor-pointer"
                              >
                                {isChecked ? (
                                  <CheckSquare className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                            <td
                              className="px-4 py-3 font-extrabold text-slate-900 cursor-pointer"
                              onClick={() => setExpandedEsocialId(isExpanded ? null : ev.id)}
                            >
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                  ev.evento.includes('1200')
                                    ? 'bg-sky-100 text-sky-800'
                                    : ev.evento.includes('1210')
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ev.evento.includes('2200')
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ev.evento}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-700">
                              {String(ev.mes).padStart(2, '0')}/{ev.ano}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {formatDate(ev.data_envio)} {ev.hora_envio || ''}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600 text-[11px] truncate max-w-[180px]">
                              {ev.nro_protocolo || '-'}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-[11px] truncate max-w-[180px]">
                              {ev.nro_recibo || '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isAceito
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isErro
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {ev.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ev.nro_recibo ? (
                                <button
                                  onClick={() =>
                                    setPdfModal({
                                      isOpen: true,
                                      url: `/api/easycoop/cooperados/${selectedCpf}/pdf/esocial?ids=${ev.id}`,
                                      title: 'Comprovante Oficial de Transmissão - e-Social',
                                      subtitle: `Recibo ${ev.nro_recibo} • ${ev.evento}`,
                                      filename: `recibo-esocial-${ev.id}.pdf`,
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 font-bold text-[11px] inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                                  title="Visualizar e Baixar Recibo Oficial em PDF"
                                >
                                  <FileDown className="h-3.5 w-3.5" />
                                  <span>Recibo PDF</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Sem recibo</span>
                              )}
                            </td>
                          </tr>

                          {isExpanded && ev.erro_envio && (
                            <tr>
                              <td colSpan={8} className="bg-rose-50/70 p-4 text-xs border-b border-rose-100">
                                <div className="space-y-1">
                                  <span className="font-extrabold text-rose-900 block">
                                    Mensagem de Retorno / Ocorrência do eSocial:
                                  </span>
                                  <p className="font-mono text-rose-800 bg-white p-3 rounded-xl border border-rose-200">
                                    {ev.erro_envio}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 5: ALOCAÇÕES */}
      {activeCoopTab === 'alocacoes' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 animate-in fade-in">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Histórico de Alocações em Tomadores de Serviço e Contratos
          </h3>
          <div className="divide-y divide-slate-100">
            {coopFullData.alocacoes?.map((al: any, idx: number) => (
              <div key={idx} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{al.tomador_nome}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        al.status_alocacao === 'Ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {al.status_alocacao}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Contrato: {al.contrato_descricao || 'Contrato Geral'} (Doc nº {al.contrato_numero || al.contrato_id})
                  </span>
                  {isDescansoOuSobras(al.contrato_descricao) ? (
                    <span className="text-[11px] text-slate-400 italic block mt-0.5">
                      Contrato de Rateio / Benefício Anual (Sem atividade)
                    </span>
                  ) : (
                    <span className="text-xs text-sky-700 font-medium block mt-0.5">
                      Atividade: {al.cargo || 'Não especificado'}
                    </span>
                  )}
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400 block">Vigência:</span>
                  <span className="font-bold text-slate-800 block">
                    {formatDate(al.data_inicio)} até {formatDate(al.data_fim)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 6: DEPENDENTES */}
      {activeCoopTab === 'dependentes' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 animate-in fade-in">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Dependentes Cadastrados (Dedução de IRRF e Benefícios)
          </h3>
          {coopFullData.dependentes?.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Nenhum dependente cadastrado.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {coopFullData.dependentes?.map((dep: any, idx: number) => (
                <div key={idx} className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{dep.nome}</span>
                    <span className="text-[11px] text-slate-500">
                      CPF: {formatCpf(dep.cpf)} • Nasc: {formatDate(dep.data_nascimento)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dep.deduz_irrf === 'S' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Deduz IRRF
                      </span>
                    )}
                    {dep.tem_convenio === 'S' && (
                      <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                        Convênio Médico
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 7: DOCUMENTOS / TERMOS ASSINADOS */}
      {activeCoopTab === 'documentos' && (
        <div className="space-y-6 animate-in fade-in">
          {/* SEÇÃO 1: TERMOS OFICIAIS DO EASYCOOP (ADESÃO E DESLIGAMENTO) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-sky-600" />
                <span>TERMOS DO EASYCOOP (DOWNLOAD & VISUALIZACAO)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 uppercase font-medium">
                DOCUMENTOS OFICIAIS DE INGRESSO E DESLIGAMENTO CATALOGADOS NO GOOGLE DRIVE E VINCULADOS AO COOPERADO.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* CARD 1: FICHA DE ADESÃO */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50/60 to-white flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                      FICHA DE ADESAO (EASY)
                    </span>
                    {coopFullData.termos_easy?.adesao ? (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        DISPONIVEL
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        NAO LOCALIZADA
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-black text-slate-800 mt-3 break-all uppercase">
                    {coopFullData.termos_easy?.adesao?.file_name || 'FICHA DE ADESAO CADASTRAL'}
                  </h4>

                  <div className="mt-2 space-y-1 text-xs text-slate-600 uppercase">
                    <div>
                      <span className="text-slate-400 font-bold">MATRICULA: </span>
                      <span className="font-mono font-bold text-slate-800">
                        #{coopFullData.termos_easy?.adesao?.matricula || coopFullData.registration_number || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold">CPF: </span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCpf(coopFullData.termos_easy?.adesao?.cpf || coopFullData.document)}
                      </span>
                    </div>
                  </div>
                </div>

                {coopFullData.termos_easy?.adesao ? (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                    <a
                      href={coopFullData.termos_easy.adesao.download_url}
                      download={coopFullData.termos_easy.adesao.file_name}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>BAIXAR PDF</span>
                    </a>
                    {coopFullData.termos_easy.adesao.web_view_link && (
                      <a
                        href={coopFullData.termos_easy.adesao.web_view_link}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>ABRIR DRIVE</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-400 italic uppercase">
                    DOCUMENTO NAO LOCALIZADO NA BASE DO DRIVE
                  </div>
                )}
              </div>

              {/* CARD 2: FICHA DE DESLIGAMENTO */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-b from-rose-50/60 to-white flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                      FICHA DE DESLIGAMENTO (EASY)
                    </span>
                    {coopFullData.termos_easy?.desligamento ? (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        DISPONIVEL
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        SEM DESLIGAMENTO
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-black text-slate-800 mt-3 break-all uppercase">
                    {coopFullData.termos_easy?.desligamento?.file_name || 'TERMO / FICHA DE DESLIGAMENTO'}
                  </h4>

                  <div className="mt-2 space-y-1 text-xs text-slate-600 uppercase">
                    <div>
                      <span className="text-slate-400 font-bold">DATA DESLIGAMENTO: </span>
                      <span className="font-bold text-slate-800">
                        {coopFullData.termos_easy?.desligamento?.termination_date
                          ? formatDate(coopFullData.termos_easy.desligamento.termination_date)
                          : (coopFullData.termination_date ? formatDate(coopFullData.termination_date) : 'VINCULO ATIVO')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold">CONTRATO: </span>
                      <span className="font-bold text-slate-800">
                        {toUpperNoAccents(coopFullData.termos_easy?.desligamento?.contract_name || coopFullData.contrato_atual?.tomador_nome || '-')}
                      </span>
                    </div>
                  </div>
                </div>

                {coopFullData.termos_easy?.desligamento ? (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                    <a
                      href={coopFullData.termos_easy.desligamento.download_url}
                      download={coopFullData.termos_easy.desligamento.file_name}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>BAIXAR PDF</span>
                    </a>
                    {coopFullData.termos_easy.desligamento.web_view_link && (
                      <a
                        href={coopFullData.termos_easy.desligamento.web_view_link}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>ABRIR DRIVE</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-400 italic uppercase">
                    COOPERADO SEM TERMO DE DESLIGAMENTO (VINCULO ATIVO OU NAO DIGITALIZADO)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: TERMOS DIGITALIZADOS (ASSINACOOP) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              TERMOS E PROPOSTAS ASSINADAS DIGITALMENTE (ASSINACOOP)
            </h3>
            {coopFullData.documentos?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center uppercase">NENHUM TERMO DIGITALIZADO ENCONTRADO NO ASSINACOOP.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {coopFullData.documentos?.map((doc: any, idx: number) => (
                  <div key={idx} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block uppercase">{toUpperNoAccents(doc.tipo_documento)}</span>
                      <span className="text-[11px] text-slate-500 uppercase">
                        CRIADO EM: {formatDate(doc.data_criacao)} • ASSINADO EM: {doc.data_assinatura || '-'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        doc.finalizado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {toUpperNoAccents(doc.status || (doc.finalizado ? 'ASSINADO' : 'PENDENTE'))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL INTERATIVO PARA SELEÇÃO DE DEMONSTRATIVOS EM LOTE */}
      <FolhaLoteModal
        isOpen={isFolhaLoteModalOpen}
        onClose={() => setIsFolhaLoteModalOpen(false)}
        competencias={folhaData?.competencias || []}
        cooperadoName={coopFullData?.name || 'Cooperado'}
        cpf={selectedCpf}
        onGenerate={(selected) => {
          setPdfModal({
            isOpen: true,
            url: `/api/easycoop/cooperados/${selectedCpf}/pdf/folha-lote?competencias=${encodeURIComponent(JSON.stringify(selected))}`,
            title: 'Demonstrativos de Produtividade em Lote',
            subtitle: `${selected.length} competências selecionadas • ${coopFullData?.name}`,
            filename: `demonstrativos-${selectedCpf}-lote.pdf`,
          });
        }}
      />

      {/* MODAL UNIVERSAL DE PDF VETORIAL (COM LOGO OFICIAL COOPEDU) */}
      {pdfModal.isOpen && (
        <PdfViewerModal
          isOpen={pdfModal.isOpen}
          onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
          customUrl={pdfModal.url}
          customTitle={pdfModal.title}
          customSubtitle={pdfModal.subtitle}
          customFilename={pdfModal.filename}
        />
      )}
    </div>
  );
};
