# TheVIA - 개발 플랜

## 1. 기술 아키텍처

### 1.1 시스템 아키텍처 개요

```
+------------------+          +------------------+          +------------------+
|                  |          |                  |          |                  |
|   TheVIA 프론트   |  <---->  |   TheVIA API     |  <---->  |   Database       |
|   (VIA 포크)      |   REST   |   (백엔드)        |          |                  |
|                  |          |                  |          |                  |
+------------------+          +------------------+          +------------------+
|                  |          |                  |          |                  |
| - React + TS     |          | - Node.js        |          | - PostgreSQL     |
| - Redux Toolkit  |          | - Express/Fastify |          |   (JSON 메타)    |
| - Vite           |          | - REST API       |          | - S3/R2          |
| - WebHID API     |          | - JSON 검증       |          |   (JSON 파일)    |
| - Three.js       |          | - Rate limiting   |          |                  |
| - i18next        |          |                  |          |                  |
+------------------+          +------------------+          +------------------+
        |
        v
+------------------+
| 브라우저 로컬      |
| - IndexedDB      |
|   (커스텀 JSON)   |
| - localStorage    |
|   (설정/투표이력)  |
+------------------+
```

### 1.2 프론트엔드 (VIA 포크)

| 항목 | 기술 |
|------|------|
| **프레임워크** | React 18+ |
| **상태관리** | Redux Toolkit (기존 VIA 구조 유지) |
| **빌드** | Vite |
| **언어** | TypeScript |
| **3D 렌더링** | Three.js + @react-three/fiber (기존 VIA) |
| **로컬 저장** | IndexedDB (idb-keyval, 기존 VIA) |
| **국제화** | i18next (기존 VIA) |
| **스타일** | styled-components (기존 VIA) |
| **HID 통신** | WebHID API (기존 VIA) |

**VIA 원본 대비 수정/추가 모듈:**

```
src/
├── store/
│   ├── devicesSlice.ts          # [수정] 커뮤니티 매칭 로직 추가
│   ├── definitionsSlice.ts      # [수정] 커뮤니티 JSON 로딩 추가
│   └── communitySlice.ts        # [신규] 커뮤니티 상태 관리
│
├── components/
│   ├── community/
│   │   ├── TrustBadge.tsx       # [신규] 신뢰도 배지 컴포넌트
│   │   ├── NotificationBar.tsx  # [신규] 상단 알림바
│   │   ├── JsonDropdown.tsx     # [신규] JSON 선택 드롭다운
│   │   ├── UploadDialog.tsx     # [신규] JSON 업로드 다이얼로그
│   │   └── VoteButtons.tsx      # [신규] 추천/비추천 버튼
│   │
│   ├── community-page/
│   │   ├── CommunityPage.tsx    # [신규] 커뮤니티 탭 페이지
│   │   ├── KeyboardSearch.tsx   # [신규] 키보드 검색
│   │   └── KeyboardList.tsx     # [신규] 키보드 목록
│   │
│   └── about/
│       └── AboutPage.tsx        # [신규] TheVIA 소개 페이지
│
├── utils/
│   ├── community-api.ts         # [신규] 백엔드 API 클라이언트
│   ├── json-validator.ts        # [신규] JSON 스키마 검증
│   └── session-tracker.ts       # [신규] 세션 추적 (신뢰도용)
│
└── Routes.tsx                   # [수정] 커뮤니티/소개 라우트 추가
```

### 1.3 백엔드 API

| 항목 | 기술 |
|------|------|
| **런타임** | Node.js 20+ |
| **프레임워크** | Fastify (경량, 고성능) |
| **언어** | TypeScript |
| **ORM** | Drizzle ORM (TypeScript-first, 경량) |
| **검증** | Zod (JSON 스키마 검증) |
| **보안** | helmet, rate-limit, CORS |
| **배포** | Docker + Fly.io 또는 Railway |

**API 엔드포인트 설계:**

