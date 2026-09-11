import React from "react";
import { Scissors } from "lucide-react";

export interface RubricaItem {
  codigo?: string | number;
  descricao: string;
  referencia?: string;
  tipo?: "C" | "D" | string;
  valor?: number;
  vencimento_atual?: number | null;
  vencimento_acumulado?: number | null;
  desconto_atual?: number | null;
  desconto_acumulado?: number | null;
}

export interface DemonstrativoProdutividadeCardProps {
  folha: {
    ano: number;
    mes: number;
    folha?: number;
    competencia_str?: string;
    competencia_rotulo?: string;
    tomador?: string;
    cooperativa?: {
      razao_social: string;
      cnpj: string;
      endereco: string;
      cidade: string;
      uf: string;
      telefone: string;
    };
    cooperado: {
      nome: string;
      cpf: string;
      matricula: string | number;
      cargo: string;
      banco_sigla?: string;
      banco?: string;
      agencia?: string;
      agencia_digito?: string;
      conta?: string;
      conta_digito?: string;
    };
    itens?: RubricaItem[];
    proventos?: RubricaItem[];
    descontos?: RubricaItem[];
    totais?: {
      totalVencimentos?: number;
      totalDescontos?: number;
      totalProventos?: number;
      valorLiquido?: number;
    };
    bases_calculo?: {
      produtividade?: number;
      baseInss?: number;
      baseIrrf?: number;
      nroDepIrrf?: string | number;
      valorIrrfDep?: number;
    };
  };
}

/**
 * Formata valor para padrão decimal brasileiro sem R$ (ex: 651,00)
 */
