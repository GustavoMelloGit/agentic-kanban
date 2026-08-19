import Icon from "@/components/atoms/Icon";
import { ehImagem, formatarTamanho } from "@/lib/anexos";
import { cn } from "@/lib/ui/utils";

// Um anexo: miniatura quando é imagem, ícone quando não é, e sempre nome e
// tamanho — o tamanho é o que responde "por que esse arquivo demorou".
// `href` só existe pro anexo que já está no servidor; o que ainda está no
// compositor não tem endereço pra abrir.
export default function AttachmentChip({
  nome,
  tamanho,
  tipo,
  href,
  onRemove,
  rotuloDeRemocao,
  desabilitado,
}: {
  nome: string;
  tamanho: number;
  tipo: string;
  href?: string;
  onRemove?: () => void;
  rotuloDeRemocao?: string;
  desabilitado?: boolean;
}) {
  const miniatura = href && ehImagem(tipo);

  const identidade = (
    <>
      {miniatura ? (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela API do board, sem otimização possível
        <img
          src={href}
          alt=""
          className="border-border size-9 shrink-0 rounded border object-cover"
        />
      ) : (
        <span className="bg-surface-3 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded">
          <Icon name="arquivo" size="lg" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-tight">{nome}</span>
        <span className="text-faint block text-[11px] leading-tight">
          {formatarTamanho(tamanho)}
        </span>
      </span>
    </>
  );

  return (
    <span className="bg-surface-2 border-border flex max-w-72 min-w-0 items-center gap-2 rounded-md border py-1 pr-1 pl-1">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          title={nome}
          className="hover:text-brand-text flex min-w-0 flex-1 items-center gap-2 rounded-sm transition-colors"
        >
          {identidade}
        </a>
      ) : (
        <span title={nome} className="flex min-w-0 flex-1 items-center gap-2">
          {identidade}
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          aria-label={rotuloDeRemocao ?? `Remover ${nome}`}
          disabled={desabilitado}
          onClick={onRemove}
          className={cn(
            "text-muted-foreground hover:bg-surface-3 hover:text-danger flex size-6 shrink-0 items-center justify-center rounded transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <Icon name="fechar" size="md" />
        </button>
      )}
    </span>
  );
}
