import Icon from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";

// Rodando, a única ação é parar; parado, só faz sentido redisparar em coluna
// que tem agente e não é de chat.
export default function CardActions({
  rodando,
  cancelando,
  podeRedisparar,
  onCancel,
  onRun,
}: {
  rodando: boolean;
  cancelando: boolean;
  podeRedisparar: boolean;
  onCancel: () => void;
  onRun: () => void;
}) {
  if (rodando) {
    return (
      <div className="mt-2 flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={cancelando}
          onClick={onCancel}
          className="text-danger border-danger/25 hover:bg-danger/12 hover:text-danger h-6 px-2 text-[11px]"
        >
          <Icon name="cancelar" size="sm" />
          {cancelando ? "cancelando…" : "Cancelar operação"}
        </Button>
      </div>
    );
  }

  if (!podeRedisparar) return null;

  return (
    <div className="mt-2 flex gap-1">
      <Button variant="outline" size="sm" onClick={onRun} className="h-6 px-2 text-[11px]">
        <Icon name="recomecar" size="sm" />
        Rodar agente de novo
      </Button>
    </div>
  );
}
