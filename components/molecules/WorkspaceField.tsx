import Icon from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WorkspaceField({
  value,
  onChange,
  onTogglePicker,
  label,
  placeholder,
}: {
  value: string;
  onChange: (caminho: string) => void;
  onTogglePicker: () => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        aria-label={label}
        title="relativo à raiz do app, ou absoluto"
        placeholder={placeholder}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="h-8 text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        title="escolher pasta"
        aria-label={label}
        onClick={onTogglePicker}
        className="size-8"
      >
        <Icon name="pasta" size="md" />
      </Button>
    </div>
  );
}
