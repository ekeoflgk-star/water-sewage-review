import DxfParser from 'dxf-parser';
import type { DxfPolyline, DxfText } from '@/types/dxf';

/** DXF 파싱 결과 */
export interface DxfParseResult {
  layers: Record<string, { name: string; color?: number; visible: boolean }>;
  polylines: DxfPolyline[];
  texts: DxfText[];
  entityCount: number;
}

/** Shoelace formula로 폴리곤 면적 계산 (부호 있음) */
function shoelaceArea(vertices: { x: number; y: number }[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

/** DXF 파일인지 확인 */
export function isDxfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.dxf');
}

/** DXF 파일 파싱 — dxf-parser 래퍼 */
export function parseDXF(content: string): DxfParseResult {
  const parser = new DxfParser();

  let dxf;
  try {
    dxf = parser.parseSync(content);
  } catch (err) {
    throw new Error(
      `DXF 파일을 읽을 수 없습니다. AutoCAD에서 SAVEAS → DXF로 다시 저장 후 시도해주세요. (${
        err instanceof Error ? err.message : '파싱 오류'
      })`
    );
  }

  if (!dxf) {
    throw new Error('DXF 파일 파싱 결과가 비어있습니다.');
  }

  // 레이어 정보 추출
  const layers: DxfParseResult['layers'] = {};
  if (dxf.tables?.layer?.layers) {
    for (const [name, layerData] of Object.entries(dxf.tables.layer.layers as Record<string, any>)) {
      layers[name] = {
        name,
        color: layerData.color,
        visible: !layerData.frozen && layerData.visible !== false,
      };
    }
  }

  const polylines: DxfPolyline[] = [];
  const texts: DxfText[] = [];

  if (!dxf.entities) {
    return { layers, polylines, texts, entityCount: 0 };
  }

  for (const rawEntity of dxf.entities) {
    // dxf-parser의 IEntity 타입이 제한적이므로 any로 캐스팅
    const entity = rawEntity as any;
    const layer = entity.layer || '0';

    // LWPOLYLINE / POLYLINE
    if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
      const verts = (entity.vertices || []).map((v: any) => ({
        x: v.x ?? 0,
        y: v.y ?? 0,
      }));

      if (verts.length < 2) continue;

      // CLOSED 플래그: shape 속성 또는 비트마스크
      const isClosed = !!(entity.shape);

      // 면적 계산 (닫힌 폴리라인만 유의미)
      const area = verts.length >= 3 ? Math.abs(shoelaceArea(verts)) : 0;

      polylines.push({ layer, vertices: verts, isClosed, area });
    }

    // LINE → 2점 폴리라인으로 변환
    if (entity.type === 'LINE') {
      const verts = [
        { x: entity.vertices?.[0]?.x ?? 0, y: entity.vertices?.[0]?.y ?? 0 },
        { x: entity.vertices?.[1]?.x ?? 0, y: entity.vertices?.[1]?.y ?? 0 },
      ];
      polylines.push({ layer, vertices: verts, isClosed: false, area: 0 });
    }

    // TEXT / MTEXT
    if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      const text = (entity.text || entity.string || '').trim();
      if (!text) continue;

      const x = entity.startPoint?.x ?? entity.position?.x ?? 0;
      const y = entity.startPoint?.y ?? entity.position?.y ?? 0;
      const height = entity.textHeight ?? entity.height ?? 1;

      texts.push({
        layer,
        text,
        insertionPoint: { x, y },
        height,
      });
    }
  }

  return {
    layers,
    polylines,
    texts,
    entityCount: dxf.entities.length,
  };
}
