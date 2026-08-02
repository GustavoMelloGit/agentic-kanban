import EmptyState from "@/components/atoms/EmptyState";
import AddCardTrigger from "@/components/molecules/AddCardTrigger";
import ColumnHeader from "@/components/molecules/ColumnHeader";
import type { Column } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

export default function BoardColumn({
  col,
  vazia,
  arrastando,
  compositor,
  podeAdicionar,
  onAdd,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  col: Column;
  vazia: boolean;
  arrastando: boolean;
  compositor?: React.ReactNode;
  podeAdicionar: boolean;
  onAdd: () => void;
  onDragOver: (evento: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "bg-surface w-70 flex-none rounded-xl border p-3 transition-colors duration-150 ease-(--ease-board)",
        arrastando && "border-primary bg-surface-2"
      )}
    >
      <ColumnHeader col={col} />

      {/* o estado vazio some assim que o compositor abre: dois convites pra
          mesma ação, um deles já aceito, viram ruído */}
      {vazia && !compositor && (
        <EmptyState>
          {col.type === "manual" ? "Nenhum card aqui." : "Solte um card pra o agente atuar."}
        </EmptyState>
      )}

      {children}

      {/* só a coluna de entrada oferece criar; as outras se alcançam arrastando */}
      {compositor ??
        (col.entryPoint && (
          <AddCardTrigger columnName={col.name} onClick={onAdd} disabled={!podeAdicionar} />
        ))}
    </div>
  );
}
