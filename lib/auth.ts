/** 간단한 해시 — 비밀번호 원문을 쿠키에 저장하지 않기 위함 */
export function hashPassword(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const ch = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return 'auth_' + Math.abs(hash).toString(36);
}
