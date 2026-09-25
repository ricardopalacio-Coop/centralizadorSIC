import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Combo de múltipla escolha com pesquisa, para filtros de cabeçalho de tabela.
 * O painel usa posição fixa para não ser cortado pelo overflow da tabela.
 */
export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  options,
  selected,
  onChange,
  placeholder = "Todos",
  searchPlaceholder = "Pesquisar...",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(o.label).includes(q)) : options;
  }, [options, query]);

  const openPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    // Fecha ao rolar a página (o painel é fixo), mas não ao rolar a própria lista
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const toggle = (value: string) =>
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedSet.has(o.value));
  const toggleAllFiltered = () => {
    const values = filtered.map((o) => o.value);
    onChange(
      allFilteredSelected
        ? selected.filter((v) => !values.includes(v))
        : [...selected, ...values.filter((v) => !selectedSet.has(v))]
    );
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selecionados`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`w-full min-w-[150px] px-2.5 py-1.5 rounded-lg bg-white border text-[11px] font-medium flex items-center justify-between gap-1.5 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 ${
          selected.length ? "border-sky-500 text-[#005487]" : "border-slate-300 text-slate-400"
        }`}
      >
        <span className="truncate text-left">{label}</span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <X
              className="h-3 w-3 text-slate-400 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 bg-white rounded-xl border border-slate-200 shadow-lg normal-case tracking-normal font-medium text-slate-700 overflow-hidden"
        >
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-[11px] focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 text-[11px]">
            <button type="button" onClick={toggleAllFiltered} disabled={!filtered.length} className="font-semibold text-[#005487] hover:underline disabled:opacity-40">
              {allFilteredSelected ? "Desmarcar todos" : query ? "Marcar resultados" : "Marcar todos"}
            </button>
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="font-semibold text-slate-500 hover:text-slate-800">
                Limpar ({selected.length})
              </button>
            )}
          </div>

          <ul className="max-h-72 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[11px] text-slate-400">Nenhum resultado</li>
            ) : (
              filtered.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={checked}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-[11px] hover:bg-sky-50 ${checked ? "text-[#005487] font-semibold" : ""}`}
                    >
                      <span
                        className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                          checked ? "bg-[#005487] border-[#005487]" : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 truncate" title={o.label}>{o.label}</span>
                      {o.count !== undefined && (
                        <span className="text-[10px] text-slate-400 tabular-nums">{o.count.toLocaleString("pt-BR")}</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </>
  );
};
