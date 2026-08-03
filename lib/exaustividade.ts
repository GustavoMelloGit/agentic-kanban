import { logErro } from "./log";

// Fecha um `switch` sobre union de literais: o parâmetro `never` quebra o build
// quando alguém adiciona uma variante e esquece o caso. O braço em runtime existe
// porque sem ele o handler cairia fora do `switch` e devolveria `undefined` no
// lugar de uma resposta — o Next derruba a requisição com "No response is
// returned", que é o pior jeito de descobrir a variante nova.
export function casoNaoTratado(contexto: string, valor: never): void {
  logErro(contexto, `caso não tratado: ${String(valor)}`);
}
