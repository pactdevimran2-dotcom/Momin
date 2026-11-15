import { useEffect, useMemo, useRef, useState } from 'react'
import INDEX from './data/index.json'
import ASMA from './data/asma.json'

/* Every chapter's text. Each file: { id, title, items:[{n,page,title,count,blocks}] } */
const FILES = import.meta.glob('./data/*.json', { eager: true, import: 'default' })
const BOOK = {}
for (const d of Object.values(FILES)) if (d && d.id && Array.isArray(d.items)) BOOK[d.id] = d
// Index rows that jump into another chapter
const ALIAS = { asma: ['sabah', 44], dajjal: ['sabah', 45] }

/* ---------- helpers ---------- */
const URDU_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ur = (n) => String(n).replace(/\d/g, (d) => URDU_DIGITS[d])
const COUNT_WORDS = { 'ایک': 1, 'تین': 3, 'چار': 4, 'سات': 7, 'دس': 10, 'سو': 100, 'پچیس': 25 }
const countOf = (s) => (s ? COUNT_WORDS[s.split(/\s+/)[0]] || 0 : 0)
const HARAKAT = /[ً-ْ]/

function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? initial : JSON.parse(raw)
    } catch { return initial }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ }
  }, [key, v])
  return [v, setV]
}

const normalize = (s) =>
  (s || '')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ه/g, 'ہ')

/* Time of day decides which adhkar the home screen offers first (book p.8 and p.64) */
function timeOfDay() {
  const h = new Date().getHours()
  if (h >= 4 && h < 12) return 'sabah'
  if (h >= 15 || h < 4) return 'masa'
  return 'noon'
}

/* ---------- icons ---------- */
const I = {
  back: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>,
  down: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>,
  aa: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 19l5-13 5 13M4.8 14.5h6.4M15 19l3.2-8 3.3 8M16 16.7h4.4" /></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  mark: (on) => <svg width="20" height="20" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
  reset: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  copy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>,
}

const THEMES = [
  { id: 'lavender', name: 'دن', sw: ['#F7F3FC', '#2E2541', '#C2185B'] },
  { id: 'plum', name: 'رات', sw: ['#2B1428', '#F6E6EE', '#FF92BD'] },
]
const THEME_COLOR = { lavender: '#F7F3FC', plum: '#2B1428' }

