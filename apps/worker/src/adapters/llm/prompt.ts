/**
 * LLM 프롬프트 빌더 (docs/usecases/030/plan.md 모듈 5, 순수 함수).
 * 노드/관계 종류에 컴팩트 별칭(N1..Nn / R1..Rm)을 부여해 토큰을 절감하고 UUID 환각을 방지한다(R-12).
 * 실 UUID는 어댑터 밖으로만 흐른다 — 프롬프트 문자열에는 절대 노출되지 않는다.
 */
import type { LlmAnalysisInput } from "./contract";

export interface AliasMaps {
  nodeAliasToId: Map<string, string>;
  nodeIdToAlias: Map<string, string>;
  relationAliasToId: Map<string, string>;
  relationIdToAlias: Map<string, string>;
}

export function buildAliasMaps(input: LlmAnalysisInput): AliasMaps {
  const nodeAliasToId = new Map<string, string>();
  const nodeIdToAlias = new Map<string, string>();
  input.chainContext.nodes.forEach((node, index) => {
    const alias = `N${index + 1}`;
    nodeAliasToId.set(alias, node.nodeId);
    nodeIdToAlias.set(node.nodeId, alias);
  });

  const relationAliasToId = new Map<string, string>();
  const relationIdToAlias = new Map<string, string>();
  input.chainContext.activeRelationTypes.forEach((relationType, index) => {
    const alias = `R${index + 1}`;
    relationAliasToId.set(alias, relationType.relationTypeId);
    relationIdToAlias.set(relationType.relationTypeId, alias);
  });

  return { nodeAliasToId, nodeIdToAlias, relationAliasToId, relationIdToAlias };
}

const SYSTEM_PROMPT = `당신은 기업 밸류체인(가치사슬) 관계 분석가입니다.
주어진 공시와 밸류체인의 기존 노드·관계 종류 목록을 바탕으로, 공시 내용이 시사하는
노드 간 관계 변경안(추가/변경/삭제)을 제안하세요.

반드시 지켜야 할 제약:
1. 반드시 아래에 주어진 기존 노드 별칭(N1, N2, ...)만 사용하세요. 목록에 없는 새로운 기업/주체를 언급하거나
   제안하지 마세요(신규 노드 제안 금지).
2. 자기 참조(동일 노드를 source/target으로 지정) 제안은 하지 마세요.
3. 모든 제안은 반드시 주어진 활성 관계 종류 별칭(R1, R2, ...) 중 하나를 지정해야 합니다(필수 — 생략 불가).
4. 공시 내용에서 변경 근거가 명확하지 않으면 제안하지 마세요. 추측이나 과도한 해석을 피하세요.
5. 변경할 내용이 없다고 판단되면 빈 배열을 반환하세요.

출력은 반드시 아래 JSON 스키마를 따르는 구조화된 JSON이어야 합니다:
{
  "proposals": [
    {
      "proposalType": "relation_add" | "relation_update" | "relation_delete",
      "sourceNodeAlias": "N1",
      "targetNodeAlias": "N2",
      "relationTypeAlias": "R1",
      "rationale": "공시 인용 요지를 포함한 근거 설명"
    }
  ]
}`;

function formatNodeList(input: LlmAnalysisInput, aliasMaps: AliasMaps): string {
  return input.chainContext.nodes
    .map((node) => {
      const alias = aliasMaps.nodeIdToAlias.get(node.nodeId);
      return `- ${alias}: ${node.displayName} (${node.nodeKind})`;
    })
    .join("\n");
}

function formatRelationTypeList(input: LlmAnalysisInput, aliasMaps: AliasMaps): string {
  return input.chainContext.activeRelationTypes
    .map((relationType) => {
      const alias = aliasMaps.relationIdToAlias.get(relationType.relationTypeId);
      return `- ${alias}: ${relationType.name} (${relationType.isDirected ? "유향" : "무향"})`;
    })
    .join("\n");
}

function formatEdgeList(input: LlmAnalysisInput, aliasMaps: AliasMaps): string {
  if (input.chainContext.edges.length === 0) return "(기존 엣지 없음)";
  return input.chainContext.edges
    .map((edge) => {
      const sourceAlias = aliasMaps.nodeIdToAlias.get(edge.sourceNodeId);
      const targetAlias = aliasMaps.nodeIdToAlias.get(edge.targetNodeId);
      return `- ${sourceAlias} -> ${targetAlias} (${edge.relationTypeName})`;
    })
    .join("\n");
}

export interface AnalysisPrompt {
  system: string;
  user: string;
}

/**
 * 공시 컨텍스트 + 별칭 노드/관계 종류/엣지 요약으로 사용자 프롬프트를 조립한다.
 * `contentExcerpt`가 null이면 "원문 미확보, 메타데이터만으로 판단" 문구를 명시한다(R-3).
 */
export function buildAnalysisPrompt(input: LlmAnalysisInput, aliasMaps: AliasMaps): AnalysisPrompt {
  const { disclosure, chainContext } = input;
  const excerptSection =
    disclosure.contentExcerpt === null
      ? "(원문 미확보, 메타데이터만으로 판단하세요)"
      : disclosure.contentExcerpt;

  const user = `## 공시 정보
- 제목: ${disclosure.title}
- 공시일: ${disclosure.disclosureDate}
- 공시 기업: ${disclosure.companyName} (${disclosure.ticker}, ${disclosure.market})
- 원문 링크: ${disclosure.url ?? "(없음)"}

## 공시 원문 발췌
${excerptSection}

## 밸류체인: ${chainContext.chainName}

### 기존 노드 목록
${formatNodeList(input, aliasMaps)}

### 활성 관계 종류 목록
${formatRelationTypeList(input, aliasMaps)}

### 기존 엣지 요약
${formatEdgeList(input, aliasMaps)}`;

  return { system: SYSTEM_PROMPT, user };
}
