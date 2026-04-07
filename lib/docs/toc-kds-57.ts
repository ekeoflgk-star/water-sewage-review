import { TocItem } from './types';

/** KDS 57 00 00 상수도설계기준 (2024) — 목차 데이터 */
export const TOC_KDS_57: TocItem[] = [
  {
    id: 'kds-57-10-00',
    title: 'KDS 57 10 00 상수도설계 일반사항',
    page: 1,
    level: 1,
    children: [
      { id: 's57-1-1', title: '1.1 목적', page: 1, level: 2 },
      { id: 's57-1-2', title: '1.2 적용범위', page: 1, level: 2 },
      { id: 's57-1-3', title: '1.3 참고기준', page: 2, level: 2 },
      { id: 's57-1-4', title: '1.4 용어의 정의', page: 2, level: 2 },
      { id: 's57-1-5', title: '1.5 기호의 정의', page: 3, level: 2 },
      { id: 's57-1-6', title: '1.6 상수도시설 계획의 기본적 개념', page: 4, level: 2 },
      { id: 's57-1-7', title: '1.7 시설의 개량·교체 등', page: 10, level: 2 },
    ],
  },
  {
    id: 'kds-57-17-00',
    title: 'KDS 57 17 00 상수도 내진설계',
    page: 12,
    level: 1,
    children: [
      { id: 's57-17-1', title: '1.1 목적', page: 12, level: 2 },
      { id: 's57-17-2', title: '1.2 적용범위', page: 12, level: 2 },
      { id: 's57-17-3', title: '1.3 참고기준', page: 12, level: 2 },
      { id: 's57-17-4', title: '1.4 내진설계 일반', page: 13, level: 2 },
    ],
  },
  {
    id: 'kds-57-20-00',
    title: 'KDS 57 20 00 취수시설',
    page: 18,
    level: 1,
    children: [
      { id: 's57-20-1', title: '1.1 일반사항', page: 18, level: 2 },
      { id: 's57-20-2', title: '1.2 수원의 종류', page: 19, level: 2 },
      { id: 's57-20-3', title: '1.3 취수시설 설계', page: 21, level: 2 },
    ],
  },
  {
    id: 'kds-57-30-00',
    title: 'KDS 57 30 00 도수·송수시설',
    page: 30,
    level: 1,
    children: [
      { id: 's57-30-1', title: '1.1 일반사항', page: 30, level: 2 },
      { id: 's57-30-2', title: '1.2 관로 설계', page: 32, level: 2 },
      { id: 's57-30-3', title: '1.3 관종 선정', page: 35, level: 2 },
      { id: 's57-30-4', title: '1.4 부대시설', page: 40, level: 2 },
    ],
  },
  {
    id: 'kds-57-35-00',
    title: 'KDS 57 35 00 배수시설',
    page: 48,
    level: 1,
    children: [
      { id: 's57-35-1', title: '1.1 일반사항', page: 48, level: 2 },
      { id: 's57-35-2', title: '1.2 배수관로', page: 50, level: 2 },
      { id: 's57-35-3', title: '1.3 배수지', page: 55, level: 2 },
    ],
  },
  {
    id: 'kds-57-40-00',
    title: 'KDS 57 40 00 급수시설',
    page: 62,
    level: 1,
    children: [
      { id: 's57-40-1', title: '1.1 일반사항', page: 62, level: 2 },
      { id: 's57-40-2', title: '1.2 급수관', page: 64, level: 2 },
      { id: 's57-40-3', title: '1.3 급수장치', page: 68, level: 2 },
    ],
  },
  {
    id: 'kds-57-55-00',
    title: 'KDS 57 55 00 정수시설',
    page: 75,
    level: 1,
    children: [
      { id: 's57-55-1', title: '1.1 일반사항', page: 75, level: 2 },
      { id: 's57-55-2', title: '1.2 착수정', page: 78, level: 2 },
      { id: 's57-55-3', title: '1.3 약품투입', page: 80, level: 2 },
      { id: 's57-55-4', title: '1.4 혼화·응집', page: 85, level: 2 },
      { id: 's57-55-5', title: '1.5 침전', page: 92, level: 2 },
      { id: 's57-55-6', title: '1.6 여과', page: 100, level: 2 },
      { id: 's57-55-7', title: '1.7 소독', page: 110, level: 2 },
      { id: 's57-55-8', title: '1.8 고도정수처리', page: 118, level: 2 },
    ],
  },
  {
    id: 'kds-57-60-00',
    title: 'KDS 57 60 00 펌프장시설',
    page: 130,
    level: 1,
    children: [
      { id: 's57-60-1', title: '1.1 일반사항', page: 130, level: 2 },
      { id: 's57-60-2', title: '1.2 펌프 선정', page: 132, level: 2 },
      { id: 's57-60-3', title: '1.3 펌프장 건축', page: 138, level: 2 },
    ],
  },
  {
    id: 'kds-57-70-00',
    title: 'KDS 57 70 00 기타 수도시설',
    page: 145,
    level: 1,
    children: [
      { id: 's57-70-1', title: '1.1 관리동', page: 145, level: 2 },
      { id: 's57-70-2', title: '1.2 계장설비', page: 148, level: 2 },
      { id: 's57-70-3', title: '1.3 전기설비', page: 155, level: 2 },
      { id: 's57-70-4', title: '1.4 배수지·저수조', page: 165, level: 2 },
      { id: 's57-70-5', title: '1.5 기타 부속시설', page: 175, level: 2 },
    ],
  },
];
