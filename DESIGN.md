---
omd: 0.1
brand: invest-in-best
bootstrapped_from: stripe
bootstrapped_at: 2026-07-10
---

<!-- omd:note: 레퍼런스(stripe)의 sohne-var "ss01" 시그니처는 폰트 종속이라 이식 불가.
     프로젝트 규약(Pretendard Variable 필수)에 따라 시그니처를 "라이트 웨이트 디스플레이 + 타이트 트래킹"으로 재표현. -->
<!-- omd:note: 레퍼런스는 라이트 단일 테마. 프로젝트는 라이트 기본 + 다크 자동(토큰 재정의)이므로
     §2 Brand & Dark를 다크 테마 토큰 문서로 사용. 컴포넌트는 토큰만 참조 — `dark:` variant 금지. -->

# Design System of invest-in-best

## 1. Visual Theme & Atmosphere

invest-in-best의 화면은 데이터를 다루는 금융 도구이면서 동시에 잘 만든 소프트웨어처럼 보여야 한다. 페이지는 옅은 slate 캔버스(`#f8fafc`) 위에 순백 카드(`#ffffff`)를 얹고, slate-900(`#0f172a`) 텍스트와 시그니처 indigo-violet(`#4f46e5`)이 브랜드 앵커이자 인터랙션 색을 겸한다. 차갑고 사무적인 회색 시스템이 아니다 — 뉴트럴 전체가 청색 편향(slate)이라 화면 어디에서든 은은한 쿨 톤이 유지되고, 그 위의 indigo가 신뢰와 정밀함을 동시에 읽히게 한다.

타이포그래피의 기둥은 셀프호스팅 Pretendard Variable(`--font-sans`)이다. 디스플레이 크기(48–56px)에서 weight 300을 쓴다 — 헤드라인이 소리치지 않아도 권위가 서는, 가벼움을 고급스러움으로 쓰는 선택이다. 디스플레이 크기의 네거티브 트래킹(-1.4px @ 56px)이 텍스트를 밀도 있는 블록으로 조인다. 숫자는 별도 규칙을 따른다: 시세·재무 수치는 Geist Mono(`--font-mono`) + `.tabular` 클래스로 자릿수를 정렬한다. 본문 속 숫자와 테이블 속 숫자는 서로 다른 시민이다.

그림자 시스템이 이 시스템의 또 다른 서명이다. 평평한 단일 레이어 대신 블루 틴트 멀티 레이어를 쓴다: `rgba(50,50,93,0.25)`와 `rgba(0,0,0,0.1)`의 조합이 만드는 차갑고 대기감 있는 깊이는 slate-indigo 팔레트와 같은 계열이라, 엘리베이션조차 브랜드 색을 입는다.

**Key Characteristics:**
- Pretendard Variable을 모든 텍스트에 — 폰트는 항상 Pretendard, 예외 없음
- Weight 300이 디스플레이 시그니처 — 가볍고, 확신에 차 있고, 관습을 거스른다
- 디스플레이 크기의 네거티브 트래킹 (56px에서 -1.4px, 아래로 갈수록 점진 완화)
- 블루 틴트 멀티 레이어 그림자 `rgba(50,50,93,0.25)` — 브랜드 색을 입은 엘리베이션
- 순수 검정 대신 slate-900(`#0f172a`) 헤딩 — 청색 편향 뉴트럴의 일관성
- 보수적 radius (6–12px) — 필 셰이프 없음, 각진 것도 없음
- data cyan(`#0891b2`)이 두 번째 액센트 — KRX 시장 배지, 데이터 강조 전용
- Geist Mono + `.tabular`가 모든 수치의 모노스페이스 동반자

## 2. Color Palette & Roles

토큰 SOT는 `apps/web/src/app/globals.css`. 컴포넌트는 항상 토큰 유틸리티(`bg-surface`, `text-fg`, `border-border`, `bg-accent` …)만 참조한다. 아래 hex는 라이트 테마 기준값이다.

### Primary
- **Accent Indigo** (`#4f46e5`, `--accent`): 프라이머리 CTA 배경, 링크, 선택 상태, 인터랙티브 하이라이트. 시스템 전체의 앵커.
- **Foreground** (`#0f172a`, `--fg`): 본문·헤딩 텍스트. 검정이 아니라 slate-900 — 청색 편향이 팔레트에 온기를 준다.
- **Surface Raised** (`#ffffff`, `--surface-raised`): 카드·패널 표면. 페이지 바닥은 `--surface`(`#f8fafc`).

### Brand & Dark
다크 테마는 별도 시스템이 아니라 같은 토큰의 재정의다 (`prefers-color-scheme` 자동).
- **Dark Surface** (`#0b0f1a`): 다크 페이지 바닥. Raised `#111827`, Sunken `#0f172a`, Hover `#1e293b`.
- **Dark Accent** (`#818cf8`): 다크에서 액센트는 밝아진다. Hover `#a5b4fc`, accent-fg는 `#0b0f1a`로 반전.
- **Dark Foreground** (`#e5e9f0`): 다크 본문. Muted `#9aa7bd`, Subtle `#64748b`, Border `#1f2937`/`#334155`.

