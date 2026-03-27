# Liminal

오픈소스 LLM 기반 AI 어시스턴트 프로젝트. Anthropic API 없이 로컬 Ollama로 동작.

## 기능

- **실시간 스트리밍 채팅** — SSE(Server-Sent Events) 기반 토큰 스트리밍
- **툴 사용** — bash, 파일시스템, git, 웹 검색
- **아티팩트** — 코드, HTML, React, Mermaid 다이어그램 자동 감지 및 렌더링
- **프로젝트 관리** — 시스템 프롬프트, 파일 루트 경로 설정
- **메모리 시스템** — 대화 간 컨텍스트 유지
- **DeepSeek R1 지원** — `<think>` 블록 파싱, 추론 과정 표시
- **웹 UI** — Claude.ai 스타일 다크 테마
- **CLI 도구** — 터미널 기반 인터페이스

## 요구사항

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- [Ollama](https://ollama.ai/) (이미 설치됨)

## 설치

```bash
# 의존성 설치
pnpm install

# 빌드
pnpm build
```

## 실행

### Windows
```batch
scripts\start.bat
```

### Linux / macOS
```bash
./scripts/dev.sh
```

### 수동 실행
```bash
# 터미널 1 — API 서버
pnpm --filter @liminal/api dev

# 터미널 2 — 웹 UI
pnpm --filter @liminal/web dev
```

웹 UI: http://localhost:3000
API: http://localhost:3001

## 환경 설정

`.env.example`을 복사하여 `.env` 생성:

```bash
cp .env.example .env
```

주요 설정:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 서버 주소 |
| `OLLAMA_DEFAULT_MODEL` | `deepseek-r1:8b` | 기본 모델 |
| `OLLAMA_FAST_MODEL` | `deepseek-r1:8b` | 빠른 응답용 모델 |
| `OLLAMA_CODE_MODEL` | `deepseek-r1:8b` | 코드 생성용 모델 |
| `API_PORT` | `3001` | API 서버 포트 |
| `DATABASE_PATH` | `./data/liminal.db` | SQLite DB 경로 |

## 아키텍처

```
liminal/
├── packages/
│   ├── core/        # 공유 타입, 프롬프트 빌더, 컨텍스트 관리
│   ├── db/          # Drizzle ORM + SQLite (better-sqlite3)
│   ├── inference/   # Ollama 클라이언트, ReAct 루프, 스트림 파서
│   └── tools/       # bash, filesystem, git, web-search 툴
├── apps/
│   ├── api/         # Hono HTTP 서버 (포트 3001)
│   ├── web/         # Next.js 15 웹 UI (포트 3000)
│   └── cli/         # Ink 기반 터미널 CLI
└── scripts/
    ├── start.bat    # Windows 시작 스크립트
    └── dev.sh       # Linux/macOS 시작 스크립트
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/v1/messages` | 메시지 전송 (SSE 스트림 응답) |
| `GET` | `/api/v1/conversations` | 대화 목록 |
| `GET` | `/api/v1/conversations/:id` | 대화 상세 |
| `GET` | `/api/v1/conversations/:id/messages` | 메시지 목록 |
| `GET` | `/api/v1/projects` | 프로젝트 목록 |
| `GET` | `/api/v1/models` | Ollama 사용 가능 모델 목록 |
| `GET` | `/api/v1/artifacts/:id` | 아티팩트 조회 |
| `GET` | `/health` | 서버 상태 확인 |

### SSE 스트림 이벤트 형식

```
POST /api/v1/messages
{ "content": "안녕하세요", "conversation_id": "optional" }

→ data: {"type":"token","delta":"안녕"}
→ data: {"type":"token","delta":"하세요!"}
→ data: {"type":"thinking","delta":"[추론 과정]"}
→ data: {"type":"tool_call_start","id":"...","name":"bash","input":{...}}
→ data: {"type":"tool_call_result","id":"...","output":"...","is_error":false}
→ data: {"type":"artifact","id":"...","action":"create","artifact":{...}}
→ data: {"type":"done","message_id":"...","conversation_id":"..."}
```

## 현재 구현 상태 (Phase 1-2 완료)

- [x] 모노레포 구조 (pnpm + Turborepo)
- [x] 전체 TypeScript 타입 안정성
- [x] Ollama 스트리밍 추론
- [x] DeepSeek R1 `<think>` 블록 파싱
- [x] ReAct 툴콜 루프 (최대 10회 반복)
- [x] SQLite 자동 초기화 (마이그레이션 불필요)
- [x] SSE 실시간 스트리밍
- [x] 웹 UI (채팅, 아티팩트 패널, 사이드바)
- [x] 아티팩트 자동 감지 및 저장
- [x] bash, filesystem, git, web-search 툴
- [x] 프로젝트 + 메모리 시스템
- [x] CLI (Ink 기반)

## 라이선스

MIT
