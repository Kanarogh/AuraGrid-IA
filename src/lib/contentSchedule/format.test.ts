import { formatScheduleItemCopy } from "./format";
import { normalizeRawScheduleItem } from "./normalize";
import type { ContentScheduleItem } from "../../types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const postItem: ContentScheduleItem = {
  id: "p1",
  order: 1,
  section: "posts",
  name: "POST 1",
  postType: "Arte Única",
  status: "draft",
  headline: "Estoque sob controle no PDV",
  subtitle: "Veja como o sistema avisa antes do produto acabar na prateleira da loja",
  cta: "Qual item você mais perde por falta de estoque?",
  legenda: "Corpo da legenda do feed.",
  hashtags: "#marca #pdv",
  imagePrompt: "Arte 4:5 com headline em destaque",
};

const storyItem: ContentScheduleItem = {
  ...postItem,
  id: "s1",
  order: 1,
  section: "stories",
  name: "STORY 1",
  postType: "Enquete",
  hashtags: "#nao-deve-aparecer",
  legenda: "Texto curto na tela",
};

const postCopy = formatScheduleItemCopy(postItem);
assert(postCopy.includes("Legenda:"), "post deve rotular Legenda");
assert(postCopy.includes("Hashtags:"), "post deve incluir hashtags");
assert(!postCopy.includes("Texto de apoio:"), "post não deve usar Texto de apoio");

const storyCopy = formatScheduleItemCopy(storyItem);
assert(storyCopy.includes("Texto de apoio:"), "story deve rotular Texto de apoio");
assert(!storyCopy.includes("Hashtags:"), "story não deve exibir hashtags no export");

const normalizedStory = normalizeRawScheduleItem(
  {
    section: "stories",
    name: "STORY 2",
    postType: "Dica",
    headline: "H",
    subtitle: "S",
    cta: "C",
    legenda: "texto",
    hashtags: "#foo #bar",
    suggestedDate: "05/05",
  },
  "stories",
  2
);
assert(normalizedStory.hashtags === "", "normalize deve limpar hashtags em stories");

console.log("contentSchedule/format.test.ts: ok");
