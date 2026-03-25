import type { DxfPolyline, DxfText, ClassifiedLayer, LayerRole, PermitAnalysisItem } from '@/types/dxf';

/** # 레이어 → 인허가 매핑 테이블 */
export const PERMIT_LAYER_MAP: Record<string, string> = {
  '#도로구역':         '도로 점용 허가',
  '#하천구역':         '하천 점용 허가',
  '#소하천구역':       '소하천 점용 허가',
  '#영구점용선':       '도로 점용 허가',
  '#일시점용선':       '도로 점용 허가',
  '#농지':             '농지 전용 허가',
  '#산지':             '산지 전용 허가',
  '#철도보호지구':     '철도 보호지구 행위허가',
  '#군사시설보호구역': '군사시설 보호구역 행위허가',
  '#문화재보호구역':   '문화재 현상변경 허가',
};

/** 지적 관련 레이어명 패턴 (대소문자 무시) */
const CADASTRAL_LAYER_PATTERNS = ['지적경계', '지적텍스트', '지적도', '지적'];

/** 레이어명으로 역할 분류 */
function getLayerRole(name: string): { role: LayerRole; prefix: '$' | '#' | ''; baseName: string } {
  if (name.startsWith('$')) {
    return { role: 'design', prefix: '$', baseName: name.slice(1) };
  }
  if (name.startsWith('#')) {
    return { role: 'permit', prefix: '#', baseName: name.slice(1) };
  }
  // 지적 관련 레이어 감지
  const lower = name.toLowerCase();
  if (CADASTRAL_LAYER_PATTERNS.some(p => lower.includes(p))) {
    return { role: 'cadastral', prefix: '', baseName: name };
  }
  return { role: 'general', prefix: '', baseName: name };
}

/** 모든 레이어 분류 */
export function classifyLayers(
  layers: Record<string, any>,
  polylines: DxfPolyline[],
  texts: DxfText[]
): ClassifiedLayer[] {
  // 레이어별 엔티티 통계
  const layerStats = new Map<string, { polyCount: number; textCount: number }>();

  for (const p of polylines) {
    const s = layerStats.get(p.layer) || { polyCount: 0, textCount: 0 };
    s.polyCount++;
    layerStats.set(p.layer, s);
  }
  for (const t of texts) {
    const s = layerStats.get(t.layer) || { polyCount: 0, textCount: 0 };
    s.textCount++;
    layerStats.set(t.layer, s);
  }

  // 모든 레이어 이름 수집 (layers 테이블 + 엔티티에서 발견된 레이어)
  const allLayerNames = new Set<string>([
    ...Object.keys(layers),
    ...Array.from(layerStats.keys()),
  ]);

  const result: ClassifiedLayer[] = [];

  for (const name of Array.from(allLayerNames)) {
    const { role, prefix, baseName } = getLayerRole(name);
    const stats = layerStats.get(name) || { polyCount: 0, textCount: 0 };

    result.push({
      name,
      role,
      prefix,
      baseName,
      entityCount: stats.polyCount + stats.textCount,
      hasPolylines: stats.polyCount > 0,
      hasTexts: stats.textCount > 0,
    });
  }

  return result.sort((a, b) => {
    // 역할순 정렬: design → permit → cadastral → general
    const order: Record<LayerRole, number> = { design: 0, permit: 1, cadastral: 2, general: 3 };
    return order[a.role] - order[b.role];
  });
}

/** "#" 레이어 → 인허가 자동 매핑 */
export function mapPermitLayers(
  permitLayers: ClassifiedLayer[]
): PermitAnalysisItem[] {
  const items: PermitAnalysisItem[] = [];
  const seen = new Set<string>();

  for (const layer of permitLayers) {
    const permitName = PERMIT_LAYER_MAP[layer.name];
    if (!permitName) continue;

    // 같은 인허가가 여러 레이어에서 감지될 수 있음 (예: #도로구역 + #영구점용선 → 둘 다 도로 점용)
    const key = permitName;
    if (seen.has(key)) {
      // 기존 항목의 sourceDetail에 추가
      const existing = items.find(i => i.permitName === key);
      if (existing) {
        existing.sourceDetail += `, ${layer.name} (엔티티 ${layer.entityCount}개)`;
      }
      continue;
    }
    seen.add(key);

    items.push({
      permitName,
      source: 'layer',
      sourceDetail: `${layer.name} 레이어 존재 (엔티티 ${layer.entityCount}개)`,
      layerName: layer.name,
    });
  }

  return items;
}
