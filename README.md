<p align="center">
  <img src="apps/web/public/logo.svg" alt="Liminal" width="80" />
</p>

<h1 align="center">Liminal</h1>

<p align="center">
  로컬 LLM 기반 풀스택 AI 어시스턴트 — Ollama로 동작하는 오픈소스 Claude 대안
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/Hono-server-orange" alt="Hono" />
  <img src="https://img.shields.io/badge/Ollama-local%20LLM-green" alt="Ollama" />
</p>

---

## 기능

- **실시간 스트리밍 채팅** — SSE 기반 토큰 스트리밍, DeepSeek R1 `<think>` 블록 파싱
- **23개 내장 도구** — bash, 파일시스템, git, 웹 검색, PDF/CSV/Excel 분석, MCP 클라이언트
- **Computer Use** — 자율 브라우저 자동화, 스크린 캡처, DOM 분석
- **Auto Task** — DAG 기반 태스크 오케스트레이션, 동적 에이전트, QA 리뷰
- **Dispatch** — 원격 태스크 실행 + WebSocket 실시간 이벤트 (Slack, Google Calendar 커넥터)
- **아티팩트** — Code, HTML, Mermaid, React, SVG, Markdown 렌더러 + 버전 관리 + Export
- **메모리** — 벡터 유사도 검색 기반 대화 간 컨텍스트 유지
- **멀티 에이전트** — 서브 에이전트 디스패치, 코워크 오케스트레이터, ReAct 툴콜 루프
- **데스크톱 & CLI** — Electron 앱 + Ink 기반 터미널 REPL

## 빠른 시작

