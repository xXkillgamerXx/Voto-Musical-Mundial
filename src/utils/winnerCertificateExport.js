import { toBlob } from 'html-to-image'
import {
  formatCertificateInstagramTag,
  getCertificateInstagramHandle,
} from './certificateBrand'

const CERT_WIDTH = 1000
const CERT_HEIGHT = Math.round((CERT_WIDTH * 3.85) / 3)

const STAR_PATH =
  'M12 1.6l2.05 6.3H21l-5.2 3.78 1.98 6.32L12 14.9 6.22 18l1.98-6.32L3 7.9h6.95L12 1.6z'

const copyForLang = (lang) =>
  lang === 'en'
    ? {
        title: 'CERTIFICATE',
        certifies: 'MUSIC MUNDIAL CERTIFIES THAT',
        awarded: 'HAS BEEN OFFICIALLY AWARDED',
        descHtml:
          'In recognition of outstanding talent, dedication<br>and impact in the music industry.' +
          '<em>Voted by fans worldwide.</em>',
      }
    : {
        title: 'CERTIFICADO',
        certifies: 'MUSIC MUNDIAL CERTIFICA QUE',
        awarded: 'HA SIDO OFICIALMENTE PREMIADO/A',
        descHtml:
          'En reconocimiento a su talento excepcional, dedicación<br>e impacto en la industria musical.' +
          '<em>Votado por fans de todo el mundo.</em>',
      }

const slugify = (value) =>
  String(value || 'certificate')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'certificate'

const waitForImages = (root) =>
  Promise.all(
    Array.from(root.querySelectorAll('img')).map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.onload = () => resolve()
              img.onerror = () => resolve()
            }),
    ),
  )

const ensureFonts = async () => {
  if (typeof document === 'undefined') return

  const href =
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@600;700;800&display=swap'
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }

  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load('800 44px Cinzel'),
    document.fonts.load('700 18px Cinzel'),
    document.fonts.load('800 13px Inter'),
    document.fonts.load('700 16px Inter'),
  ]).catch(() => {})
}