function formatPtBr(val?: number | string | null): string {
  if (val === undefined || val === null || val === "") return "0,00";
  const n = Number(val);
  if (isNaN(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const DemonstrativoProdutividadeCard: React.FC<DemonstrativoProdutividadeCardProps> = ({ folha }) => {
  if (!folha) return null;

  const cooperativa = folha.cooperativa || {
    razao_social: "COOP TRAB PROF DA EDUCACAO DO ESTADO RIO G NORTE",
    cnpj: "35.537.126/0001-84",
    endereco: "RUA PROJETADA, N 1",
    cidade: "MONTE ALEGRE",
    uf: "RN",
    telefone: "(84) 98156-1479",
  };

  const cooperado = folha.cooperado || {
    nome: "COOPERADO",
    cpf: "000.000.000-00",
    matricula: "00002700",
    cargo: "ASG 20 HORAS",
    banco_sigla: "BB",
    agencia: "1140",
    agencia_digito: "",
    conta: "26725",
    conta_digito: "2",
  };

  const matricula = String(cooperado.matricula || "00002700").padStart(8, "0");
  const compRotulo = folha.competencia_rotulo || `${String(folha.mes).padStart(2, "0")} / ${folha.ano} - Folha : ${String(folha.folha || 1).padStart(2, "0")}`;

  // Itens normalizados
  let rubricas: RubricaItem[] = [];
  if (Array.isArray(folha.itens) && folha.itens.length > 0) {
    rubricas = folha.itens;
  } else {
    rubricas = [...(folha.proventos || []), ...(folha.descontos || [])];
  }

  // Garantir pelo menos 8 linhas para altura clássica do contracheque
  const minRows = Math.max(rubricas.length, 8);
  const displayRows: (RubricaItem | null)[] = [];
  for (let i = 0; i < minRows; i++) {
    displayRows.push(rubricas[i] || null);
  }

  const totalVenc = Number(folha.totais?.totalVencimentos ?? folha.totais?.totalProventos ?? 0);
  const totalDesc = Number(folha.totais?.totalDescontos ?? 0);
  const totalLiq = Number(folha.totais?.valorLiquido ?? (totalVenc - totalDesc));

  const baseProd = Number(folha.bases_calculo?.produtividade ?? totalVenc);
  const baseInss = Number(folha.bases_calculo?.baseInss ?? baseProd);
  const baseIrrf = Number(folha.bases_calculo?.baseIrrf ?? Math.max(0, baseInss - totalDesc));
  const nroDep = String(folha.bases_calculo?.nroDepIrrf ?? "00");
  const vlrDep = Number(folha.bases_calculo?.valorIrrfDep ?? 0);

  return (
    <div className="w-full max-w-5xl mx-auto my-4 text-slate-900 select-none overflow-x-auto">
      {/* MOLDURA PRINCIPAL DO CONTRACHEQUE (ESTILO IMAGEM 2) */}
      <div className="min-w-[820px] bg-white border-2 border-black font-sans text-xs shadow-sm">
        {/* 1. CABEÇALHO SUPERIOR */}
        <div className="p-3 border-b-2 border-black">
          <div className="text-right font-black uppercase tracking-wider text-[11px] mb-1">
            DEMONSTRATIVO DE PRODUTIVIDADE
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-extrabold text-[13px] uppercase tracking-tight">
                {cooperativa.razao_social}
              </div>
              <div className="flex items-center space-x-6 text-[11px] mt-0.5 text-slate-800">
                <span>{cooperativa.endereco}</span>
                <span className="font-semibold">{cooperativa.cidade}</span>
              </div>
            </div>
            <div className="text-right text-[11px]">
              <div className="font-semibold">C.N.P.J {cooperativa.cnpj}</div>
              <div className="text-slate-800 mt-0.5">{cooperativa.uf} {cooperativa.telefone}</div>
            </div>
          </div>
        </div>

        {/* 2. IDENTIFICAÇÃO DO COOPERADO */}
        <div className="border-b-2 border-black">
          {/* Linha 1 */}
          <div className="flex border-b border-black">
            <div className="w-28 border-r border-black p-1.5">
              <span className="text-[9px] block text-slate-600 font-medium">Matrícula</span>
              <span className="font-bold text-[12px] font-mono">{matricula}</span>
            </div>
            <div className="flex-1 border-r border-black p-1.5">
              <span className="text-[9px] block text-slate-600 font-medium">Nome do Associado - Cooperado</span>
              <span className="font-extrabold text-[12px] uppercase">{cooperado.nome}</span>
            </div>
            <div className="w-72 p-1.5">
              <span className="text-[9px] block text-slate-600 font-medium">Atividade Profissional</span>
              <span className="font-bold text-[11px] uppercase truncate block">{cooperado.cargo}</span>
            </div>
          </div>

          {/* Linha 2 */}
          <div className="flex">
            <div className="flex-1 border-r border-black p-1.5 text-slate-500 text-[10px] flex items-center">
              {folha.tomador && (
                <span>Tomador / Contrato: <strong className="text-slate-800">{folha.tomador}</strong></span>
              )}
            </div>
            <div className="w-40 border-r border-black p-1.5">
              <span className="text-[9px] block text-slate-600 font-medium">CPF</span>
              <span className="font-bold text-[11px] font-mono">{cooperado.cpf}</span>
            </div>
            <div className="w-52 p-1.5">
              <span className="text-[9px] block text-slate-600 font-medium">Competência</span>
              <span className="font-bold text-[11px] font-mono">{compRotulo}</span>
            </div>
          </div>
        </div>

        {/* 3. TABELA DE PRODUTIVIDADE E DESCONTOS */}
        <div className="border-b-2 border-black">
          {/* Cabeçalho da Tabela */}
          <div className="flex border-b border-black text-[10px] font-semibold bg-slate-50/50">
            <div className="w-14 border-r border-black p-1.5 flex items-center">Cód.</div>
            <div className="flex-1 border-r border-black p-1.5 flex items-center">Descrição da Produtividade</div>
            <div className="w-24 border-r border-black p-1.5 text-right flex items-center justify-end">Referência</div>
            
            {/* Bloco Vencimentos */}
            <div className="w-56 border-r border-black">
              <div className="text-center border-b border-black py-0.5 font-bold">Vencimentos</div>
              <div className="flex text-[9px]">
                <div className="w-28 text-right pr-2 py-0.5 border-r border-black">Atual</div>
                <div className="w-28 text-right pr-2 py-0.5">Acumulado</div>
              </div>
            </div>

            {/* Bloco Descontos */}
            <div className="w-56">
              <div className="text-center border-b border-black py-0.5 font-bold">Descontos</div>
              <div className="flex text-[9px]">
                <div className="w-28 text-right pr-2 py-0.5 border-r border-black">Atual</div>
                <div className="w-28 text-right pr-2 py-0.5">Acumulado</div>
              </div>
            </div>
          </div>

          {/* Linhas de Dados */}
          <div className="divide-y divide-slate-100 font-mono text-[11px]">
            {displayRows.map((it, idx) => {
              if (!it) {
                return (
                  <div key={`empty-${idx}`} className="flex h-6">
                    <div className="w-14 border-r border-black" />
                    <div className="flex-1 border-r border-black" />
                    <div className="w-24 border-r border-black" />
                    <div className="w-56 border-r border-black flex">
                      <div className="w-28 border-r border-black" />
                      <div className="w-28" />
                    </div>
                    <div className="w-56 flex">
                      <div className="w-28 border-r border-black" />
                      <div className="w-28" />
                    </div>
                  </div>
                );
              }

              const isDesconto = it.tipo === "D" || String(it.tipo).toUpperCase() === "D";
              const codStr = it.codigo ? String(it.codigo).padStart(4, "0") : (isDesconto ? "0200" : "0100");
              const refStr = it.referencia || (codStr === "0200" || it.descricao.includes("INSS") ? "0,00" : "1,00");
              const valFormatted = formatPtBr(it.valor);

              return (
                <div key={`item-${idx}`} className="flex h-6 items-center hover:bg-slate-50/70 transition-colors">
                  <div className="w-14 border-r border-black px-1.5 text-slate-700">{codStr}</div>
                  <div className="flex-1 border-r border-black px-1.5 font-sans font-medium uppercase truncate">
                    {it.descricao}
                  </div>
                  <div className="w-24 border-r border-black px-1.5 text-right text-slate-700">{refStr}</div>

                  {/* Vencimentos */}
                  <div className="w-56 border-r border-black flex h-full items-center">
                    <div className="w-28 border-r border-black px-2 text-right">
                      {!isDesconto ? valFormatted : ""}
                    </div>
                    <div className="w-28 px-2 text-right">
                      {!isDesconto ? valFormatted : ""}
                    </div>
                  </div>

                  {/* Descontos */}
                  <div className="w-56 flex h-full items-center">
                    <div className="w-28 border-r border-black px-2 text-right">
                      {isDesconto ? valFormatted : ""}
                    </div>
                    <div className="w-28 px-2 text-right">
                      {isDesconto ? valFormatted : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. DADOS BANCÁRIOS E TOTAIS (VENCIMENTOS / DESCONTOS) */}
        <div className="flex border-b-2 border-black">
          {/* Células Bancárias */}
          <div className="flex-1 flex text-[10px]">
            <div className="w-24 border-r border-black p-1.5">
              <span className="text-slate-600 block text-[9px]">Banco :</span>
              <strong className="font-bold text-[11px] uppercase">{cooperado.banco_sigla || "BB"}</strong>
            </div>
            <div className="w-28 border-r border-black p-1.5">
              <span className="text-slate-600 block text-[9px]">Agência :</span>
              <strong className="font-bold text-[11px] font-mono">{cooperado.agencia || "1140"}</strong>
            </div>
            <div className="w-14 border-r border-black p-1.5">
              <span className="text-slate-600 block text-[9px]">Díg.</span>
              <strong className="font-bold text-[11px] font-mono">{cooperado.agencia_digito || ""}</strong>
            </div>
            <div className="w-28 border-r border-black p-1.5">
              <span className="text-slate-600 block text-[9px]">Conta :</span>
              <strong className="font-bold text-[11px] font-mono">{cooperado.conta || "26725"}</strong>
            </div>
            <div className="w-14 border-r border-black p-1.5">
              <span className="text-slate-600 block text-[9px]">Díg.</span>
              <strong className="font-bold text-[11px] font-mono">{cooperado.conta_digito || "2"}</strong>
            </div>
          </div>

          {/* Totais de Vencimentos e Descontos */}
          <div className="w-56 border-l-2 border-black border-r border-black p-1.5 text-right">
            <span className="text-[9px] block text-slate-600 font-bold">Total de Vencimentos</span>
            <span className="font-black text-[13px] font-mono">{formatPtBr(totalVenc)}</span>
          </div>
          <div className="w-56 p-1.5 text-right">
            <span className="text-[9px] block text-slate-600 font-bold">Total de Descontos</span>
            <span className="font-black text-[13px] font-mono">{formatPtBr(totalDesc)}</span>
          </div>
        </div>

        {/* 5. BASES FISCAIS E TOTAL LÍQUIDO ==> */}
        <div className="flex border-b-2 border-black items-center">
          <div className="flex-1 flex text-[10px]">
            <div className="flex-1 border-r border-black p-1.5 text-right">
              <span className="text-[9px] block text-slate-600">Produtividade</span>
              <span className="font-bold font-mono text-[11px]">{formatPtBr(baseProd)}</span>
            </div>
            <div className="flex-1 border-r border-black p-1.5 text-right">
              <span className="text-[9px] block text-slate-600">Base Cálc. IRRF</span>
              <span className="font-bold font-mono text-[11px]">{formatPtBr(baseIrrf)}</span>
            </div>
            <div className="w-24 border-r border-black p-1.5 text-center">
              <span className="text-[9px] block text-slate-600">Nro. Dep. IRRF</span>
              <span className="font-bold font-mono text-[11px]">{nroDep}</span>
            </div>
            <div className="flex-1 border-r border-black p-1.5 text-right">
              <span className="text-[9px] block text-slate-600">Valor IRRF/Dep.</span>
              <span className="font-bold font-mono text-[11px]">{formatPtBr(vlrDep)}</span>
            </div>
            <div className="flex-1 border-r-2 border-black p-1.5 text-right">
              <span className="text-[9px] block text-slate-600">Base Cálc. INSS</span>
              <span className="font-bold font-mono text-[11px]">{formatPtBr(baseInss)}</span>
            </div>
          </div>

          {/* Total Líquido em Destaque */}
          <div className="w-[28rem] px-4 py-2 flex items-center justify-between">
            <span className="font-extrabold text-[12px] tracking-tight">TOTAL LÍQUIDO ==&gt;</span>
            <span className="font-black text-[17px] font-mono tracking-tight">{formatPtBr(totalLiq)}</span>
          </div>
        </div>

        {/* 6. CANHOTO DE QUITAÇÃO E ASSINATURA */}
        <div className="flex text-[10px]">
          <div className="flex-1 p-2 border-r border-black flex items-center justify-center text-slate-400 italic text-[10px]">
            Via do Cooperado
          </div>
          <div className="w-[36rem] p-2 space-y-3">
            <p className="text-[10px] text-slate-800 leading-tight">
              Declaro ter recebido a importância líquida acima descriminada, dando total quitação
            </p>
            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px]">
                Data : <span className="font-mono text-slate-400">_____/_____/_________</span>
              </div>
              <div className="text-[10px] flex-1 max-w-[20rem] text-right">
                Assinatura : <span className="text-slate-400">__________________________________________</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. LINHA DE PICOTE COM ÍCONE DE TESOURA ✂ */}
      <div className="min-w-[820px] flex items-center space-x-2 my-3 text-slate-400 text-xs">
        <Scissors className="h-3.5 w-3.5 transform -rotate-90 text-slate-600" />
        <div className="flex-1 border-b border-dashed border-slate-400" />
      </div>
    </div>
  );
};
