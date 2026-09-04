import React from "react";
import { CooperadoProfileView } from "./cooperado/CooperadoProfileView";

interface InlineCooperadoViewProps {
  cooperadoCpf: string;
  onOpenPdf: (cpf: string, payrollId: string, competence: string, docType?: "demonstrativo" | "comprovante") => void;
}

export const InlineCooperadoView: React.FC<InlineCooperadoViewProps> = ({
  cooperadoCpf,
  onOpenPdf,
}) => {
  return (
    <CooperadoProfileView
      cooperadoCpf={cooperadoCpf}
      onOpenPdf={onOpenPdf}
      variant="inline"
    />
  );
};
