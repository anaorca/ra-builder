import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import * as XLSX from 'xlsx'

type Lang = 'es'|'en'

const i18n = {
  es: { title:'Creador de Resultados de Aprendizaje', subtitle:'Redacta resultados claros, observables y medibles.',
    step:'Paso', steps:['Contexto','Verbo (Bloom)','Contenido/Competencia','Condición/Recursos','Criterio medible','Rúbrica rápida (opcional)','Generar','Validar y exportar'],
    next:'Continuar', back:'Atrás', reset:'Reiniciar', improve:'Mejorar con IA', validateExport:'Validar y exportar',
    copy:'Copiar', copySuccess:'Copiado al portapapeles', copyManualTitle:'Copiar manualmente', copyManualMsg:'Selecciona el texto y presiona Ctrl+C (Windows) o Cmd+C (Mac)',
    selectAll:'Seleccionar todo', close:'Cerrar', downloadTxt:'Descargar .txt', downloadDocx:'Descargar .docx', downloadXlsx:'Descargar .xlsx', createAnother:'Crear otro',
    contextTitle:'Selecciona el contexto', contextDesc:'Personalizamos ejemplos y verbos según tu realidad.', level:'Nivel educativo', area:'Área o asignatura', topic:'Tema específico', duration:'Duración',
    bloomTitle:'Selecciona un verbo de acción (Bloom)', bloomDesc:'Escoge el nivel cognitivo y luego un verbo observable.', customVerb:'o escribe tu propio verbo en infinitivo',
    contentTitle:'Define el contenido o competencia', conditionTitle:'Describe la condición o contexto', conditionDesc:'¿Con qué recursos o situación se evidenciará?',
    criterionTitle:'Establece el criterio de evaluación', rubricTitle:'Rúbrica rápida (opcional)', rubricDesc:'3–4 criterios con pesos (100%).', addCriterion:'Añadir criterio', genBtn:'Generar',
    resultTitle:'Resultado generado', resultDesc:'Edita o mejora automáticamente.', variations:'Generar 3 variaciones', validationTitle:'Validación automática', validationOk:'✅ ¡Todo se ve bien!', tipsTitle:'Sugerencias rápidas', lang:'Idioma',
  },
  en: { title:'Learning Outcomes Builder', subtitle:'Write clear, observable, measurable outcomes.',
    step:'Step', steps:['Context','Verb (Bloom)','Content/Competency','Condition/Resources','Measurable criterion','Quick rubric (optional)','Generate','Validate & export'],
    next:'Next', back:'Back', reset:'Reset', improve:'Improve with AI', validateExport:'Validate & export',
    copy:'Copy', copySuccess:'Copied to clipboard', copyManualTitle:'Copy manually', copyManualMsg:'Select the text and press Ctrl+C (Windows) or Cmd+C (Mac)',
    selectAll:'Select all', close:'Close', downloadTxt:'Download .txt', downloadDocx:'Download .docx', downloadXlsx:'Download .xlsx', createAnother:'Create another',
    contextTitle:'Select context', contextDesc:'We tailor examples and verbs to your reality.', level:'Educational level', area:'Subject/Area', topic:'Specific topic', duration:'Duration',
    bloomTitle:'Choose an action verb (Bloom)', bloomDesc:'Pick the cognitive level then an observable verb.', customVerb:'or type your own verb (infinitive)',
    contentTitle:'Define content or competency', conditionTitle:'Describe the condition/context', conditionDesc:'With which resources or situation?',
    criterionTitle:'Set the assessment criterion', rubricTitle:'Quick rubric (optional)', rubricDesc:'3–4 criteria with weights (100%).', addCriterion:'Add criterion', genBtn:'Generate',
    resultTitle:'Generated outcome', resultDesc:'Edit or auto-improve.', variations:'Generate 3 variations', validationTitle:'Automatic validation', validationOk:'✅ Looks good!', tipsTitle:'Quick tips', lang:'Language',
  },
} as const

