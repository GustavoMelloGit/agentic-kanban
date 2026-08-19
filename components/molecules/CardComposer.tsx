"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Column, Project } from "@/lib/config";

// Compositor no formato do card, dentro da própria coluna: quem escreve já vê
// onde o card vai cair. Enter cria e mantém o campo aberto pro próximo (entrada
// em sequência), Esc fecha.
export default function CardComposer({
  column,
  projects,
  projectId,
  onProjectChange,
  value,
  onChange,
  onSubmit,
  onCancel,
  ocupado,
}: {
  column: Column;
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  value: string;
  onChange: (texto: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  ocupado: boolean;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const compositor = useRef<HTMLDivElement>(null);
  const seletorAberto = useRef(false);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  // Cresce com o texto em vez de rolar: título longo fica legível inteiro,
  // como no card que ele vai virar.
  useEffect(() => {
    const area = campo.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [value]);

  // Fecha sozinho quando não há nada escrito e o clique cai fora do compositor;
  // com texto digitado ficar aberto é o comportamento seguro — nada pode comer
  // o que o usuário escreveu. Fechar por blur do título não serve: o seletor de
  // projeto rouba o foco do campo, e escolher o projeto antes de digitar o
  // título derrubava o compositor inteiro.
  useEffect(() => {
    const aoApontar = (evento: PointerEvent) => {
      if (seletorAberto.current) return;
      if (compositor.current?.contains(evento.target as Node)) return;
      if (!value.trim()) onCancel();
    };
    document.addEventListener("pointerdown", aoApontar);
    return () => document.removeEventListener("pointerdown", aoApontar);
  }, [value, onCancel]);

  const rodaAgente = column.type !== "manual";

  return (
    <div
      ref={compositor}
      // o conteúdo do seletor mora num portal fora desta árvore no DOM, então
      // Esc que só fecha a lista de projetos não chega aqui como se fosse do
      // compositor
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        if (!compositor.current?.contains(evento.target as Node)) return;
        evento.preventDefault();
        onCancel();
      }}
      className="bg-surface-2 border-primary mt-2 rounded-md border p-3 shadow-md"
    >
      <textarea
        ref={campo}
        rows={1}
        aria-label={`Título do novo card em ${column.name}`}
        placeholder="Título do card…"
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" && !evento.shiftKey) {
            evento.preventDefault();
            onSubmit();
          }
        }}
        className="placeholder:text-faint w-full resize-none bg-transparent font-semibold leading-snug outline-none"
      />

      {/* sempre visível, mesmo com um projeto só: é o projeto que decide qual
          CLI roda e em qual workspace, então o card não deve nascer sem que dê
          pra ver — e conferir — o destino */}
      <Select
        value={projectId}
        onValueChange={onProjectChange}
        onOpenChange={(aberto) => {
          seletorAberto.current = aberto;
        }}
      >
        <SelectTrigger aria-label="Projeto do novo card" className="mt-2 h-7 w-full text-xs">
          <SelectValue placeholder="Escolha o projeto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((projeto) => (
            <SelectItem key={projeto.id} value={projeto.id}>
              {projeto.name} · {projeto.tool}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          disabled={!value.trim() || ocupado}
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={onSubmit}
          className="h-7 text-xs"
        >
          Adicionar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancelar
        </Button>
      </div>

      <p className="text-faint mt-2 text-[11px]">
        {rodaAgente
          ? "Enter cria — o agente desta coluna começa na hora."
          : "Enter cria · Esc fecha"}
      </p>
    </div>
  );
}
