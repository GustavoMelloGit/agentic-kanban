"use client";

import { useRef, useState } from "react";
import AttachmentChip from "@/components/molecules/AttachmentChip";
import Icon from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/ui/utils";

// Três caminhos pro mesmo lugar: o clipe abre o seletor, arrastar solta em cima
// do compositor, e colar pega o print direto do Cmd+Shift+4 sem passar por
// arquivo. Quem valida tamanho e quantidade é a página — aqui só se anuncia.
export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  onAnexar,
  onRemoverAnexo,
  arquivos,
  erroDeAnexo,
  rodando,
  cancelando,
  conversaVazia,
}: {
  value: string;
  onChange: (texto: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onAnexar: (arquivos: File[]) => void;
  onRemoverAnexo: (indice: number) => void;
  arquivos: File[];
  erroDeAnexo: string | null;
  rodando: boolean;
  cancelando: boolean;
  conversaVazia: boolean;
}) {
  const [arrastando, setArrastando] = useState(false);
  const seletorDeArquivos = useRef<HTMLInputElement>(null);

  const placeholder = rodando
    ? "Aguarde a resposta…"
    : conversaVazia
      ? "Comece a conversa…"
      : "Responda ao agente…";

  // Mandar mensagem só com anexo é envio válido: o arquivo é o recado.
  const temOQueEnviar = value.trim().length > 0 || arquivos.length > 0;

  function receber(lista: FileList | null) {
    if (!lista?.length) return;
    onAnexar(Array.from(lista));
  }

  return (
    <form
      className={cn(
        "flex shrink-0 flex-col gap-2 rounded-md border-t pt-3 transition-colors",
        arrastando && "border-primary bg-primary/8 border border-dashed"
      )}
      onSubmit={(evento) => {
        evento.preventDefault();
        onSubmit();
      }}
      onDragOver={(evento) => {
        // preventDefault sempre, mesmo com o agente rodando: sem ele o form não
        // é alvo de drop válido e o navegador abre o arquivo solto por cima da
        // página, levando junto o rascunho e os anexos pendentes.
        evento.preventDefault();
        if (rodando) return;
        setArrastando(true);
      }}
      onDragLeave={(evento) => {
        // sair pra um filho ainda é estar dentro do compositor
        if (evento.currentTarget.contains(evento.relatedTarget as Node)) return;
        setArrastando(false);
      }}
      onDrop={(evento) => {
        evento.preventDefault();
        setArrastando(false);
        if (rodando) return;
        receber(evento.dataTransfer.files);
      }}
    >
      {arquivos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Arquivos a enviar">
          {arquivos.map((arquivo, indice) => (
            <li key={`${arquivo.name}-${arquivo.lastModified}-${indice}`} className="min-w-0">
              <AttachmentChip
                nome={arquivo.name}
                tamanho={arquivo.size}
                tipo={arquivo.type}
                onRemove={() => onRemoverAnexo(indice)}
                rotuloDeRemocao={`Remover ${arquivo.name} do envio`}
                desabilitado={rodando}
              />
            </li>
          ))}
        </ul>
      )}

      {erroDeAnexo && (
        <p role="alert" className="text-danger flex items-center gap-2 text-xs">
          <Icon name="alerta" size="md" />
          {erroDeAnexo}
        </p>
      )}

      <div className="flex gap-2">
        <input
          ref={seletorDeArquivos}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(evento) => {
            receber(evento.target.files);
            // limpa pra reanexar o mesmo arquivo depois de removê-lo
            evento.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Anexar arquivo à mensagem"
          disabled={rodando}
          onClick={() => seletorDeArquivos.current?.click()}
        >
          <Icon name="anexo" size="lg" />
        </Button>
        <Input
          aria-label="Mensagem para o agente"
          placeholder={placeholder}
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
          onPaste={(evento) => {
            if (rodando || evento.clipboardData.files.length === 0) return;
            evento.preventDefault();
            receber(evento.clipboardData.files);
          }}
          disabled={rodando}
          className="flex-1"
        />
        {rodando ? (
          <Button type="button" variant="destructive" disabled={cancelando} onClick={onCancel}>
            <Icon name="cancelar" size="md" />
            {cancelando ? "cancelando…" : "Cancelar"}
          </Button>
        ) : (
          <Button type="submit" disabled={!temOQueEnviar}>
            Enviar
          </Button>
        )}
      </div>
    </form>
  );
}
