import Markdown from "@/components/atoms/Markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import type { ChatMessage as Mensagem } from "@/lib/config";

const ROTULO = { user: "Você", agent: "Agente" } as const;

// Só a resposta do agente vira markdown; a do usuário segue texto puro pra
// preservar exatamente o que foi digitado.
export default function ChatMessage({ message }: { message: Mensagem }) {
  const doUsuario = message.role === "user";

  return (
    <Message align={doUsuario ? "end" : "start"}>
      <MessageContent>
        <MessageHeader className="text-faint text-[11px] tracking-[0.06em] uppercase">
          {ROTULO[message.role]}
        </MessageHeader>
        <Bubble variant={doUsuario ? "default" : "outline"}>
          <BubbleContent
            className={doUsuario ? "whitespace-pre-wrap" : "bg-surface-2 border-border"}
          >
            {doUsuario ? message.content : <Markdown content={message.content} />}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
