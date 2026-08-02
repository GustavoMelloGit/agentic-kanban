import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fica sempre visível (e não só no hover da coluna) porque é a única entrada de
// card do board — esconder atrás de hover deixaria a ação principal invisível
// pra quem navega por teclado.
export default function AddCardTrigger({
  columnName,
  onClick,
  disabled,
}: {
  columnName: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Cadastre um projeto antes (botão Projetos)" : undefined}
      aria-label={`Adicionar card em ${columnName}`}
      className="text-muted-foreground hover:text-foreground mt-2 h-8 w-full justify-start px-2 text-xs"
    >
      <Plus className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      Adicionar card
    </Button>
  );
}
