import Icon from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  rodando,
  cancelando,
  conversaVazia,
}: {
  value: string;
  onChange: (texto: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  rodando: boolean;
  cancelando: boolean;
  conversaVazia: boolean;
}) {
  const placeholder = rodando
    ? "Aguarde a resposta…"
    : conversaVazia
      ? "Comece a conversa…"
      : "Responda ao agente…";

  return (
    <form
      className="flex shrink-0 gap-2 border-t pt-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        onSubmit();
      }}
    >
      <Input
        aria-label="Mensagem para o agente"
        placeholder={placeholder}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={rodando}
        className="flex-1"
      />
      {rodando ? (
        <Button type="button" variant="destructive" disabled={cancelando} onClick={onCancel}>
          <Icon name="cancelar" size="md" />
          {cancelando ? "cancelando…" : "Cancelar"}
        </Button>
      ) : (
        <Button type="submit">Enviar</Button>
      )}
    </form>
  );
}
