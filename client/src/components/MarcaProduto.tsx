import React from "react";

/**
 * Marca do produto (abaixo da marca-mae SiC).
 *
 * PROVISORIA: enquanto nao existir o PNG oficial em /logo-centralizador.png
 * (transparente, proporcao 3:1, primeira metade #0c2856 e segunda #0060e0),
 * mostramos a marca em texto com a mesma divisao de cores. Serve para
 * desenvolver e nao substitui o arquivo oficial na publicacao.
 *
 * Para trocar: coloque o arquivo em client/public/ e mude USA_ARQUIVO para true.
 */
const USA_ARQUIVO = false;
const CAMINHO = "/logo-centralizador.png";

interface MarcaProdutoProps {
  /** Altura da marca em pixels (sidebar usa 43, tela de entrada usa 60). */
  altura?: number;
  className?: string;
}

export const MarcaProduto: React.FC<MarcaProdutoProps> = ({ altura = 43, className = "" }) => {
  if (USA_ARQUIVO) {
    return (
      <img
        src={CAMINHO}
        alt="Centralizador"
        className={`object-contain ${className}`}
        style={{ height: altura }}
      />
    );
  }

  return (
    <span
      className={`font-extrabold tracking-tight leading-none select-none ${className}`}
      style={{ fontSize: altura * 0.52 }}
      aria-label="Centralizador"
    >
      <span style={{ color: "#0c2856" }}>Central</span>
      <span style={{ color: "#0060e0" }}>izador</span>
    </span>
  );
};
