export interface ShareSlot {
  startTime: string
  endTime: string
  userName?: string
  participants?: { name: string }[]
  gameSystem?: string
}

function parseMinutes(t: string | undefined): number {
  if (!t) return -1
  const m = /^(\d{2}):(\d{2})$/.exec(t)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1
}

function extractTime(datetimeOrTime: string): string {
  if (!datetimeOrTime) return ''
  const tIndex = datetimeOrTime.indexOf('T')
  return tIndex >= 0 ? datetimeOrTime.slice(tIndex + 1, tIndex + 6) : datetimeOrTime.slice(0, 5)
}

export function drawShareCanvas(
  tableNumber: string,
  selectedDate: Date,
  clubName: string | undefined,
  slots: ShareSlot[] | undefined,
  openTime: string | undefined,
  closeTime: string | undefined,
): HTMLCanvasElement {
  const W = 420
  const H = 580
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Background
  ctx.fillStyle = '#16213e'
  ctx.fillRect(0, 0, W, H)

  // Header bar
  ctx.fillStyle = '#0f3460'
  ctx.fillRect(0, 0, W, 120)

  // Club name
  ctx.fillStyle = '#ffc107'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText(clubName || 'Клуб', 16, 32)

  // Table label
  ctx.fillStyle = '#e94560'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(`Стол #${tableNumber}`, 16, 62)

  // Date
  ctx.fillStyle = '#cccccc'
  ctx.font = '14px sans-serif'
  const dateStr = selectedDate.toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  ctx.fillText(dateStr, 16, 90)

  // Divider
  ctx.strokeStyle = '#533483'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 120)
  ctx.lineTo(W, 120)
  ctx.stroke()

  // Timeline area
  const tlLeft = 56
  const tlTop = 136
  const tlWidth = W - tlLeft - 20
  const tlHeight = 400

  const openMinutes = openTime ? parseMinutes(openTime) : 0
  const closeMinutes = closeTime ? parseMinutes(closeTime) : 24 * 60
  const validOpen = openMinutes >= 0 ? openMinutes : 0
  const validClose = closeMinutes >= 0 ? closeMinutes : 24 * 60
  const totalMin = Math.max(validClose - validOpen, 1)

  // Free background
  ctx.fillStyle = '#90ee90'
  ctx.fillRect(tlLeft, tlTop, tlWidth, tlHeight)

  // Booked segments
  if (slots && slots.length > 0) {
    for (const b of slots) {
      const bs = new Date(b.startTime)
      const be = new Date(b.endTime)
      const bStartMin = Math.max(bs.getHours() * 60 + bs.getMinutes(), validOpen)
      const bEndMin = Math.min(be.getHours() * 60 + be.getMinutes(), validClose)
      if (bEndMin > bStartMin) {
        const segTop = tlTop + ((bStartMin - validOpen) / totalMin) * tlHeight
        const segH = Math.max(((bEndMin - bStartMin) / totalMin) * tlHeight, 2)
        ctx.fillStyle = '#ff8c00'
        ctx.fillRect(tlLeft, segTop, tlWidth, segH)
        if (segH >= 20) {
          ctx.fillStyle = '#ffffff'
          ctx.font = '11px sans-serif'
          const allNames = [b.userName, ...(b.participants ?? []).map(p => p.name)].filter((n): n is string => !!n)
          const nameLine = allNames.join(' + ')
          const lines: string[] = []
          if (nameLine.trim().length > 0) lines.push(nameLine)
          if (b.gameSystem) lines.push(b.gameSystem)
          const lineHeight = 14
          const totalTextH = lines.length * lineHeight
          const startY = segTop + segH / 2 - totalTextH / 2 + lineHeight - 2
          lines.forEach((line, idx) => {
            ctx.fillText(line, tlLeft + 6, startY + idx * lineHeight)
          })
        }
      }
    }
  }

  // Hour grid lines + labels
  const openHour = Math.floor(validOpen / 60)
  const closeHour = Math.ceil(validClose / 60)
  ctx.lineWidth = 1
  for (let h = openHour; h <= closeHour; h++) {
    const min = h * 60
    if (min < validOpen || min > validClose) continue
    const y = tlTop + ((min - validOpen) / totalMin) * tlHeight
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.moveTo(tlLeft, y)
    ctx.lineTo(tlLeft + tlWidth, y)
    ctx.stroke()
    ctx.fillStyle = '#888888'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${String(h).padStart(2, '0')}:00`, tlLeft - 4, y + 4)
    ctx.textAlign = 'left'
  }

  // Timeline border
  ctx.strokeStyle = '#533483'
  ctx.lineWidth = 2
  ctx.strokeRect(tlLeft, tlTop, tlWidth, tlHeight)

  // Legend
  const legendY = tlTop + tlHeight + 20
  ctx.fillStyle = '#90ee90'
  ctx.fillRect(tlLeft, legendY, 14, 10)
  ctx.fillStyle = '#cccccc'
  ctx.font = '12px sans-serif'
  ctx.fillText('Свободно', tlLeft + 18, legendY + 9)

  ctx.fillStyle = '#ff8c00'
  ctx.fillRect(tlLeft + 100, legendY, 14, 10)
  ctx.fillStyle = '#cccccc'
  ctx.fillText('Занято', tlLeft + 118, legendY + 9)

  // Footer
  ctx.fillStyle = '#555555'
  ctx.font = '11px sans-serif'
  ctx.fillText('ClubTableTracker', 16, H - 12)

  return canvas
}

export function buildShareText(
  tableNumber: string,
  selectedDate: Date,
  slots: ShareSlot[],
): string {
  if (slots.length === 0) return ''
  const dateStr = selectedDate.toLocaleDateString('ru-RU')
  const blocks = slots.map(b => {
    const fromTime = extractTime(b.startTime)
    const toTime = extractTime(b.endTime)
    const systemPart = b.gameSystem ? `, ${b.gameSystem}` : ''
    const header = `${dateStr}, ${fromTime}–${toTime}`
    const tableLine = `Стол #${tableNumber}${systemPart}`
    const playerLines: string[] = []
    if (b.userName) playerLines.push(b.userName)
    for (const p of b.participants ?? []) {
      playerLines.push(p.name)
    }
    return `=====\n${header}\n${tableLine}\n${playerLines.join('\n')}\n=====`
  })
  return blocks.join('\n\n')
}

