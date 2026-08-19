"use client";

import Icon from "@/components/atoms/Icon";
import CardActions from "@/components/molecules/CardActions";
import CardMeta from "@/components/molecules/CardMeta";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Card, Column, Project } from "@/lib/config";
import { podeDispararAgente } from "@/lib/disparo";
import { useTextoCortado } from "@/lib/ui/use-texto-cortado";

export default function KanbanCard({
  card,
  column,
  project,
  cancelando,
  onOpen,
  onRemove,
  onCancel,
  onRun,
  onDragStart,
}: {
  card: Card;
  column: Column;
  project?: Project;
  cancelando: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onRun: () => void;
  onDragStart: () => void;
}) {
  const { medirTexto: medirTitulo, cortado: tituloCortado } = useTextoCortado(card.title);

  /* botão de verdade em vez de clique no container: o card tem controles
     dentro, então role="button" nele seria ARIA inválido e o teclado ficaria
     sem como abrir o drawer */
  const botaoDoTitulo = (
    <button
      ref={medirTitulo}
      className="hover:text-brand-text line-clamp-2 min-w-0 text-left leading-snug font-semibold break-words"
      onClick={(evento) => {
        evento.stopPropagation();
        onOpen();
      }}
    >
      {card.title}
    </button>
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="bg-surface-2 hover:border-border-strong group mt-2 cursor-grab rounded-md border p-3 shadow-xs transition-[border-color,box-shadow] duration-150 ease-(--ease-board) hover:shadow-md active:cursor-grabbing"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        {/* o Tooltip inteiro sai da árvore quando não há corte: esconder só o
            conteúdo deixaria o Root sem quem fecha no pointerleave, e o botão
            ficaria preso em delayed-open com aria-describedby apontando pra um
            balão que nunca montou */}
        {tituloCortado ? (
          <Tooltip>
            <TooltipTrigger asChild>{botaoDoTitulo}</TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-64">
              {card.title}
            </TooltipContent>
          </Tooltip>
        ) : (
          botaoDoTitulo
        )}
        {/* some por opacidade, não por display: o alvo existe sempre, senão o
            teclado não alcança */}
        <Button
          variant="ghost"
          size="icon"
          title="Excluir card"
          aria-label={`Excluir ${card.title}`}
          onClick={(evento) => {
            evento.stopPropagation();
            onRemove();
          }}
          className="text-faint hover:text-danger size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-transparent focus-visible:opacity-100"
        >
          <Icon name="fechar" size="md" />
        </Button>
      </div>

      {/* prévia de três linhas: quem quer o requisito inteiro abre o card, onde
          ele já está completo e editável. Um "ver mais" aqui traria de volta o
          card-parede que o corte existe pra evitar. */}
      {card.description && (
        <p className="text-muted-foreground line-clamp-3 text-xs break-words whitespace-pre-wrap">
          {card.description}
        </p>
      )}

      <CardMeta card={card} project={project} />

      <div onClick={(evento) => evento.stopPropagation()}>
        <CardActions
          rodando={card.status === "running"}
          cancelando={cancelando}
          podeRedisparar={podeDispararAgente(column, card.messages)}
          onCancel={onCancel}
          onRun={onRun}
        />
      </div>
    </div>
  );
}
