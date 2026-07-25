export function logErro(contexto: string, erro: unknown): void {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error(`[agentic-kanban] ${contexto}: ${mensagem}`);
}