```
POST   /api/v1/definitions/search     # VID+PID+name으로 JSON 검색
GET    /api/v1/definitions/:id         # 특정 JSON 정의 조회
POST   /api/v1/definitions             # JSON 업로드
GET    /api/v1/definitions/:id/json    # JSON 파일 다운로드

POST   /api/v1/trust/session           # 세션 완료 기록 (신뢰도 +1)
POST   /api/v1/trust/vote              # 추천/비추천 투표
POST   /api/v1/trust/replace           # JSON 교체 기록 (신뢰도 -2)

GET    /api/v1/keyboards               # 키보드 목록 (검색/필터)
GET    /api/v1/keyboards/recent        # 최근 등록
GET    /api/v1/keyboards/popular       # 인기 키보드

GET    /api/v1/stats                   # 통계 (총 등록 수, 매칭률 등)
```

### 1.4 데이터베이스

| 항목 | 기술 |
|------|------|
| **메인 DB** | PostgreSQL 16 (Neon 또는 Supabase 무료 티어) |
| **파일 스토리지** | Cloudflare R2 또는 S3 (JSON 파일 원본) |
| **캐시** | 프론트엔드 IndexedDB + API 응답 캐시 |

**핵심 테이블 설계:**

```sql
-- 키보드 정의 매칭 레코드
CREATE TABLE definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       INTEGER NOT NULL,           -- USB Vendor ID
    product_id      INTEGER NOT NULL,           -- USB Product ID
    product_name    VARCHAR(255) NOT NULL,       -- WebHID productName
    vendor_product_id BIGINT GENERATED ALWAYS AS
        (vendor_id * 65536 + product_id) STORED, -- VIA 매칭 키
    connection_type VARCHAR(20) NOT NULL         -- 'usb' | 'dongle'
        DEFAULT 'usb',

    -- JSON 메타데이터
    keyboard_name   VARCHAR(255) NOT NULL,       -- JSON 내 name 필드
    json_url        VARCHAR(512) NOT NULL,       -- R2/S3 파일 URL
    json_hash       VARCHAR(64) NOT NULL,        -- SHA-256 (중복 방지)
    json_version    INTEGER NOT NULL DEFAULT 1,  -- JSON 버전
    via_protocol    VARCHAR(10) NOT NULL          -- 'v2' | 'v3'
        DEFAULT 'v3',

    -- 신뢰도
    trust_score     INTEGER NOT NULL DEFAULT 0,
    upvotes         INTEGER NOT NULL DEFAULT 0,
    downvotes       INTEGER NOT NULL DEFAULT 0,
    session_count   INTEGER NOT NULL DEFAULT 0,  -- 정상 완료 세션 수
    replace_count   INTEGER NOT NULL DEFAULT 0,  -- JSON 교체 횟수

    -- 메타
    uploader_name   VARCHAR(100),                -- 선택적 닉네임
    uploader_hash   VARCHAR(64),                 -- 브라우저 fingerprint hash
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 인덱스용 제약
    UNIQUE(vendor_id, product_id, product_name, json_hash, connection_type)
);

-- 투표 기록 (중복 투표 방지)
CREATE TABLE votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id   UUID NOT NULL REFERENCES definitions(id),
    voter_hash      VARCHAR(64) NOT NULL,        -- 브라우저 fingerprint
    vote_type       VARCHAR(10) NOT NULL,        -- 'up' | 'down'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(definition_id, voter_hash)
);

-- 세션 기록 (신뢰도 자동 계산용)
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id   UUID NOT NULL REFERENCES definitions(id),
    session_hash    VARCHAR(64) NOT NULL,        -- 브라우저 fingerprint
    outcome         VARCHAR(20) NOT NULL,        -- 'completed' | 'replaced'
    duration_sec    INTEGER,                      -- 세션 지속 시간
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_definitions_match
    ON definitions(vendor_id, product_id, product_name);
CREATE INDEX idx_definitions_vpid
    ON definitions(vendor_product_id);
CREATE INDEX idx_definitions_trust
    ON definitions(trust_score DESC);
CREATE INDEX idx_definitions_created
    ON definitions(created_at DESC);
```

---

## 2. 개발 단계

### 전체 타임라인 개요

```
Phase 1: MVP (4~6주)
  - VIA 포크 + 커뮤니티 JSON 자동매칭 핵심 기능
  - 최소 백엔드 + DB
  - 배포 가능한 상태

Phase 2: 확장 (4~6주)
  - 커뮤니티 페이지
  - 신뢰도 시스템 고도화
  - UX 개선

Phase 3: 고도화 (4~6주)
  - 키맵 공유
  - 다국어
  - 통계/분석
  - 제조사 인증
```