### Accent Colors
- **Data Cyan** (`#0891b2`, `--data`): 두 번째 액센트. KRX 시장 배지, 데이터 강조, 마인드맵 KRX 노드. 다크에서 `#22d3ee`.
- **Data Soft** (`#ecfeff`, `--data-soft`): cyan 틴트 배경. 다크에서 `#083344`.
- **Accent Soft** (`#eef2ff`, `--accent-soft`): indigo 틴트 배경 (텍스트는 `--accent-soft-fg` `#4338ca`). US 시장 배지, 선택 상태 배경.

### Interactive
- **Accent** (`#4f46e5`): 링크, 활성 상태, 선택 요소. 흰 텍스트 대비 6.3:1(WCAG AA).
- **Accent Hover** (`#4338ca`): 프라이머리 hover — 라이트에서는 어두워지고, 다크(`#818cf8`→`#a5b4fc`)에서는 밝아진다.
- **Ring** (`#818cf8`, `--ring`): 키보드 포커스 링 전용. 다크에서 `#6366f1`.
- **Danger Hover** (`#b91c1c`): 파괴적 액션의 hover.

### Neutral Scale
- **Foreground** (`#0f172a`): 본문, 헤딩, 강한 라벨.
- **Foreground Muted** (`#475569`, `--fg-muted`): 보조 텍스트, 설명, 차트 텍스트.
- **Foreground Subtle** (`#64748b`, `--fg-subtle`): 캡션, placeholder, 비활성 라벨 — 흰 바탕 4.76:1(AA).
- **Success** (`#16a34a`): 상승, 성공 상태 (+`--success-soft` `#f0fdf4`).
- **Warning** (`#d97706`): 경고 — amber/orange/yellow를 이 단일 계열로 통일했다 (+`--warning-soft` `#fffbeb`).
- **Danger** (`#dc2626`): 하락, 오류, 파괴적 액션 (+`--danger-soft` `#fef2f2`).

### Surface & Borders
- **Border** (`#e2e8f0`, `--border`): 카드, 디바이더, 컨테이너의 기본 보더.
- **Border Strong** (`#cbd5e1`, `--border-strong`): 인풋, 강조 구분선.
- **Surface Sunken** (`#f1f5f9`, `--surface-sunken`): 인풋·코드 블록·테이블 헤더의 가라앉은 표면.
- **Surface Hover** (`#f1f5f9`): 행·카드 hover 배경.

### Shadow Colors
- **Shadow Blue** (`rgba(50,50,93,0.25)`): 시그니처 — 블루 틴트 프라이머리 그림자.
- **Shadow Black** (`rgba(0,0,0,0.1)`): 깊이 보강용 세컨더리 레이어.
- **Shadow Ambient** (`rgba(23,23,23,0.08)`): 표준 카드의 부드러운 앰비언트.
- **Shadow Soft** (`rgba(23,23,23,0.06)`): 최소 리프트.

## 3. Typography Rules

### Font Family
- **Primary**: Pretendard Variable — 셀프호스팅 `src/app/fonts/PretendardVariable.woff2`, `next/font/local`로 `--font-sans` 배선. 폰트는 항상 Pretendard.
- **Monospace**: Geist Mono (`--font-mono`) — 숫자·티커·코드 전용, `.tabular` 클래스와 함께.
- **수치 규칙**: 시세·재무·차트 축의 모든 숫자는 tabular numerals. 본문 문장 속 숫자는 Pretendard 그대로.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Pretendard | 56px | 300 | 1.03 | -1.4px | 랜딩 히어로, 위스퍼-웨이트 권위 |
| Display Large | Pretendard | 48px | 300 | 1.15 | -0.96px | 보조 히어로 |
| Section Heading | Pretendard | 32px | 300 | 1.10 | -0.64px | 섹션 타이틀 (Heading level 1) |
| Sub-heading | Pretendard | 22px | 300 | 1.10 | -0.22px | 카드·서브섹션 헤드 (Heading level 2) |
| Panel Heading | Pretendard | 18px | 300 | 1.40 | normal | 밀집 패널 소제목 (Heading level 3) — 22px는 밀집 화면을 파괴해 18px로 확정 |
| Body Large | Pretendard | 18px | 300 | 1.40 | normal | 피처 설명, 인트로 |
| Body | Pretendard | 16px | 400 | 1.40 | normal | 표준 본문 |
| Button | Pretendard | 16px | 400 | 1.00 | normal | 버튼 라벨 (md) |
| Caption | Pretendard | 13px | 400 | normal | normal | 라벨, 메타데이터 |
| Caption Tabular | Geist Mono | 12px | 400 | 1.33 | normal | 시세·재무 수치, `.tabular` |
| Micro Tabular | Geist Mono | 10px | 400 | 1.15 | normal | 차트 축, 작은 수치 |
| Code | Geist Mono | 12px | 500 | 2.00 | normal | 코드 블록 |

