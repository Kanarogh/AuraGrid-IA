import type { Metadata } from "next";
import "../src/index.css";

export const metadata: Metadata = {
  title: "AuraGrid Intelligence",
  description: "Planejamento de Instagram para marcas de moda com IA.",
};

const themeScript = `
(function () {
  try {
    var t = localStorage.getItem("palak_theme") === "dark" ? "dark" : "light";
    var r = document.documentElement;
    r.classList.remove("light", "dark");
    r.classList.add(t);
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
