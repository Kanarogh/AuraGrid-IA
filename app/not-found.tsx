"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redireciona URLs desconhecidas para o fluxo principal do app. */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/welcome");
  }, [router]);

  return null;
}
