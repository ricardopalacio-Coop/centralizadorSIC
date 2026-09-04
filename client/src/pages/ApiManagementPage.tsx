import React, { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  BookOpen,
  ShieldCheck,
  Search,
  FileText,
  Eye,
  CheckCircle2,
  Lock,
  Terminal,
  ExternalLink,
  Loader2,
  AlertCircle,
  BarChart3,
  Building2,
  Landmark,
  UserCheck,
} from "lucide-react";

interface ApiToken {
  id: number;
  user_id: number;
  name: string;
  token: string;
  status: "ACTIVE" | "REVOKED";
  last_used_at?: string;
  created_at: string;
}

export const ApiManagementPage: React.FC = () => {
  const [subTab, setSubTab] = useState<"tokens" | "docs">("tokens");
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens/listar", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setTokens(data.tokens || []);
      }
    } catch (err) {
      console.error("Erro ao carregar tokens:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;

    setGenerating(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/tokens/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newTokenName.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setNewTokenName("");
        setGeneratedToken(data.token.token);
        setSuccessMsg("Novo Token de API gerado com sucesso!");
        fetchTokens();
      } else {
        setError(data.error || "Falha ao gerar o token.");
      }
    } catch (err: any) {
      setError("Erro de conexão ao gerar token.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeToken = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja revogar este Token de API? Sistemas que utilizam este token perderão o acesso imediatamente.")) {
      return;
    }

    try {
      const res = await fetch(`/api/tokens/${id}/revogar`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setSuccessMsg("Token de API revogado com sucesso!");
        fetchTokens();
      }
    } catch (err) {
      console.error("Erro ao revogar token:", err);
    }
  };

  const copyToClipboard = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Nunca utilizado";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const baseUrl = `${window.location.origin}/api/v1`;

  return (
    <div className="w-full max-w-[98%] 2xl:max-w-[1850px] mx-auto px-2 sm:px-4 md:px-6 py-6 space-y-8 animate-in fade-in duration-300">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
            <Code className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900">Gestão de APIs & Distribuição de Dados</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-200">
                v1.0 REST
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Gere tokens seguros para distribuir dados de cooperados, resumos, folhas e PDFs para sistemas externos ou agentes de IA.
            </p>
          </div>
        </div>

        {/* Chaveador de Navegação Interna */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setSubTab("tokens")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              subTab === "tokens"
                ? "bg-white text-sky-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Key className="h-4 w-4 text-sky-600" />
            <span>Meus API Tokens</span>
          </button>

          <button
            onClick={() => setSubTab("docs")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              subTab === "docs"
                ? "bg-white text-sky-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="h-4 w-4 text-sky-600" />
            <span>Manual da API</span>
          </button>
        </div>
      </div>

      {/* SUB-ABA 1: MEUS TOKENS DE API */}
      {subTab === "tokens" && (
        <div className="space-y-6">
          {/* Alertas */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Modal/Banner de Novo Token Gerado */}
          {generatedToken && (
            <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-3 shadow-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Seu Novo Token Foi Gerado com Sucesso!
                </span>
                <button
                  onClick={() => setGeneratedToken(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white"
                >
                  Fechar Alerta
                </button>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Guarde este token em local seguro. Ele concede acesso autenticado à API de distribuição de dados do Centralizador SIC.
              </p>
              <div className="flex items-center space-x-2 bg-slate-800 p-3 rounded-2xl border border-slate-700 font-mono text-sm text-sky-300">
                <input
                  type="text"
                  readOnly
                  value={generatedToken}
                  className="bg-transparent w-full focus:outline-none text-sky-300 font-mono text-xs sm:text-sm"
                />
                <button
                  onClick={() => copyToClipboard(generatedToken, "new_generated")}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1 transition-all shrink-0"
                >
                  {copiedId === "new_generated" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === "new_generated" ? "Copiado!" : "Copiar Token"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Form de Criação de Token */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-sky-600" />
              Gerar Novo API Token de Acesso
            </h2>
            <form onSubmit={handleGenerateToken} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Ex: Integração CRM / Bot WhatsApp / Sistema Financeiro..."
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={generating || !newTokenName.trim()}
                className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                <span>Gerar Token</span>
              </button>
            </form>
          </div>

          {/* Tabela de Tokens de API Ativos */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">Tokens Ativos e Histórico de Acesso</h2>
              <span className="text-xs font-bold text-slate-500">Total: {tokens.length} token(s)</span>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
                <span className="text-xs font-bold text-slate-500">Carregando seus tokens de API...</span>
              </div>
            ) : tokens.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-bold">
                Nenhum Token de API foi gerado ainda. Use o formulário acima para gerar a primeira chave de integração.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
                      <th className="pb-3 px-2">Identificação / Nome</th>
                      <th className="pb-3 px-2">Token Mascarado</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2">Criado Em</th>
                      <th className="pb-3 px-2">Último Uso</th>
                      <th className="pb-3 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {tokens.map((t) => {
                      const isRevoked = t.status === "REVOKED";
                      const maskedToken = isRevoked ? "●●●●●●●● (REVOGADO)" : `${t.token.substring(0, 14)}...${t.token.substring(t.token.length - 6)}`;

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-all">
                          <td className="py-3.5 px-2 font-bold text-slate-900">{t.name}</td>
                          <td className="py-3.5 px-2 font-mono text-slate-700">
                            <div className="flex items-center space-x-2">
                              <span>{maskedToken}</span>
                              {!isRevoked && (
                                <button
                                  onClick={() => copyToClipboard(t.token, String(t.id))}
                                  className="text-slate-400 hover:text-sky-600"
                                  title="Copiar Token Inteiro"
                                >
                                  {copiedId === String(t.id) ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isRevoked
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {t.status === "ACTIVE" ? "Ativo" : "Revogado"}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-slate-600">{formatDate(t.created_at)}</td>
                          <td className="py-3.5 px-2 text-slate-600">{formatDate(t.last_used_at)}</td>
                          <td className="py-3.5 px-2 text-right">
                            {!isRevoked && (
                              <button
                                onClick={() => handleRevokeToken(t.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] flex items-center space-x-1 ml-auto transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Revogar</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 2: MANUAL COMPLETO DE UTILIZAÇÃO DA API */}
      {subTab === "docs" && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 text-sky-400">
                <Terminal className="h-6 w-6" />
                <h2 className="text-lg font-black uppercase tracking-wider text-white">Manual Completo de Integração REST (v1)</h2>
              </div>

              {/* Botão de Download do Manual em PDF */}
              <a
                href="/api/tokens/manual/pdf"
                download="Manual_API_Centralizador_SIC_v1.pdf"
                className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center space-x-2 transition-all shadow-md shrink-0 self-start sm:self-auto"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Baixar Manual em PDF</span>
              </a>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Esta API foi desenvolvida para distribuir os dados cadastrais, financeiros e documentos do cooperado de forma segura e autenticada via **API Token**.
            </p>

            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">Autenticação nos Cabeçalhos (Headers)</span>
              <p className="text-xs text-slate-300 font-mono">
                Authorization: Bearer <span className="text-amber-400">&lt;SEU_API_TOKEN&gt;</span>
              </p>
              <p className="text-xs text-slate-400">
                Ou alternativamente: <code className="text-sky-300">X-API-Key: &lt;SEU_API_TOKEN&gt;</code>
              </p>
            </div>
          </div>

          {/* LISTA DE ENDPOINTS DISPONÍVEIS E DICIONÁRIO DE CAMPOS */}
          <div className="space-y-6">
            {/* ENDPOINT 1: PESQUISA */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">GET</span>
                <span className="font-mono text-sm font-bold text-slate-900">/api/v1/cooperados/pesquisar?q=12345678900</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Pesquisa cooperados por **CPF** (apenas números ou formatado) ou por **Nome Completo**.
              </p>

              {/* Tabela de Campos */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Campo Retornado</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descrição Detalhada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">status</td><td className="py-2 px-3">String</td><td className="py-2 px-3">'SUCESSO' indicando execução correta.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">total</td><td className="py-2 px-3">Integer</td><td className="py-2 px-3">Total de registros localizados.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">cooperados[].cpf</td><td className="py-2 px-3">String</td><td className="py-2 px-3">CPF numérico sem pontuação (11 dígitos).</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">cooperados[].nome</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Nome completo cadastrado no SIC.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">cooperados[].matricula</td><td className="py-2 px-3">Integer</td><td className="py-2 px-3">Matrícula oficial de cooperado.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">cooperados[].status</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Status no SIC ('Ativo', 'Inativo').</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 text-sky-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                <pre>{`curl -X GET "${baseUrl}/cooperados/pesquisar?q=25930187800" \\
  -H "Authorization: Bearer sic_live_..."`}</pre>
              </div>
            </div>

            {/* ENDPOINT 2: RESUMO COMPLETO DO COOPERADO */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">GET</span>
                <span className="font-mono text-sm font-bold text-slate-900">/api/v1/cooperados/{`{CPF}`}/resumo</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Retorna **TODOS os dados da aba Resumo do Cooperado**: Dados Pessoais, Cargo real do SIC, Contratos Ativos, Dados Bancários, PIX, Endereço, Contatos e a Última Competência.
              </p>

              {/* Tabela de Campos Detalhada */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Objeto / Campo</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descrição Detalhada do Dado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosPessoais.nome</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Nome completo oficial do cooperado.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosPessoais.cpf</td><td className="py-2 px-3">String</td><td className="py-2 px-3">CPF numérico (11 dígitos).</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosPessoais.matricula</td><td className="py-2 px-3">Integer</td><td className="py-2 px-3">Número de matrícula no SIC.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosPessoais.cargoProfissao</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Cargo real extraído do SIC (ex: 'OUVIDOR').</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosPessoais.naturalidade</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Cidade e Estado de nascimento.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">contratosAtivos[]</td><td className="py-2 px-3">Array</td><td className="py-2 px-3">Vínculos contratuais ativos com contratante e núcleo.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosBancarios.banco</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Instituição financeira (ex: 'Fitbank / Banco 450').</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosBancarios.conta</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Número da conta com dígito verificador.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">dadosBancarios.chavePix</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Chave PIX cadastrada para crédito.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">enderecoResidencial</td><td className="py-2 px-3">Object</td><td className="py-2 px-3">Rua, número, complemento, bairro, CEP e cidade.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">contatos.celularWhatsapp</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Número do WhatsApp / Celular cadastrado.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">contatos.email</td><td className="py-2 px-3">String</td><td className="py-2 px-3">E-mail de contato cadastrado.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">ultimaCompetencia.linksDiretos</td><td className="py-2 px-3">Object</td><td className="py-2 px-3">URLs diretas para resumo, PDF demonstrativo e PDF comprovante.</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 text-sky-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                <pre>{`curl -X GET "${baseUrl}/cooperados/25930187800/resumo" \\
  -H "Authorization: Bearer sic_live_..."`}</pre>
              </div>
            </div>

            {/* ENDPOINT 3: LISTA DE FOLHAS DE PAGAMENTO */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">GET</span>
                <span className="font-mono text-sm font-bold text-slate-900">/api/v1/cooperados/{`{CPF}`}/folhas</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Retorna **todas as folhas de pagamento de todas as competências** registradas no SIC para o cooperado.
              </p>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Campo Retornado</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descrição do Campo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">folhas[].payrollId</td><td className="py-2 px-3">UUID String</td><td className="py-2 px-3">ID único do holerite (usado nas consultas de PDF).</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">folhas[].competencia</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Competência no formato AAAA-MM (ex: 2026-07).</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">folhas[].tipoFolha</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Tipo ('Regular', 'Complementar').</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">folhas[].status</td><td className="py-2 px-3">String</td><td className="py-2 px-3">Status ('Processado', 'Pago').</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">folhas[].dataPagamento</td><td className="py-2 px-3">Date/String</td><td className="py-2 px-3">Data efetiva de depósito.</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 text-sky-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                <pre>{`curl -X GET "${baseUrl}/cooperados/25930187800/folhas" \\
  -H "Authorization: Bearer sic_live_..."`}</pre>
              </div>
            </div>

            {/* ENDPOINT 4: RESUMO FINANCEIRO DE UMA FOLHA */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">GET</span>
                <span className="font-mono text-sm font-bold text-slate-900">/api/v1/cooperados/{`{CPF}`}/folhas/{`{PAYROLL_ID}`}/resumo-financeiro</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Retorna os detalhes estruturados da folha de pagamento (Valor Bruto, Descontos, Valor Líquido e Rubricas).
              </p>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Campo Retornado</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descrição Financeira</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">valorBruto</td><td className="py-2 px-3">Number</td><td className="py-2 px-3">Valor total da produção bruta em Reais (R$).</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">totalDescontos</td><td className="py-2 px-3">Number</td><td className="py-2 px-3">Somatório de descontos (tributos, INSS, IRRF).</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">valorLiquido</td><td className="py-2 px-3">Number</td><td className="py-2 px-3">Valor líquido repassado ao cooperado.</td></tr>
                    <tr><td className="py-2 px-3 font-mono text-sky-700 font-bold">rubricas[]</td><td className="py-2 px-3">Array</td><td className="py-2 px-3">Descrição, tipo ('PROVENTO'/'DESCONTO') e valor.</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 text-sky-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                <pre>{`curl -X GET "${baseUrl}/cooperados/25930187800/folhas/019fa3aa-25fc-7410-9168-af6328aa44df/resumo-financeiro" \\
  -H "Authorization: Bearer sic_live_..."`}</pre>
              </div>
            </div>

            {/* ENDPOINTS 5 E 6: DOWNLOADS DE PDF */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">GET</span>
                <span className="font-mono text-sm font-bold text-slate-900">/api/v1/cooperados/{`{CPF}`}/folhas/{`{PAYROLL_ID}`}/demonstrativo</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">GET</span>
                <span className="font-mono text-sm font-bold text-slate-900">/api/v1/cooperados/{`{CPF}`}/folhas/{`{PAYROLL_ID}`}/comprovante</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Transmite o arquivo PDF original oficial do SIC (`application/pdf`) em fluxo de dados binários.
              </p>

              <div className="bg-slate-900 text-sky-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                <pre>{`curl -X GET "${baseUrl}/cooperados/25930187800/folhas/019fa3aa-25fc-7410-9168-af6328aa44df/demonstrativo" \\
  -H "Authorization: Bearer sic_live_..." \\
  --output demonstrativo.pdf`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
