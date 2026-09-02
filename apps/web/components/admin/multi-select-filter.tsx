"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "Todos",
  allLabel = "Todos",
  emptyMessage = "Nenhuma opção disponível",
  disabled = false,
  className = "",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const availableValues = useMemo(() => new Set(options.map((option) => option.value)), [options]);
  const selected = useMemo(
    () => value.filter((item, index) => availableValues.has(item) && value.indexOf(item) === index),
    [availableValues, value]
  );
  const selectedKey = selected.join("\u0000");
  const valueKey = value.join("\u0000");

  useEffect(() => {
    if (selectedKey !== valueKey) onChange(selected);
  }, [onChange, selectedKey, valueKey]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === options.length
        ? allLabel
        : selected.length === 1
          ? (options.find((option) => option.value === selected[0])?.label ?? placeholder)
          : `${selected.length} selecionados`;
  const enabledValues = options.filter((option) => !option.disabled).map((option) => option.value);
  const allSelected =
    enabledValues.length > 0 && enabledValues.every((item) => selected.includes(item));

  function toggle(option: MultiSelectOption) {
    if (option.disabled) return;
    onChange(
      selected.includes(option.value)
        ? selected.filter((item) => item !== option.value)
        : [...selected, option.value]
    );
  }

  return (
    <div className={`relative min-w-0 ${className}`} ref={rootRef}>
      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${summary}`}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="truncate">{options.length === 0 ? emptyMessage : summary}</span>
        <span aria-hidden="true" className="text-xs text-slate-500">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div
          aria-label={label}
          className="absolute z-30 mt-1 max-h-72 w-full min-w-56 overflow-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg"
          id={listId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
          role="listbox"
          tabIndex={-1}
        >
          <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500">{label}</span>
            <button
              className="text-xs font-semibold text-slate-700 disabled:text-slate-300"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
              type="button"
            >
              Limpar
            </button>
          </div>
          <label
            aria-selected={allSelected}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm font-semibold hover:bg-slate-50"
            role="option"
          >
            <input
              checked={allSelected}
              onChange={() => onChange(allSelected ? [] : enabledValues)}
              type="checkbox"
            />
            <span>Selecionar todos</span>
          </label>
          <div className="my-1 border-t border-slate-100" />
          {options.map((option) => (
            <label
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-50 ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              key={option.value}
              role="option"
              aria-selected={selected.includes(option.value)}
            >
              <input
                checked={selected.includes(option.value)}
                disabled={option.disabled}
                onChange={() => toggle(option)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
