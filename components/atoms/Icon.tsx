import {
  AlertTriangle,
  Check,
  CircleCheck,
  CircleStop,
  Code,
  Columns3,
  CornerDownLeft,
  Folder,
  Lightbulb,
  Loader2,
  MessageSquare,
  MessagesSquare,
  RotateCw,
  SearchCheck,
  Trash2,
  Unlink,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/ui/utils";

// Ponto de entrada único dos ícones do board. Emoji não serve como ícone
// estrutural: depende da fonte do sistema, muda de desenho entre plataformas e
// ignora os tokens de cor e tamanho.
const ICONES = {
  alerta: AlertTriangle,
  aprovado: Check,
  cancelar: CircleStop,
  conversa: MessageSquare,
  desconectado: Unlink,
  devolvido: CornerDownLeft,
  excluir: Trash2,
  fechar: X,
  girando: Loader2,
  pasta: Folder,
  recomecar: RotateCw,
  // identidade das colunas do board
  coluna: Columns3,
  codigo: Code,
  concluido: CircleCheck,
  ideia: Lightbulb,
  pessoa: UserCheck,
  refino: MessagesSquare,
  revisao: SearchCheck,
} satisfies Record<string, LucideIcon>;

export type NomeDoIcone = keyof typeof ICONES;

// Três tamanhos, nunca um valor avulso.
const TAMANHOS = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
} as const;

export type TamanhoDoIcone = keyof typeof TAMANHOS;

// Sempre decorativo: quem carrega o nome acessível é o texto ao lado ou o
// aria-label do controle. Controle só com ícone precisa do aria-label.
export default function Icon({
  name,
  size = "md",
  className,
}: {
  name: NomeDoIcone;
  size?: TamanhoDoIcone;
  className?: string;
}) {
  const Desenho = ICONES[name];
  return (
    <Desenho
      className={cn("shrink-0", TAMANHOS[size], className)}
      strokeWidth={2}
      aria-hidden="true"
      focusable="false"
    />
  );
}
