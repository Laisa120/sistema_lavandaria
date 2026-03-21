export function toUserErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return 'Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.';
  }

  if (error instanceof Error) {
    const message = (error.message || '').trim();
    const lower = message.toLowerCase();

    if (!message) return fallback;

    if (lower.includes('router_external_target_handshake_error')) {
      return 'Não foi possível comunicar com o servidor neste momento. Tente novamente em instantes.';
    }

    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error')) {
      return 'Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.';
    }

    const statusMatch = message.match(/\b(4\d\d|5\d\d)\b/);
    if (statusMatch) {
      const status = Number(statusMatch[1]);
      if (status === 400 || status === 422) return 'Alguns dados informados são inválidos. Revise e tente novamente.';
      if (status === 401 || status === 403) return 'Você não tem permissão para esta ação.';
      if (status === 404) return 'Serviço não encontrado. Tente novamente em instantes.';
      if (status === 409) return 'Conflito de dados. Atualize a página e tente novamente.';
      if (status >= 500) return 'Ocorreu um erro interno no servidor. Tente novamente em instantes.';
    }

    if (
      lower.includes('sqlstate') ||
      lower.includes('exception') ||
      lower.includes('trace') ||
      lower.includes('typeerror') ||
      lower.includes('syntaxerror')
    ) {
      return fallback;
    }

    if (lower.startsWith('erro na requisição') || lower.startsWith('erro na api')) {
      return fallback;
    }

    return message;
  }

  return fallback;
}
