import { Badge } from "@/components/ui/badge";
import type { CardStatus } from "@/lib/config";
import Icon from "./Icon";
import Spinner from "./Spinner";

// Cor nunca sozinha: cada estado carrega ícone e rótulo, senão quem não
// distingue as cores não distingue os estados.
const APARENCIA = {
  running: "border-transparent bg-running/15 text-running",
  error: "border-transparent bg-danger/15 text-danger",
  idle: "",
} satisfies Record<CardStatus, string>;

export default function StatusBadge({ status }: { status: CardStatus }) {
  if (status === "idle") return null;

  return (
    <Badge variant="outline" className={APARENCIA[status]}>
      {status === "running" ? <Spinner size="sm" /> : <Icon name="alerta" size="sm" />}
      {status}
    </Badge>
  );
}
