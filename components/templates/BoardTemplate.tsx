import SkipLink from "@/components/atoms/SkipLink";

// Só o esqueleto da tela: header em cima, faixa de aviso, board rolando na
// horizontal e o drawer por cima. Nada de estado nem de regra aqui.
export default function BoardTemplate({
  header,
  aviso,
  colunas,
  drawer,
  modais,
}: {
  header: React.ReactNode;
  aviso?: React.ReactNode;
  colunas: React.ReactNode;
  drawer?: React.ReactNode;
  modais?: React.ReactNode;
}) {
  return (
    <>
      <SkipLink href="#board">Pular para o board</SkipLink>
      {header}
      {aviso}
      {modais}
      <main
        id="board"
        className="flex min-h-[calc(100vh-var(--header-h))] items-start gap-3 overflow-x-auto px-6 pt-4 pb-8"
      >
        {colunas}
      </main>
      {drawer}
    </>
  );
}
