import type { DxfAnalysisResult, PermitAnalysisItem, SpatialIntersectionResult } from '@/types/dxf';
import type { DxfParseResult } from '@/lib/parsers/dxf';
import { classifyLayers, mapPermitLayers } from './layer-classifier';
import { parseCadastralParcels, mapCadastralPermits } from './cadastral-parser';
import { analyzeSpatialIntersections } from './spatial-analyzer';

interface AnalyzeOptions {
  /** 지적경계 레이어명 (기본: 자동 감지) */
  cadastralLayerName?: string;
  /** 지적텍스트 레이어명 (기본: 자동 감지) */
  cadastralTextLayerName?: string;
  /** 공간 교차 분석 활성화 (기본: true) */
  enableSpatial?: boolean;
}

/** 중복 인허가 통합 (공간 교차 데이터 병합 포함) */
function deduplicatePermits(items: PermitAnalysisItem[]): PermitAnalysisItem[] {
  const map = new Map<string, PermitAnalysisItem>();

  for (const item of items) {
    const existing = map.get(item.permitName);
    if (existing) {
      // 소스가 다르면 sourceDetail을 통합
      if (existing.source !== item.source) {
        existing.sourceDetail += ` / ${item.sourceDetail}`;
      }
      // 공간 교차 데이터가 있으면 기존 항목에 병합
      if (item.intersection) {
        if (existing.intersection) {
          existing.intersection.length += item.intersection.length;
          existing.intersection.area += item.intersection.area;
          const layerSet = new Set([
            ...existing.intersection.designLayers,
            ...item.intersection.designLayers,
          ]);
          existing.intersection.designLayers = Array.from(layerSet);
        } else {
          existing.intersection = { ...item.intersection };
        }
      }
    } else {
      map.set(item.permitName, { ...item });
    }
  }

  return Array.from(map.values());
}

/** DXF 분석 메인 함수 — 모든 모듈 통합 */
export function analyzeDxfForPermits(
  parseResult: DxfParseResult,
  fileName: string,
  options?: AnalyzeOptions
): DxfAnalysisResult {
  const warnings: string[] = [];

  // 1. 레이어 분류
  const classifiedLayers = classifyLayers(
    parseResult.layers,
    parseResult.polylines,
    parseResult.texts
  );

  const designLayers = classifiedLayers.filter(l => l.role === 'design');
  const permitLayers = classifiedLayers.filter(l => l.role === 'permit');
  const cadastralLayers = classifiedLayers.filter(l => l.role === 'cadastral');
  const generalLayers = classifiedLayers.filter(l => l.role === 'general');

  // 2. # 레이어 → 인허가 매핑 (Phase A)
  const layerPermits = mapPermitLayers(permitLayers);

  if (permitLayers.length === 0) {
    warnings.push(
      '인허가 구역 레이어(# 접두사)가 없습니다. CAD 레이어명에 # 접두사를 사용해주세요.'
    );
  }

  // 3. 지적도 파싱 + 지목 → 인허가
  let cadastralPermits: PermitAnalysisItem[] = [];
  let parcels: DxfAnalysisResult['parcels'] = [];

  // 지적 관련 폴리라인과 텍스트 수집
  const cadastralLayerNames = new Set<string>();

  // 옵션으로 지정된 레이어 또는 자동 감지된 cadastral 레이어 사용
  if (options?.cadastralLayerName) {
    cadastralLayerNames.add(options.cadastralLayerName);
  }
  if (options?.cadastralTextLayerName) {
    cadastralLayerNames.add(options.cadastralTextLayerName);
  }
  for (const cl of cadastralLayers) {
    cadastralLayerNames.add(cl.name);
  }

  if (cadastralLayerNames.size > 0) {
    const cadPolylines = parseResult.polylines.filter(p =>
      cadastralLayerNames.has(p.layer)
    );
    const cadTexts = parseResult.texts.filter(t =>
      cadastralLayerNames.has(t.layer)
    );

    if (cadPolylines.length > 0) {
      const result = parseCadastralParcels(cadPolylines, cadTexts);
      parcels = result.parcels;
      warnings.push(...result.warnings);
      cadastralPermits = mapCadastralPermits(parcels);
    } else {
      warnings.push('지적 레이어에 폴리라인이 없습니다. 지목 기반 분석을 건너뜁니다.');
    }
  } else {
    warnings.push(
      '지적경계/지적텍스트 레이어가 없습니다. 지목 기반 분석을 건너뜁니다.'
    );
  }

  // 4. 공간 교차 분석 (Phase B)
  let spatialPermits: PermitAnalysisItem[] = [];
  let spatialResults: SpatialIntersectionResult[] = [];

  if (options?.enableSpatial !== false) {
    try {
      const spatial = analyzeSpatialIntersections(
        parseResult.polylines,
        classifiedLayers
      );
      spatialResults = spatial.results;
      warnings.push(...spatial.warnings);

      // 공간 결과 → PermitAnalysisItem 변환
      // permitName별로 그룹핑하여 교차 수치 합산
      const spatialByPermit = new Map<string, {
        length: number;
        area: number;
        designLayers: Set<string>;
        details: string[];
        entityCount: number;
      }>();

      for (const sr of spatialResults) {
        const key = sr.permitName;
        const existing = spatialByPermit.get(key) || {
          length: 0, area: 0, designLayers: new Set<string>(), details: [], entityCount: 0,
        };
        existing.length += sr.intersectionLength;
        existing.area += sr.intersectionArea;
        existing.designLayers.add(sr.designLayer);
        existing.entityCount += sr.designEntityCount;
        if (sr.intersectionLength > 0) {
          existing.details.push(`${sr.designLayer}→${sr.permitLayer}: ${sr.intersectionLength}m`);
        }
        if (sr.intersectionArea > 0) {
          existing.details.push(`${sr.designLayer}→${sr.permitLayer}: ${sr.intersectionArea}m²`);
        }
        spatialByPermit.set(key, existing);
      }

      for (const [permitName, data] of Array.from(spatialByPermit.entries())) {
        spatialPermits.push({
          permitName,
          source: 'spatial',
          sourceDetail: `공간 교차: ${data.details.slice(0, 3).join(', ')}${data.details.length > 3 ? ` 외 ${data.details.length - 3}건` : ''}`,
          intersection: {
            length: Math.round(data.length * 10) / 10,
            area: Math.round(data.area * 10) / 10,
            designLayers: Array.from(data.designLayers),
          },
        });
      }
    } catch (err) {
      warnings.push(`공간 교차 분석 오류: ${err instanceof Error ? err.message : '알 수 없음'}`);
    }
  }

  // 5. 인허가 통합 (중복 제거 + 공간 데이터 병합)
  const allPermits = deduplicatePermits([...layerPermits, ...cadastralPermits, ...spatialPermits]);

  return {
    fileName,
    layerSummary: {
      total: classifiedLayers.length,
      design: designLayers,
      permit: permitLayers,
      cadastral: cadastralLayers,
      general: generalLayers,
    },
    parcels,
    permits: allPermits,
    spatialResults: spatialResults.length > 0 ? spatialResults : undefined,
    warnings,
    analyzedAt: new Date().toISOString(),
  };
}