---

### Phase 1: MVP (4~6주)

**목표**: "키보드 연결 --> 커뮤니티 JSON 자동매칭 --> 키 설정"이 동작하는 최소 제품

#### Sprint 1 (1~2주): VIA 포크 세팅 + 백엔드 기초

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 1.1 | VIA 원본 포크 및 로컬 빌드 환경 구축 | P0 | 2시간 |
| 1.2 | VIA 빌드 및 정상 동작 확인 (npm run dev) | P0 | 2시간 |
| 1.3 | TheVIA 브랜딩 적용 (로고, 타이틀, 파비콘) | P1 | 3시간 |
| 1.4 | 백엔드 프로젝트 초기화 (Fastify + TypeScript + Drizzle) | P0 | 4시간 |
| 1.5 | PostgreSQL DB 세팅 + 스키마 마이그레이션 | P0 | 3시간 |
| 1.6 | JSON 파일 스토리지 세팅 (Cloudflare R2) | P0 | 2시간 |
| 1.7 | 핵심 API 구현: `POST /definitions/search` | P0 | 4시간 |
| 1.8 | 핵심 API 구현: `POST /definitions` (업로드) | P0 | 4시간 |
| 1.9 | 핵심 API 구현: `GET /definitions/:id/json` | P0 | 2시간 |
| 1.10 | JSON 스키마 검증 로직 (Zod) | P0 | 3시간 |
| 1.11 | API Rate limiting + CORS 설정 | P1 | 2시간 |

#### Sprint 2 (2~3주): 프론트엔드 커뮤니티 매칭 통합

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 2.1 | `community-api.ts` 구현 (API 클라이언트) | P0 | 3시간 |
| 2.2 | `communitySlice.ts` 구현 (Redux 상태) | P0 | 4시간 |
| 2.3 | `devicesSlice.ts` 수정: 키보드 연결 시 커뮤니티 DB 검색 로직 추가 | P0 | 6시간 |
| 2.4 | `definitionsSlice.ts` 수정: 커뮤니티 JSON 로딩 + 캐싱 | P0 | 5시간 |
| 2.5 | `NotificationBar.tsx` 구현 (상단 알림바) | P0 | 4시간 |
| 2.6 | `TrustBadge.tsx` 구현 (Official/Community/New 배지) | P0 | 2시간 |
| 2.7 | `VoteButtons.tsx` 구현 (추천/비추천) | P1 | 3시간 |
| 2.8 | JSON 미등록 키보드 안내 화면 구현 | P0 | 4시간 |
| 2.9 | `UploadDialog.tsx` 구현 (JSON 업로드 + 커뮤니티 공유) | P0 | 5시간 |
| 2.10 | `json-validator.ts` 구현 (프론트엔드 JSON 검증) | P1 | 3시간 |
| 2.11 | `session-tracker.ts` 구현 (세션 추적, 정상 완료 감지) | P1 | 4시간 |

#### Sprint 3 (1~2주): 신뢰도 기초 + 배포

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 3.1 | 신뢰도 API: `POST /trust/session`, `POST /trust/vote` | P0 | 4시간 |
| 3.2 | 신뢰도 계산 로직 (점수 집계, 등급 결정) | P0 | 3시간 |
| 3.3 | 투표 중복 방지 (브라우저 fingerprint 기반) | P1 | 3시간 |
| 3.4 | `JsonDropdown.tsx` 구현 (복수 JSON 선택) | P1 | 4시간 |
| 3.5 | Settings 탭에 커뮤니티 매칭 ON/OFF 토글 추가 | P1 | 2시간 |
| 3.6 | 프론트엔드 빌드 + 정적 호스팅 배포 (Cloudflare Pages) | P0 | 3시간 |
| 3.7 | 백엔드 Docker화 + 배포 (Fly.io 또는 Railway) | P0 | 4시간 |
| 3.8 | DB 배포 (Neon PostgreSQL) | P0 | 2시간 |
| 3.9 | 도메인 연결 + HTTPS 설정 | P1 | 2시간 |
| 3.10 | 초기 시드 데이터 수집 (주요 키보드 JSON 10~20개) | P1 | 4시간 |
| 3.11 | E2E 테스트: 연결 --> 매칭 --> 설정 --> 종료 플로우 | P0 | 4시간 |