### Principles
- **라이트 웨이트가 시그니처**: 디스플레이 크기의 weight 300은 이 시스템의 가장 뚜렷한 타이포 선택. 남들이 600–700으로 주목을 명령할 때, 가벼움으로 권위를 만든다.
- **두 폰트, 두 역할**: Pretendard는 언어, Geist Mono는 수치. 겹치지 않는다 — 테이블·티커·차트의 숫자가 Pretendard로 렌더되면 잘못된 것.
- **점진적 트래킹**: 크기에 비례해 자간이 조여진다: 56px에서 -1.4px, 48px에서 -0.96px, 32px에서 -0.64px, 16px 이하는 normal.
- **두 웨이트 단순성**: 디스플레이·리드는 300, UI·본문은 400. Pretendard 700은 쓰지 않는다 — 강조는 웨이트가 아니라 색(`--fg` vs `--fg-muted`)과 크기로.

## 4. Component Stylings

프리미티브 SOT는 `@/components/ui` 배럴. raw `<button>`/`<input>`/카드 클래스를 직접 쓰지 말고 프리미티브를 쓴다.

### Buttons

**Primary** (`Button variant="primary"`)
- Background: `--accent` (`#4f46e5`) / Text: `--accent-fg` (`#ffffff`)
- Radius: `--radius` (8px)
- Hover: `--accent-hover` (`#4338ca`)
- Use: 프라이머리 CTA. 화면당 하나가 원칙.

**Secondary** (`variant="secondary"`)
- Background: `--surface-raised` / Text: `--fg` / Border: `1px solid --border-strong`
- Hover: `--surface-hover`
- Use: 보조 액션.

**Ghost** (`variant="ghost"`)
- Background: transparent / Text: `--fg-muted`
- Hover: `--surface-hover` 배경
- Use: 밀도 높은 데이터 서피스의 기본 버튼.

**Danger** (`variant="danger"`)
- Background: `--danger` (`#dc2626`) / Text: white / Hover: `--danger-hover`
- Use: 파괴적 액션 전용. 확인 스텝과 함께.

**Link** (`variant="link"`, `as="link"`)
- Text: `--accent`, 배경 없음
- Use: 인라인 내비게이션형 액션.

#### 데이터 서피스 규약 — 차트·테이블·마인드맵

마케팅 랜딩과 데이터 서피스는 같은 토큰, 다른 밀도를 쓴다. 랜딩은 `size="md"` primary가 주인공이고, 시세 테이블·마인드맵 툴바·차트 컨트롤에서는 `size="sm"` ghost/secondary가 기본이다. 데이터 서피스에서 primary 버튼은 화면의 최종 행동(저장, 추가) 하나에만 허용 — 컨트롤마다 indigo를 칠하면 데이터 강조가 죽는다.

### Cards & Containers
- `Card` 프리미티브: Background `--surface-raised`, Border `1px solid --border`, Radius `--radius-lg` (12px)
- Shadow (standard): `rgba(23,23,23,0.08) 0px 15px 35px`
- Shadow (elevated): `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px`
- `interactive` prop: hover 시 그림자 강화 + `--surface-hover`

### Badges / Tags / Pills
- `Badge` 프리미티브, tone으로만 구분: `neutral` / `accent` / `success` / `warning` / `danger` / `data`
- 구조: soft 배경(`--*-soft`) + 진한 텍스트, radius `--radius-sm` (6px)
- **MarketBadge** (`SecurityBadges.tsx`): KRX = `data`(cyan), US = `accent`(violet). 마인드맵 노드도 동일 색 규칙.
- 새 상태 배지를 만들 때 새 색을 도입하지 않는다 — 여섯 tone 안에서 해결.

### Inputs & Forms
- `Input` / `Textarea` / `Select` 프리미티브
- Background: `--surface-sunken` / Border: `1px solid --border-strong` / Radius: `--radius-sm` (6px)
- Focus: `--ring` (`#818cf8`) 링
- `invalid` prop: `--danger` 보더 + 필드 하단 13px 오류 텍스트
- Label: `--fg-muted` 13px / Placeholder: `--fg-subtle`

### Navigation
- 화이트(라이트)/다크 surface 위 sticky 헤더, backdrop blur
- 링크: Pretendard 14px weight 400, `--fg` 텍스트, hover 시 `--accent`
- 활성 라우트: `--accent` 텍스트 또는 `--accent-soft` 배경
- CTA: primary 버튼 우측 정렬

