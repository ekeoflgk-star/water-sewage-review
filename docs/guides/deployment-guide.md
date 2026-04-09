# 상하수도 설계 검토 플랫폼 — 배포 및 접속 가이드

## 1. Vercel 환경변수 설정 (관리자)

Vercel 대시보드에서 환경변수를 설정해야 합니다.

### 설정 경로
1. [vercel.com](https://vercel.com) 로그인
2. `water-sewage-review` 프로젝트 선택
3. **Settings** > **Environment Variables**

### 필수 환경변수

| 변수명 | 값 | 용도 |
|--------|---|------|
| `GEMINI_API_KEY` | `AIzaSy...` (aistudio.google.com에서 발급) | AI 검토 엔진 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qmsintfrhxcpmevcksil.supabase.co` | DB 연결 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (Supabase anon key) | DB 인증 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (Supabase service role) | 서버 DB 접근 |
| `SITE_PASSWORD` | `review2026` | 사내 접속 비밀번호 |
| `LAW_API_OC` | `jonghyeon` | 법제처 API |
| `NEXT_PUBLIC_LAW_API_OC` | `jonghyeon` | 법제처 API (클라이언트) |
| `NEXT_PUBLIC_APP_URL` | `https://water-sewage-review.vercel.app` | 앱 URL |

### 선택 환경변수

| 변수명 | 값 | 용도 |
|--------|---|------|
| `ALLOWED_IPS` | 회사 고정 IP (쉼표 구분) | IP 화이트리스트 (비밀번호 없이 접근) |

> **주의**: Environment 선택 시 **Production**, **Preview**, **Development** 모두 체크하세요.

### 재배포
환경변수 설정 후:
1. **Deployments** 탭으로 이동
2. 가장 최근 배포의 **⋮** 메뉴 클릭
3. **Redeploy** 클릭

---

## 2. 사용자 접속 방법

### 접속 URL
```
https://water-sewage-review.vercel.app
```

### 처음 접속할 때
1. 위 URL을 브라우저에 입력합니다
2. **로그인 페이지**가 나타납니다
3. 비밀번호 입력란에 **`review2026`** 을 입력합니다
4. **입장** 버튼을 클릭합니다
5. 메인 페이지로 이동됩니다

> 한 번 로그인하면 **7일간** 자동 접속됩니다.
> 7일 후에는 다시 비밀번호를 입력하면 됩니다.

### 회사 네트워크에서 접속 (IP 화이트리스트 설정 시)
- 관리자가 회사 고정 IP를 등록하면 비밀번호 입력 없이 자동 접속됩니다
- 재택근무 등 외부에서 접속할 때는 비밀번호가 필요합니다

### 주요 기능

| 메뉴 | 기능 | 설명 |
|------|------|------|
| **설계검토** | AI 자동 검토 | PDF, DOCX, XLSX, DXF 파일을 업로드하면 법령/KDS 기준으로 자동 검토 |
| **참고문서** | 법령/시방서/KDS 탐색 | 법제처 API로 법령 실시간 검색, KDS 설계기준 임베딩 검색 |

### 지원 파일 형식
- **PDF** — 설계 보고서, 구조계산서 등
- **DOCX** — 설계설명서, 시방서 등
- **XLSX** — 수리계산서, 물량산출서 등
- **DXF** — 도면 파일 (인허가 레이어 자동 분석)

### 사용 흐름
```
1. 설계검토 페이지 접속
2. 사업 폴더 생성 (예: "○○시 상수도 확장")
3. 설계 파일 업로드 (드래그&드롭)
4. AI 검토 실행 → 적합/부적합/확인필요 판정
5. 검토의견서 PDF 다운로드
```

---

## 3. 문제 해결

### "비밀번호가 일치하지 않습니다" 에러
- 비밀번호를 정확히 입력했는지 확인하세요
- 관리자에게 현재 비밀번호를 문의하세요

### 페이지가 로드되지 않을 때
- 브라우저 캐시를 삭제하고 새로고침 (Ctrl+Shift+R)
- 다른 브라우저로 접속해보세요

### "서버 연결에 실패했습니다" 에러
- 인터넷 연결을 확인하세요
- Vercel 서비스 상태를 확인하세요 (status.vercel.com)

---

## 4. 관리자 참고사항

### 비밀번호 변경
1. Vercel 대시보드 > Settings > Environment Variables
2. `SITE_PASSWORD` 값 변경
3. Redeploy 실행
4. 기존 사용자는 7일 내 새 비밀번호로 재로그인 필요

### IP 화이트리스트 추가
1. Vercel 대시보드 > Settings > Environment Variables
2. `ALLOWED_IPS` 에 회사 IP 추가 (쉼표 구분)
   - 예: `123.456.78.90,123.456.78.91`
3. Redeploy 실행

### 회사 고정 IP 확인 방법
- 회사 네트워크에서 브라우저로 `whatismyip.com` 접속
- 표시되는 IP 주소를 `ALLOWED_IPS`에 추가
