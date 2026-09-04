import React from "react";
import { CooperadoProfileView } from "./cooperado/CooperadoProfileView";

interface CooperadoDetailsProps {
  cooperadoCpf: string;
  onClose: () => void;
  onOpenPdf: (cpf: string, payrollId: string, competence: string, docType?: "demonstrativo" | "comprovante") => void;
}

export const CooperadoDetails: React.FC<CooperadoDetailsProps> = ({
  cooperadoCpf,
  onClose,
  onOpenPdf,
}) => {
  return (
    <CooperadoProfileView
      cooperadoCpf={cooperadoCpf}
      onOpenPdf={onOpenPdf}
      onClose={onClose}
      variant="modal"
    />
  );
};
