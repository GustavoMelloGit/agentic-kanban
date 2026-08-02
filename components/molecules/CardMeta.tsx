import Icon from "@/components/atoms/Icon";
import StatusBadge from "@/components/atoms/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { MAX_REVIEW_CYCLES, type Card, type Project } from "@/lib/config";

export default function CardMeta({ card, project }: { card: Card; project?: Project }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="text-muted-foreground">
        {project?.name} · {project?.tool}
      </Badge>

      <StatusBadge status={card.status} />

      {card.reviewCycles > 0 && (
        <Badge
          variant="outline"
          title={`Review devolveu o card ${card.reviewCycles}x (limite ${MAX_REVIEW_CYCLES})`}
          className="bg-running/15 text-running border-transparent"
        >
          <Icon name="devolvido" size="sm" />
          {card.reviewCycles}/{MAX_REVIEW_CYCLES}
        </Badge>
      )}

      {card.messages.length > 0 && (
        <Badge
          variant="outline"
          title={`${card.messages.length} mensagens na conversa`}
          className="text-muted-foreground"
        >
          <Icon name="conversa" size="sm" />
          {card.messages.length}
        </Badge>
      )}
    </div>
  );
}
