// Fica fora da tela até receber foco: quem navega por teclado pula o header
// inteiro em vez de tabular por todos os controles até chegar no board.
export default function SkipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="bg-primary text-primary-foreground absolute left-3 top-[-100px] z-100 rounded-sm px-3 py-2 text-xs focus:top-2"
    >
      {children}
    </a>
  );
}
