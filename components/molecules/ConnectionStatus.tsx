import Icon from "@/components/atoms/Icon";
import { Badge } from "@/components/ui/badge";

// Só aparece quando o SSE cai: board congelado sem aviso é uma UI que mente.
export default function ConnectionStatus({ live }: { live: boolean }) {
  if (live) return null;

  return (
    <Badge
      role="status"
      variant="outline"
      title="o board pode estar desatualizado"
      className="bg-danger/15 text-danger border-transparent"
    >
      <Icon name="desconectado" size="sm" />
      desconectado — reconectando…
    </Badge>
  );
}
