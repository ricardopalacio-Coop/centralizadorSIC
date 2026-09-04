export interface PayrollItem {
  payrollId: string;
  contractId: string;
  month: number;
  year: number;
  competence: string;
  payrollType: string;
  payrollStatus: string;
  contractDescription?: string;
  clientName?: string;
  payDayTime?: string;
}

export interface RegistrationItem {
  id?: string | number;
  registration?: string;
  status?: string;
  profession?: string;
  createdTime?: string;
}

export interface AuditLogItem {
  id: string | number;
  isToday?: boolean;
  actionRaw?: string;
  actionTitle?: string;
  moduleName?: string;
  formattedDate?: string;
  timeStr?: string;
  detailsSummary?: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface ProductivityRecord {
  id: string | number;
  date?: string;
  competence?: string;
  description?: string;
  workedTimeFormatted?: string;
  amountOrHours?: string;
  status?: string;
}

export interface AppData {
  worked_time_today?: string;
  total_worked_time?: string;
  todayWorkedTimeFormatted?: string;
  lastAccess?: {
    date?: string;
    page?: string;
    action?: string;
    deviceInfo?: string;
    ipAddress?: string;
  };
  periodProductivity?: {
    today?: number;
    last7Days?: number;
    last30Days?: number;
    totalHistory?: number;
  };
  productivityRecords?: ProductivityRecord[];
  auditLogs?: AuditLogItem[];
}

export interface CooperadoProfileViewProps {
  cooperadoCpf: string;
  onOpenPdf: (cpf: string, payrollId: string, competence: string, docType?: "demonstrativo" | "comprovante") => void;
  onClose?: () => void;
  variant?: "inline" | "modal";
}
