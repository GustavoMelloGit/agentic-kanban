"use client";

import { useRef, useState } from "react";
import AttachmentChip from "@/components/atoms/AttachmentChip";
import Icon from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";
import type { Attachment } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

// Área de anexos do card, independente das mensagens: é o material que vale pro
// card inteiro (mockup, spec, planilha) e que entra em todo disparo — refino,
// desenvolvimento e review. Remover daqui não mexe nas mensagens já enviadas.
export default function CardAttachments({
  anexos,
  onAnexar,
  onRemover,
  erro,
  enviando,
  removendoId,
}: {
  anexos: Attachment[];
  onAnexar: (arquivos: File[]) => void;
  onRemover: (id: string) => void;
  erro: string | null;
  enviando: boolean;
  removendoId: string | null;
}) {
  const [arrastando, setArrastando] = useState(false);
  const seletorDeArquivos = useRef<HTMLInputElement>(null);

  function receber(lista: FileList | null) {
    if (!lista?.length) return;
    onAnexar(Array.from(lista));
  }

  return (
    <section
      aria-label="Anexos do card"
      className={cn(
        "rounded-md border border-transparent p-1 transition-colors",
        arrastando && "border-primary bg-primary/8 border-dashed"
      )}
      onDragOver={(evento) => {
        evento.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(evento) => {
        if (evento.currentTarget.contains(evento.relatedTarget as Node)) return;
        setArrastando(false);
      }}
      onDrop={(evento) => {
        evento.preventDefault();
        setArrastando(false);
        receber(evento.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-2">
        <Icon name="anexo" size="md" className="text-muted-foreground" />
        <b className="text-[13px]">Anexos do card</b>
        <span className="text-faint text-[11px]">
          o agente recebe em toda coluna
        </span>
        <input
          ref={seletorDeArquivos}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(evento) => {
            receber(evento.target.files);
            evento.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={enviando}
          onClick={() => seletorDeArquivos.current?.click()}
        >
          <Icon name="adicionar" size="md" />
          {enviando ? "anexando…" : "Anexar"}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-danger mt-2 flex items-center gap-2 text-xs">
          <Icon name="alerta" size="md" />
          {erro}
        </p>
      )}

      {anexos.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {anexos.map((anexo) => (
            <li key={anexo.id} className="min-w-0">
              <AttachmentChip
                nome={anexo.name}
                tamanho={anexo.size}
                tipo={anexo.mime}
                href={`/api/attachments/${anexo.id}`}
                onRemove={() => onRemover(anexo.id)}
                rotuloDeRemocao={`Remover ${anexo.name} do card`}
                desabilitado={removendoId === anexo.id}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          Arraste um arquivo aqui ou use Anexar — mockup, spec, planilha, o que o
          agente precisar ver em toda etapa do card.
        </p>
      )}
    </section>
  );
}
