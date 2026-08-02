// O horário é o que ordena a leitura do histórico, então vale precisão e não
// "há 6 min": duas execuções da mesma coluna só se distinguem pelo relógio.
// O ISO cru fica no title, pra quem precisa do valor exato em UTC.
const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const DIA_COMPLETO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export function diaDaExecucao(at: string): string {
  return DIA_CURTO.format(new Date(at));
}

export function rotuloDoDia(at: string): string {
  return DIA_COMPLETO.format(new Date(at));
}

export default function RunTime({ at }: { at: string }) {
  return (
    <time
      dateTime={at}
      title={at}
      className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums"
    >
      {HORA.format(new Date(at))}
    </time>
  );
}