### Decorative Elements
- 히어로 장식 그라디언트: `--accent`(indigo) → `--data`(cyan). 장식 전용 — 버튼·링크에 그라디언트 금지.
- 마인드맵 엣지 강조: `--accent` 계열, 관계 라벨은 엣지 선 위 레이어.
- soft 틴트(`--accent-soft`, `--data-soft`)로 섹션 배경 변주. 임의 파스텔 도입 금지.

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px
- 소형 구간(4–12px)이 촘촘한 것은 의도 — 시세 테이블·차트 컨트롤 같은 정밀 UI를 위한 해상도.

### Grid & Container
- 컨테이너는 `PageShell` (width `sm`/`md`/`lg`/`xl`)로 통일
- 랜딩 히어로: 중앙 단일 컬럼 + 여유 패딩 + 라이트 웨이트 헤드라인
- 피처 섹션: 2–3 컬럼 카드 그리드
- 데이터 화면: 차트·테이블이 주인공, 크롬은 최소

### Whitespace Philosophy
- **정밀 스페이싱**: 미니멀리즘의 광활한 여백이 아니라, 측정된 목적 있는 여백. 모든 간격이 의도적 선택이다.
- **밀한 데이터, 너른 크롬**: 시세 테이블·차트는 촘촘하게, 그 주변 UI 크롬은 넉넉하게. 잘 정리된 스프레드시트를 좋은 액자에 넣은 감각.
- **섹션 리듬**: 라이트 캔버스에 soft 틴트 섹션을 교차시켜 단조로움을 깬다 — 임의 색이 아니라 `--accent-soft`/`--data-soft`로.

### Border Radius Scale
- Small (6px, `--radius-sm`): 인풋, 배지, 컴팩트 요소
- Standard (8px, `--radius`): 버튼, 표준 컨테이너 — 워크호스
- Large (12px, `--radius-lg`): 카드, 피처 컨테이너
- 필 셰이프(9999px) 금지 — 보수적 라운딩은 의도다.

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | 그림자 없음 | 페이지 배경, 인라인 텍스트, 시세 테이블 행 |
| Ambient (Level 1) | `rgba(23,23,23,0.06) 0px 3px 6px` | 미묘한 카드 리프트, hover 힌트 |
| Standard (Level 2) | `rgba(23,23,23,0.08) 0px 15px 35px` | 표준 카드, 콘텐츠 패널 |
| Elevated (Level 3) | `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px` | 피처 카드, 드롭다운, 팝오버 |
| Deep (Level 4) | `rgba(3,3,39,0.25) 0px 14px 21px -14px, rgba(0,0,0,0.1) 0px 8px 17px -8px` | 모달, 플로팅 패널 |
| Ring (Accessibility) | `2px solid --ring` outline | 키보드 포커스 링 |

**Shadow Philosophy**: 크로마틱 깊이가 원칙이다. 중립 회색 그림자 대신 블루-그레이(`rgba(50,50,93,0.25)`)를 프라이머리 그림자로 쓴다 — slate 뉴트럴과 indigo 액센트가 그림자 레이어에서 다시 나타나는 것. 멀티 레이어는 브랜드 색 그림자를 멀리, 중립 검정을 가까이 배치해 시차(parallax) 같은 깊이를 만든다. 네거티브 스프레드(-30px, -18px)로 그림자가 요소 밖으로 수평 확산하지 않게 — 엘리베이션은 수직으로만.

### Decorative Depth
- 다크 테마 전환 자체가 깊이 표현 — 별도 다크 섹션 대신 시스템 전체가 반전된다
- indigo→cyan 그라디언트 장식은 히어로에만
- sticky 요소 하단에는 얇은 `--border` 라인 + soft 그림자

## 7. Do's and Don'ts

### Do
- 모든 텍스트에 Pretendard Variable — 폰트는 항상 Pretendard
- 디스플레이·리드에 weight 300 — 가벼움이 시그니처
- 엘리베이션에는 블루 틴트 그림자 (`rgba(50,50,93,0.25)`)
- 헤딩에 `--fg`(`#0f172a`) — 순수 검정 금지
- radius는 6–12px 스케일 안에서 — 보수적 라운딩이 의도
- 모든 시세·재무 수치에 Geist Mono + `.tabular`
- 색은 반드시 토큰 유틸리티로 — `bg-surface`, `text-fg-muted`, `border-border`, `bg-accent`
- 상승 = `--success`(초록), 하락 = `--danger`(빨강) — 차트·티커·배지 전부 동일
- UI는 `@/components/ui` 프리미티브로 — Button, Input, Card, Badge, Heading, PageShell, Skeleton, ErrorState, EmptyState

