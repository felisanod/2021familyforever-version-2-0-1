import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ContributionWithStats } from '../services/contributions'
import type { ContributionMemberRow } from '../services/contributions'

const BRAND: [number, number, number] = [79, 70, 229] // indigo #4F46E5
const MUTED: [number, number, number] = [102, 112, 133]

const MONTHS_SW = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des',
] as const

function money(n: number): string {
  return `TZS ${Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/**
 * Generates a professional contribution report PDF:
 * brand header, contribution summary, payment statistics and a full
 * per-member payment table (required / paid / remaining / status / progress).
 */
export function exportContributionPdf(
  contribution: ContributionWithStats,
  rows: ContributionMemberRow[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // ---- Header band ----
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageWidth, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('2021familyforever', 40, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Ripoti ya Malipo ya Michango', 40, 46)
  doc.setFontSize(9)
  const today = formatDateStr(new Date().toISOString())
  doc.text(`Imetengenezwa ${today}`, pageWidth - 40, 46, { align: 'right' })

  // ---- Contribution summary ----
  let y = 88
  doc.setTextColor(23, 32, 51)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(contribution.title, 40, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  if (contribution.description) {
    const lines = doc.splitTextToSize(contribution.description, pageWidth - 80)
    doc.text(lines, 40, y)
    y += lines.length * 12 + 4
  }

  const infoPairs: [string, string][] = [
    ['Kiasi Kinachohitajika', money(contribution.amount)],
    ['Tarehe ya Kufunguka', formatDateStr(contribution.opening_date)],
    ['Tarehe ya Kufunga', formatDateStr(contribution.due_date)],
    ['Hali', contribution.status === 'OPEN' ? 'Wazi' : 'Imefungwa'],
    ['Wanachama Wote', String(contribution.total_members)],
    ['DONE', String(contribution.completed_members)],
    ['DONE Kiasi', String(contribution.partial_members)],
    ['Hawajalipa / Wanasubiri', String(contribution.unpaid_members + contribution.pending_members)],
    ['Jumla Yaliyokusanywa', money(contribution.total_collected)],
    ['Ukamilifu', `${contribution.completion_percent}%`],
  ]

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 0, right: 12 }, textColor: [23, 32, 51] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: MUTED } },
    body: chunk(infoPairs, 5).map(group =>
      group.flatMap(([label, value]) => [label, value])
    ),
    margin: { left: 40, right: 40 },
  })

  // ---- Member payment table ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type DocWithTable = any
  const lastY = (doc as DocWithTable).lastAutoTable?.finalY ?? y + 60

  const tableRows = rows.map(r => [
    r.profile?.full_name ?? '—',
    r.profile?.phone_number ?? '—',
    [r.profile?.city, r.profile?.region].filter(Boolean).join(', ') || '—',
    money(r.required_amount),
    money(r.total_paid),
    money(r.remaining_amount),
    r.overpaid_amount > 0 ? `${money(r.overpaid_amount)} zaidi` : '—',
    labelFor(r.payment_status),
    `${r.progress_percent}%`,
    r.last_payment_date ? formatDateStr(r.last_payment_date) : '—',
  ])

  autoTable(doc, {
    startY: lastY + 24,
    head: [[
      'Mwanachama', 'Namba ya Simu', 'Mkoa/Mji', 'Kinachohitajika', 'Kilicholipwa',
      'Kilichobaki', 'ILIZIDI', 'Hali', 'Maendeleo', 'Malipo ya Mwisho',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 245, 252] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      8: { halign: 'center' },
      9: { halign: 'center' },
    },
    margin: { left: 40, right: 40 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 7) {
        const v = String(data.cell.raw)
        if (v === 'Imekamilika') data.cell.styles.textColor = [22, 163, 74]
        else if (v === 'Imekamilika Kiasi') data.cell.styles.textColor = [217, 119, 6]
        else if (v === 'Haijalipwa') data.cell.styles.textColor = [220, 38, 38]
      }
    },
  })

  // Footer on every page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(
      `2021familyforever — Ripoti ya Michango · Ukurasa ${i} kati ya ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 16,
      { align: 'center' }
    )
  }

  const safeName = contribution.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`${safeName}-ripoti.pdf`)
}

function labelFor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'Imekamilika'
    case 'PARTIAL': return 'Imekamilika Kiasi'
    case 'UNPAID': return 'Haijalipwa'
    default: return 'Inasubiri'
  }
}

function formatDateStr(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS_SW[d.getMonth()]} ${d.getFullYear()}`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}