**Phase 1 완료 기준:**
- [x] 키보드 연결 시 커뮤니티 DB에서 JSON 자동매칭
- [x] JSON 업로드 및 커뮤니티 공유 가능
- [x] 기본 신뢰도 점수 동작 (세션 완료, 투표)
- [x] 기존 VIA 기능 100% 정상 동작
- [x] 프로덕션 배포 완료

---

### Phase 2: 확장 (4~6주)

**목표**: 커뮤니티 페이지, 신뢰도 고도화, UX 개선

#### Sprint 4 (2주): 커뮤니티 페이지

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 4.1 | `CommunityPage.tsx` 기본 레이아웃 | P0 | 4시간 |
| 4.2 | `KeyboardSearch.tsx` 검색 기능 (이름, VID/PID) | P0 | 5시간 |
| 4.3 | `KeyboardList.tsx` 목록 표시 (페이지네이션) | P0 | 4시간 |
| 4.4 | 키보드 상세 페이지 (등록된 JSON 목록, 신뢰도, 투표) | P1 | 6시간 |
| 4.5 | 최근 등록 / 인기 키보드 API 및 UI | P1 | 4시간 |
| 4.6 | About 페이지 구현 | P2 | 3시간 |
| 4.7 | 라우터 구성 + 네비게이션 업데이트 | P0 | 2시간 |
| 4.8 | 검색 API: `GET /keyboards` (필터, 정렬, 페이지네이션) | P0 | 5시간 |

#### Sprint 5 (2주): 신뢰도 고도화 + UX

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 5.1 | JSON 버전 관리 시스템 (업데이트 시 이전 버전 보존) | P1 | 5시간 |
| 5.2 | 신뢰도 Flagged 처리 (음수 점수 JSON 자동매칭 제외) | P0 | 3시간 |
| 5.3 | JSON 교체 시 신뢰도 감소 자동 처리 | P0 | 3시간 |
| 5.4 | JSON 업로드 미리보기 (키보드 레이아웃 렌더링) | P1 | 6시간 |
| 5.5 | 연결 방식(USB/동글) 자동 감지 및 표시 | P1 | 4시간 |
| 5.6 | 중복 JSON 업로드 감지 (hash 비교) | P1 | 3시간 |
| 5.7 | 에러 핸들링 개선 (네트워크 오류, API 실패 시 폴백) | P0 | 4시간 |
| 5.8 | 오프라인 모드: API 불가 시 로컬 IndexedDB 캐시 사용 | P1 | 5시간 |
| 5.9 | 모바일/WebHID 미지원 브라우저 안내 페이지 | P2 | 2시간 |

**Phase 2 완료 기준:**
- [x] 커뮤니티 탭에서 키보드 검색/브라우징 가능
- [x] JSON 버전 관리 동작
- [x] Flagged JSON 자동매칭 제외
- [x] 오프라인 폴백 동작
- [x] 에러 핸들링 완비

---

### Phase 3: 고도화 (4~6주)

**목표**: 제조사 인증, 키맵 공유, 다국어, 통계

#### Sprint 6 (2주): 제조사 인증 + 키맵 공유

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 6.1 | 제조사 인증 배지 시스템 (관리자 수동 부여) | P1 | 5시간 |
| 6.2 | 키맵 프리셋 공유 DB 스키마 + API | P2 | 6시간 |
| 6.3 | 키맵 내보내기/가져오기 UI | P2 | 5시간 |
| 6.4 | 키맵 프리셋 브라우징 UI (커뮤니티 탭 확장) | P2 | 5시간 |
| 6.5 | 관리자 대시보드 (신고된 JSON 검토, 제조사 인증) | P1 | 6시간 |

#### Sprint 7 (2주): 다국어 + 통계 + 최적화