### Don't
- Pretendard 700으로 헤드라인 만들지 말 것 — 300이 브랜드 보이스
- 카드·버튼에 큰 radius(16px+, 필 셰이프) 금지
- 중립 회색 그림자 금지 — 항상 블루 틴트
- hex를 컴포넌트에 하드코딩하지 말 것 — 토큰이 SOT
- `dark:` variant 금지 — 다크는 토큰 재정의로만 동작한다
- 경고 상태에 amber/orange/yellow를 따로 쓰지 말 것 — `--warning` 단일 계열
- 인터랙티브 요소에 warm 색(주황, 노랑) 금지 — indigo가 프라이머리
- raw `<button>`/`<input>` 직접 스타일링 금지 — 프리미티브를 거칠 것
- 그라디언트를 버튼·링크에 쓰지 말 것 — 장식 전용

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | 단일 컬럼, 헤딩 축소, 카드 스택 |
| Tablet | 640–1024px | 2컬럼 그리드, 중간 패딩 |
| Desktop | 1024–1280px | 풀 레이아웃, 3컬럼 피처 그리드 |
| Large Desktop | >1280px | PageShell 중앙 정렬 + 여유 마진 |

### Touch Targets
- 버튼 최소 높이 40px(md) / 32px(sm은 데스크톱 밀집 UI 전용, 모바일에서는 md로 승격)
- 마인드맵 노드는 터치 시 최소 44px 히트 영역
- 테이블 행 터치 타깃은 행 전체

### Collapsing Strategy
- 히어로: 56px → 32px 모바일, weight 300 유지
- 내비게이션: 수평 링크 → 햄버거 토글
- 피처 카드: 3컬럼 → 2컬럼 → 단일 스택
- 시세·재무 테이블: 모바일에서 수평 스크롤 (컬럼 숨김보다 스크롤 우선 — 수치 생략 금지)
- 마인드맵: 모바일에서 핀치 줌 + 패닝, 사이드 패널은 바텀 시트로
- 섹션 스페이싱: 64px+ → 40px 모바일

### Image Behavior
- 차트·대시보드 스크린샷은 모든 크기에서 블루 틴트 그림자 유지
- 히어로 그라디언트 장식은 모바일에서 단순화
- 카드 이미지는 radius 8px 일관 유지

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: `--accent` (`#4f46e5`), hover `--accent-hover` (`#4338ca`)
- 페이지 배경: `--surface` (`#f8fafc`) / 카드: `--surface-raised` (`#ffffff`)
- 헤딩·본문: `--fg` (`#0f172a`) / 보조: `--fg-muted` (`#475569`) / 캡션: `--fg-subtle` (`#64748b`)
- 보더: `--border` (`#e2e8f0`) / 강조 보더: `--border-strong` (`#cbd5e1`)
- 데이터 액센트: `--data` (`#0891b2`) — KRX 배지, 데이터 강조
- 상승/성공: `--success` (`#16a34a`) / 하락/오류: `--danger` (`#dc2626`) / 경고: `--warning` (`#d97706`)
- 포커스 링: `--ring` (`#818cf8`)
- 차트: `var(--chart-*)` 변수, 팔레트 SOT는 `src/components/charts/chartTheme.ts`

### Example Component Prompts
- "히어로 섹션: `bg-surface` 배경. 헤드라인 48px Pretendard weight 300, line-height 1.15, letter-spacing -0.96px, `text-fg`. 서브타이틀 18px weight 300 `text-fg-muted`. `Button variant='primary'`(bg-accent, radius 8px)와 `variant='secondary'`."
- "카드: `Card` 프리미티브 — `bg-surface-raised`, `border-border`, radius 12px. Elevated 그림자: rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px. 타이틀 22px weight 300 `text-fg`, 본문 16px `text-fg-muted`."
- "시세 테이블: 헤더 `bg-surface-sunken`, 수치 셀은 Geist Mono `.tabular` 우측 정렬, 상승 `text-success` 하락 `text-danger`, 행 hover `bg-surface-hover`."
- "시장 배지: `MarketBadge` — KRX는 `Badge tone='data'`, US는 `tone='accent'`. radius 6px, soft 배경 + 진한 텍스트."
- "빈 상태: `EmptyState` 프리미티브 — 한 문장 `text-fg` 18px weight 300 + primary CTA 하나. 일러스트 없음."

### Iteration Guide
1. 색·보더·배경은 반드시 토큰 유틸리티 — hex 하드코딩이 보이면 잘못된 것
2. 디스플레이는 300, UI는 400 — 두 웨이트 밖으로 나가지 않기
3. 그림자는 시맨틱 유틸만: `shadow-ambient`/`shadow-standard`/`shadow-elevated`/`shadow-deep` (§6 레벨과 1:1)
4. 숫자가 테이블·차트·티커에 있으면 무조건 Geist Mono + `.tabular` — 반복 셀은 `NumericText` 프리미티브
5. radius는 6/8/12 스케일에서만 고르기
6. 다크 대응은 토큰이 알아서 한다 — 컴포넌트에서 다크를 의식하지 말 것
7. 새 UI는 프리미티브 조합이 먼저, 커스텀은 마지막
8. 차트 색은 `chartTheme.ts` 경유 — lightweight-charts는 `getChartPalette()` + `subscribeThemeChange()`, recharts/SVG는 `var(--chart-*)`
9. 모달 스크림은 `bg-overlay`(slate 틴트) — `bg-black/40` 금지

