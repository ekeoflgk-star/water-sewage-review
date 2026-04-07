import { TocItem } from './types';

/** KDS 61 00 00 하수도설계기준 (2022) — 목차 데이터 */
export const TOC_KDS_61: TocItem[] = [
  {
    id: 'kds-61-10-00',
    title: 'KDS 61 10 00 하수도설계 일반사항',
    page: 1,
    level: 1,
    children: [
      { id: 's61-10-1', title: '1.1 목적', page: 1, level: 2 },
      { id: 's61-10-2', title: '1.2 적용범위', page: 1, level: 2 },
      { id: 's61-10-3', title: '1.3 참고기준', page: 2, level: 2 },
      { id: 's61-10-4', title: '1.4 용어의 정의', page: 3, level: 2 },
      { id: 's61-10-5', title: '1.5 하수도계획의 기본사항', page: 5, level: 2 },
      { id: 's61-10-6', title: '1.6 하수도시설 기본계획', page: 12, level: 2 },
    ],
  },
  {
    id: 'kds-61-30-00',
    title: 'KDS 61 30 00 하수관로시설',
    page: 25,
    level: 1,
    children: [
      { id: 's61-30-1', title: '1.1 일반사항', page: 25, level: 2 },
      { id: 's61-30-2', title: '1.2 관로계획', page: 28, level: 2 },
      { id: 's61-30-3', title: '1.3 우수관로', page: 35, level: 2 },
      { id: 's61-30-4', title: '1.4 오수관로', page: 42, level: 2 },
      { id: 's61-30-5', title: '1.5 합류식관로', page: 48, level: 2 },
      { id: 's61-30-6', title: '1.6 관종 및 기초', page: 52, level: 2 },
      { id: 's61-30-7', title: '1.7 맨홀 및 부대시설', page: 60, level: 2 },
    ],
  },
  {
    id: 'kds-61-40-00',
    title: 'KDS 61 40 00 하수처리시설',
    page: 70,
    level: 1,
    children: [
      { id: 's61-40-1', title: '1.1 일반사항', page: 70, level: 2 },
      { id: 's61-40-2', title: '1.2 예비처리시설', page: 75, level: 2 },
      { id: 's61-40-3', title: '1.3 1차 처리시설', page: 82, level: 2 },
      { id: 's61-40-4', title: '1.4 생물학적 처리', page: 90, level: 2 },
      { id: 's61-40-5', title: '1.5 고도처리', page: 110, level: 2 },
      { id: 's61-40-6', title: '1.6 소독시설', page: 125, level: 2 },
      { id: 's61-40-7', title: '1.7 방류시설', page: 130, level: 2 },
    ],
  },
  {
    id: 'kds-61-50-00',
    title: 'KDS 61 50 00 하수 펌프장시설',
    page: 135,
    level: 1,
    children: [
      { id: 's61-50-1', title: '1.1 일반사항', page: 135, level: 2 },
      { id: 's61-50-2', title: '1.2 펌프 설계', page: 138, level: 2 },
      { id: 's61-50-3', title: '1.3 부대설비', page: 145, level: 2 },
    ],
  },
  {
    id: 'kds-61-55-00',
    title: 'KDS 61 55 00 슬러지 처리시설',
    page: 152,
    level: 1,
    children: [
      { id: 's61-55-1', title: '1.1 일반사항', page: 152, level: 2 },
      { id: 's61-55-2', title: '1.2 슬러지 농축', page: 155, level: 2 },
      { id: 's61-55-3', title: '1.3 슬러지 소화', page: 162, level: 2 },
      { id: 's61-55-4', title: '1.4 슬러지 탈수', page: 172, level: 2 },
      { id: 's61-55-5', title: '1.5 슬러지 건조·소각', page: 182, level: 2 },
    ],
  },
  {
    id: 'kds-61-60-00',
    title: 'KDS 61 60 00 물재이용시설',
    page: 192,
    level: 1,
    children: [
      { id: 's61-60-1', title: '1.1 일반사항', page: 192, level: 2 },
      { id: 's61-60-2', title: '1.2 하수처리수 재이용', page: 195, level: 2 },
      { id: 's61-60-3', title: '1.3 빗물이용시설', page: 205, level: 2 },
      { id: 's61-60-4', title: '1.4 중수도', page: 212, level: 2 },
    ],
  },
  {
    id: 'kds-61-70-00',
    title: 'KDS 61 70 00 기타 하수도시설',
    page: 220,
    level: 1,
    children: [
      { id: 's61-70-1', title: '1.1 전기설비', page: 220, level: 2 },
      { id: 's61-70-2', title: '1.2 계장설비', page: 228, level: 2 },
      { id: 's61-70-3', title: '1.3 부대시설', page: 235, level: 2 },
    ],
  },
];
