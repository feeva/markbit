import { ref } from 'vue'

// Landing-page-only locale support (EN default, KO supported) — deliberately
// separate from src/i18n/index.ts's L(), which stays an English-only
// passthrough for the editor UI. See that file's comment for why the split.
export type Locale = 'en' | 'ko'

const STORAGE_KEY = 'markbit-locale'

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ko') return stored
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // fall through to detection instead of failing the whole page.
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export const locale = ref<Locale>(detectInitialLocale())

export function setLocale(next: Locale) {
  locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Best-effort persistence only.
  }
}

// Keyed by the English source string, matching the rest of the codebase's
// L(key) convention — no separate abstract key names to keep in sync.
const ko: Record<string, string> = {
  'Paste. Mark. Share.': '붙여넣고. 표시하고. 공유하기.',
  'Paste (Cmd/Ctrl+V), drop an image here, or choose a file':
    '이미지를 붙여넣거나(Cmd/Ctrl+V), 끌어다 놓거나, 파일을 선택하세요',
  'Choose a file': '파일 선택',
  'Embed on your own site': '내 사이트에 넣기',
  'Add this to any page. Press the hotkey to capture, mark up, and copy or download.':
    '아무 페이지에나 추가하세요. 단축키를 누르면 화면을 캡처해 표시하고 복사하거나 다운로드할 수 있습니다.',
  'Copied!': '복사됨!',
  'No account. No upload unless you share. Everything runs in your browser.':
    '회원가입 없음. 공유하지 않는 한 서버로 업로드하지 않습니다. 모든 처리는 브라우저에서 이루어집니다.',
  'About Markbit': 'Markbit 소개',
  'Markbit started as an internal tool for explaining screen issues without the back-and-forth of "the button on the top right, no, the other one." It\'s free and open source under the AGPL-3.0.':
    'Markbit은 "오른쪽 위 버튼 말이에요, 아니 그거 말고"처럼 화면 문제를 말로 설명하며 주고받는 과정을 줄이기 위한 사내 도구에서 시작했습니다. AGPL-3.0으로 배포되는 무료 오픈소스입니다.',
  'View source on GitHub': 'GitHub에서 소스 보기',
  'Send feedback': '피드백 보내기',
  Box: '박스',
  Text: '텍스트',
  Highlight: '하이라이트',
  Draw: '그리기',
  Blur: '블러',
  Crop: '자르기',
}

export function t(key: string): string {
  if (locale.value === 'ko' && key in ko) {
    return ko[key]
  }
  return key
}