**감사 체크리스트** (전부 0 또는 문서화된 예외만 남아야 통과):

```bash
grep -rn "dark:" apps/web/src --include="*.tsx"                          # → 0
grep -rn "font-bold\|font-semibold\|font-medium" apps/web/src --include="*.tsx"  # → 0 (코드 블록 500 예외)
grep -rEn "(bg|text|border|from|via|to|ring)-(slate|gray|violet|cyan|blue|red|green|amber|white|black)[0-9/]" apps/web/src --include="*.tsx"  # → 0
grep -rln "#[0-9a-fA-F]{6}" apps/web/src --include="*.tsx" --include="*.ts" | grep -v test
# → 예외 3곳만: chartTheme.ts(팔레트 SOT), manifest.ts(PWA), opengraph-image.tsx(next/og)
grep -rn "rounded-full" apps/web/src --include="*.tsx"
# → 원형 예외만: 마인드맵 원형 노드(92px)·NodeHandles·NodeDeleteButton·RelationEdge 삭제 버튼,
#    SearchBar 검색어 지우기 아이콘 버튼, TimelineSlider 트랙/썸, 상태 dot, 랜딩 배경 워시 원
grep -rn "shadow-\(sm\|md\|lg\|xl\|2xl\)\|var(--shadow-sm)\|var(--shadow-md)" apps/web/src --include="*.tsx"  # → 0 (시맨틱 4레벨만)
```

---

## 10. Voice & Tone

invest-in-best의 목소리는 데이터를 정확히 다루는 어드바이저의 것이다 — 정밀하고, 절제되고, 조용히 확신하며, 과장을 배격한다. 핵심 thesis "투자의 근본을 위해"가 레지스터를 정의한다: 수익을 약속하는 언어가 아니라 구조를 이해시키는 언어. 버튼 라벨은 간결한 명령형("종목 추가", "차트 보기")이고, "지금 바로 시작하세요! 🚀"는 없다. 숫자가 주인공인 화면에서 카피는 숫자를 방해하지 않는다.

| Context | Tone |
|---|---|
| 랜딩 헤드라인 | 선언적, 절제됨. 리서치 요약처럼 읽힌다. 최상급 금지. |
| 기능 설명 | 동사 하나 + 구체 기능. "밸류체인을 한눈에." — "투자 인생을 바꾸세요"가 아니라. |
| CTA | 간결한 명령형. "시작하기", "종목 추가", "차트 보기". |
| 오류 메시지 | 무엇이 왜 실패했는지 + 다음 행동. "문제가 발생했습니다" 단독 금지. |
| 데이터 라벨·툴팁 | 밀도 있게, 정확하게. 사용자를 동료 투자자로 존중. 용어는 첫 등장에서 짧게 풀어준다. |
| 온보딩 (초보자) | 쉬운 문장, 같은 정밀함. 쉽게 쓴다고 대충 말하지 않는다. |
| 법적 고지·면책 | **푸터에만.** UI 흐름 중간에 면책 문구를 반복 삽입하지 않는다. 형식적 문어체(합니다체). |
| 시세·수치 표시 | 카피 없음 — 숫자·단위·시점만. 해석 형용사("무려", "급등") 금지. |

**금지 표현.** "수익 보장", "확실한", "무조건", "폭등/떡상/따상", "지금 아니면 늦습니다", "혁신적인", "게임체인저". 일상 CTA의 느낌표. 마케팅·제품·데이터 서피스의 이모지. 수식어 스태킹("가장 강력하고 완벽한 최고의 분석 도구" — 하나만 고르거나, 대개는 0개). 리딩방 화법 전반.

## 11. Brand Narrative

invest-in-best는 **2026년 7월 9일** 시작된 투자 분석 서비스다. 핵심 thesis는 **"투자의 근본을 위해"** — 종목 추천과 수익 약속이 넘치는 환경에서, 기업·산업·밸류체인의 구조를 데이터로 이해하는 것이 투자의 근본이라는 입장이다. 제품은 그 입장을 그대로 구현한다: 종목·밸류체인 마인드맵으로 산업의 연결 구조를 보여주고, KRX·US 시장의 시세와 차트를 정밀한 수치로 제공한다.

이 서비스가 거부하는 것: 과장된 수익 언어, 해석을 강요하는 카피, 화면 곳곳에 흩어진 형식적 면책 문구(법적 고지는 푸터에 한 번, 제대로). 받아들이는 것: 자릿수가 정렬된 숫자, 구조를 드러내는 시각화, 초보자와 고수가 같은 데이터를 각자의 깊이로 읽을 수 있는 화면.

