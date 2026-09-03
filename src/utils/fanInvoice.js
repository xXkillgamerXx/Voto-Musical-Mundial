import { toJpeg } from 'html-to-image'
import { formatStoreMoney } from '../data/fanStoreCatalog'

const PAGE_W = 595.28
const PAGE_H = 841.89
const SHEET_W = 820

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatDate = (iso, lang) => {
  const date = iso ? new Date(iso) : new Date()
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const folioFromId = (invoiceId) => {
  const digits = String(invoiceId || '').replace(/\D/g, '').slice(-6).padStart(6, '0')
  return `FV-${digits}`
}

const moneyLabel = (amount, currency) => {
  if (currency === 'COP') return `${formatStoreMoney(amount, 'COP')} COP`
  return `USD ${Number(amount || 0).toFixed(2)}`
}

const concatBytes = (chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    out.set(chunk, offset)
    offset += chunk.length
  })
  return out
}

const dataUrlToBytes = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',')[1] || ''
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const buildPdfFromJpeg = (jpegBytes, imgWidth, imgHeight) => {
  const ratio = imgWidth / imgHeight
  const pageRatio = PAGE_W / PAGE_H
  let drawW = PAGE_W
  let drawH = PAGE_H
  let drawX = 0
  let drawY = 0
  if (ratio > pageRatio) {
    drawH = PAGE_W / ratio
    drawY = (PAGE_H - drawH) / 2
  } else {
    drawW = PAGE_H * ratio
    drawX = (PAGE_W - drawW) / 2
  }

  const encoder = new TextEncoder()
  const header = encoder.encode('%PDF-1.4\n')
  const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`
  const contentBytes = encoder.encode(content)

  const objects = [
    encoder.encode('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'),
    encoder.encode('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n'),
    encoder.encode(
      `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >> endobj\n`,
    ),
    concatBytes([
      encoder.encode(`4 0 obj << /Length ${contentBytes.length} >> stream\n`),
      contentBytes,
      encoder.encode('endstream\nendobj\n'),
    ]),
    concatBytes([
      encoder.encode(
        `5 0 obj << /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >> stream\n`,
      ),
      jpegBytes,
      encoder.encode('\nendstream\nendobj\n'),
    ]),
  ]

  const chunks = [header]
  const offsets = [0]
  let cursor = header.length
  objects.forEach((object) => {
    offsets.push(cursor)
    chunks.push(object)
    cursor += object.length
  })

  const xrefStart = cursor
  const xrefLines = ['xref\n0 6\n0000000000 65535 f \n']
  for (let i = 1; i <= 5; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  }
  chunks.push(encoder.encode(xrefLines.join('')))
  chunks.push(
    encoder.encode(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`),
  )
  return concatBytes(chunks)
}

const waitForImages = (root) =>
  Promise.all(
    Array.from(root.querySelectorAll('img')).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }),
    ),
  )

const ensureInvoiceFonts = async () => {
  if (typeof document === 'undefined') return
  const href =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }
  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load('800 28px Inter'),
    document.fonts.load('700 16px Inter'),
    document.fonts.load('400 13px Inter'),
  ]).catch(() => {})
}

const itemCopy = (invoice, lang) => {
  const en = lang === 'en'
  if (invoice.type === 'pack') {
    return {
      title: en ? `${invoice.welcomePts} point pack` : `Paquete ${invoice.welcomePts} puntos`,
      detail: en ? 'Points now, no plan and no supported artist.' : 'Puntos ya, sin plan y sin artista apoyado.',
    }
  }
  const cycle = invoice.yearly ? (en ? 'Yearly' : 'Anual') : (en ? 'Monthly' : 'Mensual')
  const mark = invoice.sku === 'MEGA' ? '♛' : invoice.sku === 'SUPER' ? '⚡' : '★'
  return {
    title: en ? `${invoice.name} subscription` : `Suscripción ${invoice.name}`,
    detail: `${cycle} · ${en ? 'Votes' : 'Votos'} ×${invoice.multiplier || 1} · badge ${mark} · ${en ? 'welcome' : 'bienvenida'} ${invoice.welcomePts || 0} pts`,
  }
}