### 요구사항

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Ollama](https://ollama.com/) 로컬 실행 중

### 설치 및 실행

```bash
# 클론
git clone https://github.com/jty68823/liminal.git
cd liminal

# 의존성 설치
pnpm install

# 모델 다운로드
ollama pull deepseek-r1:8b
ollama pull nomic-embed-text

# 개발 서버 시작
pnpm dev
```

**웹 UI** → http://localhost:3000 | **API** → http://localhost:3001

### 플랫폼별 실행

```bash
# Windows
scripts\start.bat

# Linux / macOS
./scripts/dev.sh

# 개별 패키지
pnpm --filter @liminal/api dev    # API만
pnpm --filter @liminal/web dev    # Web만
pnpm --filter @liminal/cli dev    # CLI만
pnpm build                        # 전체 빌드
pnpm test                         # 전체 테스트
```

## 아키텍처

```
liminal/
├── packages/
│   ├── core/         공유 타입, 프롬프트 빌더, 컨텍스트 관리
│   ├── db/           Drizzle ORM + SQLite, 자동 초기화, 벡터 검색
│   ├── inference/    Ollama 클라이언트, ReAct 루프, 스트림 파서, 임베딩
│   └── tools/        bash, filesystem, git, web-search, MCP, computer-use
├── apps/
│   ├── api/          Hono REST + SSE + WebSocket 서버 (포트 3001)
│   ├── web/          Next.js 15 웹 UI (포트 3000)
│   ├── cli/          Ink 기반 터미널 REPL
│   └── desktop/      Electron 데스크톱 앱
└── scripts/          개발/빌드 헬퍼 스크립트
```

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Next.js 15, React 19, Tailwind CSS 4, Zustand, framer-motion |
| 백엔드 | Hono, SSE 스트리밍, WebSocket |
| 데이터베이스 | SQLite (better-sqlite3), Drizzle ORM, WAL 모드 |
| AI | Ollama, deepseek-r1:8b, nomic-embed-text 임베딩 |
| 도구 | MCP 클라이언트, Playwright (브라우저), robotjs (스크린) |
| 빌드 | pnpm workspaces, Turborepo |
| 데스크톱 | Electron |
| CLI | Ink (React for terminals) |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/v1/messages` | 메시지 전송 (SSE 스트림 응답) |
| `PATCH` | `/api/v1/messages/:id` | 메시지 편집 |
| `GET` | `/api/v1/conversations` | 대화 목록 + 검색 |
| `GET` | `/api/v1/conversations/:id` | 대화 상세 |
| `GET` | `/api/v1/models` | 사용 가능 모델 목록 |
| `GET/POST` | `/api/v1/artifacts` | 아티팩트 CRUD + 버전 히스토리 |
| `GET/POST` | `/api/v1/mcp/servers` | MCP 서버 관리 |
| `POST` | `/api/v1/auto-task` | Auto Task 오케스트레이션 |
| `GET/POST` | `/api/v1/dispatch` | Dispatch 태스크 CRUD |
| `GET/POST` | `/api/v1/cowork` | 코워크 세션 관리 |
| `GET` | `/health` | 상태 확인 |
| `GET` | `/health/deep` | DB + Ollama + Provider 연결 확인 |

### SSE 스트림 이벤트

```
POST /api/v1/messages
{ "content": "안녕하세요", "conversationId": "optional" }

→ data: {"type":"token","delta":"안녕"}
→ data: {"type":"thinking","delta":"[추론 과정]"}
→ data: {"type":"tool_call_start","id":"...","name":"bash","input":{...}}
→ data: {"type":"tool_call_result","id":"...","output":"...","is_error":false}
→ data: {"type":"artifact","id":"...","action":"create","artifact":{...}}
→ data: {"type":"sub_agent_result","role":"...","output":"..."}
→ data: {"type":"autonomous_progress","iteration":1,"phase":"analyzing"}
→ data: {"type":"done","message_id":"...","conversation_id":"..."}
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 서버 주소 |
| `OLLAMA_DEFAULT_MODEL` | `deepseek-r1:8b` | 기본 채팅 모델 |
| `DATABASE_PATH` | `./data/liminal.db` | SQLite DB 경로 |
| `API_PORT` | `3001` | API 서버 포트 |
| `ENABLE_COMPUTER_USE` | `0` | Computer Use 활성화 (`1`로 설정) |
| `SEARXNG_URL` | — | SearXNG 인스턴스 (웹 검색용) |
| `LOG_DIR` | `./data/logs` | 로그 디렉토리 (프로덕션) |
| `LOG_LEVEL` | `debug` / `info` | Pino 로그 레벨 |

## 디자인 시스템

다크 테마 + 웜 액센트 (`#d4956b`), 글래스모피즘 이펙트, 스프링 애니메이션.

- Glass: `.glass`, `.glass-heavy` (backdrop-blur + 반투명 배경)
- Glow: `.glow-hover`, `.neon-focus`, `.animate-pulse-glow`
- Animation: `.message-enter-premium`, `.btn-ripple`, `.animate-float`
- Font: Inter + system monospace

## 구현 상태

- [x] 모노레포 (pnpm + Turborepo, 7개 패키지)
- [x] TypeScript strict mode 전체 적용
- [x] Ollama 스트리밍 + DeepSeek R1 `<think>` 파싱
- [x] ReAct 툴콜 루프 (최대 6회 반복, 토큰 버짓 관리)
- [x] 23개 도구 + MCP 클라이언트 동적 등록
- [x] 아티팩트 (7종 렌더러 + 버전 히스토리 + Export)
- [x] Auto Task (DAG 스케줄링, 동적 에이전트, QA 워크플로우)
- [x] Computer Use (자율 에이전트, 브라우저 자동화, OCR)
- [x] Dispatch (원격 실행, WebSocket, Slack/Calendar 커넥터)
- [x] 메모리 (벡터 유사도 검색 + 자동 팩트 추출)
- [x] 메시지 편집 (cascade delete 포함)
- [x] 코워크 (멀티 에이전트 협업 세션)
- [x] 웹 UI (채팅, 아티팩트, 사이드바, 커맨드 팔레트)
- [x] CLI (Ink 기반, 슬래시 커맨드 7종)
- [x] Electron 데스크톱 앱
- [x] Graceful shutdown + 구조화 로깅

## 라이선스

MIT
