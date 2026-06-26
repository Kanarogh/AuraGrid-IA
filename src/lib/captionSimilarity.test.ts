import {
  extractOpeningTemplate,
  isHookTooSimilar,
  openerTemplateMatches,
} from "./captionSimilarity";
import {
  analyzeRecentCaptionHooks,
  extractRepeatedPhraseClusters,
} from "./recentCaptionHooks";

const samples = [
  "Sumérgete en la elegancia bohemia con este maxi vestido, donde los delicados bordados florales capturan la luz.",
  "Sumérgete en la sofisticación atemporal con este maxi vestido, una pieza clave de nuestra colección.",
  "Sumérgete en la calidez de un atardecer en Rajastán con este diseño exclusivo que fusiona motivos celestiales.",
];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

for (const a of samples) {
  for (const b of samples) {
    if (a === b) continue;
    assert(
      openerTemplateMatches(a, b, 3),
      "expected same 3-word opener template"
    );
    assert(
      isHookTooSimilar(a, [b]),
      "expected hooks with same opener to be too similar"
    );
  }
}

assert(
  extractOpeningTemplate(samples[0], 3) === "sumergete en la",
  "expected normalized opener template"
);

const phrases = extractRepeatedPhraseClusters(samples);
assert(
  phrases.some((p) => p.includes("maxi vestido") || p.includes("este maxi")),
  "expected repeated phrase cluster across samples"
);

const analysis = analyzeRecentCaptionHooks(samples);
assert(analysis.templates.includes("sumergete en la"), "expected forbidden template");
assert(analysis.full.length === 3, "expected three full hooks");

console.log("captionSimilarity.test.ts: ok");
