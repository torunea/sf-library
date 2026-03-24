// ═══════════════════════════════════════
//  store.js — アプリ状態管理
// ═══════════════════════════════════════

/** アプリ全体の状態 */
export const state = {
  books:    [],   // スプレッドシートから取得した本データ
  stories:  [],   // 各話データ
  memos:    [],   // ユーザーメモ
  links:    [],   // ユーザーリンク
  currentBookId:  null,
  currentTab:     'info',
  linkModalScope: 'book', // 'book' | 'story_N'
};

/** IDで本を取得 */
export function getBook(id) {
  return state.books.find(b => b.id === id);
}

/** 本に紐づく各話を取得 */
export function getStoriesForBook(bookId) {
  return state.stories
    .filter(s => s.book_id === bookId)
    .sort((a, b) => Number(a.order) - Number(b.order));
}

/** 本に紐づくメモを取得（話IDなし＝本全体のメモ） */
export function getMemosForBook(bookId) {
  return state.memos.filter(m => m.book_id === bookId && (!m.story_id || m.story_id === ''));
}

/** 話に紐づくメモを取得 */
export function getMemosForStory(storyId) {
  return state.memos.filter(m => m.story_id === storyId);
}

/** 本から出るリンク */
export function getLinksFrom(bookId) {
  return state.links.filter(l => l.from_book_id === bookId && (!l.from_story_id || l.from_story_id === ''));
}

/** 話から出るリンク */
export function getLinksFromStory(storyId) {
  return state.links.filter(l => l.from_story_id === storyId);
}

/** IDからタイトルを引く（本・話両対応） */
export function titleById(bookId) {
  const b = state.books.find(b => b.id === bookId);
  return b ? b.title_jp : bookId;
}