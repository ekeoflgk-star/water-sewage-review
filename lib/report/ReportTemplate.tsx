import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type {
  ReviewCard,
  ReviewVerdict,
  PermitCard,
  PermitVerdict,
} from '@/types';

// ============================================================
// 한글 폰트 등록 — Google Fonts CDN (Noto Sans KR)
// ============================================================
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf',
      fontWeight: 'bold',
    },
  ],
});

// ============================================================
// 스타일 정의
// ============================================================
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontSize: 9,
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 40,
    color: '#1e293b',
  },

  // --- 표지 ---
  coverPage: {
    fontFamily: 'NotoSansKR',
    paddingHorizontal: 50,
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 12,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 40,
    textAlign: 'center',
  },
  coverInfo: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
  },
  coverDivider: {
    width: 120,
    height: 3,
    backgroundColor: '#3b82f6',
    marginVertical: 24,
  },

  // --- 요약 ---
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  summaryLabel: {
    width: 120,
    fontWeight: 'bold',
    color: '#475569',
    fontSize: 10,
  },
  summaryValue: {
    flex: 1,
    fontSize: 10,
    color: '#1e293b',
  },
  statRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    color: '#64748b',
  },

  // --- 테이블 공통 ---
  table: {
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 8,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
    paddingHorizontal: 2,
  },

  // --- 판정 배지 ---
  verdictPass: { color: '#16a34a', fontWeight: 'bold' },
  verdictFail: { color: '#dc2626', fontWeight: 'bold' },
  verdictCheck: { color: '#d97706', fontWeight: 'bold' },
  verdictRequired: { color: '#16a34a', fontWeight: 'bold' },
  verdictConditional: { color: '#d97706', fontWeight: 'bold' },
  verdictScaleReview: { color: '#2563eb', fontWeight: 'bold' },
  verdictNotApplicable: { color: '#64748b', fontWeight: 'bold' },

  // --- 결론 ---
  conclusionBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#f0f9ff',
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  conclusionText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.6,
  },

  // --- 페이지 번호 ---
  pageNumber: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    right: 40,
    fontSize: 7,
    color: '#cbd5e1',
  },
});

// ============================================================
// 판정 텍스트 유틸
// ============================================================
const REVIEW_VERDICT_TEXT: Record<ReviewVerdict, string> = {
  pass: '적합',
  fail: '부적합',
  check: '확인필요',
};

const REVIEW_VERDICT_STYLE: Record<ReviewVerdict, object> = {
  pass: styles.verdictPass,
  fail: styles.verdictFail,
  check: styles.verdictCheck,
};

const PERMIT_VERDICT_TEXT: Record<PermitVerdict, string> = {
  required: '필수',
  conditional: '조건부',
  'scale-review': '규모검토',
  'not-applicable': '해당없음',
};

const PERMIT_VERDICT_STYLE: Record<PermitVerdict, object> = {
  required: styles.verdictRequired,
  conditional: styles.verdictConditional,
  'scale-review': styles.verdictScaleReview,
  'not-applicable': styles.verdictNotApplicable,
};

// ============================================================
// Props 타입
// ============================================================
export interface ReportData {
  reviewCards: ReviewCard[];
  permitCards: PermitCard[];
  projectName: string;
  fileName: string;
}

