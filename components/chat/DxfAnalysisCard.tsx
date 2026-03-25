'use client';

import { useState } from 'react';
import type { DxfAnalysisResult, ClassifiedLayer } from '@/types/dxf';

interface DxfAnalysisCardProps {
  result: DxfAnalysisResult;
}

/** 레이어 목록 (접기/펼치기) */
function LayerList({ layers, label, icon }: { layers: ClassifiedLayer[]; label: string; icon: string }) {
  const [open, setOpen] = useState(false);
  if (layers.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 w-full text-left"
      >
        <span>{icon}</span>
        <span className="font-medium">{label}: {layers.length}개</span>
        <span className="text-slate-400 ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="ml-5 mt-1 space-y-0.5">
          {layers.map((l) => (
            <div key={l.name} className="text-[11px] text-slate-500 flex items-center gap-2">
              <span className="font-mono bg-slate-100 px-1 rounded">{l.name}</span>
              <span className="text-slate-400">엔티티 {l.entityCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 인허가 소스 배지 */
function SourceBadge({ source }: { source: 'layer' | 'cadastral' | 'spatial' }) {
  const styles = {
    layer: 'bg-blue-100 text-blue-700',
    cadastral: 'bg-green-100 text-green-700',
    spatial: 'bg-purple-100 text-purple-700',
  };
  const labels = {
    layer: '레이어',
    cadastral: '지적',
    spatial: '공간분석',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[source]}`}>
      {labels[source]}
    </span>
  );
}

export function DxfAnalysisCard({ result }: DxfAnalysisCardProps) {
  const [showWarnings, setShowWarnings] = useState(false);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📐</span>
          <div>
            <h3 className="text-sm font-bold text-slate-800">DXF 인허가 분석 결과</h3>
            <p className="text-[11px] text-slate-500">
              {result.fileName} — {result.layerSummary.total}개 레이어
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* 레이어 요약 */}
        <div className="mb-3">
          <LayerList layers={result.layerSummary.design} label="설계($)" icon="🔧" />
          <LayerList layers={result.layerSummary.permit} label="인허가(#)" icon="📋" />
          <LayerList layers={result.layerSummary.cadastral} label="지적" icon="🗺️" />
          <LayerList layers={result.layerSummary.general} label="일반" icon="📄" />
        </div>

        {/* 인허가 목록 */}
        {result.permits.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <span>🔍</span>
              필요 인허가 ({result.permits.length}건)
            </h4>
            <div className="space-y-2">
              {result.permits.map((permit, i) => (
                <div
                  key={`${permit.permitName}-${i}`}
                  className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600 font-bold text-xs">✅</span>
                    <span className="text-sm font-semibold text-slate-800">{permit.permitName}</span>
                    <SourceBadge source={permit.source} />
                  </div>
                  <p className="text-[11px] text-slate-500 ml-5">
                    근거: {permit.sourceDetail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500 text-center py-2">
              감지된 인허가가 없습니다. # 접두사 레이어 또는 지적 정보를 확인해주세요.
            </p>
          </div>
        )}

        {/* 지적 필지 요약 */}
        {result.parcels.length > 0 && (
          <div className="border-t border-slate-100 pt-3 mt-3">
            <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span>🗺️</span>
              지적 필지 ({result.parcels.length}건)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {result.parcels.slice(0, 20).map((p, i) => (
                <span
                  key={i}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    p.matched
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  {p.lotNumber} {p.landCategory && `${p.landCategory}(${p.landCategoryFull})`}
                </span>
              ))}
              {result.parcels.length > 20 && (
                <span className="text-[11px] text-slate-400">외 {result.parcels.length - 20}건</span>
              )}
            </div>
          </div>
        )}

        {/* 경고 */}
        {result.warnings.length > 0 && (
          <div className="border-t border-slate-100 pt-3 mt-3">
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="text-xs text-amber-600 font-medium flex items-center gap-1 hover:text-amber-700"
            >
              <span>⚠️</span>
              경고 ({result.warnings.length}건)
              <span className="text-slate-400 ml-1">{showWarnings ? '▲' : '▼'}</span>
            </button>
            {showWarnings && (
              <ul className="mt-1.5 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-600 flex items-start gap-1.5">
                    <span className="mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="bg-slate-50 px-4 py-2 border-t border-slate-100">
        <p className="text-[10px] text-slate-400">
          분석 시각: {new Date(result.analyzedAt).toLocaleString('ko-KR')} |
          레이어 접두사: $ 설계, # 인허가
        </p>
      </div>
    </div>
  );
}
