interface AccessDeniedProps {
  title?: string;
  message?: string;
}

export function AccessDenied({
  title = "Acesso negado",
  message = "Seu usuario nao possui permissao para acessar esta area.",
}: AccessDeniedProps) {
  return (
    <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1">{message}</p>
    </section>
  );
}