// ============================================================
// 날짜 포맷 유틸
// ============================================================
function formatDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}년 ${m}월 ${d}일`;
}

// ============================================================
// 보고서 PDF 컴포넌트
// ============================================================
export function ReportTemplate({
  reviewCards,
  permitCards,
  projectName,
  fileName,
}: ReportData) {
  // 통계 계산
  const passCount = reviewCards.filter((c) => c.verdict === 'pass').length;
  const failCount = reviewCards.filter((c) => c.verdict === 'fail').length;
  const checkCount = reviewCards.filter((c) => c.verdict === 'check').length;
  const totalReview = reviewCards.length;
  const totalPermit = permitCards.length;

  return (
    <Document>
      {/* ===== 표지 ===== */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverDivider} />
        <Text style={styles.coverTitle}>
          상하수도 설계 검토 보고서
        </Text>
        <Text style={styles.coverSubtitle}>
          Design Review Report
        </Text>
        <View style={styles.coverDivider} />

        <Text style={styles.coverInfo}>
          프로젝트: {projectName || '(미지정)'}
        </Text>
        <Text style={styles.coverInfo}>
          검토 파일: {fileName || '(미지정)'}
        </Text>
        <Text style={styles.coverInfo}>
          작성일: {formatDate()}
        </Text>
        <Text style={{ ...styles.coverInfo, marginTop: 16, fontSize: 9 }}>
          AI 기반 자동 검토 (Gemini 2.5 Flash)
        </Text>

        <Text style={styles.pageNumber}>1</Text>
      </Page>

      {/* ===== 요약 + 설계 검토 결과 ===== */}
      <Page size="A4" style={styles.page}>
        {/* 요약 섹션 */}
        <Text style={styles.sectionTitle}>1. 검토 요약</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>프로젝트명</Text>
          <Text style={styles.summaryValue}>{projectName || '(미지정)'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>검토 파일</Text>
          <Text style={styles.summaryValue}>{fileName || '(미지정)'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>검토일자</Text>
          <Text style={styles.summaryValue}>{formatDate()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>설계 검토 항목</Text>
          <Text style={styles.summaryValue}>{totalReview}개 항목</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>인허가 검토 항목</Text>
          <Text style={styles.summaryValue}>{totalPermit}개 항목</Text>
        </View>

        {/* 통계 박스 */}
        <View style={styles.statRow}>
          <View style={{ ...styles.statBox, backgroundColor: '#f0fdf4' }}>
            <Text style={{ ...styles.statNumber, color: '#16a34a' }}>{passCount}</Text>
            <Text style={styles.statLabel}>적합</Text>
          </View>
          <View style={{ ...styles.statBox, backgroundColor: '#fef2f2' }}>
            <Text style={{ ...styles.statNumber, color: '#dc2626' }}>{failCount}</Text>
            <Text style={styles.statLabel}>부적합</Text>
          </View>
          <View style={{ ...styles.statBox, backgroundColor: '#fffbeb' }}>
            <Text style={{ ...styles.statNumber, color: '#d97706' }}>{checkCount}</Text>
            <Text style={styles.statLabel}>확인필요</Text>
          </View>
          <View style={{ ...styles.statBox, backgroundColor: '#f8fafc' }}>
            <Text style={{ ...styles.statNumber, color: '#475569' }}>{totalReview}</Text>
            <Text style={styles.statLabel}>총 항목</Text>
          </View>
        </View>

        {/* 설계 검토 결과 테이블 */}
        {totalReview > 0 && (
          <>
            <Text style={styles.sectionTitle}>2. 설계 검토 결과</Text>

            <View style={styles.table}>
              {/* 테이블 헤더 */}
              <View style={styles.tableHeaderRow}>
                <Text style={{ ...styles.tableHeaderCell, width: '5%' }}>No</Text>
                <Text style={{ ...styles.tableHeaderCell, width: '18%' }}>항목명</Text>
                <Text style={{ ...styles.tableHeaderCell, width: '8%' }}>판정</Text>
                <Text style={{ ...styles.tableHeaderCell, width: '12%' }}>설계값</Text>
                <Text style={{ ...styles.tableHeaderCell, width: '12%' }}>기준값</Text>
                <Text style={{ ...styles.tableHeaderCell, width: '17%' }}>근거조문</Text>
                <Text style={{ ...styles.tableHeaderCell, width: '28%' }}>검토의견</Text>
              </View>

              {/* 테이블 본문 */}
              {reviewCards.map((card, idx) => (
                <View
                  key={card.id}
                  style={[
                    styles.tableRow,
                    idx % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                  wrap={false}
                >
                  <Text style={{ ...styles.tableCell, width: '5%', textAlign: 'center' }}>
                    {idx + 1}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '18%' }}>
                    {card.itemName}
                  </Text>
                  <Text
                    style={{
                      ...styles.tableCell,
                      width: '8%',
                      textAlign: 'center',
                      ...(REVIEW_VERDICT_STYLE[card.verdict] || {}),
                    }}
                  >
                    {REVIEW_VERDICT_TEXT[card.verdict]}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '12%', textAlign: 'center' }}>
                    {card.designValue || '-'}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '12%', textAlign: 'center' }}>
                    {card.standardValue || '-'}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '17%', fontSize: 7 }}>
                    {card.reference}
                  </Text>
                  <Text style={{ ...styles.tableCell, width: '28%', fontSize: 7 }}>
                    {card.finding}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber }) => `${pageNumber}`}
          fixed
        />
        <Text style={styles.footer} fixed>
          상하수도 설계 검토 보고서
        </Text>
      </Page>

      {/* ===== 인허가 검토 + 결론 ===== */}
      {(totalPermit > 0) && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>3. 인허가 검토 결과</Text>

          <View style={styles.table}>
            {/* 테이블 헤더 */}
            <View style={styles.tableHeaderRow}>
              <Text style={{ ...styles.tableHeaderCell, width: '5%' }}>No</Text>
              <Text style={{ ...styles.tableHeaderCell, width: '18%' }}>인허가명</Text>
              <Text style={{ ...styles.tableHeaderCell, width: '10%' }}>판정</Text>
              <Text style={{ ...styles.tableHeaderCell, width: '20%' }}>근거법령</Text>
              <Text style={{ ...styles.tableHeaderCell, width: '47%' }}>설명</Text>
            </View>

            {/* 테이블 본문 */}
            {permitCards.map((card, idx) => (
              <View
                key={card.id}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 ? styles.tableRowAlt : {},
                ]}
                wrap={false}
              >
                <Text style={{ ...styles.tableCell, width: '5%', textAlign: 'center' }}>
                  {idx + 1}
                </Text>
                <Text style={{ ...styles.tableCell, width: '18%' }}>
                  {card.permitName}
                </Text>
                <Text
                  style={{
                    ...styles.tableCell,
                    width: '10%',
                    textAlign: 'center',
                    ...(PERMIT_VERDICT_STYLE[card.verdict] || {}),
                  }}
                >
                  {PERMIT_VERDICT_TEXT[card.verdict]}
                </Text>
                <Text style={{ ...styles.tableCell, width: '20%', fontSize: 7 }}>
                  {card.legalBasis}
                </Text>
                <Text style={{ ...styles.tableCell, width: '47%', fontSize: 7 }}>
                  {card.explanation}
                </Text>
              </View>
            ))}
          </View>

          <Text
            style={styles.pageNumber}
            render={({ pageNumber }) => `${pageNumber}`}
            fixed
          />
          <Text style={styles.footer} fixed>
            상하수도 설계 검토 보고서
          </Text>
        </Page>
      )}

      {/* ===== 결론 페이지 ===== */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          {totalPermit > 0 ? '4' : '3'}. 결론 및 소견
        </Text>

        <View style={styles.conclusionBox}>
          <Text style={styles.conclusionText}>
            본 보고서는 AI 기반 자동 검토 시스템을 통해 상하수도 설계 성과품을
            KDS 설계기준 및 관련 법령과 대조하여 작성되었습니다.
          </Text>
          <Text style={{ ...styles.conclusionText, marginTop: 8 }}>
            총 {totalReview}개 설계 검토 항목 중, 적합 {passCount}건,
            부적합 {failCount}건, 확인필요 {checkCount}건으로 분석되었습니다.
            {failCount > 0 &&
              ` 부적합 ${failCount}건에 대해서는 설계 수정 및 보완이 필요합니다.`}
            {checkCount > 0 &&
              ` 확인필요 ${checkCount}건은 담당자의 추가 확인이 권장됩니다.`}
          </Text>
          {totalPermit > 0 && (
            <Text style={{ ...styles.conclusionText, marginTop: 8 }}>
              인허가 검토 결과 총 {totalPermit}개 항목을 확인하였으며,
              관련 법령에 따른 인허가 절차를 검토해 주시기 바랍니다.
            </Text>
          )}
          <Text style={{ ...styles.conclusionText, marginTop: 12, fontSize: 8, color: '#94a3b8' }}>
            * 본 보고서는 AI 분석 결과이며, 최종 판단은 담당 엔지니어의 확인이 필요합니다.
          </Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber }) => `${pageNumber}`}
          fixed
        />
        <Text style={styles.footer} fixed>
          상하수도 설계 검토 보고서
        </Text>
      </Page>
    </Document>
  );
}
