import type { Metadata } from "next";
import "../src/index.css";
import { APP_DESCRIPTION, APP_NAME } from "../src/lib/appBranding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: "/favicon.svg",
  },
};

const themeScript = `
(function () {
  try {
    var r = document.documentElement;
    var t = localStorage.getItem("palak_theme") === "dark" ? "dark" : "light";
    r.classList.remove("light", "dark");
    r.classList.add(t);
    var presets = ["aura","cobalto","esmeralda","argila","rose","vermelho","violeta","grafite","custom"];
    var a = localStorage.getItem("ag_accent");
    var accent = presets.indexOf(a) !== -1 ? a : "aura";
    r.setAttribute("data-accent", accent);
    if (accent === "custom") {
      try {
        var c = JSON.parse(localStorage.getItem("ag_accent_custom") || "{}");
        var tok = t === "dark" ? c.tokensDark : c.tokensLight;
        if (tok && tok.accent) {
          r.style.setProperty("--ag-accent", tok.accent);
          r.style.setProperty("--ag-accent-strong", tok.accentStrong);
          r.style.setProperty("--ag-accent-soft", tok.accentSoft);
          r.style.setProperty("--ag-accent-fg", tok.accentFg);
        }
      } catch (e) {}
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