const defaultBank = {
  bloomVerbs: {
    Recordar: ['enumerar','definir','identificar','listar','nombrar','reconocer','describir'],
    Comprender: ['explicar','resumir','interpretar','clasificar','comparar','ilustrar'],
    Aplicar: ['resolver','usar','implementar','demostrar','ejecutar','calcular'],
    Analizar: ['analizar','diferenciar','organizar','atribuir','relacionar','examinar'],
    Evaluar: ['evaluar','justificar','argumentar','valorar','criticar','comprobar'],
    Crear: ['diseñar','construir','producir','planificar','componer','formular'],
  },
  areaExamples: {
    Matemáticas: ['ecuaciones cuadráticas','funciones lineales','probabilidad básica'],
    Lengua: ['argumentación escrita','comprensión lectora','cohesión y coherencia'],
    Ciencias: ['ciclo del agua','fotosíntesis','cambio climático'],
    Historia: ['Revolución Industrial','Independencias en América','Guerra Fría'],
    Tecnología: ['diseño de prototipos','alfabetización digital','seguridad en la red'],
  },
  resources: [
    'a partir de fuentes primarias','usando simuladores virtuales','con apoyo de rúbrica',
    'mediante una guía de lectura','en equipo de 3 a 4 estudiantes','con retroalimentación por pares'
  ],
  products: ['ensayo','informe','presentación','prototipo','portafolio','póster científico','rúbrica aplicada'],
}

function loadBank(){ try{ const raw = localStorage.getItem('outcomes_bank_v1'); return raw ? JSON.parse(raw) : defaultBank } catch { return defaultBank } }
function saveBank(bank:any){ localStorage.setItem('outcomes_bank_v1', JSON.stringify(bank)) }

function suggestCriterion(verb:string, content:string, rubric:any[]){
  if (rubric && rubric.length){ const items = rubric.map((r:any)=>`${r.name} (${r.weight}%)`).join(', '); return `alcanzando ≥70% en la rúbrica (${items})` }
  const base = content ? `sobre ${content}` : 'sobre el tema'
  const v = verb.toLowerCase().trim()
  if (['resolver','calcular','usar','aplicar'].includes(v)) return `resolviendo correctamente al menos 4 de 5 ejercicios ${base}`
  if (['analizar','examinar','relacionar','comparar'].includes(v)) return `identificando al menos 3 evidencias o patrones clave ${base}`
  if (['diseñar','construir','producir','planificar','componer','formular'].includes(v)) return `entregando un prototipo funcional que cumpla 3 de 4 criterios de calidad`
  if (['argumentar','justificar','evaluar','valorar','criticar'].includes(v)) return `presentando argumentos con ≥2 fuentes fiables y puntuación ≥3/4 en la rúbrica`
  return 'cumpliendo los criterios de desempeño definidos (≥70%)'
}

function validateOutcome(text: string) {
  const issues: string[] = [];
  if (!/(será|sera|will) capaz de/.test(text)) {
    issues.push("Usa la estructura '… será capaz de … / … will be able to …'");
  }
  if (/(aprender|entender|conocer|learn|understand|know)\b/i.test(text)) {
    issues.push("Evita verbos no observables.");
  }
  if (!/(\b≥|al menos|mínim[oa]|at least|minimum)/i.test(text)) {
    issues.push("Añade un umbral medible.");
  }
  if (text.length < 80) {
    issues.push("Añade más detalle para condición y evidencia.");
  }
  return issues;
}

async function copyText(text:string, opts?:{forceFallback?:boolean}): Promise<{ok:boolean; method:'clipboard'|'execCommand'|'manual'; reason?:string}>{
  const forceFallback = !!opts?.forceFallback
  if (!forceFallback && typeof navigator!=='undefined' && 'clipboard' in navigator && (window as any).isSecureContext){
    try { await (navigator as any).clipboard.writeText(text); return { ok:true, method:'clipboard' } } catch {}
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.top='-9999px'; ta.style.opacity='0'
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy'); document.body.removeChild(ta)
    if (ok) return { ok:true, method:'execCommand' }
  } catch {}
  return { ok:false, method:'manual', reason:'Permissions policy blocked or insecure context' }
}

