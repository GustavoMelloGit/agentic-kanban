import EmptyState from "@/components/atoms/EmptyState";
import ColumnHeader from "@/components/molecules/ColumnHeader";
import type { Column } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

export default function BoardColumn({
  col,
  vazia,
  arrastando,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  col: Column;
  vazia: boolean;
  arrastando: boolean;
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
      {vazia ? (
        <EmptyState>
          {col.type === "manual" ? "Nenhum card aqui." : "Solte um card pra o agente atuar."}
        </EmptyState>
      ) : (
        children
      )}
    </div>
  );
}
