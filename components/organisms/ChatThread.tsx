"use client";

import { ArrowDown } from "lucide-react";
import Spinner from "@/components/atoms/Spinner";
import ChatMessage from "@/components/molecules/ChatMessage";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { ChatMessage as Mensagem } from "@/lib/config";

// O scroller gruda no fim enquanto o usuário está no fim e solta assim que ele
// rola pra cima — sem isso a resposta nova do agente arrastava a leitura.
// scrollAnchor no turno do usuário: é a mensagem dele que deve ficar no topo
// da vista quando a resposta chega.
export default function ChatThread({
  messages,
  pensando,
}: {
  messages: Mensagem[];
  pensando: boolean;
}) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        {/* o rótulo padrão do componente é "Messages"; o resto do board fala
            português e o leitor de tela deve falar a mesma língua */}
        <MessageScrollerViewport aria-label="Mensagens">
          <MessageScrollerContent className="gap-4 pb-5" aria-busy={pensando}>
            {messages.map((mensagem, indice) => (
              <MessageScrollerItem
                key={`${mensagem.at}-${indice}`}
                messageId={`${mensagem.at}-${indice}`}
                scrollAnchor={mensagem.role === "user"}
              >
                <ChatMessage message={mensagem} />
              </MessageScrollerItem>
            ))}

            {pensando && (
              <MessageScrollerItem messageId="pensando">
                <Message align="start">
                  <MessageContent>
                    <MessageHeader className="text-faint text-[11px] tracking-[0.06em] uppercase">
                      Agente
                    </MessageHeader>
                    <Bubble variant="outline">
                      <BubbleContent
                        role="status"
                        className="bg-surface-2 border-border text-muted-foreground flex items-center gap-2"
                      >
                        <Spinner size="md" />
                        pensando…
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {/* o padrão vem com bg-background e sem largura de borda, o que no
            nosso tema fica igual à bolha atrás — vira uma seta solta sobre o
            texto. Aqui ele ganha corpo e sombra pra ler como botão flutuante. */}
        <MessageScrollerButton className="bg-surface-3 border-border-strong hover:bg-surface-2 border shadow-lg">
          <ArrowDown className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Ir para a mensagem mais recente</span>
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
