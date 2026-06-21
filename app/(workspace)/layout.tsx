"use client";

import dynamic from "next/dynamic";
import { AppBootstrapSplash } from "../../src/components/app/AppBootstrapSplash";

const AppShell = dynamic(() => import("../AppShell"), {
  ssr: false,
  loading: () => <AppBootstrapSplash status="connecting" />,
});

/** Layout persistente: providers e App não remontam ao mudar segmentos da URL. */
export default function WorkspaceLayout() {
  return <AppShell />;
}
