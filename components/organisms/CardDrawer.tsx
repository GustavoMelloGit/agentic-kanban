"use client";

import { useState } from "react";
import Icon from "@/components/atoms/Icon";
import ChatComposer from "@/components/molecules/ChatComposer";
import ChatThread from "@/components/organisms/ChatThread";
import RunHistory from "@/components/organisms/RunHistory";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Card, Column } from "@/lib/config";
import { semMarcadoresDeCancelamento } from "@/lib/cancelamento";
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
  onClose,
  onCancel,
  onRemove,
  onSendChat,
}: {
  card: Card;
  column?: Column;
  columns: Column[];
  cancelando: boolean;
  chatInput: string;
  onChatInputChange: (texto: string) => void;
  onClose: () => void;
  onCancel: (confirmar: boolean) => void;
  onRemove: () => void;
  onSendChat: () => void;
}) {
  const [arquivoAberto, setArquivoAberto] = useState(false);
  const rodando = card.status === "running";
  const ehChat = !!column?.chat;
  // Thread só com marcador de cancelamento é conversa que nunca começou — é o
  // que o agente enxerga no prompt, então é o que o placeholder deve refletir.
  const conversaReal = semMarcadoresDeCancelamento(card.messages);
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
          ehChat && card.history.length > 0 && "max-h-[40%] overflow-y-auto"
        )}
      >
        <h3 className="mt-0 mr-8 mb-1 text-base font-semibold tracking-[-0.01em]">{card.title}</h3>
        <p className="text-muted-foreground text-[13px] whitespace-pre-wrap">{card.description}</p>

        <div className="my-4 flex gap-2">
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

      {ehChat ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {card.messages.length === 0 && !rodando ? (
            <p className="text-muted-foreground text-xs">{placeholderDaConversa}</p>
          ) : (
            <ChatThread messages={card.messages} pensando={rodando} />
          )}
          <ChatComposer
            value={chatInput}
            onChange={onChatInputChange}
            onSubmit={onSendChat}
            onCancel={() => onCancel(false)}
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

          <RunHistory history={card.history} columns={columns} />
        </div>
      )}
    </aside>
  );
}
