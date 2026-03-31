/**
 * DXF 공간 교차 분석 모듈 (Phase B)
 *
 * 설계 요소($레이어)와 인허가 구역(#레이어) 간의
 * 공간 교차를 Turf.js로 분석하여 교차 연장/면적을 산출합니다.
 *
 * CAD 좌표계(미터 단위 평면좌표)를 그대로 사용합니다.
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, MultiPolygon } from 'geojson';
import type { DxfPolyline, ClassifiedLayer, SpatialIntersectionResult } from '@/types/dxf';
import { PERMIT_LAYER_MAP } from './layer-classifier';

// 최대 엔티티 수 (성능 제한 — Vercel 10초 타임아웃 대응)
const MAX_DESIGN_ENTITIES = 3000;
const MAX_PERMIT_ENTITIES = 500;

// ─── 좌표 변환 ───

/** DxfPolyline → Turf Polygon (닫힌 폴리라인) */
function toTurfPolygon(poly: DxfPolyline): Feature<Polygon> | null {
  if (!poly.isClosed || poly.vertices.length < 3) return null;
  const coords = poly.vertices.map(v => [v.x, v.y]);
  // 닫힌 링: 첫 점 == 끝 점 보장
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]);
  }
  try {
    return turf.polygon([coords]);
  } catch {
    return null; // 유효하지 않은 폴리곤 (자기교차 등)
  }
}

/** DxfPolyline → Turf LineString */
function toTurfLine(poly: DxfPolyline): Feature<LineString> | null {
  if (poly.vertices.length < 2) return null;
  const coords = poly.vertices.map(v => [v.x, v.y]);
  try {
    return turf.lineString(coords);
  } catch {
    return null;
  }
}

// ─── 인허가 구역 통합 ───

/** 같은 #레이어의 닫힌 폴리라인들을 하나의 구역(union)으로 합침 */
function buildPermitZone(
  polylines: DxfPolyline[]
): Feature<Polygon | MultiPolygon> | null {
  const polygons = polylines
    .map(toTurfPolygon)
    .filter((p): p is Feature<Polygon> => p !== null);

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  // 순차적 union
  try {
    let merged: Feature<Polygon | MultiPolygon> = polygons[0];
    for (let i = 1; i < polygons.length; i++) {
      const result = turf.union(
        turf.featureCollection([merged, polygons[i]])
      );
      if (result) merged = result as Feature<Polygon | MultiPolygon>;
    }
    return merged;
  } catch {
    // union 실패 시 첫 번째 폴리곤만 사용
    return polygons[0];
  }
}

// ─── 교차 연장 계산 (세그먼트 중점 판별법) ───

/**
 * 라인의 각 세그먼트 중점이 폴리곤 내부인지 판별하여
 * 내부 세그먼트 길이의 합계를 반환합니다.
 */
function lineInsidePolygonLength(
  line: Feature<LineString>,
  zone: Feature<Polygon | MultiPolygon>
): number {
  const coords = line.geometry.coordinates;
  let totalLength = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    if (turf.booleanPointInPolygon(turf.point([midX, midY]), zone)) {
      // 세그먼트 길이 (유클리드 거리, 미터 단위)
      const dx = x2 - x1;
      const dy = y2 - y1;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
  }

  return totalLength;
}

// ─── 교차 면적 계산 ───

/** 설계 폴리곤과 인허가 구역의 교차 면적 */
function polygonIntersectionArea(
  designPoly: Feature<Polygon>,
  zone: Feature<Polygon | MultiPolygon>
): number {
  try {
    const intersection = turf.intersect(
      turf.featureCollection([designPoly, zone])
    );
    if (!intersection) return 0;
    return turf.area(intersection); // turf.area는 평면좌표에서 좌표 단위² 반환
  } catch {
    return 0;
  }
}

// ─── BBox 빠른 거부 ───

/** 두 지오메트리의 바운딩 박스가 겹치는지 확인 */
function bboxOverlap(
  a: Feature,
  b: Feature
): boolean {
  const ba = turf.bbox(a); // [minX, minY, maxX, maxY]
  const bb = turf.bbox(b);
  return !(ba[2] < bb[0] || ba[0] > bb[2] || ba[3] < bb[1] || ba[1] > bb[3]);
}

