import type { DxfPolyline, DxfText, CadParcel, PermitAnalysisItem } from '@/types/dxf';

// ============================================================
// 지목 매핑 상수
// ============================================================

/** 지목 → 인허가 매핑 */
export const LAND_CATEGORY_PERMIT: Record<string, string> = {
  '전': '농지 전용 허가',
  '답': '농지 전용 허가',
  '과': '농지 전용 허가',
  '임': '산지 전용 허가',
  '하': '하천 점용 허가',
  '도': '도로 점용 허가',
  '천': '하천 점용 허가',
  '구': '도로 점용 허가',
  '유': '하천 점용 허가',
};

/** 지목 풀네임 */
export const LAND_CATEGORY_FULL: Record<string, string> = {
  '전': '밭', '답': '논', '과': '과수원', '임': '임야',
  '하': '하천', '도': '도로', '천': '천(내)', '대': '대지',
  '공': '공장용지', '잡': '잡종지', '학': '학교용지',
  '구': '구거', '유': '유지', '제': '제방', '목': '목장용지',
  '광': '광천지', '염': '염전', '수': '수도용지', '체': '체육용지',
  '원': '원야', '묘': '묘지', '사': '사적지', '종': '종교용지',
};

// ============================================================
// 지적 텍스트 파싱
// ============================================================

/** 지적 텍스트 파싱: "154-7 답" → { lotNumber, category } */
export function parseLotText(text: string): { lotNumber: string; category: string } | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  // 메인 패턴: "154-7 답", "산 12-3 임", "1 대"
  const mainPattern = /^(산?\s*\d+(?:-\d+)?)\s+(\S+)/;
  const match = cleaned.match(mainPattern);

  if (match) {
    const lotNumber = match[1].replace(/\s+/g, ' ').trim();
    const category = match[2].trim();
    // 지목이 알려진 지목인지 확인
    if (LAND_CATEGORY_FULL[category]) {
      return { lotNumber, category };
    }
  }

  // 멀티라인 패턴: "154-7\n답" (줄바꿈 포함 — MTEXT에서 발생)
  const multilinePattern = /^(산?\s*\d+(?:-\d+)?)\s*[\n\r]+\s*(\S+)/;
  const multiMatch = text.trim().match(multilinePattern);
  if (multiMatch && LAND_CATEGORY_FULL[multiMatch[2].trim()]) {
    return {
      lotNumber: multiMatch[1].replace(/\s+/g, ' ').trim(),
      category: multiMatch[2].trim(),
    };
  }

  // 면적 포함 패턴: "154-7 답 1,234" (면적 부분은 무시)
  const areaPattern = /^(산?\s*\d+(?:-\d+)?)\s+(\S)\s+[\d,.]+/;
  const areaMatch = cleaned.match(areaPattern);
  if (areaMatch && LAND_CATEGORY_FULL[areaMatch[2]]) {
    return {
      lotNumber: areaMatch[1].replace(/\s+/g, ' ').trim(),
      category: areaMatch[2],
    };
  }

  return null;
}

// ============================================================
// Point-in-Polygon (Ray Casting)
// ============================================================

