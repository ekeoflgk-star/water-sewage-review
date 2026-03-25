import type { DxfAnalysisResult, PermitAnalysisItem } from '@/types/dxf';
import type { DxfParseResult } from '@/lib/parsers/dxf';
import { classifyLayers, mapPermitLayers } from './layer-classifier';
import { parseCadastralParcels, mapCadastralPermits } from './cadastral-parser';

interface AnalyzeOptions {
  /** 지적경계 레이어명 (기본: 자동 감지) */
  cadastralLayerName?: string;
  /** 지적텍스트 레이어명 (기본: 자동 감지) */
  cadastralTextLayerName?: string;
}

/** 중복 인허가 통합 */
function deduplicatePermits(items: PermitAnalysisItem[]): PermitAnalysisItem[] {
  const map = new Map<string, PermitAnalysisItem>();

  for (const item of items) {
    const existing = map.get(item.permitName);
    if (existing) {
      // 소스가 다르면 sourceDetail을 통합
      if (existing.source !== item.source) {
        existing.sourceDetail += ` / ${item.sourceDetail}`;
        // source를 더 구체적인 것으로 유지 (layer가 우선)
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

  // 4. 인허가 통합 (중복 제거)
  const allPermits = deduplicatePermits([...layerPermits, ...cadastralPermits]);

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
    warnings,
    analyzedAt: new Date().toISOString(),
  };
}