const artistChipsHtml = (artists) =>
  (artists || [])
    .filter((row) => row?.name)
    .map((row) => {
      const photo = row.image
        ? `<img src="${escapeHtml(row.image)}" alt="" crossorigin="anonymous" />`
        : `<span class="ph">${escapeHtml(String(row.name).charAt(0))}</span>`
      return `<span class="chip">${photo}<b>${escapeHtml(row.name)}</b></span>`
    })
    .join('')

const planBannerHtml = (invoice, lang) => {
  if (invoice.type !== 'plan') return ''
  const en = lang === 'en'
  const chips = artistChipsHtml(invoice.artists)
  return `
    <section class="meta">
      <div>
        <h3>${en ? 'PLAN' : 'PLAN'}</h3>
        <p><b>${escapeHtml(invoice.name)}</b> · ${en ? 'Votes' : 'Votos'} ×${invoice.multiplier || 1}${invoice.welcomePts ? ` · +${invoice.welcomePts} pts` : ''}</p>
      </div>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </section>
  `
}

const buildInvoiceNode = (invoice, lang = 'es') => {
  const en = lang === 'en'
  const folio = folioFromId(invoice.invoiceId)
  const currency = invoice.currency === 'COP' ? 'COP' : 'USD'
  const copy = itemCopy(invoice, lang)
  const artists = (invoice.artists || []).filter((row) => row?.name)
  const artistCell = artists.length
    ? `${escapeHtml(copy.detail)}<br/>${en ? 'Supporting' : 'Artista(s)'}: <b>${escapeHtml(artists.map((row) => row.name).join(', '))}</b>`
    : escapeHtml(copy.detail)
  const buyer = invoice.buyerName || (en ? 'End consumer' : 'Consumidor final')
  const host = document.createElement('div')
  host.setAttribute('data-fan-invoice', '1')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_W}px;pointer-events:none;z-index:-1;background:#ffffff;`
  host.innerHTML = `
    <style>
      [data-fan-invoice] * { box-sizing: border-box; }
      [data-fan-invoice] .sheet {
        width: ${SHEET_W}px;
        padding: 36px 40px 32px;
        color: #111827;
        font-family: Inter, Arial, sans-serif;
        background: #ffffff;
        border: 1px solid #e5e7eb;
      }
      [data-fan-invoice] .top {
        display: flex; justify-content: space-between; gap: 20px;
        border-bottom: 2px solid #111827;
        padding-bottom: 18px;
      }
      [data-fan-invoice] .mmv {
        font-size: 10px; letter-spacing: 1.6px; color: #6b7280; font-weight: 800; margin-bottom: 6px;
      }
      [data-fan-invoice] .brand strong { font-size: 18px; color: #111827; }
      [data-fan-invoice] .brand small { display: block; color: #4b5563; font-size: 12px; margin-top: 6px; line-height: 1.5; }
      [data-fan-invoice] .doc { text-align: right; }
      [data-fan-invoice] .doc b {
        display: inline-block; background: #111827;
        color: #fff; font-size: 11px; letter-spacing: 1.2px; padding: 5px 10px; border-radius: 4px;
      }
      [data-fan-invoice] .doc h1 { font-size: 26px; margin: 10px 0 4px; color: #111827; letter-spacing: -0.5px; }
      [data-fan-invoice] .doc p { color: #6b7280; font-size: 13px; }
      [data-fan-invoice] .cols {
        display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
        padding: 20px 0; font-size: 13px;
      }
      [data-fan-invoice] .cols h3 { font-size: 11px; letter-spacing: 1.2px; color: #6b7280; margin-bottom: 8px; }
      [data-fan-invoice] .cols p { line-height: 1.55; color: #111827; }
      [data-fan-invoice] .meta {
        margin: 0 0 18px; padding: 12px 14px;
        border: 1px solid #e5e7eb; background: #f9fafb;
      }
      [data-fan-invoice] .meta h3 { font-size: 11px; letter-spacing: 1.2px; color: #6b7280; margin-bottom: 4px; }
      [data-fan-invoice] .meta p { font-size: 13px; color: #111827; }
      [data-fan-invoice] .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      [data-fan-invoice] .chip {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 4px 10px 4px 4px; border-radius: 999px;
        border: 1px solid #e5e7eb; background: #fff; font-size: 12px; color: #111827;
      }
      [data-fan-invoice] .chip img, [data-fan-invoice] .chip .ph {
        width: 22px; height: 22px; border-radius: 50%; object-fit: cover; display: grid; place-items: center;
        background: #e5e7eb; font-size: 10px; font-weight: 800; color: #111827;
      }
      [data-fan-invoice] table { width: 100%; border-collapse: collapse; font-size: 13px; }
      [data-fan-invoice] th {
        text-align: left; font-size: 11px; letter-spacing: .8px; color: #6b7280;
        border-bottom: 1px solid #d1d5db; padding: 8px 6px;
      }
      [data-fan-invoice] td {
        padding: 14px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; color: #111827;
      }
      [data-fan-invoice] .num { text-align: right; }
      [data-fan-invoice] .totals { width: 280px; margin: 16px 0 0 auto; font-size: 13px; color: #4b5563; }
      [data-fan-invoice] .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
      [data-fan-invoice] .totals b { color: #111827; }
      [data-fan-invoice] .grand {
        border-top: 2px solid #111827; margin-top: 6px; padding-top: 10px;
        font-size: 16px; font-weight: 800; color: #111827;
      }
      [data-fan-invoice] .grand span:last-child { color: #111827; font-size: 20px; }
      [data-fan-invoice] .pay {
        margin-top: 22px; padding: 12px 14px; background: #f9fafb;
        border: 1px solid #e5e7eb; font-size: 13px; color: #374151;
      }
      [data-fan-invoice] .legal {
        margin-top: 24px; font-size: 11px; color: #6b7280; line-height: 1.5;
        border-top: 1px solid #e5e7eb; padding-top: 14px;
      }
    </style>
    <article class="sheet">
      <div class="top">
        <div class="brand">
          <div class="mmv">MUSIC MUNDIAL VOTING</div>
          <strong>STARFLARE GROUP S.A.S.</strong>
          <small>
            NIT 902.024.591-7<br/>
            CL 9E No. 6A-90 Piso 3, Prados del Este<br/>
            Cúcuta, Norte de Santander · Colombia<br/>
            starflaregroup@gmail.com
          </small>
        </div>
        <div class="doc">
          <b>${en ? 'SALES INVOICE' : 'FACTURA DE VENTA'}</b>
          <h1>${escapeHtml(folio)}</h1>
          <p>Music Mundial Voting</p>
        </div>
      </div>

      <div class="cols">
        <div>
          <h3>${en ? 'BILL TO' : 'ADQUIRIENTE'}</h3>
          <p>
            <b>${escapeHtml(buyer)}</b><br/>
            ${escapeHtml(invoice.buyerEmail || (en ? 'End consumer' : 'Consumidor final'))}<br/>
            ${escapeHtml(invoice.country || '')}<br/>
            ${escapeHtml(invoice.phone || '—')}
          </p>
        </div>
        <div>
          <h3>${en ? 'DOCUMENT' : 'DOCUMENTO'}</h3>
          <p>
            ${en ? 'Date' : 'Fecha'}: <b>${escapeHtml(formatDate(invoice.startedAt, lang))}</b><br/>
            ${en ? 'Currency' : 'Moneda'}: <b>${currency}</b><br/>
            ${en ? 'Method' : 'Medio'}: <b>${escapeHtml(invoice.method === 'paypal' ? 'PayPal' : `Wompi · ${invoice.method || (en ? 'Card' : 'Tarjeta')}`)}</b><br/>
            ${en ? 'Reference' : 'Referencia'}: <b>MMV-${escapeHtml(invoice.sku || 'FAN')}-${folio.replace('FV-', '')}</b>
          </p>
        </div>
      </div>

      ${planBannerHtml(invoice, lang)}

      <table>
        <thead>
          <tr>
            <th>${en ? 'Description' : 'Descripción'}</th>
            <th>${en ? 'Detail' : 'Detalle'}</th>
            <th class="num">${en ? 'Qty' : 'Cant.'}</th>
            <th class="num">${en ? 'Amount' : 'Valor'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(copy.title)}</td>
            <td>${artistCell}</td>
            <td class="num">1</td>
            <td class="num">${escapeHtml(moneyLabel(invoice.base, currency))}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div><span>Subtotal</span><b>${escapeHtml(moneyLabel(invoice.base, currency))}</b></div>
        <div><span>${invoice.tax ? (en ? 'VAT 19%' : 'IVA 19%') : (en ? 'VAT 0%' : 'IVA 0%')}</span><b>${invoice.tax ? escapeHtml(moneyLabel(invoice.tax, currency)) : moneyLabel(0, currency)}</b></div>
        <div class="grand"><span>Total</span><span>${escapeHtml(moneyLabel(invoice.total, currency))}</span></div>
      </div>

      <div class="pay">
        ${en ? 'VAT taxpayer · Simple Taxation Regime.' : 'Responsable de IVA · Régimen Simple de Tributación.'}<br/>
        ${
          invoice.tax
            ? (en ? 'Taxed operation in Colombia. VAT shown separately.' : 'Operación gravada en Colombia. IVA discriminado.')
            : (en ? 'Service export. VAT 0%. Buyer outside Colombia.' : 'Exportación de servicios. IVA 0%. Destinatario fuera de Colombia.')
        }
      </div>

      <p class="legal">
        ${
          en
            ? 'Document generated as commercial support for Music Mundial Voting. The DIAN electronic invoice is issued from STARFLARE GROUP S.A.S. billing with the same number and amounts. Legal representative: Álvarez Omaña Jordan Daniel.'
            : 'Documento generado para respaldo comercial de Music Mundial Voting. La factura electrónica DIAN (validación previa) se emite desde el sistema de facturación de STARFLARE GROUP S.A.S. con el mismo número y valores. Representante legal: Álvarez Omaña Jordan Daniel.'
        }
      </p>
    </article>
  `
  return host
}

export const downloadFanInvoice = async (invoice, lang = 'es') => {
  if (!invoice || typeof document === 'undefined') return
  await ensureInvoiceFonts()
  const host = buildInvoiceNode(invoice, lang)
  document.body.appendChild(host)
  try {
    const sheet = host.querySelector('.sheet')
    await waitForImages(host)
    await new Promise((resolve) => window.setTimeout(resolve, 80))
    const width = sheet.offsetWidth || SHEET_W
    const height = sheet.offsetHeight || 1123
    const dataUrl = await toJpeg(sheet, {
      cacheBust: true,
      quality: 0.95,
      pixelRatio: 2,
      width,
      height,
      backgroundColor: '#ffffff',
    })
    if (!dataUrl) throw new Error('PDF export failed')
    const preview = new Image()
    preview.src = dataUrl
    await preview.decode()
    const jpegBytes = dataUrlToBytes(dataUrl)
    const pdfBytes = buildPdfFromJpeg(
      jpegBytes,
      preview.naturalWidth || width * 2,
      preview.naturalHeight || height * 2,
    )
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${folioFromId(invoice.invoiceId)}.pdf`
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  } finally {
    host.remove()
  }
}
