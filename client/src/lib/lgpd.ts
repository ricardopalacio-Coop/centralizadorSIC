/**
 * Máscara LGPD na exibição. O servidor já mascara os demais dados pessoais;
 * o CPF chega íntegro porque é a chave de busca, então é mascarado aqui ao exibir.
 * O AuthContext liga a máscara quando a LGPD está ativa e o usuário não é SuperAdmin.
 */
let mascararAtivo = false;

export const definirMascaraLgpd = (ativo: boolean) => {
  mascararAtivo = ativo;
};

/** Recebe o CPF já formatado para exibição e oculta os dígitos iniciais e finais. */
export const exibirCpf = (formatado: string) => {
  if (!mascararAtivo) return formatado;
  const d = String(formatado || "").replace(/\D/g, "");
  if (d.length !== 11) return formatado;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};