/* ---------- App ---------- */
export default function App() {
  const [theme, setTheme] = useStored('mkh.theme4', 'lavender')
  const [scale, setScale] = useStored('mkh.scale', 1)
  const [showTr, setShowTr] = useStored('mkh.tr', true)
  const [marks, setMarks] = useStored('mkh.marks', [])
  const [last, setLast] = useStored('mkh.last', null)
  const [route, setRoute] = useState({ view: 'cover' })
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  useEffect(() => {
    const onPop = () => setRoute(history.state?.route || { view: 'home' })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = (r) => {
    try { history.pushState({ route: r }, '') } catch { /* sandboxed */ }
    setRoute(r)
  }
  const back = () => (history.state?.route ? history.back() : setRoute({ view: 'home' }))

  const openSection = (id, n) => {
    const [sid, sn] = ALIAS[id] || [id, n]
    if (!BOOK[sid]) return
    go({ view: 'section', id: sid, n: n ?? sn })
  }
  const toggleMark = (key) =>
    setMarks((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key]))

  return (
    <div className="min-h-screen" style={{ '--s': scale }}>
      {route.view === 'cover' && (
        <Cover onOpen={() => setRoute({ view: 'bism' })} openSection={openSection} />
      )}
      {route.view === 'bism' && <BismillahPage onNext={() => setRoute({ view: 'home' })} />}
      {route.view === 'home' && (
        <Home last={last} marks={marks} openSection={openSection} openSettings={() => setSheet(true)}
          openCover={() => setRoute({ view: 'cover' })} tab={route.tab || 'index'}
          setTab={(t) => setRoute({ view: 'home', tab: t })} />
      )}
      {(route.view === 'home' || route.view === 'section') && (
        <TabBar route={route}
          go={(r) => { if (r.view === 'home') { setRoute(r); window.scrollTo(0, 0) } else openSection(r.id) }}
          openSettings={() => setSheet(true)} />
      )}
      {route.view === 'section' && (
        <Section
          key={route.id + ':' + route.n}
          section={BOOK[route.id]}
          target={route.n}
          showTr={showTr}
          marks={marks}
          toggleMark={toggleMark}
          onBack={back}
          onSeen={(n) => setLast({ id: route.id, n })}
          openSettings={() => setSheet(true)}
        />
      )}
      {sheet && (
        <Settings theme={theme} setTheme={setTheme} scale={scale} setScale={setScale}
          showTr={showTr} setShowTr={setShowTr} onClose={() => setSheet(false)} />
      )}
    </div>
  )
}

/* ---------- Cover (from the book's cover page) ---------- */
const asset = (p) => `url("${new URL(p, document.baseURI).href}")`
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--rope-h', asset('cover/rope-h.png'))
  document.documentElement.style.setProperty('--rope-v', asset('cover/rope-v.png'))
}
const Art = ({ src, w, h, color, style, label }) => (
  <div role="img" aria-label={label} className="mask mx-auto"
    style={{ '--m': asset(`cover/${src}`), '--c': color, aspectRatio: `${w} / ${h}`, ...style }} />
)
const COVER_TAGS = ['asma', 'munjiyat', 'manzil', 'shifa', 'hifazat', 'sakina']
const COVER_BOXES = [
  ['aasan', 'صرف اردو زبان میں', 'آسان دعائیں'],
  ['panah', 'مصیبتوں بیماریوں سے بچاؤ کیلئے', 'اللہ کی پناہ'],
  ['fatawa', 'اوراد و وظائف سے متعلق', 'فتاویٰ'],
  ['namaz', 'فرض نماز کے بعد کی', 'دعائیں'],
]
function Cover({ onOpen, openSection }) {
  return (
    <div className="fade-cover min-h-screen relative safe-top safe-bottom" style={{ background: 'var(--paper)' }}>
      <div className="rope" style={{ inset: 'calc(env(safe-area-inset-top) + 10px) 10px 10px 10px', '--rs': '10px' }} />
      <div className="max-w-md mx-auto px-8 pt-10 pb-10 flex flex-col items-center gap-4">
        <p className="cover-pill ar px-6 text-lg" style={{ lineHeight: 1.9 }}>مقاليد السماوات والأرض</p>
        <Art src="title.png" w={573} h={239} label="مؤمن کا ہتھیار" style={{ width: '82%' }} />
        <Art src="subtitle.png" w={565} h={137} color="var(--rubric)" label="صبح اور شام کی مسنون دعائیں" style={{ width: '74%' }} />
        <div className="relative w-full" style={{ aspectRatio: '841 / 97' }}>
          <Art src="tags.png" w={841} h={97} color="var(--rubric)" label="" style={{ width: '100%' }} />
          <div className="absolute inset-0 flex">
            {COVER_TAGS.map((id) => (
              <button key={id} className="flex-1" aria-label={INDEX.find((x) => x.id === id)?.title}
                onClick={() => openSection(id)} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full mt-2">
          {COVER_BOXES.map(([id, small, big]) => (
            <button key={id} onClick={() => openSection(id)} className="cover-box px-2 py-1 text-center">
              <span className="ur block text-[.7rem] muted" style={{ lineHeight: 2 }}>{small}</span>
              <span className="ur block font-bold text-[1.05rem]" style={{ color: 'var(--cover)', lineHeight: 2 }}>{big}</span>
            </button>
          ))}
        </div>
        <Art src="author.png" w={503} h={96} label="محمد یونس پالنپوری" style={{ width: '70%', marginTop: '.5rem' }} />
        <button onClick={onOpen} className="ur rounded-full px-8 mt-2 text-[1rem]"
          style={{ background: 'var(--rubric)', color: 'var(--paper)', lineHeight: 2.7 }}>کتاب کھولیں</button>
      </div>
    </div>
  )
}
function BismillahPage({ onNext }) {
  useEffect(() => { const t = setTimeout(onNext, 2600); return () => clearTimeout(t) }, []) // eslint-disable-line
  return (
    <button onClick={onNext} className="fade-cover min-h-screen w-full relative grid place-items-center safe-top" style={{ background: 'var(--paper)' }}
      aria-label="فہرست پر جائیں">
      <span className="rope" style={{ inset: 'calc(env(safe-area-inset-top) + 10px) 10px 10px 10px', '--rs': '10px' }} />
      <Art src="bismillah.png" w={500} h={675} label="بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ" style={{ width: "64%", maxWidth: 320 }} />
    </button>
  )
}

const itemLabel = (it) => {
  if (it.title) return it.title
  const b = it.blocks.find((x) => ['ar', 'du', 'bism'].includes(x[0]))
  const t = b ? String(b[1]) : ''
  return t.split(/\s+/).slice(0, 6).join(' ') + (t.split(/\s+/).length > 6 ? ' …' : '')
}

/* ---------- Home ---------- */
function Home({ last, marks, openSection, openSettings, openCover, tab, setTab }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const tod = timeOfDay()
  const now = tod === 'noon' ? null : BOOK[tod]
  const lastItem = last && BOOK[last.id]?.items.find((i) => i.n === last.n)

  const results = useMemo(() => {
    const nq = normalize(q.trim())
    if (!nq) return null
    const out = []
    for (const [sid, sec] of Object.entries(BOOK)) {
      for (const it of sec.items) {
        if (!it.n) continue
        const hay = normalize(it.title + ' ' + it.blocks.map((b) => (typeof b[1] === 'string' ? b[1] : '')).join(' '))
        if (hay.includes(nq)) out.push({ sid, it })
      }
    }
    return out
  }, [q])

  const markedItems = marks
    .map((k) => {
      const [sid, n] = k.split(':')
      const it = BOOK[sid]?.items.find((i) => String(i.n) === n)
      return it && { sid, it }
    })
    .filter(Boolean)

  return (
    <div className="safe-bottom">
      <header className="topbar sticky top-0 z-20 safe-top">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={openCover} aria-label="سرورق" style={{ width: 104 }}>
            <Art src="title.png" w={573} h={239} label="مؤمن کا ہتھیار" style={{ width: '100%' }} />
          </button>
          <span className="ur text-xs muted">{tab === 'marks' ? 'محفوظ دعائیں' : 'صبح اور شام کی مسنون دعائیں'}</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4">
      {tab !== 'marks' && !q && (
        <section className="pt-4">
          <div className="grid grid-cols-2 gap-3">
            {['sabah', 'masa'].map((id) => {
              const on = tod === id
              const sec = BOOK[id]
              return (
                <button key={id} onClick={() => openSection(id)} className="home-tile text-start"
                  style={on ? { background: 'var(--rubric)', color: 'var(--paper)', borderColor: 'var(--rubric)' } : null}>
                  <span className="flex items-center justify-between">
                    <span style={{ color: on ? 'var(--paper)' : 'var(--rubric)' }}>{TAB_ICONS[id]}</span>
                    
                  </span>
                  <span className="ur block font-bold text-[1.05rem] mt-1" style={{ lineHeight: 2.1 }}>{sec.title}</span>
                </button>
              )
            })}
          </div>

          {lastItem && (
            <button onClick={() => openSection(last.id, last.n)} className="home-row w-full flex items-center gap-3 mt-3 text-start">
              <span className="num rubric text-base shrink-0">﴿{ur(lastItem.n)}﴾</span>
              <span className="flex-1 min-w-0">
                <span className="ur block text-[.7rem] muted" style={{ lineHeight: 1.9 }}>{BOOK[last.id].title}</span>
                <span className="ur block text-[.9rem] truncate" style={{ lineHeight: 2.1 }}>{itemLabel(lastItem)}</span>
              </span>
              <span className="muted" style={{ transform: 'scaleX(-1)' }}>{I.back}</span>
            </button>
          )}
        </section>
      )}

      <label className="search-box flex items-center gap-2 mt-4 px-4">
        <span className="muted">{I.search}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دعا تلاش کریں"
          className="ur bg-transparent outline-none flex-1 text-[.95rem] placeholder:opacity-60" style={{ lineHeight: 2.5, color: 'var(--ink)' }} />
        {q && <button onClick={() => setQ('')} className="muted" aria-label="صاف کریں">{I.x}</button>}
      </label>

      {results ? (
        <section className="pt-4">
          <p className="ur text-xs muted">{ur(results.length)} دعائیں ملیں</p>
          {results.length === 0 && <p className="ur py-8 muted">اس لفظ سے کوئی دعا نہیں ملی۔ کوئی اور لفظ آزمائیں۔</p>}
          <ul>
            {results.slice(0, 80).map(({ sid, it }, i) => (
              <li key={i} className="rule">
                <button onClick={() => openSection(sid, it.n)} className="w-full text-start py-2">
                  <span className="ur block text-[.95rem]" style={{ lineHeight: 2.2 }}>{itemLabel(it)}</span>
                  <span className="ur block text-xs muted" style={{ lineHeight: 2 }}>{BOOK[sid].title}، صفحہ {ur(it.page)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <h2 className="ur font-bold rubric pt-6 pb-1 text-[1.1rem]" style={{ lineHeight: 2.4 }}>
            {tab === 'marks' ? `محفوظ دعائیں (${ur(markedItems.length)})` : 'فہرست'}
          </h2>

          {tab === 'marks' ? (
            markedItems.length === 0
              ? <p className="ur py-8 muted text-sm">کسی دعا کے ساتھ والے نشان کو دبائیں، وہ دعا یہاں آ جائے گی۔</p>
              : <ul>{markedItems.map(({ sid, it }) => (
                <li key={sid + it.n} className="rule">
                  <button onClick={() => openSection(sid, it.n)} className="w-full text-start py-2">
                    <span className="ur block text-[.95rem]" style={{ lineHeight: 2.2 }}>{itemLabel(it)}</span>
                    <span className="ur block text-xs muted">{BOOK[sid].title}</span>
                  </button>
                </li>
              ))}</ul>
          ) : (
            <ol className="pb-6">
              {INDEX.map((s) => {
                const sec = BOOK[s.id]
                const subs = sec ? sec.items.filter((i) => i.n || (i.head && s.id === 'panah')) : null
                const many = subs && subs.filter((i) => i.n).length > 1
                const isOpen = open[s.id]
                return (
                  <li key={s.id} className="rule">
                    <div className="flex items-center">
                      <button className="flex-1 flex items-end text-start py-3 min-w-0" onClick={() => openSection(s.id)}>
                        <span className="min-w-0">
                          <span className="ur block text-[1.08rem] font-bold" style={{ lineHeight: 2.2 }}>{s.title}</span>
                          {s.sub && <span className="ur block text-xs muted" style={{ lineHeight: 2 }}>{s.sub}</span>}
                        </span>
                        <span className="leader" aria-hidden="true" />
                        <span className="num rubric text-lg">{ur(s.page)}</span>
                      </button>
                      {many && (
                        <button className="icon-btn ms-1 muted" aria-expanded={!!isOpen} aria-label="دعاؤں کی فہرست"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                          onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>{I.down}</button>
                      )}
                    </div>
                    {isOpen && many && (
                      <ul className="pb-3 ps-3" style={{ borderInlineStart: '2px solid var(--rubric-soft)' }}>
                        {subs.map((it, k) => it.n ? (
                          <li key={k}>
                            <button onClick={() => openSection(s.id, it.n)} className="w-full flex items-end text-start py-1">
                              <span className="num rubric text-sm w-11 shrink-0">﴿{ur(it.n)}﴾</span>
                              <span className="ur text-[.9rem] min-w-0" style={{ lineHeight: 2.1 }}>{itemLabel(it)}</span>
                              <span className="leader" aria-hidden="true" />
                              <span className="num muted text-sm">{ur(it.page)}</span>
                            </button>
                          </li>
                        ) : (
                          <li key={k} className="ur rubric text-sm pt-3" style={{ lineHeight: 2.2 }}>{it.head}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
      </div>
    </div>
  )
}

/* ---------- Ornamental frame ---------- */
const CORNER = (
  <svg viewBox="0 0 26 26" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M13 3 L17 7 L13 11 L9 7 Z" fill="currentColor" stroke="none" />
    <path d="M3 13 L7 9 L11 13 L7 17 Z" fill="currentColor" stroke="none" />
    <path d="M14 14 C20 14 23 18 23 23 M14 14 C14 20 18 23 23 23" />
    <circle cx="13" cy="13" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)
function Frame({ crest, children }) {
  return (
    <div className="frame">
      <span className="rope" style={{ inset: 0, '--rs': '7px', '--c': 'color-mix(in srgb, var(--ink) 55%, transparent)' }} />
      {['tl', 'tr', 'bl', 'br'].map((p) => <span key={p} className={`corner ${p}`}>{CORNER}</span>)}
      {crest && <span className={`crest ${/[\u06A9\u06AF\u06BA\u06BE\u06C1\u06D2\u0679\u0688\u0691\u06CC]/.test(crest) ? 'ur' : ''}`}>{crest}</span>}
      {children}
    </div>
  )
}
/* split an item's blocks into sub-sections at each heading (e.g. Ikhlas / Falaq / Nas) */
function segments(blocks) {
  const segs = [[]]
  for (const b of blocks) {
    if (b[0] === 'lbl' && segs[segs.length - 1].length) segs.push([])
    segs[segs.length - 1].push(b)
  }
  return segs
}

/* ---------- Reader ---------- */
function Section({ section, target, showTr, marks, toggleMark, onBack, onSeen, openSettings }) {
  const refs = useRef({})
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    const el = target != null && refs.current[target]
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'start' })
        window.scrollBy(0, -64)
        el.classList.add('flash')
      })
    } else window.scrollTo(0, 0)
  }, [target])

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(Number(e.target.dataset.n))
    }, { rootMargin: '-30% 0px -60% 0px' })
    Object.values(refs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])
  useEffect(() => { if (current) onSeen(current) }, [current]) // eslint-disable-line

  const total = section.items.filter((i) => i.n).length

  return (
    <div>
      <div className="topbar sticky top-0 z-20 safe-top">
        <div className="flex items-center gap-2 px-3 py-1 max-w-xl mx-auto">
          <button className="icon-btn" onClick={onBack} aria-label="فہرست پر واپس">{I.back}</button>
          <h2 className="ur font-bold flex-1 rubric" style={{ lineHeight: 2.3 }}>{section.title}</h2>
          {current && total > 1 && <span className="num muted text-sm">{ur(current)}/{ur(total)}</span>}
          <button className="icon-btn" onClick={openSettings} aria-label="ترتیبات">{I.aa}</button>
        </div>
      </div>

      <main className="px-5 max-w-xl mx-auto safe-bottom">
        {section.items.map((it, i) => (
          <article key={i} ref={(el) => { if (it.n) refs.current[it.n] = el }} data-n={it.n}
            className="py-5">
            {it.type === 'intro' ? (
              <>
                {it.head && (
                  <h3 className={`${HARAKAT.test(it.head) ? 'ar' : 'ur'} font-bold text-center rubric`}
                    style={{ fontSize: HARAKAT.test(it.head) ? 'calc(2rem * var(--s))' : 'calc(1.35rem * var(--s))', lineHeight: 2.2, color: 'var(--rubric)' }}>
                    {it.head}
                  </h3>
                )}
                {it.blocks.map((b, j) => <Block key={j} b={b} showTr={showTr} />)}
              </>
            ) : (
              <>
                <header className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {it.title && <h3 className="ur font-bold rubric" style={{ fontSize: 'calc(1.05rem * var(--s))', lineHeight: 2.15 }}>{it.title}</h3>}
                    <p className="ur text-xs muted" style={{ lineHeight: 2 }}>
                      {it.count ? `${it.count}، ` : ''}صفحہ {ur(it.page)}
                    </p>
                  </div>
                  <button className="icon-btn rubric" onClick={() => toggleMark(`${section.id}:${it.n}`)}
                    aria-label="محفوظ کریں" aria-pressed={marks.includes(`${section.id}:${it.n}`)}>
                    {I.mark(marks.includes(`${section.id}:${it.n}`))}
                  </button>
                </header>
                {(() => {
                  const segs = segments(it.blocks)
                  if (segs.length === 1) return (
                    <Frame crest={`﴿${ur(it.n)}﴾`}>
                      {it.blocks.map((b, j) => <Block key={j} b={b} showTr={showTr} />)}
                      <ItemFooter item={it} />
                    </Frame>
                  )
                  return (
                    <>
                      {segs.map((seg, k) => {
                        const head = seg[0][0] === 'lbl' ? seg[0][1] : null
                        const body = head ? seg.slice(1) : seg
                        const framed = body.some((x) => x[0] === 'ar' || x[0] === 'bism' || x[0] === 'du')
                        if (!framed) return body.map((b, j) => <Block key={k + '-' + j} b={b} showTr={showTr} />)
                        return (
                          <Frame key={k} crest={head || (k === 0 ? `﴿${ur(it.n)}﴾` : null)}>
                            {body.map((b, j) => <Block key={j} b={b} showTr={showTr} />)}
                          </Frame>
                        )
                      })}
                      <ItemFooter item={it} />
                    </>
                  )
                })()}
              </>
            )}
          </article>
        ))}
      </main>
    </div>
  )
}

function Block({ b, showTr }) {
  const [type, text] = b
  switch (type) {
    case 'ar':
      return <p className="ar text-center my-4" style={{ fontSize: 'calc(2.27rem * var(--s))' }}>{text}</p>
    case 'bism':
      return <p className="ar text-center mt-4 mb-1 rubric" style={{ fontSize: 'calc(1.89rem * var(--s))', color: 'var(--rubric)' }}>{text}</p>
    case 'ur':
      if (!showTr) return null
      return <p className="ur my-2" style={{ fontSize: 'calc(.98rem * var(--s))' }}><span className="rubric">ترجمہ: </span>{text}</p>
    case 'fz':
      return (
        <div className="fz ur my-4 whitespace-pre-line" style={{ fontSize: 'calc(.93rem * var(--s))' }}>
          {!/^[●①]/.test(text) && <span className="rubric">فضیلت: </span>}{text}
        </div>
      )
    case 'note':
      return <p className="ur my-2 muted whitespace-pre-line" style={{ fontSize: 'calc(.88rem * var(--s))' }}>{text}</p>
    case 'lbl':
      return <h4 className="ur rubric font-bold mt-6 mb-1 text-center" style={{ fontSize: 'calc(.98rem * var(--s))' }}>{text}</h4>
    case 'ref':
      return <p className="ur text-[.75rem] muted my-1" style={{ lineHeight: 2 }}>({text})</p>
    case 'du': {
      const [, t, num, lang] = b
      if (lang === 'ar') return (
        <div className="my-3 rule pt-2">
          <span className="num rubric text-sm">﴿{ur(num)}﴾</span>
          <p className="ar text-center" style={{ fontSize: 'calc(1.95rem * var(--s))' }}>{t}</p>
        </div>
      )
      return (
        <p className="ur my-2 flex gap-3" style={{ fontSize: 'calc(1rem * var(--s))' }}>
          <span className="num rubric text-sm shrink-0 w-10 pt-1">﴿{ur(num)}﴾</span>
          <span className="flex-1">{t}</span>
        </p>
      )
    }
    case 'poem':
      return (
        <div className="ur my-4 text-center" style={{ fontSize: 'calc(1rem * var(--s))' }}>
          {text.split('\n').map((l, i) => <p key={i} style={{ lineHeight: 2.5 }}>{l}</p>)}
        </div>
      )
    case 'asma':
      return (
        <ol className="my-4">
          {ASMA.map(([name, mean], i) => (
            <li key={i} className="flex items-baseline gap-3 py-1 rule">
              <span className="num rubric text-sm w-8 shrink-0">{ur(i + 1)}</span>
              <span className="ar font-bold shrink-0" style={{ fontSize: 'calc(1.82rem * var(--s))', lineHeight: 1.9 }}>{name}</span>
              {showTr && <span className="ur text-[.8rem] muted flex-1" style={{ lineHeight: 2 }}>{mean}</span>}
            </li>
          ))}
        </ol>
      )
    default:
      return null
  }
}

function ItemFooter({ item }) {
  const target = countOf(item.count)
  const [c, setC] = useState(0)
  const [copied, setCopied] = useState(false)
  const arabic = item.blocks.filter((b) => b[0] === 'ar').map((b) => b[1]).join('\n')
  if (target <= 1 && !arabic) return null
  const tap = () => setC((x) => {
    const nx = x + 1
    if (nx === target) try { navigator.vibrate?.(60) } catch { /* no vibration */ }
    return nx
  })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${item.title}\n\n${arabic}`)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <div className="flex items-center gap-2 mt-4">
      {target > 1 && (
        <>
          <button onClick={tap} className={`tally ${c >= target ? 'done' : ''}`} aria-label="گنتی">
            {ur(c)} / {ur(target)}
          </button>
          {c > 0 && <button className="icon-btn muted" onClick={() => setC(0)} aria-label="گنتی صفر کریں">{I.reset}</button>}
        </>
      )}
      <span className="flex-1" />
      {arabic && (
        <button onClick={copy} className="flex items-center gap-1 text-xs ur muted px-2" style={{ lineHeight: 2.4 }}>
          {I.copy} {copied ? 'کاپی ہو گئی' : 'عربی کاپی کریں'}
        </button>
      )}
    </div>
  )
}

/* ---------- Bottom tab bar ---------- */
const TAB_ICONS = {
  index: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 5h16M4 12h16M4 19h10" /></svg>,
  sabah: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  masa: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>,
  marks: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
  settings: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 19l5-13 5 13M4.8 14.5h6.4M15 19l3.2-8 3.3 8M16 16.7h4.4" /></svg>,
}
function TabBar({ route, go, openSettings }) {
  const active =
    route.view === 'section' ? (route.id === 'sabah' || route.id === 'masa' ? route.id : 'index')
      : route.tab === 'marks' ? 'marks' : 'index'
  const tabs = [
    ['index', 'فہرست', () => go({ view: 'home', tab: 'index' })],
    ['sabah', 'صبح', () => go({ view: 'section', id: 'sabah' })],
    ['masa', 'شام', () => go({ view: 'section', id: 'masa' })],
    ['marks', 'محفوظ', () => go({ view: 'home', tab: 'marks' })],
    ['settings', 'ترتیب', openSettings],
  ]
  return (
    <nav className="tabbar fixed bottom-0 inset-x-0 z-30" aria-label="مینو">
      <div className="max-w-xl mx-auto grid grid-cols-5">
        {tabs.map(([id, label, fn]) => {
          const on = active === id
          return (
            <button key={id} onClick={fn} aria-current={on ? 'page' : undefined}
              className="flex flex-col items-center pt-2 pb-1 relative"
              style={{ color: on ? 'var(--rubric)' : 'var(--muted)' }}>
              {on && <span className="absolute top-0 h-[3px] w-8 rounded-full" style={{ background: 'var(--rubric)' }} />}
              {TAB_ICONS[id]}
              <span className="ur text-[.72rem]" style={{ lineHeight: 2 }}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ---------- Settings ---------- */
function Settings({ theme, setTheme, scale, setScale, showTr, setShowTr, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose} style={{ background: 'rgba(43,20,40,.45)' }}>
      <div className="sheet-enter w-full rounded-t-3xl px-5 pt-3 safe-bottom max-w-xl mx-auto"
        style={{ background: 'var(--paper)' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-2" style={{ background: 'var(--rule)' }} />
        <div className="flex items-center justify-between">
          <h3 className="ur font-bold rubric">پڑھنے کی ترتیب</h3>
          <button className="icon-btn" onClick={onClose} aria-label="بند کریں">{I.x}</button>
        </div>

        <p className="ur text-sm muted mt-2">رنگ</p>
        <div className="flex gap-3 my-2">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} aria-pressed={theme === t.id}
              className="flex-1 rounded-2xl p-3 text-center"
              style={{ background: t.sw[0], border: `2px solid ${theme === t.id ? 'var(--rubric)' : 'var(--rule)'}` }}>
              <span className="ar block text-xl" style={{ color: t.sw[1], lineHeight: 1.8 }}>بِسْمِ اللّٰهِ</span>
              <span className="ur block text-xs" style={{ color: t.sw[2], lineHeight: 2 }}>{t.name}</span>
            </button>
          ))}
        </div>

        <p className="ur text-sm muted mt-4">حروف کا سائز</p>
        <div className="flex items-center gap-3">
          <span className="ur text-sm">ا</span>
          <input type="range" min=".8" max="1.6" step=".05" value={scale} aria-label="حروف کا سائز"
            onChange={(e) => setScale(Number(e.target.value))} className="flex-1" />
          <span className="ur text-xl">ا</span>
        </div>
        <p className="ar text-center my-2" style={{ fontSize: `calc(1.6rem * ${scale})` }}>رَضِيْتُ بِاللّٰهِ رَبًّا</p>

        <label className="flex items-center justify-between py-3 rule">
          <span className="ur text-sm">اردو ترجمہ دکھائیں</span>
          <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} className="w-5 h-5" style={{ accentColor: 'var(--rubric)' }} />
        </label>
      </div>
    </div>
  )
}
