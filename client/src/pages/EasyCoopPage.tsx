import React, { useState, useEffect } from "react";
import { CabecalhoPagina } from "../components/CabecalhoPagina";
import {
  Search,
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Layers,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { EasyCoopCooperadoDossier, toUpperNoAccents } from "../components/EasyCoopCooperadoDossier";

interface EasyCoopPageProps {
  initialMode?: "cooperado" | "contrato";
}

interface CooperadoSummary {
  id: number;
  document: string;
  registration_number?: number;
  name: string;
  contract_name?: string;
  position?: string;
  admission_date?: string;
  status: string;
  email?: string;
  whatsapp_number?: string;
  city?: string;
  state?: string;
}

interface ContratoItem {
  cliente_id: number;
  contrato_id: number;
  numero_doc: string;
  tomador_nome: string;
  contrato_descricao: string;
  cidade: string;
  uf: string;
  data_inicio: string;
  data_fim?: string;
  status: string;
  perc_taxa_adm?: number;
  total_cooperados: number;
}

interface ContratoDetails {
  cliente_id: number;
  contrato_id: number;
  numero_doc: string;
  tomador_nome: string;
  tomador_razao: string;
  tomador_cnpj: string;
  contrato_descricao: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
  contato_responsavel?: string;
  data_inicio: string;
  data_fim?: string;
  status: string;
  perc_taxa_adm?: number;
  valor_taxa_adm?: number;
  dia_pagamento?: number;
  centro_custo?: string;
  total_cooperados: number;
  cooperados_ativos: number;
}

export const EasyCoopPage: React.FC<EasyCoopPageProps> = ({ initialMode = "cooperado" }) => {
  const [mode, setMode] = useState<"cooperado" | "contrato">(initialMode);

  // ==========================================
  // ESTADOS DA ABA: COOPERADO
  // ==========================================
  const [coopQuery, setCoopQuery] = useState("");
  const [coopSearchResults, setCoopSearchResults] = useState<CooperadoSummary[]>([]);
  const [coopSearchLoading, setCoopSearchLoading] = useState(false);
  const [selectedCpf, setSelectedCpf] = useState<string | null>(null);

  // ==========================================
  // ESTADOS DA ABA: CONTRATO
  // ==========================================
  const [contratoSearch, setContratoSearch] = useState("");
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [contratosTotal, setContratosTotal] = useState(0);
  const [contratoPage, setContratoPage] = useState(1);
  const [contratoPageSize, setContratoPageSize] = useState(10);
  const [contratoTotalPages, setContratoTotalPages] = useState(1);
  const [contratosLoading, setContratosLoading] = useState(false);

  const [selectedContrato, setSelectedContrato] = useState<{ clienteId: number; contratoId: number } | null>(null);
  const [contratoDetails, setContratoDetails] = useState<ContratoDetails | null>(null);
  const [contratoDetailsLoading, setContratoDetailsLoading] = useState(false);

  // Cooperados alocados no contrato selecionado
  const [alocadosList, setAlocadosList] = useState<any[]>([]);
  const [alocadosTotal, setAlocadosTotal] = useState(0);
  const [alocadosPage, setAlocadosPage] = useState(1);
  const [alocadosPageSize, setAlocadosPageSize] = useState(15);
  const [alocadosTotalPages, setAlocadosTotalPages] = useState(1);
  const [alocadosSearch, setAlocadosSearch] = useState("");
  const [alocadosLoading, setAlocadosLoading] = useState(false);

  // Sincronizar mode se prop mudar
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // ==========================================
  // BUSCA DE COOPERADOS (Debounced)
  // ==========================================
  useEffect(() => {
    if (!coopQuery.trim()) {
      setCoopSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCoopSearchLoading(true);
      try {
        const res = await fetch(`/api/easycoop/cooperados/search?q=${encodeURIComponent(coopQuery)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          const list = data.cooperados || [];
          setCoopSearchResults(list);
          if (list.length > 0) {
            // Se não tiver selecionado ou se o selecionado anterior não estiver nos resultados, seleciona o primeiro
            if (!selectedCpf || !list.some((c: any) => c.document === selectedCpf)) {
              setSelectedCpf(list[0].document);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao buscar cooperados no EasyCoop:", err);
      } finally {
        setCoopSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [coopQuery]);

  // ==========================================
  // CARREGAMENTO DE CONTRATOS (Com paginação e busca)
  // ==========================================
  useEffect(() => {
    if (mode !== "contrato") return;

    const fetchContratos = async () => {
      setContratosLoading(true);
      try {
        const url = `/api/easycoop/contratos?page=${contratoPage}&pageSize=${contratoPageSize}&search=${encodeURIComponent(
          contratoSearch
        )}`;
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          setContratos(data.contratos || []);
          setContratosTotal(data.total || 0);
          setContratoTotalPages(data.totalPages || 1);

          // Seleciona o primeiro contrato se nenhum estiver selecionado
          if (data.contratos?.length > 0 && !selectedContrato) {
            setSelectedContrato({
              clienteId: data.contratos[0].cliente_id,
              contratoId: data.contratos[0].contrato_id,
            });
          }
        }
      } catch (err) {
        console.error("Erro ao buscar contratos no EasyCoop:", err);
      } finally {
        setContratosLoading(false);
      }
    };

    fetchContratos();
  }, [mode, contratoPage, contratoPageSize, contratoSearch]);

  // Carregar detalhes do contrato selecionado
  useEffect(() => {
    if (!selectedContrato) {
      setContratoDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setContratoDetailsLoading(true);
      try {
        const res = await fetch(
          `/api/easycoop/contratos/${selectedContrato.clienteId}/${selectedContrato.contratoId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (res.ok) {
          setContratoDetails(data);
        }
      } catch (err) {
        console.error("Erro ao carregar detalhes do contrato:", err);
      } finally {
        setContratoDetailsLoading(false);
      }
    };

    fetchDetails();
    setAlocadosPage(1);
  }, [selectedContrato]);

  // Carregar cooperados do contrato selecionado (com paginação e busca)
  useEffect(() => {
    if (!selectedContrato) return;

    const fetchAlocados = async () => {
      setAlocadosLoading(true);
      try {
        const url = `/api/easycoop/contratos/${selectedContrato.clienteId}/${selectedContrato.contratoId}/cooperados?page=${alocadosPage}&pageSize=${alocadosPageSize}&search=${encodeURIComponent(
          alocadosSearch
        )}`;
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          setAlocadosList(data.cooperados || []);
          setAlocadosTotal(data.total || 0);
          setAlocadosTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        console.error("Erro ao buscar cooperados alocados:", err);
      } finally {
        setAlocadosLoading(false);
      }
    };

    fetchAlocados();
  }, [selectedContrato, alocadosPage, alocadosPageSize, alocadosSearch]);

  const formatCpf = (val: string) => {
    if (!val) return "-";
    const d = val.replace(/\D/g, "");
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return val;
  };

  const formatMoney = (val?: number | string) => {
    const n = Number(val || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (val?: string) => {
    if (!val) return "-";
    try {
      const parts = val.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return val;
    } catch {
      return val;
    }
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-300">
      <CabecalhoPagina
        icone={Layers}
        titulo="EasyCoop Analytics"
        descricao="Consulta analítica da base oficial: cooperados, repasses por período, folha e e-Social."
        acoes={
          <div className="flex items-center p-1.5 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setMode("cooperado")}
              className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "cooperado" ? "bg-white text-[#005487] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>Cooperado</span>
            </button>
            <button
              onClick={() => setMode("contrato")}
              className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "contrato" ? "bg-white text-[#005487] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Contrato</span>
            </button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* MODO 1: COOPERADO */}
      {/* ========================================================================= */}
      {mode === "cooperado" && (
        <div className="space-y-6">
          {/* Caixa de Busca de Cooperados */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Pesquisa de Cooperado no EasyCoop (CPF ou Nome Completo)
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={coopQuery}
                onChange={(e) => setCoopQuery(e.target.value)}
                placeholder="Digite o CPF (com ou sem pontuação) ou Nome do Cooperado..."
                className="w-full pl-12 pr-12 py-4 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-base focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-400 font-medium shadow-inner"
              />
              {coopSearchLoading && <Loader2 className="absolute right-4 h-5 w-5 text-sky-600 animate-spin" />}
            </div>
          </div>

          {/* Seletores Rápidos de Resultados (3.1: Selecionar e atualizar tela imediatamente) */}
          {coopSearchResults.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                {coopSearchResults.length} Cooperado(s) Encontrado(s) - Clique para Visualizar:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {coopSearchResults.map((c) => {
                  const isSelected = selectedCpf === c.document;
                  return (
                    <button
                      key={c.id || c.document}
                      onClick={() => setSelectedCpf(c.document)}
                      className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-sky-50 border-sky-400 ring-2 ring-sky-300/40 shadow-sm"
                          : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-bold text-xs text-slate-800 truncate">{toUpperNoAccents(c.name)}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{formatCpf(c.document)}</span>
                          <span>•</span>
                          <span
                            className={`font-semibold ${
                              c.status === "Ativo" ? "text-emerald-600" : "text-slate-500"
                            }`}
                          >
                            {toUpperNoAccents(c.status)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 ${isSelected ? "text-sky-600" : "text-slate-300"}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dossiê Completo do Cooperado com todas as abas e PDFs integrados */}
          {selectedCpf && (
            <EasyCoopCooperadoDossier selectedCpf={selectedCpf} />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: CONTRATO (Pesquisa por Nome/Tomador + Repaginação) */}
      {/* ========================================================================= */}
      {mode === "contrato" && (
        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Pesquisa de Contratos (Nome do Contrato, Prefeitura/Tomador ou Número do Documento)
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={contratoSearch}
                onChange={(e) => {
                  setContratoSearch(e.target.value);
                  setContratoPage(1);
                }}
                placeholder="Ex: PREF TOUROS, PENDENCIAS, GOIANINHA, ADM PROLABORE..."
                className="w-full pl-12 pr-12 py-4 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-base focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 font-medium shadow-inner"
              />
              {contratosLoading && <Loader2 className="absolute right-4 h-5 w-5 text-indigo-600 animate-spin" />}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Contratos Encontrados ({contratosTotal})
                </span>
                <span className="text-[11px] text-slate-400">
                  Pág {contratoPage} de {contratoTotalPages}
                </span>
              </div>

              {contratosLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                  <span>Carregando contratos...</span>
                </div>
              ) : contratos.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">Nenhum contrato encontrado.</div>
              ) : (
                <div className="space-y-2">
                  {contratos.map((ct) => {
                    const isSelected =
                      selectedContrato?.clienteId === ct.cliente_id &&
                      selectedContrato?.contratoId === ct.contrato_id;

                    return (
                      <div
                        key={`${ct.cliente_id}_${ct.contrato_id}`}
                        onClick={() => setSelectedContrato({ clienteId: ct.cliente_id, contratoId: ct.contrato_id })}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-400 shadow-sm ring-2 ring-indigo-200"
                            : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-xs text-slate-900 truncate uppercase">
                            {toUpperNoAccents(ct.tomador_nome)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase ${
                              ct.status === "S" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {ct.status === "S" ? "ATIVO" : "INATIVO"}
                          </span>
                        </div>
                        <span className="text-[11px] text-indigo-700 font-medium block mt-1 truncate uppercase">
                          {toUpperNoAccents(ct.contrato_descricao || "SEM DESCRICAO")}
                        </span>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/60 uppercase">
                          <span>DOC Nº {ct.numero_doc || ct.contrato_id}</span>
                          <span className="font-bold text-slate-700">{ct.total_cooperados} COOPERADOS</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {contratoTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    disabled={contratoPage <= 1}
                    onClick={() => setContratoPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <span className="font-bold text-slate-700">
                    {contratoPage} / {contratoTotalPages}
                  </span>
                  <button
                    disabled={contratoPage >= contratoTotalPages}
                    onClick={() => setContratoPage((p) => Math.min(contratoTotalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Painel de Detalhes do Contrato e Cooperados Alocados */}
            <div className="lg:col-span-2 space-y-6">
              {contratoDetailsLoading ? (
                <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
                  <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                  <p className="text-xs font-semibold text-slate-600">Carregando detalhes do contrato...</p>
                </div>
              ) : contratoDetails ? (
                <>
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-2xl text-white shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 block">
                          TOMADOR / ENTIDADE CONTRATANTE
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black uppercase">{toUpperNoAccents(contratoDetails.tomador_nome)}</h2>
                        <span className="text-xs text-slate-300 block mt-0.5 uppercase font-medium">
                          {toUpperNoAccents(contratoDetails.tomador_razao)} • CNPJ: {contratoDetails.tomador_cnpj}
                        </span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                          contratoDetails.status === "S"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-slate-700 text-slate-300 border-slate-600"
                        }`}
                      >
                        {contratoDetails.status === "S" ? "CONTRATO ATIVO" : "INATIVO"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-700/80 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Doc / Contrato nº</span>
                        <span className="font-extrabold text-slate-100">
                          {contratoDetails.numero_doc || contratoDetails.contrato_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Vigência</span>
                        <span className="font-extrabold text-slate-100">
                          {formatDate(contratoDetails.data_inicio)} até {formatDate(contratoDetails.data_fim)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Taxa Adm.</span>
                        <span className="font-extrabold text-emerald-400">
                          {contratoDetails.perc_taxa_adm ? `${contratoDetails.perc_taxa_adm}%` : "Padrão"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Cooperados Ativos</span>
                        <span className="font-extrabold text-sky-400">
                          {contratoDetails.cooperados_ativos} de {contratoDetails.total_cooperados}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                          Cooperados Alocados no Contrato ({alocadosTotal})
                        </h3>
                        <p className="text-xs text-slate-500">
                          Lista paginada com matrícula, atividade, carga horária e vigência.
                        </p>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={alocadosSearch}
                          onChange={(e) => {
                            setAlocadosSearch(e.target.value);
                            setAlocadosPage(1);
                          }}
                          placeholder="Filtrar por nome ou CPF..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {alocadosLoading ? (
                      <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                        <span>Carregando cooperados alocados...</span>
                      </div>
                    ) : alocadosList.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        Nenhum cooperado encontrado nesta pesquisa.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">Matrícula</th>
                              <th className="px-3.5 py-2.5">Cooperado</th>
                              <th className="px-3.5 py-2.5">CPF</th>
                              {/* 3.5 Substituir Cargo por Atividade */}
                              <th className="px-3.5 py-2.5">Atividade</th>
                              <th className="px-3.5 py-2.5">Vigência</th>
                              <th className="px-3.5 py-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alocadosList.map((cp, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="px-3.5 py-2.5 font-mono text-slate-600 font-bold">{cp.matricula}</td>
                                <td className="px-3.5 py-2.5 font-bold text-slate-900">{cp.nome}</td>
                                <td className="px-3.5 py-2.5 font-mono text-slate-600">{formatCpf(cp.cpf)}</td>
                                <td className="px-3.5 py-2.5 text-slate-700">{cp.cargo || "Não informado"}</td>
                                <td className="px-3.5 py-2.5 text-slate-500">
                                  {formatDate(cp.data_inicio)} até {formatDate(cp.data_fim)}
                                </td>
                                <td className="px-3.5 py-2.5 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      cp.status_alocacao === "Ativo"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {cp.status_alocacao}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>Exibir:</span>
                        <select
                          value={alocadosPageSize}
                          onChange={(e) => {
                            setAlocadosPageSize(parseInt(e.target.value, 10));
                            setAlocadosPage(1);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
                        >
                          <option value={10}>10 por página</option>
                          <option value={15}>15 por página</option>
                          <option value={25}>25 por página</option>
                          <option value={50}>50 por página</option>
                        </select>
                        <span>de {alocadosTotal} cooperados</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          disabled={alocadosPage <= 1}
                          onClick={() => setAlocadosPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span>Anterior</span>
                        </button>
                        <span className="font-bold text-slate-700">
                          Página {alocadosPage} de {alocadosTotalPages}
                        </span>
                        <button
                          disabled={alocadosPage >= alocadosTotalPages}
                          onClick={() => setAlocadosPage((p) => Math.min(alocadosTotalPages, p + 1))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Próxima</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