## 12. Principles

1. **디테일이 제품이다.** 시세 테이블의 자릿수 정렬이 어긋나면, 데이터 파이프라인이 틀린 것과 같은 무게로 신뢰를 잃는다.
2. **엄밀함이 화면에 드러나야 한다.** 정밀한 토큰, 타이트한 타이포, 문서화된 근거. 감으로 잡은 디자인은 이 시스템이 아니다.
3. **친절과 대담함의 균형.** 초보자를 위한 쉬운 언어(-0.96px 트래킹에도 온기는 있다)와 데이터의 대담한 밀도가 공존한다. 영리해 보이기 위한 장식은 없다.
4. **오늘 배포하되, 수년을 버틸 결정만.** 유행하는 필 버튼은 4년 뒤 낡아 보인다. 8px 코너는 그렇지 않다.
5. **가벼움이 확신의 신호다.** 디스플레이 weight 300 — 소리치지 않는 헤드라인이 볼륨 없는 권위를 만든다.
6. **크로마틱 그림자가 브랜드다.** `rgba(50,50,93,0.25)`는 slate-indigo 팔레트가 그림자 레이어에 재등장한 것. 회색 그림자였다면 다른 SaaS와 구분되지 않는다.
7. **필 버튼 금지.** 6–12px radius는 시각 취향이 아니라 시스템의 약속이다. 이 서비스는 분석 도구로 읽혀야 한다.
8. **직접 리서치하는 투자자가 일급 사용자다.** 마인드맵도, 시세 테이블도, 빈 상태 문구도 전부 디자인 서피스다. 마케팅이 데이터 화면보다 우선하지 않는다 — 동급이다.
9. **숫자는 일급 시민이다.** 모든 재무 수치·차트 축·티커에 tabular numerals. 숫자는 우연히 디지트인 본문이 아니라, 다른 규칙을 가진 타이포그래피다.

## 13. Personas

*아래 페르소나는 서비스가 정의한 타겟 세그먼트(투자 입문자, 체계적 투자를 원하는 숙련 투자자)에 기반한 가상 아키타입이며, 실존 인물이 아니다.*

**김서연, 27, 서울.** 첫 계좌를 만든 지 세 달 된 투자 입문자. 종목 이름은 알지만 그 회사가 산업 안에서 어디에 있는지 모른다는 것이 답답했다. 밸류체인 마인드맵에서 반도체 소재 기업이 어느 고객사로 이어지는지를 처음 눈으로 봤을 때 이 서비스를 신뢰하기 시작했다. 용어가 어려우면 이탈하지만, 쉬운 척하며 정보를 뭉개는 서비스는 더 빨리 떠난다. "수익 보장" 같은 문구가 보이면 리딩방과 같은 부류로 분류하고 삭제한다.

**박정후, 42, 판교.** 투자 경력 10년, 자기만의 리서치 프로세스를 가진 숙련 투자자. 감이 아니라 체계로 투자하고 싶어서 도구를 고른다. 화면의 데이터 밀도를 존중하는 서비스를 원한다 — 자릿수가 정렬된 300개 행을 한눈에 스캔할 수 있어야 하고, 여백을 늘리려고 데이터를 숨기는 "리디자인"에는 짜증을 낸다. 해석 형용사가 붙은 수치를 보면 그 서비스의 다른 숫자도 의심한다. 면책 문구가 화면마다 반복되는 서비스는 법무팀이 제품팀을 이긴 곳이라고 읽는다.

## 14. States

| State | Treatment |
|---|---|
| **Empty (마인드맵, 노드 없음)** | `EmptyState` 프리미티브. `--fg` 18px weight 300 한 문장: "아직 추가된 종목이 없습니다." primary CTA 하나: "종목 추가". 일러스트 없음. |
| **Empty (테이블, 0행)** | `--fg-muted` 14px 한 줄: "이 조건에 해당하는 데이터가 없습니다." 위에 필터 요약을 노출해 스코프를 조정할 수 있게. "No data found" 류의 영문 잔재 금지. |
| **Loading (첫 페인트)** | `Skeleton` 프리미티브 — 최종 치수 그대로의 `--border` 색 블록, 1.2s 시머. 수치 스켈레톤은 tabular 폭에 맞춘 좁은 바 — 최종 값보다 넓게 잡지 않는다. |
| **Loading (테이블 갱신)** | 헤더 아래 `--accent` 2px 프로그레스 바. 이전 값은 그대로 표시 — 갱신 중 테이블을 블록하지 않는다. |
| **Error (API 실패)** | `ErrorState` 프리미티브. `--danger` 보더 + `--danger-soft` 배경 인라인 배너. 메시지 = 무엇이 실패했는지 + 한 줄 설명 + "다시 시도" 액션. 일반론("문제가 발생했습니다") 단독 금지. |
| **Error (폼 검증)** | 필드 레벨. `invalid` prop — `--danger` 보더 + 하단 13px 오류 텍스트. 무엇이 왜 잘못됐고 어떤 값이 유효한지 명시 — "필수 항목입니다"로 끝내지 않는다. |
| **Error (시세 지연/미제공)** | 전용 상태. 숨기지 않고 명시: "실시간 시세가 지연되고 있습니다 (마지막 갱신 09:42)". 수치 옆 `Badge tone="warning"`. |
| **Success (저장 완료)** | 3s 자동 소멸 토스트. 과거형 평서문: "관심 종목에 추가했습니다." 이모지·느낌표 없음. |
| **Success (상승 표시)** | `--success` 텍스트 + `--success-soft` 배경 플래시. 상승=초록/하락=빨강 — 차트·티커·배지 전 화면 동일. |
| **Skeleton** | `--border` 색 블록, 최종 치수 고정. 수치 스켈레톤은 항상 예상 최장값보다 좁게 — 줄어드는 스켈레톤은 방향감각을 깨뜨린다. |
| **Disabled** | 표면·텍스트 동시 감쇄. accent 액션은 `rgba(79,70,229,0.35)` — 회색으로 바꾸지 않고 바랜 indigo로, 브랜드 읽힘 유지. |

