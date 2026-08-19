import AttachmentChip from "@/components/atoms/AttachmentChip";
import Icon from "@/components/atoms/Icon";
import Markdown from "@/components/atoms/Markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import type { ChatMessage as Mensagem } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

const ROTULO = { user: "Você", agent: "Agente" } as const;

// Os dois lados da conversa são markdown: o usuário escreve num editor que
// grava markdown, então a mensagem dele aparece com a mesma aparência da
// resposta do agente. A diferença é a quebra de linha — o Enter de quem digita
// é quebra de verdade, o do agente segue a regra do commonmark —, e mensagem
// antiga, escrita antes do editor, continua legível por isso mesmo.
// Turno que falhou continua na thread — é onde se lê o que quebrou —, mas
// anunciado como falha: o texto ali é traceback, não resposta ao usuário.
export default function ChatMessage({ message }: { message: Mensagem }) {
  const doUsuario = message.role === "user";
  const falhou = message.ok === false;
  // Mensagem só com anexo é envio válido: sem texto, a bolha é a lista de
  // arquivos. Anexo enviado não sai mais — a conversa é registro.
  const temTexto = message.content.trim().length > 0;

  return (
    <Message align={doUsuario ? "end" : "start"}>
      <MessageContent>
        <MessageHeader
          className={cn(
            "text-faint text-[11px] tracking-[0.06em] uppercase",
            falhou && "text-danger flex items-center gap-1"
          )}
        >
          {falhou && <Icon name="alerta" size="sm" />}
          {falhou ? `${ROTULO[message.role]} · falhou` : ROTULO[message.role]}
        </MessageHeader>
        <Bubble variant={doUsuario ? "default" : "outline"}>
          <BubbleContent
            className={cn(
              !doUsuario && "bg-surface-2 border-border",
              falhou && "border-danger/40"
            )}
          >
            {temTexto && (
              <Markdown content={message.content} quebrasSimples={doUsuario} />
            )}

            {message.attachments.length > 0 && (
              <ul
                className={cn("flex flex-wrap gap-2", temTexto && "mt-2")}
                aria-label="Arquivos anexados"
              >
                {message.attachments.map((anexo) => (
                  <li key={anexo.id} className="min-w-0">
                    <AttachmentChip
                      nome={anexo.name}
                      tamanho={anexo.size}
                      tipo={anexo.mime}
                      href={`/api/attachments/${anexo.id}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
