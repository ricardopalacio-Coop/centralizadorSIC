import React, { useState } from "react";
import {
  UserMinus,
  Search,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  ShieldCheck,
  ExternalLink,
  User,
  MapPin,
  Phone,
  Mail,
  FileCheck2,
  FileSignature,
  Download,
  UserPlus,
  CheckSquare,
} from "lucide-react";

export const DesligamentoPage: React.FC = () => {
  const [cpf, setCpf] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const formatCpfInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpfInput(e.target.value));
  };

  const handleSearch = async (cpfToSearch?: string) => {
    const targetCpf = cpfToSearch || cpf;
    const clean = targetCpf.replace(/\D/g, "");
    if (!clean || clean.length !== 11) {
      setError("Por favor, digite um CPF válido contendo 11 dígitos.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/desligamento/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cpf: clean }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao consultar desligamento/propostas.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao consultar o serviço de desligamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (sampleCpf: string) => {
    const formatted = formatCpfInput(sampleCpf);
    setCpf(formatted);
    handleSearch(formatted);
  };

  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return "Não informada";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const translateProviderStatus = (status?: string) => {
    if (!status) return "Não informado";
    const s = String(status).toLowerCase();
    if (s === "signed") return "Assinado Digitalmente";
    if (s === "completed") return "Concluído";
    if (s === "pending") return "Pendente de Assinatura";
    if (s === "created") return "Documento Criado";
    if (s === "processing") return "Em Processamento";
    if (s === "rejected") return "Rejeitado";
    return status;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* BANNER PRINCIPAL DO MENU ADESÃO / DESLIGAMENTO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-slate-700/50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-4 rounded-2xl bg-sky-600/30 border border-sky-500/30 text-sky-300 flex items-center space-x-1">
              <UserPlus className="h-7 w-7 text-sky-400" />
              <UserMinus className="h-7 w-7 text-rose-400" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 block">
                Módulo de Gestão de Vínculos Cooperativos
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <span className="text-sky-400 font-black">Adesão</span>
                <span className="text-slate-400 font-normal">/</span>
                <span className="text-rose-500 font-black">Desligamento</span>
                <span className="text-slate-200 font-bold text-xl">& Status de Propostas</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-sky-200 self-start md:self-center">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Integração Ativa via API Key M2M</span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl font-medium">
          Consulte em tempo real os <strong>pedidos de desligamento</strong> e as <strong>propostas de adesão/admissão</strong>, gerando PDFs e acompanhando a assinatura digital do cooperado.
        </p>

        {/* CAMPO DE PESQUISA POR CPF */}
        <div className="pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={cpf}
                onChange={handleCpfChange}
                placeholder="Digite o CPF do cooperado (ex: 195.848.572-15)"
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white text-slate-900 placeholder-slate-400 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Consultar CPF</span>
            </button>
          </form>

          {/* BOTÕES DE SUGESTÃO DE TESTE RÁPIDO */}
          <div className="flex flex-wrap items-center gap-2 pt-3 text-xs text-slate-300">
            <span className="font-bold text-slate-400">Atalhos de Consulta:</span>
            <button
              type="button"
              onClick={() => handleQuickSearch("19584857215")}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-[11px] transition-all border border-white/10"
            >
              195.848.572-15 (Francis)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch("05917984417")}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-[11px] transition-all border border-white/10"
            >
              059.179.844-17 (Thiago)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch("25930187800")}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-[11px] transition-all border border-white/10"
            >
              259.301.878-00 (Ricardo)
            </button>
          </div>
        </div>
      </div>

      {/* MENSAGEM DE ERRO */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-3 text-sm font-semibold shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RESULTADO DA CONSULTA */}
      {result && (
        <div className="space-y-6">
          {/* CABEÇALHO DO RESULTADO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Resultado Encontrado para</span>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                CPF: <span className="font-mono text-sky-700">{result.formattedCpf}</span>
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                  result.termination.found
                    ? "bg-rose-100 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <strong className="text-rose-700">Desligamento:</strong> {result.termination.found ? "PEDIDO ENCONTRADO" : "Nenhum Pedido"}
              </span>

              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                  result.proposal.found
                    ? "bg-sky-100 text-sky-700 border-sky-200"
                    : "bg-amber-100 text-amber-700 border-amber-200"
                }`}
              >
                <strong className="text-sky-700">Adesão:</strong> {result.proposal.found ? "LOCALIZADA" : "Não Encontrada"}
              </span>
            </div>
          </div>

          {/* 1. SEÇÃO DE STATUS DO PEDIDO DE DESLIGAMENTO */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2">
                <UserMinus className="h-4 w-4 text-rose-600" />
                <span className="text-rose-600 font-extrabold">Status do Pedido de Desligamento</span>
              </h3>

              {result.termination.found && (
                <button
                  onClick={() => window.open(`/api/desligamento/${result.cpf}/desligamento-pdf`, "_blank")}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Gerar PDF do Desligamento</span>
                </button>
              )}
            </div>

            {!result.termination.found ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-600 text-xs font-semibold space-y-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-800">Sem Pedido de Desligamento Ativo</p>
                <p className="text-slate-500 font-normal">{result.termination.message}</p>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-rose-900 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-rose-600" />
                    Solicitação de Desligamento Registrada
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white uppercase">
                    {result.termination.status}
                  </span>
                </div>

                <p className="text-xs text-rose-800 font-medium">
                  {result.termination.message}
                </p>

                {result.termination.data && (
                  <div className="p-4 rounded-xl bg-white border border-rose-200 font-mono text-xs text-slate-800 overflow-x-auto">
                    <pre>{JSON.stringify(result.termination.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. SEÇÃO DA PROPOSTA DE ADESÃO / ADMISSÃO */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-600" />
                <span className="text-sky-600 font-extrabold">Informações da Proposta de Adesão / Admissão</span>
              </h3>

              {result.proposal.found && (
                <button
                  onClick={() => window.open(`/api/desligamento/${result.cpf}/proposta-pdf`, "_blank")}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Gerar PDF da Proposta de Adesão</span>
                </button>
              )}
            </div>

            {!result.proposal.found ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs font-medium">
                Nenhuma proposta de contratação/admissão localizada para este CPF no sistema externo.
              </div>
            ) : (
              <div className="space-y-6">
                {/* HERO CARD DA PROPOSTA DE ADESÃO */}
                <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-md space-y-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-2xl bg-sky-600/30 text-sky-300 border border-sky-500/30">
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="text-xs text-sky-300 font-bold uppercase tracking-wider block">Nome Completo do Candidato / Cooperado</span>
                        <h3 className="text-2xl font-black text-white">{result.proposal.data.nomeCompleto}</h3>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* ÚLTIMO MOVIMENTO NA API */}
                      <div className="flex items-center space-x-2 text-xs font-semibold text-sky-300 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10">
                        <Clock className="h-4 w-4 text-sky-400 shrink-0" />
                        <span>
                          Último Movimento na API:{" "}
                          <strong className="text-white font-mono">
                            {formatDateStr(
                              result.proposal?.data?.crmSyncedAt ||
                              result.proposal?.data?.updatedAt ||
                              result.proposal?.data?.dataCriacao ||
                              result.cooperadoCadastral?.updated_at ||
                              new Date().toISOString()
                            )}
                          </strong>
                        </span>
                      </div>

                      <span
                        className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                          result.proposal.data.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                            : "bg-amber-500/20 text-amber-300 border-amber-400/30"
                        }`}
                      >
                        Status: {result.proposal.data.status}
                      </span>
                    </div>
                  </div>

                  {/* HIGHLIGHTS: CATEGORIA, CONTRATO E CPF */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                      <span className="text-xs text-sky-200 font-semibold block flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-sky-400" />
                        Categoria / Função
                      </span>
                      <p className="text-sm font-extrabold text-white">
                        {result.proposal.data.categoriaFuncao || "Não informada"}
                      </p>
                    </div>

                    {/* CONTRATO */}
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                      <span className="text-xs text-sky-200 font-semibold block flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-amber-400" />
                        Contrato
                      </span>
                      <p className="text-sm font-extrabold text-amber-300">
                        {result.proposal.data.contrato ||
                          result.proposal.data.contractName ||
                          result.proposal.data.nomeContrato ||
                          result.cooperadoCadastral?.contract_name ||
                          "PREFEITURA MUNICIPAL DE SANTAREM / COOPEDU GESTORES"}
                      </p>
                    </div>

                    {/* CPF */}
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                      <span className="text-xs text-sky-200 font-semibold block flex items-center gap-1.5">
                        <FileCheck2 className="h-4 w-4 text-emerald-400" />
                        CPF do Cooperado
                      </span>
                      <p className="text-sm font-mono font-extrabold text-white">
                        {result.formattedCpf || formatCpfInput(result.proposal.data.cpf || result.cpf)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CARD DE ASSINATURA DIGITAL PLUGSIGN */}
                {result.proposal.data.assinatura && (
                  <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-sky-800 flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-sky-600" />
                        Assinatura Digital de Documentos (PlugSign)
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          result.proposal.data.assinatura.assinado
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {result.proposal.data.assinatura.assinado ? "DOCUMENTO ASSINADO" : "ASSINATURA PENDENTE"}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700">
                          Status do Provedor: <strong className="text-slate-900 font-bold">{translateProviderStatus(result.proposal.data.assinatura.statusProvedor)}</strong>
                        </p>
                        {result.proposal.data.crmSyncedAt && (
                          <p className="text-slate-500 font-medium">
                            Sincronizado com CRM em: <strong>{formatDateStr(result.proposal.data.crmSyncedAt)}</strong>
                          </p>
                        )}
                      </div>

                      {result.proposal.data.assinatura.link ? (
                        <a
                          href={result.proposal.data.assinatura.link}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                        >
                          <span>Abrir Documento no PlugSign</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => window.open(`/api/desligamento/${result.cpf}/proposta-pdf`, "_blank")}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar Documento Assinado (PDF)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* DADOS PESSOAIS E ENDEREÇO DA PROPOSTA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* DADOS PESSOAIS */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                      <User className="h-4 w-4 text-sky-600" />
                      Dados Pessoais da Proposta
                    </span>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block font-medium">Nome da Mãe</span>
                        <strong className="text-slate-900">{result.proposal.data.nomeMae || "N/I"}</strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-medium">Data Nascimento</span>
                        <strong className="text-slate-900">{result.proposal.data.dataNascimento || "N/I"}</strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-medium">Sexo / Cor</span>
                        <strong className="text-slate-900">
                          {result.proposal.data.sexo} - {result.proposal.data.corRaca}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-medium">Estado Civil</span>
                        <strong className="text-slate-900">{result.proposal.data.estadoCivil}</strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-medium">Naturalidade</span>
                        <strong className="text-slate-900">
                          {result.proposal.data.naturalidadeMunicipio} / {result.proposal.data.naturalidadeEstado}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-medium">Escolaridade</span>
                        <strong className="text-slate-900">{result.proposal.data.escolaridade}</strong>
                      </div>
                    </div>
                  </div>

                  {/* ENDEREÇO & CONTATO */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2">
                      <MapPin className="h-4 w-4 text-sky-600" />
                      Endereço Residencial & Contatos
                    </span>

                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-slate-900">
                        {result.proposal.data.logradouroTipo} {result.proposal.data.logradouroNome}, Nº {result.proposal.data.numero}
                        {result.proposal.data.complemento ? ` (${result.proposal.data.complemento})` : ""}
                      </p>

                      <p className="text-slate-600 font-medium">
                        Bairro: <strong>{result.proposal.data.bairro}</strong> | Cidade:{" "}
                        <strong>{result.proposal.data.cidade} / {result.proposal.data.estado}</strong> | CEP:{" "}
                        <strong>{result.proposal.data.cep}</strong>
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        <div>
                          <span className="text-slate-500 block font-medium flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-600" /> Telefone
                          </span>
                          <strong className="text-slate-900">{result.proposal.data.telefone}</strong>
                        </div>

                        <div>
                          <span className="text-slate-500 block font-medium flex items-center gap-1">
                            <Mail className="h-3 w-3 text-sky-600" /> E-mail
                          </span>
                          <strong className="text-slate-900">{result.proposal.data.email}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CRITÉRIOS DE SELEÇÃO E ACEITES LGPD */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    <span>Critério Localidade: <strong>{result.proposal.data.criterioLocalidade}</strong></span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    <span>Experiência: <strong>{result.proposal.data.criterioExperiencia}</strong></span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    <span>Disponibilidade: <strong>{result.proposal.data.criterioDisponibilidade}</strong></span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="h-4 w-4 text-sky-600" />
                    <span>Aceite LGPD: <strong>{result.proposal.data.aceiteLGPD ? "Confirmado" : "Não"}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
