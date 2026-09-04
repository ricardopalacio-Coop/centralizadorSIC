import React from "react";
import { Phone, Edit2, Check, Save, Loader2 } from "lucide-react";

interface ContactsSectionProps {
  celular: string;
  email: string;
  birthDate: string;
  isEditingContacts: boolean;
  setIsEditingContacts: (editing: boolean) => void;
  editWhatsapp: string;
  setEditWhatsapp: (val: string) => void;
  editEmail: string;
  setEditEmail: (val: string) => void;
  editBirthDate: string;
  setEditBirthDate: (val: string) => void;
  saveLoading: boolean;
  saveSuccess: string;
  handleSaveContacts: (e: React.FormEvent) => Promise<void>;
}

export const ContactsSection: React.FC<ContactsSectionProps> = ({
  celular,
  email,
  birthDate,
  isEditingContacts,
  setIsEditingContacts,
  editWhatsapp,
  setEditWhatsapp,
  editEmail,
  setEditEmail,
  editBirthDate,
  setEditBirthDate,
  saveLoading,
  saveSuccess,
  handleSaveContacts,
}) => {
  return (
    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Phone className="h-4 w-4 text-emerald-600" />
          Dados Cadastrais (WhatsApp, E-mail & Data de Nascimento)
        </span>

        {!isEditingContacts ? (
          <button
            onClick={() => setIsEditingContacts(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Editar Dados Cadastrais</span>
          </button>
        ) : (
          <button
            onClick={() => setIsEditingContacts(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all"
          >
            Cancelar Edição
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center space-x-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {!isEditingContacts ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-xs text-slate-500 font-semibold block">Celular / WhatsApp</span>
            <span
              className={`text-sm font-bold ${
                celular === "Vazio" ? "text-amber-600 italic font-medium" : "text-slate-900"
              }`}
            >
              {celular}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-xs text-slate-500 font-semibold block">E-mail de Contato</span>
            <span
              className={`text-sm font-bold ${
                email === "Vazio" ? "text-amber-600 italic font-medium" : "text-slate-900"
              }`}
            >
              {email}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-xs text-slate-500 font-semibold block">Data de Nascimento</span>
            <span className="text-sm font-bold text-slate-900">{birthDate}</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveContacts} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Número do WhatsApp / Celular
              </label>
              <input
                type="text"
                value={editWhatsapp}
                onChange={(e) => setEditWhatsapp(e.target.value)}
                placeholder="Digite o WhatsApp do cooperado"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                E-mail do Cooperado
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Digite o e-mail do cooperado"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="submit"
              disabled={saveLoading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Salvar Alterações de Contato</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
