import { HttpException } from "@nestjs/common";

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "invalid_target"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "access_denied"
  | "invalid_redirect_uri"
  | "invalid_client_metadata";

/** RFC 6749 §5.2 error body, raised from the token, register and revoke endpoints. */
export class OAuthError extends HttpException {
  constructor(
    readonly code: OAuthErrorCode,
    readonly description: string,
    status = code === "invalid_client" ? 401 : 400
  ) {
    super({ error: code, error_description: description }, status);
  }
}

/**
 * Authorization request whose client or redirect URI could not be trusted: the user sees an
 * error page and is never redirected (OAuth 2.1 §4.1.2.1).
 */
export class UntrustedAuthorizationRequest extends Error {
  constructor(
    readonly reason: "INVALID_CLIENT" | "INVALID_REDIRECT_URI",
    message: string
  ) {
    super(message);
    this.name = "UntrustedAuthorizationRequest";
  }
}

/** Authorization request error that is safe to report back to the client's redirect URI. */
export class RedirectableAuthorizationError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    readonly description: string
  ) {
    super(description);
    this.name = "RedirectableAuthorizationError";
  }
}

export function authorizationErrorPage(message: string): string {
  const safe = message.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nao foi possivel conectar o assistente</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:1rem}
main{max-width:32rem;background:#fff;border:1px solid #e2e8f0;border-radius:.5rem;padding:1.5rem;box-shadow:0 1px 2px rgba(0,0,0,.05)}
h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#475569;line-height:1.5}
</style>
</head>
<body>
<main>
<h1>Nao foi possivel conectar o assistente</h1>
<p>${safe}</p>
<p>Volte ao assistente e tente adicionar o conector novamente. Se o erro continuar, avise o administrador da loja.</p>
</main>
</body>
</html>`;
}