| # | 태스크 | 우선순위 | 예상 시간 |
|---|--------|----------|-----------|
| 7.1 | 한국어 번역 (TheVIA 추가 UI) | P1 | 4시간 |
| 7.2 | 중국어 번역 | P2 | 4시간 |
| 7.3 | 통계 API: 총 등록 수, 매칭 성공률, 활성 기여자 | P2 | 4시간 |
| 7.4 | 통계 대시보드 UI (공개) | P2 | 5시간 |
| 7.5 | 성능 최적화: API 응답 캐싱 (Redis 또는 in-memory) | P1 | 4시간 |
| 7.6 | 프론트엔드 성능 최적화 (code splitting, lazy loading) | P1 | 4시간 |
| 7.7 | SEO 최적화 (커뮤니티 페이지 SSR 또는 pre-render) | P2 | 5시간 |
| 7.8 | VIA 원본 업스트림 추적 + 병합 전략 문서화 | P1 | 4시간 |

**Phase 3 완료 기준:**
- [x] 제조사 인증 배지 운영
- [x] 한국어/중국어 지원
- [x] 공개 통계 대시보드
- [x] 성능 최적화 완료

---

## 3. 배포 인프라

### 3.1 인프라 구성

```
                    사용자 브라우저
                         |
                    [Cloudflare CDN]
                    /           \
           [프론트엔드]       [API]
         Cloudflare Pages    Fly.io / Railway
                              |
                    +----+----+----+
                    |              |
              [PostgreSQL]   [Cloudflare R2]
               Neon (무료)    JSON 파일 저장
```

### 3.2 배포 비용 예상 (월간)

| 서비스 | 무료 티어 | 유료 전환 시점 | 예상 비용 |
|--------|-----------|---------------|-----------|
| **Cloudflare Pages** (프론트) | 무제한 | - | $0 |
| **Cloudflare R2** (JSON 저장) | 10GB + 1M req/월 | 초과 시 | $0~5 |
| **Neon PostgreSQL** | 512MB, 0.5 CU | DAU 1만+ | $0~19 |
| **Fly.io** (백엔드) | 3 shared-cpu VMs | 트래픽 증가 시 | $0~10 |
| **도메인** | - | 즉시 | ~$12/년 |
| **합계** | - | - | **$0~35/월** |

### 3.3 CI/CD

```
GitHub Push
    |
    v
GitHub Actions
    |
    +---> [프론트엔드]
    |     1. npm install
    |     2. npm run build
    |     3. Cloudflare Pages 배포
    |
    +---> [백엔드]
          1. Docker build
          2. 테스트 실행
          3. Fly.io / Railway 배포
          4. DB 마이그레이션 (변경 시)
```

---

## 4. VIA 포크 전략

### 4.1 수정 최소화 원칙

VIA 원본 업데이트를 추적하기 위해, 기존 코드 수정을 최소화하고 확장 위주로 개발한다.

| 전략 | 설명 |
|------|------|
| **래퍼 패턴** | 기존 함수를 수정하지 않고, 커뮤니티 로직을 래핑하는 새 함수 작성 |
| **미들웨어/플러그인** | Redux 미들웨어로 커뮤니티 기능 주입 |
| **별도 모듈** | 커뮤니티 관련 코드는 `src/community/` 하위에 격리 |
| **조건부 실행** | 기존 매칭 실패 시에만 커뮤니티 매칭 시도 (폴백 구조) |

### 4.2 업스트림 병합 절차

```
1. VIA 원본(the-via/app) remote 등록: upstream
2. 월 1회 upstream/main fetch
3. thevia/main에 merge (충돌 해결)
4. 커뮤니티 기능 정상 동작 확인 후 배포
```

### 4.3 핵심 수정 지점 (최소)

VIA 원본 코드에서 반드시 수정해야 하는 파일:

| 파일 | 수정 내용 | 수정 규모 |
|------|-----------|-----------|
| `src/store/devicesSlice.ts` | 디바이스 감지 후 커뮤니티 DB 검색 호출 추가 | 소 (10~20줄) |
| `src/store/definitionsSlice.ts` | 커뮤니티 JSON 로딩 로직 추가 | 소 (15~25줄) |
| `src/utils/hid-keyboards.ts` | 커뮤니티 매칭 폴백 추가 | 소 (10~15줄) |
| `src/Routes.tsx` | Community, About 라우트 추가 | 소 (5줄) |
| `src/index.tsx` 또는 레이아웃 | 상단 네비게이션에 Community, About 탭 추가 | 소 (5~10줄) |
| `package.json` | 추가 의존성 | 소 |

