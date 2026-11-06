import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ContributionMemberRow } from '../services/contributions'
import type { Contribution } from '../types'

const BRAND: [number, number, number] = [23, 107, 74]
const BRAND_DARK: [number, number, number] = [17, 74, 52]
const GREEN_LIGHT: [number, number, number] = [131, 173, 141]
const GREEN_PALE: [number, number, number] = [237, 243, 238]
const MUTED: [number, number, number] = [91, 108, 98]
const INK: [number, number, number] = [32, 48, 39]
const WHITE: [number, number, number] = [255, 255, 255]
const STATUS_COLORS: [number, number, number][] = [
  BRAND,
  GREEN_LIGHT,
  [197, 213, 200],
]

const MONTHS_SW = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des',
] as const

type Summary = {
  expected: number
  collected: number
  outstanding: number
  progress: number
  fullyPaid: number
  partial: number
  unpaid: number
}

function money(value: number): string {
  return `TZS ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function getSummary(rows: ContributionMemberRow[]): Summary {
  let expected = 0
  let collected = 0
  let outstanding = 0
  let fullyPaid = 0
  let partial = 0
  let unpaid = 0

  for (const row of rows) {
    const required = Math.max(0, Number(row.required_amount) || 0)
    const paid = Math.max(0, Number(row.total_paid) || 0)
    expected += required
    collected += paid
    outstanding += Math.max(0, required - paid)

    if (paid >= required) fullyPaid += 1
    else if (paid > 0) partial += 1
    else unpaid += 1
  }

  return {
    expected,
    collected,
    outstanding,
    progress: expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0,
    fullyPaid,
    partial,
    unpaid,
  }
}

/**
 * Exports a one-contribution executive summary with payment charts and a
 * paginated member detail appendix. All summary values come from the supplied
 * database-backed member payment rows.
 */
export async function exportContributionPdf(
  contribution: Contribution,
  rows: ContributionMemberRow[],
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const summary = getSummary(rows)
  const generatedOn = formatDateStr(new Date().toISOString())
  const logo = await loadLogoData()

  drawHeader(doc, pageWidth, logo, generatedOn)

  let y = 124
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  const titleLines = doc.splitTextToSize(contribution.title, pageWidth - margin * 2)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 22 + 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const description = contribution.description?.trim() || 'Hakuna maelezo yaliyowekwa.'
  const descriptionLines = doc.splitTextToSize(description, pageWidth - margin * 2)
  doc.text(descriptionLines, margin, y)
  y += descriptionLines.length * 12 + 15

  doc.setDrawColor(...GREEN_PALE)
  doc.setLineWidth(1)
  doc.line(margin, y - 4, pageWidth - margin, y - 4)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(`IMEUNDWA  ${formatDateStr(contribution.created_at)}`, margin, y + 9)
  doc.text(`MWISHO WA MALIPO  ${formatDateStr(contribution.due_date)}`, pageWidth / 2, y + 9)
  doc.text(contribution.status === 'OPEN' ? 'WAZI' : 'IMEFUNGWA', pageWidth - margin, y + 9, { align: 'right' })
  y += 31

  drawSectionLabel(doc, 'MUHTASARI WA FEDHA NA WANACHAMA', margin, y)
  y += 12

  const cardGap = 8
  const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4
  const cardHeight = 55
  const metrics = [
    { label: 'Jumla inayotarajiwa', value: money(summary.expected) },
    { label: 'Imekusanywa', value: money(summary.collected) },
    { label: 'Salio linalodaiwa', value: money(summary.outstanding) },
    { label: 'Maendeleo', value: `${summary.progress}%` },
    { label: 'Wanachama wote', value: String(rows.length) },
    { label: 'Wamelipa kikamilifu', value: String(summary.fullyPaid) },
    { label: 'Wamelipa sehemu', value: String(summary.partial) },
    { label: 'Hawajalipa', value: String(summary.unpaid) },
  ]

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / 4)
    const column = index % 4
    const x = margin + column * (cardWidth + cardGap)
    const cardY = y + row * (cardHeight + cardGap)
    drawMetricCard(doc, x, cardY, cardWidth, cardHeight, metric.label, metric.value, index < 4)
  })
  y += cardHeight * 2 + cardGap + 20

  drawSectionLabel(doc, 'UCHAMBUZI WA MAKUSANYO', margin, y)
  y += 10
  const chartGap = 10
  const chartWidth = (pageWidth - margin * 2 - chartGap) / 2
  const chartHeight = 208
  drawChartCard(
    doc,
    margin,
    y,
    chartWidth,
    chartHeight,
    'Hali ya malipo ya wanachama',
    [
      { label: 'Imelipwa kikamilifu', value: summary.fullyPaid },
      { label: 'Imelipwa kwa sehemu', value: summary.partial },
      { label: 'Haijalipwa', value: summary.unpaid },
    ],
    STATUS_COLORS,
    value => `${value} mwanachama`,
  )
  drawChartCard(
    doc,
    margin + chartWidth + chartGap,
    y,
    chartWidth,
    chartHeight,
    'Fedha zilizokusanywa',
    [
      { label: 'Imekusanywa', value: summary.collected },
      { label: 'Salio', value: summary.outstanding },
    ],
    [BRAND, [197, 213, 200]],
    money,
  )
  y += chartHeight + 18

  drawSectionLabel(doc, 'TAARIFA YA UTENDAJI', margin, y)
  y += 13
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const performance = `Kiasi kilichokusanywa ni ${summary.progress}% ya lengo la mchango. ` +
    `${summary.fullyPaid} kati ya wanachama ${rows.length} wamelipa kikamilifu; ` +
    `${summary.partial} wamelipa sehemu na ${summary.unpaid} hawajaanza kulipa.`
  const performanceLines = doc.splitTextToSize(performance, pageWidth - margin * 2 - 20)
  doc.setFillColor(...GREEN_PALE)
  doc.roundedRect(margin, y, pageWidth - margin * 2, performanceLines.length * 13 + 18, 8, 8, 'F')
  doc.setTextColor(...INK)
  doc.text(performanceLines, margin + 10, y + 14)

  if (rows.length > 0) {
    doc.addPage()
    doc.setFillColor(...BRAND)
    doc.rect(0, 0, pageWidth, 58, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('MAELEZO YA MALIPO KWA MWANACHAMA', margin, 27)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(contribution.title, margin, 43)

    const tableRows = rows.map(row => {
      const required = Math.max(0, Number(row.required_amount) || 0)
      const paid = Math.max(0, Number(row.total_paid) || 0)
      return [
        row.profile?.full_name ?? '—',
        money(required),
        money(paid),
        money(Math.max(0, required - paid)),
        paymentLabel(paid, required),
        row.payment_dates.length > 0 ? row.payment_dates.map(formatDateStr).join(', ') : '—',
      ]
    })

    autoTable(doc, {
      startY: 76,
      head: [['Mwanachama', 'Kinachohitajika', 'Kilicholipwa', 'Salio', 'Hali', 'Tarehe za malipo']],
      body: tableRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 5,
        textColor: INK,
        lineColor: GREEN_PALE,
        lineWidth: 0.5,
        overflow: 'linebreak',
      },
      headStyles: { fillColor: BRAND, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 249, 246] },
      columnStyles: {
        0: { cellWidth: 128 },
        1: { halign: 'right', cellWidth: 88 },
        2: { halign: 'right', cellWidth: 88 },
        3: { halign: 'right', cellWidth: 78 },
        4: { cellWidth: 75 },
        5: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin, bottom: 35 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'Imelipwa kikamilifu') data.cell.styles.textColor = BRAND
          else if (data.cell.raw === 'Imelipwa kwa sehemu') data.cell.styles.textColor = [115, 145, 95]
          else data.cell.styles.textColor = MUTED
        }
      },
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    drawFooter(doc, pageWidth, pageHeight, generatedOn, page, pageCount)
  }

  const safeName = contribution.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`${safeName || 'mchango'}-ripoti.pdf`)
}

function drawHeader(doc: jsPDF, pageWidth: number, logo: string | null, generatedOn: string) {
  doc.setFillColor(...BRAND_DARK)
  doc.rect(0, 0, pageWidth, 96, 'F')
  doc.setFillColor(...BRAND)
  doc.rect(0, 88, pageWidth, 8, 'F')

  if (logo) {
    doc.addImage(logo, 'PNG', 40, 20, 52, 52, undefined, 'FAST')
  } else {
    doc.setFillColor(...WHITE)
    doc.roundedRect(40, 22, 48, 48, 14, 14, 'F')
    doc.setTextColor(...BRAND)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('21', 64, 51, { align: 'center' })
  }

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('2021familyforever', 104, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('RIPOTI YA MCHANGO', 104, 59)
  doc.setFontSize(8)
  doc.text(`IMETENGENEZWA  ${generatedOn}`, pageWidth - 40, 55, { align: 'right' })
}

function drawSectionLabel(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFillColor(...BRAND)
  doc.roundedRect(x, y - 7, 3, 12, 1.5, 1.5, 'F')
  doc.setTextColor(...BRAND_DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(label, x + 9, y + 2)
}

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  emphasize: boolean,
) {
  doc.setFillColor(232, 239, 233)
  doc.roundedRect(x + 1, y + 2, width, height, 7, 7, 'F')
  doc.setFillColor(...WHITE)
  doc.setDrawColor(...GREEN_PALE)
  doc.roundedRect(x, y, width, height, 7, 7, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(label.toUpperCase(), width - 14), x + 8, y + 15)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(value.length > 15 ? 8 : value.length > 11 ? 9 : 12)
  doc.setTextColor(...(emphasize ? BRAND : INK))
  doc.text(value, x + 8, y + 40, { maxWidth: width - 14 })
}

function drawChartCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  slices: { label: string; value: number }[],
  colors: [number, number, number][],
  formatValue: (value: number) => string,
) {
  doc.setFillColor(...WHITE)
  doc.setDrawColor(...GREEN_PALE)
  doc.roundedRect(x, y, width, height, 9, 9, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text(title, x + 11, y + 18, { maxWidth: width - 22 })

  const centerX = x + width / 2
  const centerY = y + 78
  const radius = 45
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total > 0) {
    let startAngle = -Math.PI / 2
    slices.forEach((slice, index) => {
      if (slice.value <= 0) return
      const endAngle = startAngle + (slice.value / total) * Math.PI * 2
      drawPieSlice(doc, centerX, centerY, radius, startAngle, endAngle, colors[index])
      startAngle = endAngle
    })
  } else {
    doc.setFillColor(...GREEN_PALE)
    doc.circle(centerX, centerY, radius, 'F')
  }

  doc.setDrawColor(...WHITE)
  doc.setLineWidth(2)
  doc.circle(centerX, centerY, radius, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND_DARK)
  doc.text(total > 0 ? '100%' : '0', centerX, centerY + 3, { align: 'center' })

  const legendTop = y + 138
  slices.forEach((slice, index) => {
    const legendY = legendTop + index * 20
    doc.setFillColor(...colors[index])
    doc.circle(x + 14, legendY - 2, 3.2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(slice.label, x + 23, legendY, { maxWidth: width - 83 })
    const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0
    const valueLabel = formatValue(slice.value)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...INK)
    doc.text(valueLabel, x + 23, legendY + 8, { maxWidth: width - 65 })
    doc.setTextColor(...BRAND)
    doc.text(`${percent}%`, x + width - 10, legendY + 8, { align: 'right' })
  })
}

function drawPieSlice(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: [number, number, number],
) {
  const segments = Math.max(2, Math.ceil((endAngle - startAngle) / (Math.PI / 24)))
  doc.setFillColor(...color)
  for (let index = 0; index < segments; index += 1) {
    const angleA = startAngle + (endAngle - startAngle) * (index / segments)
    const angleB = startAngle + (endAngle - startAngle) * ((index + 1) / segments)
    doc.triangle(
      centerX,
      centerY,
      centerX + Math.cos(angleA) * radius,
      centerY + Math.sin(angleA) * radius,
      centerX + Math.cos(angleB) * radius,
      centerY + Math.sin(angleB) * radius,
      'F',
    )
  }
}

function drawFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  generatedOn: string,
  page: number,
  pageCount = 1,
) {
  doc.setDrawColor(...GREEN_PALE)
  doc.setLineWidth(0.7)
  doc.line(40, pageHeight - 31, pageWidth - 40, pageHeight - 31)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('2021familyforever  ·  Ripoti ya mchango', 40, pageHeight - 18)
  doc.text(`Imetengenezwa ${generatedOn}  ·  Ukurasa ${page} kati ya ${pageCount}`, pageWidth - 40, pageHeight - 18, { align: 'right' })
}

async function loadLogoData(): Promise<string | null> {
  try {
    const response = await fetch('/icons/icon-192x192.png')
    if (!response.ok) {
      console.warn('PDF logo is unavailable; using the text brand mark instead.')
      return null
    }

    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the PDF logo.'))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read the PDF logo.'))
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn('PDF logo could not be loaded; using the text brand mark instead.', error)
    return null
  }
}

function paymentLabel(paid: number, required: number): string {
  if (paid >= required) return 'Imelipwa kikamilifu'
  if (paid > 0) return 'Imelipwa kwa sehemu'
  return 'Haijalipwa'
}

function formatDateStr(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getDate()} ${MONTHS_SW[date.getMonth()]} ${date.getFullYear()}`
}
