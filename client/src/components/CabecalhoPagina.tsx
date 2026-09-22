import React from "react";

interface CabecalhoPaginaProps {
  /** Icone lucide da tela, em h-8 w-8 dentro do quadrado colorido. */
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao?: string;
  /**
   * O volume da tela: quantos registros, quantos arquivos, quantos resultados.
   * Aparece ao lado do titulo — quem abre a tela ja sabe o tamanho antes de ler.
   */
  contador?: React.ReactNode;
  /** Botoes de acao alinhados a direita. */
  acoes?: React.ReactNode;
}

/**
 * Cabecalho padrao das telas que rolam (Tipo A do padrao SiC / Coopedu).
 */
export const CabecalhoPagina: React.FC<CabecalhoPaginaProps> = ({
  icone: Icone,
  titulo,
  descricao,
  contador,
  acoes,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1.5">
          <div className="p-2.5 bg-blue-50 rounded-xl text-[#005487]">
            <Icone className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{titulo}</h1>
          {contador !== undefined && contador !== null && (
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-[#005487] border border-blue-200 whitespace-nowrap">
              {contador}
            </span>
          )}
        </div>
        {descricao && <p className="text-slate-500 text-lg">{descricao}</p>}
      </div>

      {acoes && <div className="flex items-center gap-2 flex-wrap shrink-0 md:pt-2">{acoes}</div>}
    </div>
  );
};

export default CabecalhoPagina;
