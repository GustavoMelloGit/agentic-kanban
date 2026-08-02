import { Badge } from "@/components/ui/badge";
import type { Verdict } from "@/lib/verdict";
import Icon from "./Icon";

export default function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const aprovado = verdict === "APPROVE";

  return (
    <Badge
      variant="outline"
      className={
        aprovado
          ? "border-transparent bg-ok/15 text-ok"
          : "border-transparent bg-running/15 text-running"
      }
    >
      <Icon name={aprovado ? "aprovado" : "devolvido"} size="sm" />
      {verdict}
    </Badge>
  );
}