/** Ray casting으로 점이 폴리곤 내부인지 판별 */
function pointInPolygon(
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/** 도넛 폴리곤(외곽 - 구멍들) 안에 점이 있는지 판별 */
function pointInDonut(
  point: { x: number; y: number },
  outer: { x: number; y: number }[],
  holes: { x: number; y: number }[][]
): boolean {
  // 외곽 안에 있어야 함
  if (!pointInPolygon(point, outer)) return false;
  // 구멍 안에 있으면 안 됨
  for (const hole of holes) {
    if (pointInPolygon(point, hole)) return false;
  }
  return true;
}

// ============================================================
// 도넛형 필지 파싱
// ============================================================

interface ParcelCandidate {
  polyline: DxfPolyline;
  absArea: number;
}

/** 지적 필지 파싱 (도넛 처리 포함) */
export function parseCadastralParcels(
  polylines: DxfPolyline[],
  texts: DxfText[]
): { parcels: CadParcel[]; warnings: string[] } {
  const warnings: string[] = [];

  // 닫힌 폴리라인만 필터 + 열린 폴리라인 자동 닫기 시도
  const closedPolys: ParcelCandidate[] = [];

  for (const p of polylines) {
    if (p.vertices.length < 3) continue;

    let isClosed = p.isClosed;

    // 열린 폴리라인이지만 시작점-끝점 거리가 가까우면 자동 닫기
    if (!isClosed) {
      const first = p.vertices[0];
      const last = p.vertices[p.vertices.length - 1];
      const dist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
      // 허용 오차: 텍스트 높이의 절반 또는 0.1 단위
      if (dist < 0.5) {
        isClosed = true;
      }
    }

    if (!isClosed) continue;

    const absArea = p.area > 0 ? p.area : Math.abs(
      p.vertices.reduce((sum, v, i) => {
        const j = (i + 1) % p.vertices.length;
        return sum + v.x * p.vertices[j].y - p.vertices[j].x * v.y;
      }, 0) / 2
    );

    closedPolys.push({ polyline: p, absArea });
  }

  // 면적 내림차순 정렬
  closedPolys.sort((a, b) => b.absArea - a.absArea);

  // 도넛 판별: 큰 폴리라인 안에 작은 폴리라인이 완전히 포함되면 hole
  const used = new Set<number>();
  const parcelGroups: { outer: ParcelCandidate; holes: ParcelCandidate[] }[] = [];

  for (let i = 0; i < closedPolys.length; i++) {
    if (used.has(i)) continue;

    const outer = closedPolys[i];
    const holes: ParcelCandidate[] = [];

    for (let j = i + 1; j < closedPolys.length; j++) {
      if (used.has(j)) continue;

      const inner = closedPolys[j];

      // 면적 비율 체크: hole은 outer의 80% 미만
      if (inner.absArea >= outer.absArea * 0.8) continue;

      // 모든 꼭짓점이 outer 내부인지 확인
      const allInside = inner.polyline.vertices.every(v =>
        pointInPolygon(v, outer.polyline.vertices)
      );

      if (allInside) {
        holes.push(inner);
        used.add(j);
      }
    }

    parcelGroups.push({ outer, holes });
  }

  // 텍스트 → 필지 매칭
  const parcels: CadParcel[] = [];
  const usedTexts = new Set<number>();

  for (const group of parcelGroups) {
    const outerVerts = group.outer.polyline.vertices;
    const holeVerts = group.holes.map(h => h.polyline.vertices);

    // 이 필지 영역에 속하는 텍스트 찾기
    let matchedText: { lotNumber: string; category: string } | null = null;
    let matchedIdx = -1;

    for (let ti = 0; ti < texts.length; ti++) {
      if (usedTexts.has(ti)) continue;

      const t = texts[ti];
      const parsed = parseLotText(t.text);
      if (!parsed) continue;

      if (pointInDonut(t.insertionPoint, outerVerts, holeVerts)) {
        matchedText = parsed;
        matchedIdx = ti;
        break;
      }
    }

    if (matchedIdx >= 0) usedTexts.add(matchedIdx);

    const holeArea = group.holes.reduce((sum, h) => sum + h.absArea, 0);

    parcels.push({
      outerBoundary: outerVerts,
      holes: holeVerts,
      lotNumber: matchedText?.lotNumber || '미확인',
      landCategory: matchedText?.category || '',
      landCategoryFull: matchedText?.category
        ? LAND_CATEGORY_FULL[matchedText.category] || matchedText.category
        : '',
      area: group.outer.absArea - holeArea,
      matched: !!matchedText,
    });
  }

  // 미매칭 텍스트 경고
  const unmatchedTexts = texts.filter((_, i) => {
    if (usedTexts.has(i)) return false;
    return parseLotText(texts[i].text) !== null;
  });

  if (unmatchedTexts.length > 0) {
    warnings.push(
      `지적 텍스트 ${unmatchedTexts.length}건이 필지와 매칭되지 않았습니다 (텍스트 위치가 폴리라인 외부)`
    );
  }

  const unmatchedParcels = parcels.filter(p => !p.matched);
  if (unmatchedParcels.length > 0) {
    warnings.push(
      `지적 필지 ${unmatchedParcels.length}건에서 번지·지목 텍스트를 찾지 못했습니다`
    );
  }

  return { parcels, warnings };
}

/** 지적 필지 → 인허가 매핑 */
export function mapCadastralPermits(parcels: CadParcel[]): PermitAnalysisItem[] {
  const permitMap = new Map<string, PermitAnalysisItem>();

  for (const parcel of parcels) {
    if (!parcel.matched || !parcel.landCategory) continue;

    const permitName = LAND_CATEGORY_PERMIT[parcel.landCategory];
    if (!permitName) continue;

    const existing = permitMap.get(permitName);
    if (existing) {
      existing.sourceDetail += `, ${parcel.lotNumber} ${parcel.landCategory}(${parcel.landCategoryFull})`;
    } else {
      permitMap.set(permitName, {
        permitName,
        source: 'cadastral',
        sourceDetail: `지적 필지 ${parcel.lotNumber} ${parcel.landCategory}(${parcel.landCategoryFull})`,
        parcelInfo: {
          lotNumber: parcel.lotNumber,
          landCategory: parcel.landCategory,
        },
      });
    }
  }

  return Array.from(permitMap.values());
}