// ─── 메인 분석 함수 ───

export function analyzeSpatialIntersections(
  polylines: DxfPolyline[],
  classifiedLayers: ClassifiedLayer[]
): { results: SpatialIntersectionResult[]; warnings: string[] } {
  const results: SpatialIntersectionResult[] = [];
  const warnings: string[] = [];

  // 인허가 레이어 목록 (#)
  const permitLayerNames = classifiedLayers
    .filter(l => l.role === 'permit' && l.hasPolylines)
    .map(l => l.name);

  // 설계 레이어 목록 ($)
  const designLayerNames = classifiedLayers
    .filter(l => l.role === 'design' && l.hasPolylines)
    .map(l => l.name);

  if (permitLayerNames.length === 0 || designLayerNames.length === 0) {
    return { results, warnings };
  }

  // 인허가 구역 구축 (# 레이어별 union)
  const permitZones = new Map<string, Feature<Polygon | MultiPolygon>>();

  for (const layerName of permitLayerNames) {
    const layerPolys = polylines.filter(
      p => p.layer === layerName && p.isClosed
    );
    if (layerPolys.length > MAX_PERMIT_ENTITIES) {
      warnings.push(
        `${layerName}: 폴리라인 ${layerPolys.length}개 — 상위 ${MAX_PERMIT_ENTITIES}개만 분석`
      );
    }
    const zone = buildPermitZone(layerPolys.slice(0, MAX_PERMIT_ENTITIES));
    if (zone) {
      permitZones.set(layerName, zone);
    } else {
      // 열린 폴리라인만 있는 # 레이어
      const openCount = polylines.filter(
        p => p.layer === layerName && !p.isClosed
      ).length;
      if (openCount > 0) {
        warnings.push(
          `${layerName}: 닫힌 폴리라인 없음 (열린 ${openCount}개) — 구역 생성 불가`
        );
      }
    }
  }

  if (permitZones.size === 0) return { results, warnings };

  // 설계 레이어별 교차 분석
  for (const dLayerName of designLayerNames) {
    let dPolylines = polylines.filter(p => p.layer === dLayerName);

    if (dPolylines.length > MAX_DESIGN_ENTITIES) {
      warnings.push(
        `${dLayerName}: ${dPolylines.length}개 엔티티 — 상위 ${MAX_DESIGN_ENTITIES}개만 분석`
      );
      dPolylines = dPolylines.slice(0, MAX_DESIGN_ENTITIES);
    }

    for (const [pLayerName, zone] of Array.from(permitZones.entries())) {
      let totalLength = 0;
      let totalArea = 0;
      let entityCount = 0;

      for (const dp of dPolylines) {
        // 라인/폴리곤 변환
        if (dp.isClosed && dp.vertices.length >= 3) {
          // 설계 폴리곤 (구조물 등)
          const designPoly = toTurfPolygon(dp);
          if (!designPoly) continue;
          if (!bboxOverlap(designPoly, zone)) continue;

          const area = polygonIntersectionArea(designPoly, zone);
          if (area > 0) {
            totalArea += area;
            entityCount++;
          }
        } else {
          // 설계 라인 (관로 등)
          const designLine = toTurfLine(dp);
          if (!designLine) continue;
          if (!bboxOverlap(designLine, zone)) continue;

          const length = lineInsidePolygonLength(designLine, zone);
          if (length > 0) {
            totalLength += length;
            entityCount++;
          }
        }
      }

      if (entityCount > 0) {
        const permitName = PERMIT_LAYER_MAP[pLayerName] || `${pLayerName} 구역 통과`;
        results.push({
          designLayer: dLayerName,
          permitLayer: pLayerName,
          permitName,
          intersectionLength: Math.round(totalLength * 10) / 10,
          intersectionArea: Math.round(totalArea * 10) / 10,
          designEntityCount: entityCount,
        });
      }
    }
  }

  return { results, warnings };
}
