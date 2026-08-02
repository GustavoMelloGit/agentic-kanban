import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Junta classes condicionais e resolve conflito de utilitário Tailwind: a
// última classe do mesmo grupo vence, então uma prop de classe consegue
// sobrescrever o padrão do componente em vez de brigar por ordem no CSS.
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}
