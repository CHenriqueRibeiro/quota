/**
 * Utilitários de timezone para sincronização com o Horário Oficial de Brasília (America/Sao_Paulo / UTC-3).
 * Evita que chamadas realizadas após as 21:00 (que caem no dia seguinte em UTC) sejam agrupadas incorretamente.
 */

export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Converte data de início (YYYY-MM-DD ou ISO) para o início do dia no Horário de Brasília (00:00:00.000-03:00).
 */
export function parseBrasiliaStartDate(dateInput?: string | Date): Date {
  if (!dateInput) {
    const now = new Date();
    const brtString = now.toLocaleString("en-US", { timeZone: BRASILIA_TIMEZONE });
    const brtDate = new Date(brtString);
    const year = brtDate.getFullYear();
    const month = String(brtDate.getMonth() + 1).padStart(2, '0');
    return new Date(`${year}-${month}-01T00:00:00.000-03:00`);
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (trimmed.length <= 10) {
      return new Date(`${trimmed}T00:00:00.000-03:00`);
    }
  }

  return new Date(dateInput);
}

/**
 * Converte data de fim (YYYY-MM-DD ou ISO) para o fim do dia no Horário de Brasília (23:59:59.999-03:00).
 */
export function parseBrasiliaEndDate(dateInput?: string | Date): Date {
  if (!dateInput) {
    return new Date();
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (trimmed.length <= 10) {
      return new Date(`${trimmed}T23:59:59.999-03:00`);
    }
  }

  return new Date(dateInput);
}

/**
 * Retorna a data atual formatada em YYYY-MM-DD no Horário de Brasília.
 */
export function getBrasiliaTodayString(): string {
  const now = new Date();
  const brtString = now.toLocaleString("en-US", { timeZone: BRASILIA_TIMEZONE });
  const brtDate = new Date(brtString);
  const year = brtDate.getFullYear();
  const month = String(brtDate.getMonth() + 1).padStart(2, '0');
  const day = String(brtDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