export async function shareTextOnly(
  tableNumber: string,
  selectedDate: Date,
  slots: ShareSlot[],
  onError?: (msg: string) => void,
): Promise<void> {
  const textContent = buildShareText(tableNumber, selectedDate, slots)
  if (!textContent) return
  const shareData = {
    title: `Стол #${tableNumber}`,
    text: textContent,
  }
  if (navigator.share) {
    try {
      await navigator.share(shareData)
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Share failed for a non-cancellation reason, fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(textContent)
  } catch (err) {
    onError?.(`Не удалось скопировать текст: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function shareTableSchedule(
  tableNumber: string,
  selectedDate: Date,
  clubName: string | undefined,
  slots: ShareSlot[],
  openTime: string | undefined,
  closeTime: string | undefined,
  onError?: (msg: string) => void,
): Promise<void> {
  const textContent = buildShareText(tableNumber, selectedDate, slots)
  const canvas = drawShareCanvas(tableNumber, selectedDate, clubName, slots, openTime, closeTime)
  canvas.toBlob(async (blob) => {
    if (!blob) {
      onError?.('Не удалось создать изображение для отправки')
      return
    }
    const dateStr = selectedDate.toISOString().slice(0, 10)
    const file = new File([blob], `table-${tableNumber}-${dateStr}.png`, { type: 'image/png' })
    const shareData = {
      title: `${clubName || 'Клуб'} — Стол #${tableNumber}`,
      text: textContent || `Состояние стола #${tableNumber} на ${selectedDate.toLocaleDateString('ru-RU')}`,
      files: [file],
    }
    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // User cancelled or share failed, fall through to download
      }
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `table-${tableNumber}-${dateStr}.png`
    link.click()
    URL.revokeObjectURL(url)
    if (textContent) {
      try { await navigator.clipboard.writeText(textContent) } catch { /* ignore */ }
    }
  }, 'image/png')
}
