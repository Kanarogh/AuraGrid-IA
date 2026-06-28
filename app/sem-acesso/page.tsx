"use client";

export default function SemAcessoPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-ag-text">Sem acesso</h1>
      <p className="text-sm text-ag-muted max-w-md">
        Você não tem permissão para acessar este cliente ou seção. Contacte o administrador da
        equipe.
      </p>
    </div>
  );
}
