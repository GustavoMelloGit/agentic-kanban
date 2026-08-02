// Ícones do board. Emoji não serve como ícone estrutural: depende da fonte do
// sistema, muda de desenho entre plataformas e não obedece a cor nem ao tamanho
// definidos nos tokens. Aqui é tudo traço de 2px em currentColor, viewBox 24.
const TRACADOS = {
  alerta: ["M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z", "M12 9v4", "M12 17h.01"],
  aprovado: ["M20 6 9 17l-5-5"],
  cancelar: ["M9 9h6v6H9z", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"],
  conversa: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"],
  desconectado: [
    "M18.84 12.25l1.72-1.71a5 5 0 0 0-.12-7.07 5 5 0 0 0-6.95 0l-1.72 1.71",
    "M5.17 11.75l-1.71 1.71a5 5 0 0 0 .12 7.07 5 5 0 0 0 6.95 0l1.71-1.71",
    "M8 2v2",
    "M2 8h2",
    "M16 20v2",
    "M20 16h2",
  ],
  devolvido: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  excluir: ["M3 6h18", "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
  fechar: ["M18 6 6 18", "m6 6 12 12"],
  girando: ["M21 12a9 9 0 1 1-6.22-8.56"],
  pasta: ["M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"],
  raio: ["m13 2-9 12h7l-1 8 9-12h-7l1-8Z"],
  recomecar: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
  robo: ["M12 8V4H8", "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z", "M2 14h2", "M20 14h2", "M9 13v2", "M15 13v2"],
  subir: ["m5 12 7-7 7 7", "M12 19V5"],
} as const;

export type NomeDoIcone = keyof typeof TRACADOS;

// Sempre decorativo: quem carrega o nome acessível é o botão ou o texto ao lado.
// Ícone sozinho num controle exige aria-label no próprio controle.
export default function Icon({
  name,
  size = 16,
  className,
}: {
  name: NomeDoIcone;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACADOS[name].map((tracado) => (
        <path key={tracado} d={tracado} />
      ))}
    </svg>
  );
}
