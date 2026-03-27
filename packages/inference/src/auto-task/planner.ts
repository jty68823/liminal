/**
 * LLM-based task planner — decomposes an objective into a DAG of subtasks.
 * Supports requesting dynamic (domain-specific) agent creation.
 */

import { providerRegistry } from '../providers/registry.js';
import { nanoid } from 'nanoid';
import { BASE_AGENT_ROLES } from '../cowork/types.js';
import type { AutoTaskPlan, Subtask, SecurityLevel, PlanDynamicAgent } from './types.js';

const PLANNER_SYSTEM_PROMPT = `당신은 자율 태스크 플래너입니다. 주어진 목표를 실행 가능한 서브태스크의 DAG(유향 비순환 그래프)로 분해합니다.

## 사용 가능한 서브태스크 타입
- tool_call: 단일 도구 실행 (toolName, toolInput 필드 필요)
- web_search: 웹 검색 (searchQuery 필드 필요)
- sub_agent: 병렬 서브에이전트 실행 (agentTasks 배열 필요)
- cowork: 멀티에이전트 협업 (coworkMode: pipeline/parallel/discussion 필요)
- code_execution: 코드/명령어 실행 (code 필드 필요)

## 사용 가능한 도구 (tool_call 타입에서 toolName으로 사용)
bash, read_file, write_file, edit_file, list_files, search_files, git, web_search, fetch_page, analyze_pdf, analyze_csv, dispatch_agents

## 기본 에이전트 역할 (sub_agent/cowork에서 role로 사용)
architect, coder, reviewer, tester, security, researcher, data_scientist, devops, product, domain_expert

## 동적 에이전트 생성
기본 10개 역할로 충분하지 않은 특화된 도메인 전문성이 필요한 경우, dynamicAgents 배열에 새 에이전트를 정의할 수 있습니다:
- 기본 역할과 중복되는 이름은 사용 불가
- 역할명은 snake_case (예: "blockchain_expert", "medical_advisor")
- 각 에이전트에 해당 도메인에 특화된 상세한 시스템 프롬프트를 작성
- 작업 완료 후 자동 삭제되므로, 해당 태스크에만 필요한 전문가를 자유롭게 생성

## 출력 형식 (반드시 유효한 JSON만 출력)
{
  "objective": "목표 요약",
  "reasoning": "분해 전략 설명",
  "estimatedSteps": 숫자,
  "recommendedConcurrency": 숫자(1-5, 최적 동시실행 수),
  "dynamicAgents": [
    {
      "role": "고유_snake_case_역할명",
      "label": "표시 이름",
      "description": "짧은 설명",
      "systemPrompt": "상세한 시스템 프롬프트 (전문가 수준)",
      "color": "#hex색상 (선택)",
      "icon": "이모지 (선택)"
    }
  ],
  "subtasks": [
    {
      "id": "고유ID",
      "title": "짧은 제목",
      "description": "상세 설명",
      "type": "타입",
      "dependsOn": ["의존하는 서브태스크 ID들"],
      "weight": 숫자(1=경량, 2=보통, 3=중량)
      // 타입별 추가 필드
    }
  ]
}

## 규칙
1. 각 subtask.id는 고유해야 함
2. dependsOn은 반드시 유효한 서브태스크 ID를 참조해야 함 (순환 참조 금지)
3. 병렬로 실행 가능한 태스크는 같은 의존성을 가지게 설계
4. 3-10개의 서브태스크로 분해 (너무 세분화하지 말 것)
5. weight는 예상 리소스 사용량에 따라 설정 (1=빠른 도구호출, 2=LLM 기반 작업, 3=멀티에이전트/코워크)
6. recommendedConcurrency는 DAG 구조와 weight를 고려하여 최적값을 제안
7. 기본 에이전트 역할이 적합하면 동적 에이전트를 생성하지 말 것 (불필요한 생성 금지)
8. dynamicAgents는 해당 태스크에 특화된 전문성이 필요한 경우에만 사용`;