**신규 파일은 전부 `src/community/` 폴더 내에 격리하여 병합 충돌을 최소화.**

---

## 5. 우선순위 정리

### P0 - 반드시 MVP에 포함 (Phase 1)
1. VIA 포크 + 정상 빌드
2. 백엔드 API (검색, 업로드, 다운로드)
3. DB + JSON 스토리지
4. 프론트엔드 커뮤니티 매칭 통합
5. JSON 미등록 시 안내 화면
6. JSON 업로드 + 커뮤니티 공유
7. 기본 신뢰도 (세션 완료 자동 +1)
8. 기본 투표 (추천/비추천)
9. 배포 (프론트 + 백엔드 + DB)

### P1 - Phase 1~2 사이 구현
10. 상단 알림바 UX
11. JSON 드롭다운 (복수 JSON 선택)
12. JSON 스키마 검증 (프론트 + 백엔드)
13. Rate limiting + 보안
14. 커뮤니티 페이지 (검색/브라우징)
15. 오프라인 폴백
16. JSON 버전 관리

### P2 - Phase 2~3 구현
17. About 페이지
18. JSON 업로드 미리보기
19. 제조사 인증 배지
20. 키맵 공유
21. 다국어 (한국어, 중국어)
22. 통계 대시보드
23. SEO 최적화

---

## 6. 기술적 고려사항

### 6.1 WebHID productName 신뢰성

| 이슈 | 설명 | 대응 |
|------|------|------|
| productName 비어있음 | 일부 키보드는 productName을 보고하지 않음 | VID+PID만으로 매칭 시도, 복수 결과 시 드롭다운 |
| productName 불일치 | 같은 키보드라도 펌웨어 버전에 따라 다를 수 있음 | productName을 정규화(trim, lowercase) 후 비교 |
| productName 중복 | 다른 키보드가 같은 이름 사용 | VID+PID 조합으로 추가 구분 |

### 6.2 보안 고려사항

| 위협 | 대응 |
|------|------|
| 악성 JSON 업로드 | Zod 스키마 검증 + JSON 구조 제한 (실행 코드 불가) |
| API 남용 | Rate limiting (IP당 분당 30회, 업로드 일 10회) |
| 투표 조작 | 브라우저 fingerprint 기반 중복 방지 + 이상 패턴 감지 |
| XSS | JSON 값 렌더링 시 이스케이프 처리 |
| CORS | 허용 도메인 화이트리스트 |

### 6.3 VIA 원본 의존성

| 의존성 | 버전 | 용도 |
|--------|------|------|
| `@the-via/keyboards` | latest | 공식 키보드 정의 빌드 |
| `@the-via/reader` | latest | JSON 정의 파싱/검증 |
| `@reduxjs/toolkit` | ^2.x | 상태관리 |
| `three` | ^0.16x | 3D 키보드 렌더링 |
| `idb-keyval` | ^6.x | IndexedDB 래퍼 |
| `i18next` | ^23.x | 국제화 |
| `styled-components` | ^6.x | 스타일링 |

### 6.4 테스트 전략

| 레벨 | 도구 | 범위 |
|------|------|------|
| 유닛 테스트 | Vitest | 매칭 로직, 신뢰도 계산, JSON 검증 |
| API 테스트 | Vitest + supertest | 백엔드 엔드포인트 |
| E2E 테스트 | Playwright | 키보드 연결 -> 매칭 -> 설정 플로우 (WebHID mock) |
| 수동 테스트 | 실제 키보드 | 다양한 키보드로 연결 테스트 |

---

## 7. 성공 기준 및 마일스톤

| 마일스톤 | 시점 | 기준 |
|----------|------|------|
| **MVP 런칭** | Phase 1 완료 | 키보드 연결 -> 커뮤니티 매칭 -> 설정 동작 확인 |
| **커뮤니티 활성화** | 런칭 후 1개월 | JSON 50+ 등록, DAU 100+ |
| **안정화** | 런칭 후 3개월 | 매칭 성공률 60%+, 주요 버그 0 |
| **성장** | 런칭 후 6개월 | JSON 500+, MAU 5,000+, 키보드 커뮤니티 인지도 확보 |

---

*문서 작성일: 2026-03-13*
*프로젝트: TheVIA (https://github.com/jijeegee/thevia)*
