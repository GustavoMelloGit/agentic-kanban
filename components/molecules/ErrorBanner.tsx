import Icon from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";

export default function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-danger/12 border-danger text-danger flex items-center gap-2 border-b px-6 py-2 text-xs"
    >
      <Icon name="alerta" size="md" />
      <span>{message}</span>
      {/* colado no texto, e não na borda direita: com o drawer aberto (fixed,
          por cima) um botão encostado na direita fica inalcançável */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Fechar aviso"
        onClick={onDismiss}
        className="text-danger hover:text-danger size-6 hover:bg-transparent"
      >
        <Icon name="fechar" size="md" />
      </Button>
    </div>
  );
}