const buildCertificateNode = ({ name, group, category, year, lang = 'es' } = {}) => {
  const copy = copyForLang(lang === 'en' ? 'en' : 'es')
  const displayName = String(name || '').trim().toUpperCase() || 'WINNER'
  const displayGroup = String(group || '').trim().toUpperCase()
  const displayCategory =
    String(category || '').trim().toUpperCase() || 'OFFICIAL WINNER'
  const yearText = String(year || new Date().getFullYear()).trim() || String(new Date().getFullYear())

  const host = document.createElement('div')
  host.setAttribute('data-certificate-export', '1')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:' +
    CERT_WIDTH +
    'px;height:' +
    CERT_HEIGHT +
    'px;pointer-events:none;z-index:-1;opacity:1;'

  host.innerHTML = `
    <style>
      [data-certificate-export] .cert {
        position: relative;
        width: ${CERT_WIDTH}px;
        height: ${CERT_HEIGHT}px;
        overflow: hidden;
        border: 2px solid #4c1d95;
        background: #070314 url("/certificate-bg.jpg") center / cover no-repeat;
        color: #fff;
        font-family: Inter, Arial, sans-serif;
      }
      [data-certificate-export] .cert::before {
        content: "";
        position: absolute;
        inset: 26px;
        border-radius: 32px;
        border: 2px solid rgba(196, 181, 253, 0.28);
        pointer-events: none;
        z-index: 2;
      }
      [data-certificate-export] .glow {
        position: absolute; inset: 0; pointer-events: none;
        background:
          radial-gradient(90% 40% at 50% -5%, rgba(124,58,237,.32), transparent 58%),
          radial-gradient(70% 35% at 100% 70%, rgba(88,28,135,.22), transparent 60%);
      }
      [data-certificate-export] .inner {
        position: relative;
        z-index: 3;
        height: 100%;
        padding: 6% 7% 5%;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      [data-certificate-export] .crown-top {
        width: 236px;
        height: auto;
        display: block;
        mix-blend-mode: lighten;
        filter: drop-shadow(0 6px 14px rgba(245, 197, 66, .28));
      }
      [data-certificate-export] .brand {
        margin-top: 12px;
        font-size: 26px;
        letter-spacing: 7.2px;
        font-weight: 800;
        color: #f5f3ff;
      }
      [data-certificate-export] .voting {
        margin-top: 6px;
        font-size: 20px;
        letter-spacing: 8.4px;
        font-weight: 700;
        color: #c084fc;
      }
      [data-certificate-export] .title-row {
        margin-top: 44px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
      }
      [data-certificate-export] .title-row svg { width: 40px; height: 40px; flex-shrink: 0; }
      [data-certificate-export] .title-row h1 {
        font-family: Cinzel, Georgia, serif;
        font-weight: 700;
        font-size: 56px;
        letter-spacing: 7px;
        color: #f8f7ff;
        margin: 0;
      }
      [data-certificate-export] .spark-line {
        margin-top: 24px;
        color: #c084fc;
        font-size: 22px;
        letter-spacing: 12px;
      }
      [data-certificate-export] .certifies {
        margin-top: 20px;
        font-size: 22px;
        letter-spacing: 4.2px;
        color: #d8b4fe;
        font-weight: 600;
      }
      [data-certificate-export] .winner {
        margin-top: 28px;
        font-family: Cinzel, Georgia, serif;
        font-weight: 800;
        font-size: 88px;
        letter-spacing: 1px;
        line-height: 1.05;
        background: linear-gradient(180deg, #ffffff 8%, #f3e8ff 40%, #c084fc 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        max-width: 100%;
        word-break: break-word;
      }
      [data-certificate-export] .group {
        margin-top: 20px;
        font-size: 32px;
        letter-spacing: 14px;
        font-weight: 700;
        color: #ede9fe;
      }
      [data-certificate-export] .awarded {
        margin-top: 44px;
        font-size: 22px;
        letter-spacing: 5.2px;
        color: #a1a1aa;
        font-weight: 600;
      }
      [data-certificate-export] .award-box {
        margin-top: 28px;
        width: 88%;
        padding: 32px 28px 24px;
        border: 2px solid rgba(233, 213, 255, .38);
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(88,28,135,.18));
      }
      [data-certificate-export] .award-box .award {
        font-family: Cinzel, Georgia, serif;
        font-weight: 700;
        font-size: 36px;
        letter-spacing: 3px;
        color: #fff;
        word-break: break-word;
      }
      [data-certificate-export] .award-box .year {
        margin-top: 14px;
        font-size: 28px;
        letter-spacing: 6px;
        color: #e9d5ff;
        font-weight: 600;
      }
      [data-certificate-export] .spark { color: #c084fc; font-size: 0.75em; }
      [data-certificate-export] .desc {
        margin-top: 40px;
        max-width: 88%;
        font-size: 26px;
        line-height: 1.6;
        color: #c4c4d0;
      }
      [data-certificate-export] .desc em {
        display: block;
        margin-top: 16px;
        font-style: italic;
        color: #a1a1aa;
        font-size: 24px;
      }
      [data-certificate-export] .foot {
        width: 100%;
        margin-top: auto;
        padding-top: 36px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 20px;
        color: #a1a1aa;
      }
      [data-certificate-export] .foot .mid,
      [data-certificate-export] .foot .hash { color: #c084fc; }
    </style>
    <article class="cert">
      <div class="glow"></div>
      <div class="inner">
        <img class="crown-top" src="/certificate-crown.png" alt="" />
        <div class="brand">MUSIC MUNDIAL</div>
        <div class="voting">VOTING</div>
        <div class="title-row">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#e9d5ff" d="${STAR_PATH}"/></svg>
          <h1>${copy.title}</h1>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#e9d5ff" d="${STAR_PATH}"/></svg>
        </div>
        <div class="spark-line">✦</div>
        <div class="certifies">${copy.certifies}</div>
        <div class="winner">${displayName}</div>
        ${displayGroup ? `<div class="group">${displayGroup}</div>` : ''}
        <div class="awarded">${copy.awarded}</div>
        <div class="award-box">
          <div class="award">${displayCategory}</div>
          <div class="year"><span class="spark">✦</span> ${yearText} <span class="spark">✦</span></div>
        </div>
        <p class="desc">${copy.descHtml}</p>
        <div class="foot">
          <span>◆ vote.musicmundial.com</span>
          <span class="mid">✦</span>
          <span class="hash">${formatCertificateInstagramTag(getCertificateInstagramHandle())}</span>
        </div>
      </div>
    </article>
  `

  return host
}

export const buildCertificateFilename = ({ name, group, category, year } = {}) => {
  const parts = [name, group, category, year].map((part) => slugify(part)).filter(Boolean)
  return `music-mundial-${parts.join('-') || 'certificate'}.png`
}

export const renderWinnerCertificateBlob = async ({
  name,
  group,
  category,
  year,
  lang = 'es',
} = {}) => {
  await ensureFonts()

  const host = buildCertificateNode({ name, group, category, year, lang })
  document.body.appendChild(host)

  try {
    const cert = host.querySelector('.cert')
    await waitForImages(host)
    await new Promise((resolve) => window.setTimeout(resolve, 80))

    const blob = await toBlob(cert, {
      cacheBust: true,
      pixelRatio: 1,
      width: CERT_WIDTH,
      height: CERT_HEIGHT,
      backgroundColor: '#070314',
    })
    if (!blob) throw new Error('PNG export failed')
    return blob
  } finally {
    host.remove()
  }
}

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const blobToFile = (blob, filename) =>
  new File([blob], filename, { type: blob.type || 'image/png' })
