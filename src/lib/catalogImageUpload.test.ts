import { describe, expect, it } from "vitest";
import {
  isCatalogImageFile,
  labelFromCatalogImageFile,
  prepareCatalogUploadCandidates,
} from "./catalogImageUpload";

function mockFile(name: string, relPath: string, size = 1000): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "webkitRelativePath", { value: relPath });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("catalogImageUpload", () => {
  it("detecta imagens por extensão mesmo sem MIME", () => {
    const file = new File(["x"], "look.JPG", { type: "" });
    expect(isCatalogImageFile(file)).toBe(true);
  });

  it("usa nome da subpasta como código da referência", () => {
    const file = mockFile("foto.jpg", "Fotos(6)/#00874/foto.jpg");
    expect(labelFromCatalogImageFile(file)).toBe("#00874");
  });

  it("agrupa uma imagem por subpasta em import de referências", () => {
    const files = [
      mockFile("a.jpg", "Fotos(6)/#00874/a.jpg"),
      mockFile("b.jpg", "Fotos(6)/00956/b.jpg"),
      mockFile("thumbs.db", "Fotos(6)/00956/thumbs.db", 10),
    ];

    const candidates = prepareCatalogUploadCandidates(files, { asReference: true });
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.label).sort()).toEqual(["#00874", "00956"]);
  });

  it("escolhe a maior imagem quando há várias na mesma pasta", () => {
    const files = [
      mockFile("small.jpg", "Fotos(6)/PLK 8016/small.jpg", 500),
      mockFile("big.jpg", "Fotos(6)/PLK 8016/big.jpg", 5000),
    ];

    const [only] = prepareCatalogUploadCandidates(files, { asReference: true });
    expect(only?.file.name).toBe("big.jpg");
    expect(only?.label).toBe("PLK 8016");
  });
});