function extractJson(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

function validateDag(subtasks: Subtask[]): void {
  const ids = new Set(subtasks.map((s) => s.id));
  for (const subtask of subtasks) {
    for (const dep of subtask.dependsOn) {
      if (!ids.has(dep)) {
        throw new Error(`Subtask "${subtask.id}" has invalid dependency "${dep}"`);
      }
      if (dep === subtask.id) {
        throw new Error(`Subtask "${subtask.id}" cannot depend on itself`);
      }
    }
  }
}

const BASE_ROLE_SET = new Set<string>(BASE_AGENT_ROLES);

function validateDynamicAgents(agents: PlanDynamicAgent[]): PlanDynamicAgent[] {
  const seen = new Set<string>();
  const validated: PlanDynamicAgent[] = [];

  for (const agent of agents) {
    if (!agent.role || !agent.label || !agent.systemPrompt) continue;
    if (BASE_ROLE_SET.has(agent.role)) continue; // Skip collisions with base roles
    if (seen.has(agent.role)) continue; // Skip duplicates
    seen.add(agent.role);
    validated.push({
      role: agent.role,
      label: agent.label,
      description: agent.description || agent.label,
      systemPrompt: agent.systemPrompt,
      color: agent.color,
      icon: agent.icon,
    });
  }

  return validated;
}

export async function planAutoTask(
  objective: string,
  securityLevel: SecurityLevel,
  model: string,
): Promise<AutoTaskPlan> {
  const provider = providerRegistry.getActive();

  const securityNote = securityLevel === 1
    ? '보안 레벨 1: 모든 도구를 제한 없이 사용 가능'
    : securityLevel === 2
      ? '보안 레벨 2: 파일 바이러스 검사 적용, 기본 명령어 검증 수행'
      : '보안 레벨 3: 샌드박스 실행, AES-256 파일 암호화, 해시 검증 적용';

  const userMessage = `목표: ${objective}\n\n${securityNote}\n\n위 목표를 서브태스크 DAG로 분해하세요. JSON만 출력하세요.`;

  const response = await provider.chat({
    model,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    stream: false,
  });

  const rawJson = extractJson(response.message.content);

  let parsed: {
    objective?: string;
    reasoning?: string;
    estimatedSteps?: number;
    recommendedConcurrency?: number;
    dynamicAgents?: Array<Partial<PlanDynamicAgent>>;
    subtasks?: Array<Partial<Subtask>>;
  };
  try {
    parsed = JSON.parse(rawJson) as typeof parsed;
  } catch {
    throw new Error(`Planner returned invalid JSON: ${rawJson.slice(0, 200)}`);
  }

  // Normalize subtasks
  const subtasks: Subtask[] = (parsed.subtasks ?? []).map((s) => ({
    id: s.id ?? nanoid(),
    title: s.title ?? 'Untitled subtask',
    description: s.description ?? '',
    type: s.type ?? 'tool_call',
    dependsOn: s.dependsOn ?? [],
    status: 'pending' as const,
    weight: s.weight ?? 2,
    toolName: s.toolName,
    toolInput: s.toolInput,
    agentTasks: s.agentTasks,
    coworkMode: s.coworkMode,
    searchQuery: s.searchQuery,
    code: s.code,
  }));

  validateDag(subtasks);

  // Validate dynamic agents
  const dynamicAgents = validateDynamicAgents(
    (parsed.dynamicAgents ?? []).map((a) => ({
      role: a.role ?? '',
      label: a.label ?? '',
      description: a.description ?? '',
      systemPrompt: a.systemPrompt ?? '',
      color: a.color,
      icon: a.icon,
    })),
  );

  return {
    objective: parsed.objective ?? objective,
    subtasks,
    reasoning: parsed.reasoning ?? '',
    estimatedSteps: parsed.estimatedSteps ?? subtasks.length,
    recommendedConcurrency: parsed.recommendedConcurrency,
    dynamicAgents: dynamicAgents.length > 0 ? dynamicAgents : undefined,
  };
}