const Section = ({children}:{children:React.ReactNode}) => <div className='bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-gray-200 p-5 mb-4'>{children}</div>
const Button = ({children,onClick,variant='primary',disabled=false}:{children:React.ReactNode;onClick?:()=>void;variant?:'primary'|'ghost'|'secondary';disabled?:boolean;}) => {
  const styles = { primary:'bg-black text-white hover:bg-gray-800', secondary:'bg-gray-100 hover:bg-gray-200 text-gray-900', ghost:'bg-transparent hover:bg-gray-100 text-gray-800 border border-gray-200' } as const
  return <button disabled={disabled} onClick={onClick} className={`px-4 py-2 rounded-xl text-sm transition ${styles[variant]} disabled:opacity-50`}>{children}</button>
}
const Modal = ({open,title,children,onClose}:{open:boolean;title:string;children:React.ReactNode;onClose:()=>void;}) => !open ? null : (
  <div className='fixed inset-0 z-50 flex items-center justify-center'>
    <div className='absolute inset-0 bg-black/40' onClick={onClose}/>
    <div className='relative bg-white rounded-2xl shadow-lg border border-gray-200 max-w-xl w-full p-5'>
      <div className='flex items-start justify-between mb-3'><h3 className='text-lg font-semibold'>{title}</h3><button className='text-gray-500 hover:text-gray-800' onClick={onClose}>✕</button></div>
      {children}
    </div>
  </div>
)

