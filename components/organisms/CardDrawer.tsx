"use client";

import { useState } from "react";
import Icon from "@/components/atoms/Icon";
import ChatComposer from "@/components/molecules/ChatComposer";
import CardAttachments from "@/components/organisms/CardAttachments";
import ChatThread from "@/components/organisms/ChatThread";
import RunHistory from "@/components/organisms/RunHistory";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import type { Card, Column } from "@/lib/config";
import { mensagensParaContexto } from "@/lib/contexto";
import { podeDispararAgente } from "@/lib/disparo";
import { cn } from "@/lib/ui/utils";

// Painel lateral, não modal: o board segue visível e utilizável atrás dele, e
// por isso é <aside> em vez de role="dialog".
export default function CardDrawer({
  card,
  column,
  columns,
  cancelando,
  chatInput,
  onChatInputChange,
  chatArquivos,
  erroDoAnexoDoChat,
  onAnexarNoChat,
  onRemoverAnexoDoChat,
  erroDoAnexoDoCard,
  anexandoNoCard,
  removendoAnexoId,
  onAnexarNoCard,
  onRemoverAnexoDoCard,
  draft,
  suja,
  salvando,
  erroDaEdicao,
  onDraftChange,
  onSalvar,
  onDescartar,
  onClose,
  onCancel,
  onRemove,
  onRun,
  onSendChat,
}: {
  card: Card;
  column?: Column;
  columns: Column[];
  cancelando: boolean;
  chatInput: string;
  onChatInputChange: (texto: string) => void;
  chatArquivos: File[];
  erroDoAnexoDoChat: string | null;
  onAnexarNoChat: (arquivos: File[]) => void;
  onRemoverAnexoDoChat: (indice: number) => void;
  erroDoAnexoDoCard: string | null;
  anexandoNoCard: boolean;
  removendoAnexoId: string | null;
  onAnexarNoCard: (arquivos: File[]) => void;
  onRemoverAnexoDoCard: (id: string) => void;
  draft: Pick<Card, "title" | "description">;
  suja: boolean;
  salvando: boolean;
  erroDaEdicao: string | null;
  onDraftChange: (patch: Partial<Pick<Card, "title" | "description">>) => void;
  onSalvar: () => void;
  onDescartar: () => void;
  onClose: () => void;
  onCancel: (confirmar: boolean) => void;
  onRemove: () => void;
  onRun: () => void;
  onSendChat: () => void;
}) {
  const [arquivoAberto, setArquivoAberto] = useState(false);
  const rodando = card.status === "running";
  const ehChat = !!column?.chat;
  // O detalhe é onde se lê o erro da execução, então é onde precisa dar pra
  // rodar de novo — o mini-card sozinho obrigava a fechar o drawer pra agir.
  const podeRedisparar = podeDispararAgente(column, card.messages) && !rodando;
  // Thread só com marcador de cancelamento ou com uma resposta que falhou é
  // conversa que nunca começou — é o que o agente enxerga no prompt, então é o
  // que o placeholder deve refletir.
  const conversaReal = mensagensParaContexto(card.messages);
  // Coluna de chat manual não dispara agente na chegada: quem abre a conversa é
  // o humano. A branch é condicional porque o card pode ter pulado Development.
  const placeholderDaConversa =
    column?.type === "manual"
      ? "Pergunte sobre a implementação ou peça uma mudança — o agente lê a branch do card, quando houver uma."
      : "A conversa começa quando o card chega aqui.";

  return (
    // 640px e não 560: o output do agente vem cheio de nome de branch e URL de
    // PR, que em 560 quebravam no meio do identificador.
    // flex-col + overflow-hidden: quem rola é a região de dentro, senão o
    // scroller do chat não teria altura pra trabalhar.
    <aside
      aria-label={`Detalhes do card ${card.title}`}
      className="bg-surface fixed top-(--header-h) right-0 z-10 flex h-[calc(100vh-var(--header-h))] w-160 max-w-[92vw] flex-col overflow-hidden border-l p-6 shadow-2xl"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Fechar detalhes do card"
        onClick={onClose}
        className="absolute top-3 right-4"
      >
        <Icon name="fechar" size="lg" />
      </Button>

      <div
        className={cn(
          "shrink-0",
          // num card de chat o histórico é raro (só se o card voltou de uma
          // coluna de execução); quando existe, ele cede espaço pra conversa
          ehChat && card.history.length > 0 && "max-h-[40%] overflow-y-auto",
        )}
      >
        {/* mt-6 desce os campos pra baixo do botão "fechar", que é absoluto no
            canto e passaria por cima da borda do primeiro deles */}
        <div className="mt-6 flex flex-col gap-2">
          <Input
            aria-label="Título do card"
            value={draft.title}
            onChange={(evento) => onDraftChange({ title: evento.target.value })}
            disabled={rodando || salvando}
            className="text-base font-semibold tracking-[-0.01em]"
          />
          <textarea
            aria-label="Descrição do card"
            placeholder="Descrição — é o que o agente de desenvolvimento recebe como requisito."
            rows={5}
            value={draft.description}
            onChange={(evento) =>
              onDraftChange({ description: evento.target.value })
            }
            disabled={rodando || salvando}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-[13px] shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          />

          {rodando && (
            <p className="text-muted-foreground text-xs">
              Um agente está atuando neste card — a edição volta quando ele
              terminar.
            </p>
          )}
          {erroDaEdicao && (
            <p
              role="alert"
              className="text-danger flex items-center gap-2 text-xs"
            >
              <Icon name="alerta" size="md" />
              {erroDaEdicao}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!suja || salvando || rodando}
              onClick={onSalvar}
            >
              {salvando ? "salvando…" : "Salvar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!suja || salvando}
              onClick={onDescartar}
            >
              Descartar
            </Button>
          </div>

          <Separator className="my-2" />

          <CardAttachments
            anexos={card.attachments}
            onAnexar={onAnexarNoCard}
            onRemover={onRemoverAnexoDoCard}
            erro={erroDoAnexoDoCard}
            enviando={anexandoNoCard}
            removendoId={removendoAnexoId}
          />
        </div>

        <div className="my-4 flex gap-2">
          {podeRedisparar && (
            <Button variant="outline" onClick={onRun}>
              <Icon name="recomecar" size="md" />
              Rodar agente de novo
            </Button>
          )}
          {!ehChat && rodando && (
            <Button
              variant="outline"
              disabled={cancelando}
              onClick={() => onCancel(true)}
              className="text-danger border-danger/25 hover:bg-danger/12 hover:text-danger"
            >
              <Icon name="cancelar" size="md" />
              {cancelando ? "cancelando…" : "Cancelar operação"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onRemove}
            className="text-danger border-danger/25 hover:bg-danger/12 hover:text-danger"
          >
            <Icon name="excluir" size="md" />
            Excluir card
          </Button>
        </div>

        {ehChat && card.history.length > 0 && (
          <RunHistory history={card.history} columns={columns} />
        )}
      </div>

      {/* fora do bloco que rola: a linha marca onde o histórico acaba e a
          conversa começa, e por isso não pode subir junto com o histórico */}
      {ehChat && card.history.length > 0 && <Separator className="my-4" />}

      {ehChat ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {card.messages.length === 0 && !rodando ? (
            <p className="text-muted-foreground text-xs">
              {placeholderDaConversa}
            </p>
          ) : (
            <ChatThread messages={card.messages} pensando={rodando} />
          )}
          <ChatComposer
            value={chatInput}
            onChange={onChatInputChange}
            onSubmit={onSendChat}
            onCancel={() => onCancel(false)}
            onAnexar={onAnexarNoChat}
            onRemoverAnexo={onRemoverAnexoDoChat}
            arquivos={chatArquivos}
            erroDeAnexo={erroDoAnexoDoChat}
            rodando={rodando}
            cancelando={cancelando}
            conversaVazia={conversaReal.length === 0}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {card.messages.length > 0 && (
            <Collapsible
              open={arquivoAberto}
              onOpenChange={setArquivoAberto}
              className="bg-surface-2 my-3 overflow-hidden rounded-md border"
            >
              <CollapsibleTrigger className="hover:bg-surface-3 flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors data-[state=open]:border-b">
                <Icon name="conversa" size="md" />
                <b>Conversa</b>
                <span className="text-muted-foreground ml-auto text-[11px]">
                  {card.messages.length} mensagens · só leitura
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="max-h-100 overflow-y-auto p-3">
                <ChatThread messages={card.messages} pensando={false} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {card.messages.length > 0 && <Separator />}

          <RunHistory history={card.history} columns={columns} />
        </div>
      )}
    </aside>
  );
}
