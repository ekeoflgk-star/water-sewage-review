import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
} from 'docx';

/** 설계도서 검토의견서 DOCX 생성 API — 한글(HWP) 호환 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewCards = [], permitCards = [], projectName = '', date = '' } = body;

    // 검토 항목 통합
    const items = [
      ...reviewCards.map((card: any, idx: number) => ({
        no: idx + 1,
        category: getCategoryLabel(card.category),
        verdict: getVerdictLabel(card.verdict),
        itemName: card.itemName || '',
        opinion: card.finding || '',
        designValue: card.designValue || '-',
        standardValue: card.standardValue || '-',
        reference: card.reference || '',
        action: '',
      })),
      ...permitCards.map((card: any, idx: number) => ({
        no: reviewCards.length + idx + 1,
        category: '인허가',
        verdict: getPermitVerdictLabel(card.verdict),
        itemName: card.permitName || '',
        opinion: card.explanation || '',
        designValue: card.triggerCondition || '-',
        standardValue: '-',
        reference: card.legalBasis || '',
        action: '',
      })),
    ];

    // 셀 테두리 공통 스타일
    const cellBorders = {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    };

    // 헤더 셀 만들기
    const headerCell = (text: string, width: number) =>
      new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        shading: { type: ShadingType.SOLID, color: 'D9E2F3', fill: 'D9E2F3' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, size: 18, font: '맑은 고딕' })],
          }),
        ],
      });

    // 데이터 셀 만들기
    const dataCell = (text: string, width: number, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
      new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment,
            children: [new TextRun({ text, size: 16, font: '맑은 고딕' })],
          }),
        ],
      });

    // 헤더 행
    const headerRow = new TableRow({
      children: [
        headerCell('번호', 5),
        headerCell('구분', 7),
        headerCell('판정', 7),
        headerCell('검토항목', 14),
        headerCell('검토의견', 25),
        headerCell('설계값', 10),
        headerCell('기준값', 10),
        headerCell('근거', 12),
        headerCell('조치내용', 10),
      ],
    });

    // 데이터 행
    const dataRows = items.map(
      (item) =>
        new TableRow({
          children: [
            dataCell(String(item.no), 5, AlignmentType.CENTER),
            dataCell(item.category, 7, AlignmentType.CENTER),
            dataCell(item.verdict, 7, AlignmentType.CENTER),
            dataCell(item.itemName, 14),
            dataCell(item.opinion, 25),
            dataCell(item.designValue, 10),
            dataCell(item.standardValue, 10),
            dataCell(item.reference, 12),
            dataCell(item.action, 10),
          ],
        })
    );

    // 문서 생성
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 16840, height: 11906 },  // A4 가로
            },
          },
          children: [
            // 제목
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: '설계도서 검토의견서',
                  bold: true,
                  size: 32,
                  font: '맑은 고딕',
                }),
              ],
            }),

            // 프로젝트명 + 날짜
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 200 },
              children: [
                new TextRun({ text: '사업명: ', size: 20, font: '맑은 고딕' }),
                new TextRun({ text: projectName || '(미입력)', bold: true, size: 20, font: '맑은 고딕' }),
                new TextRun({ text: '    작성일: ', size: 20, font: '맑은 고딕' }),
                new TextRun({ text: date || new Date().toISOString().slice(0, 10), size: 20, font: '맑은 고딕' }),
                new TextRun({ text: `    검토항목: ${items.length}건`, size: 20, font: '맑은 고딕' }),
              ],
            }),

            // 요약 (적합/부적합/확인필요)
            new Paragraph({
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: `[요약] 적합 ${items.filter(i => i.verdict === '적합').length}건 / 부적합 ${items.filter(i => i.verdict === '부적합').length}건 / 확인필요 ${items.filter(i => i.verdict === '확인필요').length}건`,
                  size: 18,
                  font: '맑은 고딕',
                  color: '555555',
                }),
              ],
            }),

            // 테이블
            new Table({
              rows: [headerRow, ...dataRows],
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),

            // 비고
            new Paragraph({
              spacing: { before: 400 },
              children: [
                new TextRun({
                  text: '※ 본 검토의견서는 AI 자동 검토 시스템에 의해 생성되었으며, 최종 판단은 설계 담당자의 확인이 필요합니다.',
                  size: 16,
                  font: '맑은 고딕',
                  color: '888888',
                  italics: true,
                }),
              ],
            }),
          ],
        },
      ],
    });

    // DOCX 바이너리 생성
    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="review-opinion-${Date.now()}.docx"`,
      },
    });
  } catch (error) {
    console.error('DOCX 생성 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'DOCX 생성 중 오류 발생' },
      { status: 500 }
    );
  }
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    'sewer-pipeline': '관로', 'sewer-pump': '펌프장', 'sewer-treatment': '수처리',
    'sewer-sludge': '슬러지', 'water-intake': '취정수', 'water-distribution': '배급수',
    'common-structural': '구조',
  };
  return map[category] || category;
}

function getVerdictLabel(verdict: string): string {
  const map: Record<string, string> = { pass: '적합', fail: '부적합', check: '확인필요' };
  return map[verdict] || verdict;
}

function getPermitVerdictLabel(verdict: string): string {
  const map: Record<string, string> = {
    required: '필수', conditional: '조건부', 'scale-review': '규모검토', 'not-applicable': '해당없음',
  };
  return map[verdict] || verdict;
}
