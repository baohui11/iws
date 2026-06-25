import fs from 'fs'
import path from 'path'

import ExcelJS from 'exceljs'

import { formatWorkSlotsBriefZh } from '@/modules/weekly/lib/weekly-report-work-slots'
import type { ProjectWeekWorkItemsPage } from '@/modules/weekly/types'

/** 与 temp/export.ts 表头、配色、列宽一致；含本周工作 + 下周计划（计划无「计划成果」列）。 */
export function sanitizeExcelFileName(name: string): string {
  const s = name.replace(/[/\\?*:"<>|]/g, '_').replace(/\s+/g, ' ').trim()
  return s || '周报'
}

const COL_LAST = 5 // A–E

export async function buildProjectWeekExcelBuffer(
  data: ProjectWeekWorkItemsPage,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('双周滚动计划')

  const headerStyle: Partial<ExcelJS.Style> = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } },
    font: { bold: true, size: 11 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  }

  const planHeaderStyle: Partial<ExcelJS.Style> = {
    ...headerStyle,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } },
  }

  const dataStyle: Partial<ExcelJS.Style> = {
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
    alignment: { vertical: 'middle', wrapText: true },
  }

  const titleStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 12 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  }

  sheet.columns = [
    { width: 8 },
    { width: 50 },
    { width: 80 },
    { width: 22 },
    { width: 18 },
  ]

  let currentRowNum = 1

  const projectTitle = `${data.projectName?.trim() || '—'} - 双周滚动计划`
  sheet.mergeCells(
    `A${currentRowNum}:${String.fromCharCode(64 + COL_LAST)}${currentRowNum}`,
  )
  const titleCell = sheet.getCell(`A${currentRowNum}`)
  titleCell.value = projectTitle
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(currentRowNum).height = 30

  try {
    const logoPath = path.join(process.cwd(), 'public', 'weekly_logo.png')
    if (fs.existsSync(logoPath)) {
      const logoId = workbook.addImage({ filename: logoPath, extension: 'png' })
      sheet.addImage(logoId, {
        tl: { col: 0.25, row: 0.25 },
        ext: { width: 136, height: 23 },
        editAs: 'oneCell',
      })
    }
  } catch {
    // ignore
  }

  currentRowNum++

  const weekLine = `${data.title_zh}${data.range_line ? `（${data.range_line}）` : ''} 工作情况`
  sheet.mergeCells(`A${currentRowNum}:E${currentRowNum}`)
  const workTitle = sheet.getCell(`A${currentRowNum}`)
  workTitle.value = weekLine
  Object.assign(workTitle, titleStyle)
  workTitle.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB4C7E7' },
  }
  sheet.getRow(currentRowNum).height = 25
  currentRowNum++

  const workHeaders = [
    '序号',
    '本周成果（文件名）',
    '主要工作内容',
    '工作日期',
    '完成人',
  ]
  workHeaders.forEach((header, index) => {
    const cell = sheet.getCell(currentRowNum, index + 1)
    cell.value = header
    Object.assign(cell, headerStyle)
  })
  sheet.getRow(currentRowNum).height = 25
  currentRowNum++

  const workRecords = data.workItems

  if (workRecords.length === 0) {
    for (let i = 0; i < COL_LAST; i++) {
      const cell = sheet.getCell(currentRowNum, i + 1)
      cell.value = i === 0 ? 1 : ''
      Object.assign(cell, dataStyle)
    }
    sheet.getRow(currentRowNum).height = 22
    currentRowNum++
  } else {
    workRecords.forEach((row, index) => {
      const it = row.item
      const fileNames = (it.files || [])
        .map((f) => f.file_name)
        .filter((n) => n)
        .map((n) => `《${n}》`)
        .join('、')

      const slotLabel = formatWorkSlotsBriefZh(it.work_slots)
      const days =
        it.work_days != null ? it.work_days : it.work_slots.length * 0.5
      const desc = it.item_desc?.trim() || ''
      const dateCell = `${slotLabel} · ${days} 天`

      const rowData = [
        index + 1,
        fileNames || '-',
        desc || '—',
        dateCell,
        row.author_name || '—',
      ]

      rowData.forEach((value, colIndex) => {
        const cell = sheet.getCell(currentRowNum, colIndex + 1)
        cell.value = value
        Object.assign(cell, dataStyle)
        if (colIndex === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })

      const contentLines = Math.max((desc || '').split('\n').length, 1)
      sheet.getRow(currentRowNum).height = Math.max(22, contentLines * 20)
      currentRowNum++
    })
  }

  sheet.getRow(currentRowNum).height = 15
  currentRowNum++

  const planSectionTitle = data.next_plan_range_line
    ? `下周（${data.next_plan_range_line}）计划安排`
    : '下周计划安排'
  sheet.mergeCells(`A${currentRowNum}:E${currentRowNum}`)
  const planTitle = sheet.getCell(`A${currentRowNum}`)
  planTitle.value = planSectionTitle
  Object.assign(planTitle, titleStyle)
  planTitle.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  }
  sheet.getRow(currentRowNum).height = 25
  currentRowNum++

  const planHeaders = ['序号', '计划工作内容', '计划日期', '计划完成人']
  planHeaders.forEach((header, index) => {
    const cell = sheet.getCell(currentRowNum, index + 1)
    cell.value = header
    Object.assign(cell, planHeaderStyle)
  })
  const planHeaderEmpty = sheet.getCell(currentRowNum, 5)
  planHeaderEmpty.value = ''
  Object.assign(planHeaderEmpty, planHeaderStyle)
  sheet.getRow(currentRowNum).height = 25
  currentRowNum++

  const planRecords = data.planItems

  if (planRecords.length === 0) {
    for (let c = 0; c < 4; c++) {
      const cell = sheet.getCell(currentRowNum, c + 1)
      cell.value = c === 0 ? 1 : ''
      Object.assign(cell, dataStyle)
    }
    sheet.getCell(currentRowNum, 5).value = ''
    Object.assign(sheet.getCell(currentRowNum, 5), dataStyle)
    sheet.getRow(currentRowNum).height = 22
  } else {
    planRecords.forEach((row, index) => {
      const it = row.item
      const slotLabel = formatWorkSlotsBriefZh(it.work_slots)
      const days =
        it.work_days != null ? it.work_days : it.work_slots.length * 0.5
      const dateCell = `${slotLabel} · ${days} 天`
      const desc = it.item_desc?.trim() || ''

      const rowData = [
        index + 1,
        desc || '—',
        dateCell,
        row.author_name || '—',
      ]

      rowData.forEach((value, colIndex) => {
        const cell = sheet.getCell(currentRowNum, colIndex + 1)
        cell.value = value
        Object.assign(cell, dataStyle)
        if (colIndex === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })
      sheet.getCell(currentRowNum, 5).value = ''
      Object.assign(sheet.getCell(currentRowNum, 5), dataStyle)

      const contentLines = Math.max((desc || '').split('\n').length, 1)
      sheet.getRow(currentRowNum).height = Math.max(22, contentLines * 22)
      currentRowNum++
    })
  }

  const raw = await workbook.xlsx.writeBuffer()
  return Buffer.from(raw as ArrayBuffer)
}