## 15. Motion & Easing

**Durations**:

| Token | Value | Use |
|---|---|---|
| `motion-instant` | 0ms | 상태 커밋, 선택 틱, 포커스 링 |
| `motion-fast` | 120ms | hover, focus, 버튼 press |
| `motion-standard` | 200ms | 시트, 모달, 드롭다운, 행 확장 |
| `motion-slow` | 320ms | 페이지 전환, 드문 히어로 리빌 |

**Easings**:

| Token | Curve | Use |
|---|---|---|
| `ease-enter` | `cubic-bezier(0.2, 0.6, 0.25, 1)` | 등장 — 시트, 드롭다운, 플로팅 패널 |
| `ease-exit` | `cubic-bezier(0.4, 0.0, 1, 1)` | 퇴장 |
| `ease-standard` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | 양방향 전환 |

**명시적 금지.** 스프링, 오버슈트, 바운스 없음. 중간 제어값이 `1.0`을 넘는 `cubic-bezier` 금지. 스프링 이징은 소비자 앱의 재롱으로 읽힌다 — 이것은 투자 분석 도구다. 도구는 안정적이어야 한다.

**Signature motions.**

1. **시세 틱 플래시.** 가격 갱신 시 `--success-soft`/`--danger-soft` 배경 플래시 200ms 후 소멸. 숫자 자체는 이징 없이 즉시 교체 — 수치에 애니메이션을 걸면 읽는 순간의 값이 불확실해진다.
2. **테이블 행 리빌.** 새 행은 `motion-standard / ease-enter`로 3px 아래에서 페이드 인. 옆에서 슬라이드 금지 — 테이블의 시간 순서는 항상 위에서 아래다.
3. **마인드맵 노드 강조.** 노드 선택 시 연결 엣지가 `motion-standard`로 강조되고 관계 라벨은 항상 엣지 선 위 레이어를 유지한다. 카메라 이동은 `ease-standard` — 갑작스러운 점프 없음.
4. **Reduce motion.** `prefers-reduced-motion: reduce`에서 모든 `motion-*` 토큰은 `motion-instant`로 붕괴. 틱 플래시는 색 변화만 남고, 행 리빌은 즉시 표시. 접근성을 대가로 한 delight는 없다.

<!--
OmD v0.1 — Bootstrap provenance

Base reference: stripe (web/references/stripe/DESIGN.md, verified 2026-05-15).
구조(§1–15 헤딩), 그림자·모션·상태 철학, 보이스 레지스터를 보존.

Project deltas (.omd/init-context.json):
- color.hue_deg -9 / saturation -15%p / lightness +6%p → primary #533afd ⇒ #6366f1 (프로젝트 기존 accent와 일치)
- radius.delta_px +2 → 4–8px ⇒ 6–12px 스케일
- 폰트: sohne-var ⇒ Pretendard Variable (프로젝트 필수 규약), tnum ⇒ Geist Mono + .tabular
- 단일 라이트 테마 ⇒ 라이트 기본 + 다크 자동 (토큰 재정의)

§11–13 사실 정보는 2026-07-10 사용자 제공:
- 프로젝트명 invest-in-best, 2026-07-09 시작
- thesis "투자의 근본을 위해"
- 법적 고지·면책은 푸터에만 (§10에 규칙로 반영)
- 타겟: 투자 입문자 / 체계적 투자를 원하는 숙련 투자자 (§13 페르소나는 가상 아키타입)

토큰 SOT는 apps/web/src/app/globals.css — 이 문서와 충돌 시 globals.css가 우선.
-->
