import { describe, expect, it } from "vitest";
import {
  isCatalogImageFile,
  labelFromCatalogImageFile,
  prepareCatalogUploadCandidates,
  referenceLabelFromFolderAndFile,
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

  it("importa todas as imagens de todas as subpastas", () => {
    const files = [
      mockFile("a.jpg", "Fotos(6)/#00874/a.jpg"),
      mockFile("b.jpg", "Fotos(6)/#00874/b.jpg"),
      mockFile("c.jpg", "Fotos(6)/00956/c.jpg"),
      mockFile("thumbs.db", "Fotos(6)/00956/thumbs.db", 10),
    ];

    const candidates = prepareCatalogUploadCandidates(files, { asReference: true });
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.file.name).sort()).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("combina pasta e nome da foto no rótulo", () => {
    const file = mockFile("9146-pink-front.jpg", "Fotos(6)/#00874/9146-pink-front.jpg");
    expect(referenceLabelFromFolderAndFile(file)).toBe("#00874 9146 Pink Front");
  });

  it("usa só a pasta quando o arquivo tem nome genérico", () => {
    const file = mockFile("IMG_0001.jpg", "Fotos(6)/PLK 8016/IMG_0001.jpg");
    expect(referenceLabelFromFolderAndFile(file)).toBe("PLK 8016");
  });
});
