import { describe, expect, it } from "vitest";
import {
  computeOverallUploadPercent,
  formatUploadBytes,
  formatUploadEta,
} from "./uploadProgress";

describe("uploadProgress", () => {
  it("formata bytes", () => {
    expect(formatUploadBytes(512)).toBe("512 B");
    expect(formatUploadBytes(2048)).toBe("2.0 KB");
    expect(formatUploadBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formata ETA", () => {
    expect(formatUploadEta(30)).toBe("~30 s restantes");
    expect(formatUploadEta(90)).toBe("~2 min restantes");
    expect(formatUploadEta(null)).toBe("Calculando tempo restante…");
  });

  it("calcula percentual geral com arquivo em andamento", () => {
    expect(computeOverallUploadPercent(10, 3, 50)).toBe(25);
    expect(computeOverallUploadPercent(4, 4, 100)).toBe(100);
  });
});
