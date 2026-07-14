// 닉네임 검증 규칙(2~12자, 한영숫자만 — src/domains/user/nickname.ts)을 항상 통과하도록
// 형용사·동물 단어는 각각 4자 이하로 유지한다. (최장 조합 4+4+2자리 숫자 = 10자)
const ADJECTIVES = [
  "용감한",
  "귀여운",
  "씩씩한",
  "명랑한",
  "다정한",
  "상냥한",
  "활발한",
  "조용한",
  "신나는",
  "즐거운",
  "재빠른",
  "느긋한",
  "포근한",
  "든든한",
  "영리한",
  "유쾌한",
  "늠름한",
  "당당한",
  "행복한",
  "기운찬",
  "깜찍한",
  "발랄한",
  "산뜻한",
  "따뜻한",
  "엉뚱한",
  "날쌘",
  "멋진",
  "착한",
  "밝은",
  "힘찬",
  "슬기로운",
  "사랑스런",
  "반짝이는",
  "부지런한",
  "자유로운",
] as const;

const ANIMALS = [
  "여우",
  "수달",
  "펭귄",
  "토끼",
  "고래",
  "늑대",
  "사자",
  "판다",
  "물개",
  "오리",
  "참새",
  "까치",
  "사슴",
  "하마",
  "기린",
  "담비",
  "백조",
  "제비",
  "순록",
  "라쿤",
  "부엉이",
  "다람쥐",
  "강아지",
  "고양이",
  "호랑이",
  "돌고래",
  "거북이",
  "독수리",
  "너구리",
  "두더지",
  "코끼리",
  "얼룩말",
  "알파카",
  "미어캣",
  "오소리",
  "족제비",
  "청설모",
  "두루미",
  "올빼미",
  "고슴도치",
  "카피바라",
] as const;

const RANDOM_DIGITS_MAX = 100;
const RANDOM_DIGITS_LENGTH = 2;

function pickRandom<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index]!;
}

function randomTwoDigits(): string {
  const value = Math.floor(Math.random() * RANDOM_DIGITS_MAX);
  return String(value).padStart(RANDOM_DIGITS_LENGTH, "0");
}

export function generateNickname(): string {
  return `${pickRandom(ADJECTIVES)}${pickRandom(ANIMALS)}${randomTwoDigits()}`;
}
