import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { CATEGORY_KEYS } from "../game/statSystem.js";

const client = new Anthropic();

const TOOL = {
  name: "register_item",
  description: "사진 속 물건 하나를 판타지 RPG 아이템으로 등록한다",
  input_schema: {
    type: "object",
    properties: {
      found: {
        type: "boolean",
        description:
          "판정 기준은 단 하나 — '사람이 손에 들 수 있는 구체적인 물건'이 사진에 뚜렷하게 있는가. " +
          "다음은 모두 false: 사람의 얼굴이나 신체가 중심인 사진(셀카 포함), " +
          "풍경·하늘·노을·바다·산·거리·건물 외관, 방이나 실내 전경, 벽·바닥·천장, " +
          "화면 캡처나 글자 위주 이미지, 무엇을 찍었는지 불분명한 사진. " +
          "사람이 함께 찍혔더라도 물건이 주인공이면 true(사람은 distractors로). " +
          "조금이라도 애매하면 false로 판정할 것. 억지로 misc에 넣지 말 것."
      },
      reject_reason: {
        type: "string",
        enum: ["none", "person", "scenery", "no_object", "unclear"],
        description: "found가 false일 때의 사유. true면 none"
      },
      name: {
        type: "string",
        description:
          "한국어 아이템 이름, 공백 포함 14자 이내. 게임 도감에 실릴 이름처럼 지을 것. " +
          "'귀여운/멋진/예쁜/기묘한 + 명사' 같은 밋밋한 형용사 조합은 금지. " +
          "대신 그 물건의 유래·전설·기능·별명을 암시하는 이름을 지어라. " +
          "단, 원래 무슨 물건인지는 알아볼 수 있어야 한다. " +
          "좋은 예: '밤샘을 지키는 파수꾼 인형', '세 겹의 달콤한 맹세', " +
          "'붉은별 질주화', '각성의 노란 잔', '휴대용 이세계 관문'. " +
          "나쁜 예: '귀여운 토끼인형', '맛있는 케이크', '멋진 신발'."
      },
      description: {
        type: "string",
        description:
          "한국어 2~3문장. 판타지 RPG 도감 말투. 이 물건의 가짜 유래나 전설을 그럴듯하게 지어내되, " +
          "사진 속 실제 물건의 색·형태·특징이 문장 안에 드러나야 한다. " +
          "약간의 유머나 반전(부작용, 사소한 결함)을 넣으면 좋다."+
          "등급·톤·지시문 같은 메타 정보는 절대 문장에 포함하지 말 것. 물건 이야기만 쓸 것."
      },
      
      category: {
        type: "string",
        enum: CATEGORY_KEYS,
        description: "물건의 실제 종류. 애매해서 misc를 고르고 싶다면 found를 false로 하는 편이 낫다"
      },
      subject_phrase: {
        type: "string",
        description:
          "영어 명사구. 관사 포함, 반드시 단수. 이미지 생성 프롬프트에 그대로 들어간다. " +
          "규칙: 단어 4개 이내. 물체의 종류만 적고 색·재질·상태·감정·판타지 표현을 넣지 말 것. " +
          "name에 쓴 표현을 절대 재사용하지 말 것. " +
          "좋은 예: the plush doll, the slice of cake, the sneaker, the ceramic mug, the game console. " +
          "나쁜 예: the white plush spirit doll with blue eyes, the legendary red sneakers." +
          "물건에 인쇄된 캐릭터·로고·라벨이 아니라 물건 자체를 가리킬 것. 예: 키티가 그려진 소금통 → the salt bottle (the hello kitty 아님)."
      },
      distractors: {
        type: "array",
        items: { type: "string" },
        description:
          "주요 피사체와 물리적으로 분리된 다른 물건들의 영어 명사. 예: plate, fork, hand, table. " +
          "피사체에 입혀지거나 붙어 있는 것(옷, 신발, 리본, 모자, 가방, 장식, 부품)은 절대 넣지 말 것. " +
          "그것들은 피사체의 일부다. 제거할 물건이 없으면 빈 배열." +
          "그릇·도시락·접시 안에 담겨 있어 하나의 구성으로 보이는 내용물은 절대 넣지 말 것 — 그것은 피사체의 일부다."
      },

     
      has_face: {
        type: "boolean",
        description: "물건 자체에 얼굴이나 표정이 그려져 있는가. 인형, 캐릭터 머그컵 등"
      }
    },

    required: ["found", "reject_reason", "name", "description", 
               "category", "subject_phrase", "distractors", "has_face"]
  }
};

const RARITY_TONE = {
  normal: "노멀 — 흔하고 소박한 물건. 일상적이고 정겨운 톤. 과장 금지",
  rare:   "레어 — 조금 특별한 물건. 살짝 신비롭고 호기심을 끄는 톤",
  epic:   "에픽 — 이름난 물건. 전설과 사연이 있는 웅장한 톤",
  unique: "유니크 — 세상에 하나뿐인 유물. 경외감이 드는 압도적인 톤"
};

export const REJECT_MESSAGE = {
  person:    "사람이 찍힌 사진으로는 아이템을 만들 수 없어요. 오늘 만난 물건을 찍어보세요",
  scenery:   "풍경 사진이네요. 손에 들 수 있는 물건을 찍어주세요",
  no_object: "아이템으로 만들 물건을 찾지 못했어요",
  unclear:   "사진이 흐리거나 무엇을 찍었는지 알기 어려워요"
};

async function prepare(buffer) {
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return out.toString("base64");
}

export async function analyzePhoto(buffer, rarity = "normal") {
  const data = await prepare(buffer);
  const tone = RARITY_TONE[rarity] || RARITY_TONE.normal;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1000,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "register_item" },
    messages: [{
      role: "user",
      content: [
        { type: "image",
          source: { type: "base64", media_type: "image/jpeg", data } },
        { type: "text", text:
          `이 사진에서 게임 아이템으로 만들 물건 하나를 판별해서 등록해줘.\n` +
          `이번 아이템의 등급은 [${tone}] 이다. 이름과 설명의 격을 이 등급에 맞춰라.\n` +
          `물건이 아니라 사람이나 풍경이 주인공이면 주저 없이 found를 false로 해라.` }
      ]
    }]
  });

  const use = msg.content.find((c) => c.type === "tool_use");
  if (!use) throw new Error("ANALYZE_FAILED");
  return use.input;
}