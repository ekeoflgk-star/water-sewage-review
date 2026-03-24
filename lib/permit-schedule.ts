/**
 * 인허가 일정 계산 로직
 * - 선후행 관계 기반 일정 자동 산출
 * - 크리티컬 패스 계산
 */

import type { PermitCard, PermitVerdict } from '@/types';
import { PERMIT_INFO_MAP } from '@/lib/permit-info';

/** 일정 계산 결과 항목 */
export interface PermitScheduleItem {
  permitName: string;
  startDay: number;       // 착수일 (D+0 기준)
  endDay: number;         // 완료일
  duration: number;       // 소요일
  dependencies: string[]; // 선행 인허가명
  isCriticalPath: boolean;
  verdict: PermitVerdict;
}

/** 일정 계산 결과 */
export interface ScheduleResult {
  items: PermitScheduleItem[];
  totalDays: number;
  criticalPath: string[];
}

/**
 * 인허가 간 선후행 관계 정의
 * key: 후행 인허가명, value: 선행 인허가명 배열
 *
 * 관계 설명:
 * - 환경영향평가 → 공공하수도 설치인가
 * - 농지전용허가, 산지전용허가, 도로점용허가 → 공공하수도 설치인가
 * - 공공하수도 설치인가 → 공공하수도 사용개시 신고
 * - 도로점용, 하천점용, 농지전용, 산지전용은 병행 가능
 * - 문화재현상변경, 군사시설행위허가는 병행 가능
 */
const DEPENDENCY_MAP: Record<string, string[]> = {
  '공공하수도 설치인가': [
    '환경영향평가',
    '소규모 환경영향평가',
    '농지 전용 허가',
    '산지 전용 허가',
    '도로 점용 허가',
  ],
  '공공하수도 사용개시 신고': [
    '공공하수도 설치인가',
  ],
};

/**
 * PermitCard[] → 일정 계산
 * - not-applicable 제외된 카드만 받는다고 가정
 * - 선후행 관계에 따라 시작일 계산
 * - 크리티컬 패스 역추적
 */
export function calculateSchedule(permitCards: PermitCard[]): ScheduleResult {
  // not-applicable 제외
  const cards = permitCards.filter((c) => c.verdict !== 'not-applicable');

  if (cards.length === 0) {
    return { items: [], totalDays: 0, criticalPath: [] };
  }

  // 인허가명 → 카드 매핑
  const cardMap = new Map<string, PermitCard>();
  for (const card of cards) {
    cardMap.set(card.permitName, card);
  }

  // 실제 존재하는 카드에 대해서만 의존관계 필터링
  const activeDeps = new Map<string, string[]>();
  for (const card of cards) {
    const allDeps = DEPENDENCY_MAP[card.permitName] ?? [];
    // 선행 인허가가 실제 결과에 포함된 것만 의존관계로 설정
    const validDeps = allDeps.filter((dep) => cardMap.has(dep));
    activeDeps.set(card.permitName, validDeps);
  }

  // 각 인허가의 소요일수 조회
  const durationMap = new Map<string, number>();
  for (const card of cards) {
    const info = PERMIT_INFO_MAP[card.permitName];
    durationMap.set(card.permitName, info?.estimatedDays ?? 30);
  }

  // 위상 정렬 + 시작일 계산 (Forward pass)
  // endDay[i] = startDay[i] + duration[i]
  // startDay[i] = max(endDay[선행 인허가들])
  const startDayMap = new Map<string, number>();
  const endDayMap = new Map<string, number>();

  // 반복적으로 계산 (위상 정렬 대신 반복 수렴)
  const permitNames = cards.map((c) => c.permitName);

  // 초기화: 모든 항목 D+0 시작
  for (const name of permitNames) {
    startDayMap.set(name, 0);
    endDayMap.set(name, durationMap.get(name) ?? 30);
  }

  // 최대 반복 (DAG이므로 노드 수만큼이면 충분)
  for (let iter = 0; iter < permitNames.length; iter++) {
    let changed = false;
    for (const name of permitNames) {
      const deps = activeDeps.get(name) ?? [];
      if (deps.length === 0) continue;

      // 선행 인허가들의 완료일 중 최대값이 시작일
      const maxPredEnd = Math.max(
        ...deps.map((dep) => endDayMap.get(dep) ?? 0)
      );

      const currentStart = startDayMap.get(name) ?? 0;
      if (maxPredEnd > currentStart) {
        startDayMap.set(name, maxPredEnd);
        endDayMap.set(name, maxPredEnd + (durationMap.get(name) ?? 30));
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 총 소요기간
  const totalDays = Math.max(...Array.from(endDayMap.values()));

  // 크리티컬 패스 역추적 (Backward pass)
  // 크리티컬 패스: 총 소요기간에 영향을 주는 경로
  const criticalPath: string[] = [];
  const criticalSet = new Set<string>();

  // 총 소요기간과 endDay가 같은 항목부터 역추적
  function traceCriticalPath(name: string) {
    if (criticalSet.has(name)) return;
    criticalSet.add(name);
    criticalPath.push(name);

    const deps = activeDeps.get(name) ?? [];
    if (deps.length === 0) return;

    // 시작일을 결정하는 선행 항목 (endDay가 이 항목의 startDay와 같은 것)
    const myStart = startDayMap.get(name) ?? 0;
    for (const dep of deps) {
      const depEnd = endDayMap.get(dep) ?? 0;
      if (depEnd === myStart) {
        traceCriticalPath(dep);
      }
    }
  }

  // 종료일이 totalDays인 항목부터 역추적
  for (const name of permitNames) {
    if ((endDayMap.get(name) ?? 0) === totalDays) {
      traceCriticalPath(name);
    }
  }

  // 결과 조립
  const items: PermitScheduleItem[] = cards.map((card) => ({
    permitName: card.permitName,
    startDay: startDayMap.get(card.permitName) ?? 0,
    endDay: endDayMap.get(card.permitName) ?? 0,
    duration: durationMap.get(card.permitName) ?? 30,
    dependencies: activeDeps.get(card.permitName) ?? [],
    isCriticalPath: criticalSet.has(card.permitName),
    verdict: card.verdict,
  }));

  // startDay 기준 정렬
  items.sort((a, b) => a.startDay - b.startDay || a.endDay - b.endDay);

  // 크리티컬 패스를 시간순으로 정렬
  const sortedCriticalPath = criticalPath.sort((a, b) => {
    return (startDayMap.get(a) ?? 0) - (startDayMap.get(b) ?? 0);
  });

  return {
    items,
    totalDays,
    criticalPath: sortedCriticalPath,
  };
}