export default function App(){
  const [lang,setLang] = useState<Lang>('es'); const t = i18n[lang]
  const [bank,setBank] = useState<any>(loadBank()); const nivelesBloom = bank.bloomVerbs as Record<string,string[]>; const areasEjemplos = bank.areaExamples as Record<string,string[]>; const resources = bank.resources as string[]; const products = bank.products as string[]
  const [paso,setPaso] = useState(1)
  const [nivel,setNivel] = useState(''); const [area,setArea] = useState(''); const [tema,setTema] = useState(''); const [duracion,setDuracion] = useState('1 clase')
  const [nivelCognitivo,setNivelCognitivo] = useState(''); const [verbo,setVerbo] = useState(''); const [contenido,setContenido] = useState(''); const [condicion,setCondicion] = useState(''); const [criterio,setCriterio] = useState('')
  const [rubric,setRubric] = useState<{name:string, weight:number}[]>([{name:'Calidad del contenido',weight:40},{name:'Claridad y organización',weight:30},{name:'Evidencia y fuentes',weight:30}])
  const [resultado,setResultado] = useState(''); const [variaciones,setVariaciones] = useState<string[]>([]); const [validacion,setValidacion] = useState<string[]>([])
  const [bankOpen,setBankOpen] = useState(false); const [bankText,setBankText] = useState(JSON.stringify(bank,null,2))
  const [copyModalOpen,setCopyModalOpen] = useState(false); const manualAreaRef = useRef<HTMLTextAreaElement|null>(null)

  const ejemplosTema = useMemo(()=> (area && areasEjemplos[area]) ? areasEjemplos[area] : [], [area,areasEjemplos])

  useEffect(()=>{ if(!criterio && verbo) setCriterio(suggestCriterion(verbo,contenido,rubric)) },[verbo,contenido,rubric])

  function generarTexto(v=verbo, c=condicion, cr=criterio){
    const pre = lang==='es' ? `Al finalizar ${duracion}, el estudiante será capaz de` : `By the end of ${duracion}, the student will be able to`
    return (`${pre} ${v.trim().toLowerCase()} ${contenido.trim()} ${c?c:''}${cr?', '+cr:''}.`).replace(/\\s+/g,' ').replace(/\\s,/,',')
  }
  function generar(){ const txt = generarTexto(); setResultado(txt); setValidacion(validateOutcome(txt)) }
  function mejorar(){ const r=(resultado||generarTexto()).trim(); const need=!/(\\b≥|al menos|mínim[oa]|at least|minimum)/i.test(r); const extra=need?(lang==='es'?' (Criterio: desempeño ≥70% según rúbrica).':' (Criterion: performance ≥70% by rubric).'):''; const out=r.replace(/\\s{2,}/g,' ').replace(/\\.$/,'.')+extra; setResultado(out); setValidacion(validateOutcome(out)) }
  function generarVariaciones(){ const alt=(nivelCognitivo&&nivelesBloom[nivelCognitivo]?nivelesBloom[nivelCognitivo]:[]).filter(v=>v!==verbo); const pick=(a:string[],n:number)=>a.sort(()=>0.5-Math.random()).slice(0,Math.max(0,Math.min(n,a.length))); const vbs=pick(alt.length?alt:['analizar','diseñar','resolver'],3); const conds=pick(resources,3); setVariaciones(vbs.map((v,i)=> generarTexto(v, conds[i]||condicion, suggestCriterion(v,contenido,rubric)))) }

  function exportTxt(){ const blob=new Blob([resultado + (variaciones.length? '\\n\\nVariaciones:\\n- '+variaciones.join('\\n- '):'')],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='resultado_aprendizaje.txt'; a.click(); URL.revokeObjectURL(url) }
  async function exportDocx(){ const ps:Paragraph[]=[]; ps.push(new Paragraph({children:[new TextRun({text:lang==='es'?'Resultado de aprendizaje':'Learning outcome',bold:true})]})); ps.push(new Paragraph(resultado)); if(variaciones.length){ ps.push(new Paragraph('')); ps.push(new Paragraph({children:[new TextRun({text:lang==='es'?'Variaciones':'Variations',bold:true})]})); variaciones.forEach(v=> ps.push(new Paragraph('• '+v))) } const doc=new Document({sections:[{children:ps}]}); const blob=await Packer.toBlob(doc); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='resultado_aprendizaje.docx'; a.click(); URL.revokeObjectURL(url) }
  function exportXlsx(){ const rows:any[]=[[lang==='es'?'Resultado':'Outcome',resultado]]; variaciones.forEach((v,i)=> rows.push([`${lang==='es'?'Variación':'Variation'} ${i+1}`,v])); const ws=XLSX.utils.aoa_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Outcome'); XLSX.writeFile(wb,'resultado_aprendizaje.xlsx') }

  function toggleBank(){ setBankOpen(!bankOpen); setBankText(JSON.stringify(bank,null,2)) }
  function saveBankFromText(){ try{ const p=JSON.parse(bankText); setBank(p); saveBank(p); alert(lang==='es'?'Banco guardado':'Bank saved') } catch(e){ alert((lang==='es'?'JSON inválido':'Invalid JSON')+': '+(e as Error).message) } }
  function reset(){ setPaso(1); setNivel(''); setArea(''); setTema(''); setDuracion('1 clase'); setNivelCognitivo(''); setVerbo(''); setContenido(''); setCondicion(''); setCriterio(''); setRubric([{name:'Calidad del contenido',weight:40},{name:'Claridad y organización',weight:30},{name:'Evidencia y fuentes',weight:30}]); setResultado(''); setVariaciones([]); setValidacion([]) }
  async function handleCopy(){ const res=await copyText(resultado); if(res.ok){ alert(t.copySuccess) } else { setCopyModalOpen(true); setTimeout(()=>{ if(manualAreaRef.current){ manualAreaRef.current.focus(); manualAreaRef.current.select(); } },0) } }

  return (
    <div className='min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900'>
      <div className='max-w-6xl mx-auto px-4 py-8'>
        <header className='mb-6 flex items-start justify-between gap-3'>
          <div><h1 className='text-3xl font-bold tracking-tight'>{t.title}</h1><p className='text-gray-600 mt-2'>{t.subtitle} 🧑‍🏫⚡</p></div>
          <div className='flex items-center gap-2'>
            <label className='text-sm text-gray-600'>{t.lang}</label>
            <select className='border rounded-xl p-2' value={lang} onChange={e=>setLang(e.target.value as Lang)}>
              <option value='es'>ES</option><option value='en'>EN</option>
            </select>
            <Button variant='ghost' onClick={toggleBank}>Banco</Button>
          </div>
        </header>

        <div className='grid md:grid-cols-4 gap-4 mb-6'>
          {[1,2,3,4,5,6,7,8].map(n=>(
            <div key={n} className={`rounded-2xl border p-3 text-sm ${n===paso?'border-black bg-white':'border-gray-200 bg-white/60'}`}>
              <div className='font-semibold'>{t.step} {n}</div>
              <div className='text-gray-600'>{t.steps[n-1]}</div>
            </div>
          ))}
        </div>

        <AnimatePresence mode='wait'>
          {paso===1&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 1</div><h2 className='text-2xl font-semibold'>{t.contextTitle}</h2><p className='text-gray-600 mt-2'>{t.contextDesc}</p></div>
              <div className='grid md:grid-cols-2 gap-4'>
                <div><label className='block text-sm font-medium mb-1'>{t.level}</label><input className='w-full border rounded-xl p-2' placeholder={lang==='es'?'p. ej., Media':'e.g., Secondary'} value={nivel} onChange={e=>setNivel(e.target.value)} /></div>
                <div><label className='block text-sm font-medium mb-1'>{t.area}</label><input className='w-full border rounded-xl p-2' list='areas' placeholder={lang==='es'?'p. ej., Historia':'e.g., History'} value={area} onChange={e=>setArea(e.target.value)} /><datalist id='areas'>{Object.keys(areasEjemplos).map(a=><option key={a} value={a} />)}</datalist></div>
                <div><label className='block text-sm font-medium mb-1'>{t.topic}</label><input className='w-full border rounded-xl p-2' placeholder={lang==='es'?'p. ej., Revolución Industrial':'e.g., Industrial Revolution'} value={tema} onChange={e=>setTema(e.target.value)} />{(ejemplosTema.length>0)&&<div className='text-xs text-gray-600 mt-1'>{(lang==='es'?'Ejemplos':'Examples')+': '+ejemplosTema.join(', ')}</div>}</div>
                <div><label className='block text-sm font-medium mb-1'>{t.duration}</label><input className='w-full border rounded-xl p-2' placeholder={lang==='es'?'p. ej., 2 semanas / 1 unidad':'e.g., 2 weeks / 1 unit'} value={duracion} onChange={e=>setDuracion(e.target.value)} /></div>
              </div>
              <div className='mt-4 flex gap-2'><Button onClick={()=>setPaso(2)} disabled={!nivel||!area}>{t.next}</Button><Button variant='ghost' onClick={reset}>{t.reset}</Button></div>
            </Section>
          )}

          {paso===2&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 2</div><h2 className='text-2xl font-semibold'>{t.bloomTitle}</h2><p className='text-gray-600 mt-2'>{t.bloomDesc}</p></div>
              <div className='grid md:grid-cols-3 gap-4'>
                <div><label className='block text-sm font-medium mb-1'>Nivel</label>
                  <select className='w-full border rounded-xl p-2' value={nivelCognitivo} onChange={e=>{setNivelCognitivo(e.target.value); setVerbo('')}}>
                    <option value=''>{lang==='es'?'Selecciona…':'Select…'}</option>
                    {Object.keys(nivelesBloom).map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className='md:col-span-2'><label className='block text-sm font-medium mb-1'>Verbo</label>
                  <div className='flex flex-wrap gap-2'>{(nivelCognitivo?nivelesBloom[nivelCognitivo]:[]).map(v=>(<button key={v} onClick={()=>setVerbo(v)} className={`px-3 py-1 rounded-full border ${verbo===v?'bg-black text-white border-black':'bg-white hover:bg-gray-100'}`}>{v}</button>))}</div>
                  <input className='w-full border rounded-xl p-2 mt-3' placeholder={t.customVerb} value={verbo} onChange={e=>setVerbo(e.target.value)} />
                </div>
              </div>
              <div className='mt-4 flex gap-2'><Button onClick={()=>setPaso(1)} variant='ghost'>{t.back}</Button><Button onClick={()=>setPaso(3)} disabled={!verbo}>{t.next}</Button></div>
            </Section>
          )}

          {paso===3&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 3</div><h2 className='text-2xl font-semibold'>{t.contentTitle}</h2></div>
              <textarea className='w-full border rounded-2xl p-3' rows={4} placeholder={ area ? (lang==='es'?`p. ej., ${tema || 'tema'}: interpretar gráficos de ${area.toLowerCase()}` : `e.g., ${tema || 'topic'}: interpret ${area.toLowerCase()} charts with real data`) : (lang==='es'?'p. ej., resolver problemas de proporcionalidad':'e.g., solve proportional reasoning problems') } value={contenido} onChange={e=>setContenido(e.target.value)} />
              <div className='mt-4 flex gap-2'><Button onClick={()=>setPaso(2)} variant='ghost'>{t.back}</Button><Button onClick={()=>setPaso(4)} disabled={!contenido}>{t.next}</Button></div>
            </Section>
          )}

          {paso===4&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 4</div><h2 className='text-2xl font-semibold'>{t.conditionTitle}</h2><p className='text-gray-600 mt-2'>{t.conditionDesc}</p></div>
              <div className='flex flex-wrap gap-2 mb-3'>{resources.map(r=>(<button key={r} onClick={()=>setCondicion(r)} className={`px-3 py-1 rounded-full border ${condicion===r?'bg-black text-white border-black':'bg-white hover:bg-gray-100'}`}>{r}</button>))}</div>
              <input className='w-full border rounded-xl p-2' placeholder={lang==='es'?'o escribe tu propia condición (p. ej., mediante un estudio de caso real)':'or write your own condition (e.g., via a real case study)'} value={condicion} onChange={e=>setCondicion(e.target.value)} />
              <div className='mt-4 flex gap-2'><Button onClick={()=>setPaso(3)} variant='ghost'>{t.back}</Button><Button onClick={()=>setPaso(5)} disabled={!condicion}>{t.next}</Button></div>
            </Section>
          )}

          {paso===5&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 5</div></div>
              <div className='flex flex-wrap gap-2 mb-3'>{products.map(p=>(<button key={p} onClick={()=>setCriterio(`${lang==='es'?'entregando':'delivering'} ${lang==='es'?'un':'a'} ${p} ${lang==='es'?'que cumpla':'that meets'} ≥70% ${lang==='es'?'de la rúbrica':'of the rubric'}`)} className='px-3 py-1 rounded-full border bg-white hover:bg-gray-100'>{p}</button>))}</div>
              <textarea className='w-full border rounded-2xl p-3' rows={3} placeholder={ lang==='es'?'p. ej., identificando al menos 3 evidencias correctas y puntuación ≥70% en la rúbrica':'e.g., identifying at least 3 correct evidences and score ≥70% by rubric' } value={criterio} onChange={e=>setCriterio(e.target.value)} />
              <div className='mt-8'>
                <div className='mb-2 text-sm font-semibold'>{t.rubricTitle}</div>
                <p className='text-sm text-gray-600 mb-3'>{t.rubricDesc}</p>
                {rubric.map((r,idx)=>(
                  <div key={idx} className='grid grid-cols-12 gap-2 mb-2'>
                    <input className='col-span-8 border rounded-xl p-2' value={r.name} onChange={e=>setRubric(prev=> prev.map((x,i)=> i===idx? {...x, name:e.target.value}: x))} />
                    <input type='number' className='col-span-3 border rounded-xl p-2' value={r.weight} onChange={e=>setRubric(prev=> prev.map((x,i)=> i===idx? {...x, weight: Number(e.target.value)}: x))} />
                    <Button variant='ghost' onClick={()=> setRubric(prev=> prev.filter((_,i)=>i!==idx))}>✕</Button>
                  </div>
                ))}
                <div className='flex items-center gap-2 mb-2'>
                  <Button variant='secondary' onClick={()=> setRubric(prev=> [...prev, {name: lang==='es'?'Criterio nuevo':'New criterion', weight: 20}])}>{t.addCriterion}</Button>
                  <div className='text-xs text-gray-600'>{lang==='es'?'Suma actual':'Current sum'}: {rubric.reduce((a,b)=>a+b.weight,0)}%</div>
                </div>
              </div>
              <div className='mt-4 flex gap-2'><Button onClick={()=>setPaso(4)} variant='ghost'>{t.back}</Button><Button onClick={()=>{ if(!criterio) setCriterio(suggestCriterion(verbo,contenido,rubric)); setPaso(6); }}>{t.genBtn}</Button></div>
            </Section>
          )}

          {paso===6&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 6</div><h2 className='text-2xl font-semibold'>{t.resultTitle}</h2><p className='text-gray-600 mt-2'>{t.resultDesc}</p></div>
              <textarea className='w-full border rounded-2xl p-3 font-medium' rows={4} value={resultado} onChange={e=>{setResultado(e.target.value); setValidacion([])}} />
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button variant='secondary' onClick={mejorar}>{t.improve}</Button>
                <Button variant='ghost' onClick={()=>setPaso(5)}>{t.back}</Button>
                <Button onClick={()=>{ generar(); setPaso(7); }}>{t.validateExport}</Button>
                <Button onClick={generarVariaciones}>{t.variations}</Button>
              </div>
              {variaciones.length>0 && (<div className='mt-4'><div className='text-sm font-semibold mb-1'>{lang==='es'?'Variaciones':'Variations'}</div><ul className='list-disc pl-6 text-gray-800'>{variaciones.map((v,i)=><li key={i}>{v}</li>)}</ul></div>)}
            </Section>
          )}

          {paso===7&&(
            <Section>
              <div className='mb-6'><div className='text-xs text-gray-500 uppercase tracking-widest'>{t.step} 7</div></div>
              {validacion.length===0 ? (<div className='p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 mb-4'>{t.validationOk}</div>)
              : (<ul className='list-disc pl-6 text-red-700 mb-4'>{validacion.map((p,i)=><li key={i}>{p}</li>)}</ul>)}
              <Section><div className='text-sm text-gray-600 mb-1'>{lang==='es'?'Resultado final':'Final outcome'}</div><div className='font-medium'>{resultado || (lang==='es'?'(vacío)':'(empty)')}</div></Section>
              <div className='flex flex-wrap gap-2'>
                <Button onClick={handleCopy}>{t.copy}</Button>
                <Button variant='secondary' onClick={exportTxt}>{t.downloadTxt}</Button>
                <Button variant='secondary' onClick={exportDocx}>{t.downloadDocx}</Button>
                <Button variant='secondary' onClick={exportXlsx}>{t.downloadXlsx}</Button>
                <Button variant='ghost' onClick={reset}>{t.createAnother}</Button>
              </div>
            </Section>
          )}
        </AnimatePresence>

        {bankOpen && (
          <Section>
            <div className='flex items-start justify-between'>
              <div><div className='text-sm font-semibold'>Banco</div><p className='text-sm text-gray-600 mb-2'>Personaliza verbos Bloom y ejemplos por área. Se guarda localmente.</p></div>
              <Button variant='ghost' onClick={()=>setBankOpen(false)}>✕</Button>
            </div>
            <textarea className='w-full border rounded-2xl p-3 font-mono' rows={14} value={bankText} onChange={e=>setBankText(e.target.value)} />
            <div className='mt-3 flex gap-2'><Button onClick={saveBankFromText}>Guardar</Button><Button variant='ghost' onClick={()=>setBankText(JSON.stringify(defaultBank,null,2))}>Reset</Button></div>
          </Section>
        )}

        <footer className='mt-12 text-center text-xs text-gray-500'>v2.1 • ES/EN • Export DOCX/XLSX • Banco editable • Variaciones • Rúbrica rápida • Copia con fallback</footer>
      </div>

      <Modal open={copyModalOpen} title={t.copyManualTitle} onClose={()=>setCopyModalOpen(false)}>
        <p className='text-sm text-gray-700 mb-2'>{t.copyManualMsg}</p>
        <textarea ref={manualAreaRef} className='w-full border rounded-2xl p-3 font-mono' rows={6} defaultValue={resultado} />
        <div className='mt-3 flex gap-2 justify-end'>
          <Button variant='secondary' onClick={()=>{ if(manualAreaRef.current){ manualAreaRef.current.focus(); manualAreaRef.current.select(); } }}>{t.selectAll}</Button>
          <Button variant='ghost' onClick={()=>setCopyModalOpen(false)}>{t.close}</Button>
        </div>
      </Modal>
    </div>
  )
}
