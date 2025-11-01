
import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, CheckCircle2, Plus, FileText, LogIn, LogOut, Search, Camera, ListChecks, ClipboardList, Upload, Trash2, Save, Printer, XCircle, AlertTriangle, Users } from 'lucide-react'
import { createClient, type Session } from '@supabase/supabase-js'

type BadgeVariant = 'gray' | 'green' | 'blue' | 'amber' | 'red'
type ButtonVariant = 'primary' | 'outline' | 'ghost'

type Role = 'admin' | 'manager' | 'inspector'
interface User { id: string; email: string; name?: string; roles: Role[] }

type QType = 'yesno' | 'text' | 'photo' | 'number' | 'date'
interface TemplateItem { id: string; type: QType; label: string; required?: boolean }
interface Template { id: string; name: string; description?: string; site?: string; items: TemplateItem[]; updatedAt: string }

interface InspectionItem { id: string; qid: string; type: QType; label: string; value?: any; pass?: boolean; media?: string[] }
interface Inspection { id: string; templateId: string; templateName: string; site?: string; status: 'in_progress' | 'submitted'; startedAt: string; submittedAt?: string; score?: number; items: InspectionItem[]; ownerId?: string; ownerName?: string }

interface Action { id: string; title: string; inspectionId?: string; itemId?: string; priority: 'low'|'medium'|'high'|'critical'; status: 'open'|'in_progress'|'resolved'|'verified'; dueDate?: string; assignee?: string; createdAt: string; ownerId?: string }

interface StoreShape { users: User[]; currentUserId?: string|null; templates: Template[]; inspections: Inspection[]; actions: Action[] }

type NavTab = 'templates'|'inspections'|'actions'

const LS_KEY = 'audit-king-local-v2'
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
const todayISO = () => new Date().toISOString().slice(0,10)

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null

function AuditKingLogo({ size = 24 }: { size?: number }){
  return (
    <div className="flex items-center gap-2 select-none">
      <Crown className="text-yellow-500 drop-shadow-sm" size={size} />
      <span className="font-extrabold text-xl text-gray-800 tracking-tight">
        Audit <span className="text-blue-600">King</span>
      </span>
    </div>
  )
}

function loadStore(): StoreShape {
  try { const raw = localStorage.getItem(LS_KEY); if(raw){ return JSON.parse(raw) } } catch {}
  return {
    users: [{ id: 'u1', email: 'admin@auditking.app', name: 'Audit King Admin', roles: ['admin'] }],
    currentUserId: 'u1',
    templates: [
      { id: 'tpl-1', name: 'General Safety Walkthrough', description: 'Basic site walkthrough', site: 'All Sites', updatedAt: '2025-10-12', items: [
        { id: 'ppe-helm', type: 'yesno', label: 'Hard hats worn?', required: true },
        { id: 'ppe-photo', type: 'photo', label: 'Photo evidence' },
      ]},
      { id: 'tpl-2', name: 'Warehouse Daily Check', description: 'Daily DC checks', site: 'Manchester DC', updatedAt: '2025-10-16', items: [
        { id: 'walkways', type: 'yesno', label: 'Walkways clear?' },
        { id: 'fire-tag', type: 'yesno', label: 'Fire extinguishers tagged?' },
        { id: 'notes', type: 'text', label: 'Notes' },
      ]},
    ],
    inspections: [],
    actions: [],
  }
}
function saveStore(s: StoreShape){ try{ localStorage.setItem(LS_KEY, JSON.stringify(s)) }catch{} }

export function parseChecklistText(raw: string): TemplateItem[] {
  const lines = raw.split(/\r?\n|•/).map(s => s.trim()).filter(Boolean)
  return lines.map((l, idx) => ({ id: `q${idx+1}`, type: /\?\s*$/.test(l) ? 'yesno' : 'text', label: l }))
}
function runParserTests(){
  const one = parseChecklistText('Is it ok?')
  console.assert(one.length===1 && one[0].type==='yesno', 'Test: question mark => yesno')
  const two = parseChecklistText('Line A\\n\\nLine B')
  console.assert(two.length===2 && two[1].label==='Line B', 'Test: ignores blanks')
  const bullets = parseChecklistText('• A\\n• B?')
  console.assert(bullets[1].type==='yesno', 'Test: bullet + question mark => yesno')
}

type BadgeVariant = 'gray' | 'green' | 'blue' | 'amber' | 'red'
function Badge({ children, variant = 'gray' }: { children: React.ReactNode, variant?: BadgeVariant }){
  const variants = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
  } as const
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${variants[variant]}`}>{children}</span>
}

type ButtonVariant = 'primary' | 'outline' | 'ghost'
function Button({ children, onClick, variant = 'primary', icon: Icon, disabled }: { children: React.ReactNode; onClick?: ()=>void; variant?: ButtonVariant; icon?: React.ComponentType<{ size?: number }>; disabled?: boolean }){
  const classes = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed',
  } as const
  return (
    <button disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${classes[variant]}`}>
      {Icon ? <Icon size={16}/> : null}
      {children}
    </button>
  )
}

function Card({ children }:{ children: React.ReactNode }){ return <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">{children}</div> }

function Topbar({ onLogout, onSearch, onNav, onImport, onBackup, onRestore, user, onOpenAuth }:{ onLogout: ()=>void; onSearch:(v:string)=>void; onNav:(tab:NavTab)=>void; onImport:()=>void; onBackup:()=>void; onRestore:(f:File)=>void; user?:User|null; onOpenAuth:()=>void }){
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <AuditKingLogo size={28} />
        <nav className="hidden md:flex items-center gap-4 ml-4 text-sm text-gray-600">
          <button className="hover:text-gray-900" onClick={()=>onNav('templates')}>Templates</button>
          <button className="hover:text-gray-900" onClick={()=>onNav('inspections')}>Inspections</button>
          <button className="hover:text-gray-900" onClick={()=>onNav('actions')}>Actions</button>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input onChange={e=>onSearch?.(e.target.value)} placeholder="Search templates…" className="rounded-xl border px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Button icon={Upload} variant="outline" onClick={onImport}>Import PDF</Button>
          <Button icon={Save} variant="outline" onClick={onBackup}>Export Backup</Button>
          <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer">
            <input type="file" accept="application/json" className="hidden" onChange={e=> e.target.files?.[0] && onRestore(e.target.files[0])} />
            Restore
          </label>
          {user ? (
            <div className="flex items-center gap-2 ml-2">
              <div className="hidden sm:block text-sm text-gray-700">{user.name || user.email}</div>
              <Button variant="outline" icon={Users} onClick={onOpenAuth}>Switch</Button>
              <Button variant="outline" icon={LogOut} onClick={onLogout}>Logout</Button>
            </div>
          ) : (
            <Button icon={LogIn} onClick={onOpenAuth}>Login</Button>
          )}
        </div>
      </div>
    </header>
  )
}

function TemplatesPage({ store, setStore, query, onRun, onEdit, onImport }:{ store:StoreShape; setStore:(s:StoreShape)=>void; query:string; onRun:(tpl:Template)=>void; onEdit:(tpl?:Template)=>void; onImport:()=>void }){
  const list = useMemo(() => store.templates.filter(t => t.name.toLowerCase().includes(query.toLowerCase())), [store.templates, query])
  const currentUser = store.users.find(u=>u.id===store.currentUserId) || null
  const isAdmin = !!currentUser && currentUser.roles.includes('admin')
  const del = (id:string)=>{
    if(!isAdmin){ alert('Only admins can delete templates.'); return }
    if(confirm('Delete template?')){
      setStore({ ...store, templates: store.templates.filter(t=>t.id!==id) })
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-gray-600">Create, manage, run inspections — or import from PDF/text.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Upload} onClick={onImport}>Import</Button>
          <Button icon={Plus} onClick={()=>onEdit(undefined)}>New Template</Button>
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {list.map(t => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={18} />
                    <h3 className="font-semibold">{t.name}</h3>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <Badge variant="blue">{t.site ?? '—'}</Badge>
                    <span>• {t.items.length} items</span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={()=>onRun(t)}>Run</Button>
                    <Button variant="outline" onClick={()=>onEdit(t)}>Edit</Button>
                  </div>
                  {isAdmin && (
                    <button className="text-rose-600 hover:underline inline-flex items-center gap-1 text-sm" onClick={()=>del(t.id)}>
                      <Trash2 size={16}/> Delete
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
        {list.length===0 && <Card>No templates match “{query}”.</Card>}
      </div>
    </div>
  )
}

function TemplateEditor({ initial, onClose, onSave }:{ initial?: Template; onClose:()=>void; onSave:(tpl:Template)=>void }){
  const [title, setTitle] = useState<string>(initial?.name ?? 'New Template')
  const [site, setSite] = useState<string>(initial?.site ?? '')
  const [items, setItems] = useState<TemplateItem[]>(initial?.items ?? [
    { id: 'q1', type: 'yesno', label: 'PPE worn?', required: true },
    { id: 'q2', type: 'photo', label: 'Photo evidence' },
  ])
  const add = (type:QType)=> setItems(x => [...x, { id: `${type}-${x.length+1}`, type, label: 'New question' }])
  const save = ()=>{ const tpl: Template = { id: initial?.id ?? uuid(), name: title, site: site||undefined, description: initial?.description, items, updatedAt: todayISO() }; onSave(tpl) }
  const rm = (id:string)=> setItems(prev => prev.filter(i=>i.id!==id))
  const up = (i:number)=> setItems(prev => i<=0?prev:[...prev.slice(0,i-1), prev[i], prev[i-1], ...prev.slice(i+1)])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><FileText className="text-blue-600"/><h3 className="font-semibold">{initial ? 'Edit Template' : 'New Template'}</h3></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button icon={Save} onClick={save}>Save</Button>
          </div>
        </div>
        <div className="p-5 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <div className="grid gap-2">
                <label className="text-sm text-gray-600">Template name</label>
                <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
                <label className="text-sm text-gray-600">Site (optional)</label>
                <input value={site} onChange={e=>setSite(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between"><h4 className="font-semibold">Questions</h4>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={()=>add('yesno')}>Yes/No</Button>
                  <Button variant="outline" onClick={()=>add('text')}>Text</Button>
                  <Button variant="outline" onClick={()=>add('number')}>Number</Button>
                  <Button variant="outline" icon={Camera} onClick={()=>add('photo')}>Photo</Button>
                  <Button variant="outline" onClick={()=>add('date')}>Date</Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {items.map((q, i) => (
                  <div key={q.id} className="rounded-xl border p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-6"><input value={q.label} onChange={e=> setItems(prev => prev.map(it => it.id===q.id ? { ...it, label: e.target.value } : it))} className="w-full rounded-xl border px-3 py-2" /></div>
                    <div className="md:col-span-3">
                      <select value={q.type} onChange={e=> setItems(prev => prev.map(it => it.id===q.id ? { ...it, type: e.target.value as QType } : it))} className="w-full rounded-xl border px-3 py-2 text-sm">
                        <option value="yesno">Yes/No</option><option value="text">Text</option><option value="photo">Photo</option><option value="number">Number</option><option value="date">Date</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <input id={`req-${q.id}`} type="checkbox" checked={!!q.required} onChange={e=> setItems(prev => prev.map(it => it.id===q.id ? { ...it, required: e.target.checked } : it))} />
                      <label htmlFor={`req-${q.id}`} className="text-sm">Required</label>
                    </div>
                    <div className="md:col-span-1 flex justify-end gap-2">
                      <button title="Move up" onClick={()=>up(i)} className="text-gray-500 hover:text-gray-900">↑</button>
                      <button title="Delete" onClick={()=>rm(q.id)} className="text-rose-600 hover:text-rose-700"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <div className="font-semibold mb-2">Preview</div>
              <div className="space-y-3 text-sm">
                {items.map(q => (
                  <div key={q.id} className="flex items-center gap-2">
                    {q.type==='yesno' && <input type="checkbox" defaultChecked/>}
                    {q.type==='text' && <input className="rounded-xl border px-2 py-1 w-full" placeholder={q.label}/>}
                    {q.type==='number' && <input type="number" className="rounded-xl border px-2 py-1 w-full" placeholder={q.label}/>}
                    {q.type==='date' && <input type="date" className="rounded-xl border px-2 py-1"/>}
                    {q.type==='photo' && <button className="rounded-xl border px-2 py-1">Add Photo</button>}
                    <span className="text-gray-600">{q.label}</span>
                    {q.required && <Badge variant="red">required</Badge>}
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="font-semibold mb-2">Tips</div>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Use required fields for critical checks.</li>
                <li>Add photo questions where evidence is needed.</li>
                <li>Keep text labels short and clear.</li>
              </ul>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function ImportModal({ onClose, onCreate }:{ onClose:()=>void; onCreate:(tpl:Template)=>void }){
  const [fileName, setFileName] = useState<string>('Imported Template')
  const [raw, setRaw] = useState<string>(`• Walkways clear?
• Fire extinguishers accessible and tagged?
• List any hazards observed`)
  const [items, setItems] = useState<TemplateItem[]>([])
  const parse = ()=>{ const mapped = parseChecklistText(raw); setItems(mapped) }
  const create = ()=>{ const tpl: Template = { id: uuid(), name: fileName.replace(/\.pdf$/i,''), updatedAt: todayISO(), items }; onCreate(tpl); onClose() }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><Upload className="text-blue-600"/><h3 className="font-semibold">Import from PDF / Text</h3></div>
          <div className="flex items-center gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={create} disabled={!items.length}>Create Template</Button></div>
        </div>
        <div className="p-5 grid md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <Card>
              <div className="font-semibold mb-2">1) Choose file (optional)</div>
              <label className="block rounded-xl border-dashed border-2 p-6 text-center cursor-pointer">
                <input type="file" accept="application/pdf,text/plain" className="hidden" onChange={(e)=> setFileName(e.target.files?.[0]?.name || 'Imported Template')} />
                <div className="text-sm text-gray-600">{fileName}</div>
              </label>
            </Card>
            <Card>
              <div className="font-semibold mb-2">2) Paste checklist text</div>
              <textarea value={raw} onChange={e=>setRaw(e.target.value)} className="w-full min-h-[140px] rounded-xl border p-2 text-sm" />
              <div className="mt-2"><Button variant="outline" onClick={parse}>Parse</Button></div>
              <p className="text-xs text-gray-500 mt-2">Tip: bullet each question. Lines ending with a question mark become Yes/No items.</p>
            </Card>
          </div>
          <div className="md:col-span-2">
            <Card>
              <div className="flex items-center justify-between"><h4 className="font-semibold">3) Review & map fields</h4><Badge variant={items.length ? 'green' : 'gray'}>{items.length ? `${items.length} items` : 'No items yet'}</Badge></div>
              <div className="mt-3 space-y-2">
                {items.map((q, i) => (
                  <div key={q.id} className="rounded-xl border p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-6"><input value={q.label} onChange={e=> setItems(prev => prev.map((it,ix)=> ix===i? { ...it, label: e.target.value } : it))} className="w-full rounded-xl border px-3 py-2" /></div>
                    <div className="md:col-span-3">
                      <select value={q.type} onChange={e=> setItems(prev => prev.map((it,ix)=> ix===i? { ...it, type: e.target.value as QType } : it))} className="w-full rounded-xl border px-3 py-2 text-sm">
                        <option value="yesno">Yes/No</option><option value="text">Text</option><option value="photo">Photo</option><option value="number">Number</option><option value="date">Date</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <input id={`req-${q.id}`} type="checkbox" checked={!!q.required} onChange={e=> setItems(prev => prev.map((it,ix)=> ix===i? { ...it, required: e.target.checked } : it))} />
                      <label htmlFor={`req-${q.id}`} className="text-sm">Required</label>
                    </div>
                    <div className="md:col-span-1 text-right"><Badge variant="blue">{q.type.toUpperCase()}</Badge></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function RunInspection({ template, onClose, onSubmit, currentUser }:{ template:Template; onClose:()=>void; onSubmit:(x:Inspection)=>void; currentUser: User }){
  const [items, setItems] = useState<InspectionItem[]>(() => template.items.map(it => ({ id: uuid(), qid: it.id, type: it.type, label: it.label, value: it.type==='yesno' ? true : undefined, pass: it.type==='yesno' ? true : undefined, media: [] })))
  const setVal = (i:number, patch:Partial<InspectionItem>) => setItems(prev => prev.map((it,ix)=> ix===i? { ...it, ...patch } : it))
  const score = Math.round((items.filter(i => i.type==='yesno').filter(i => i.pass===true).length / Math.max(1, items.filter(i=>i.type==='yesno').length)) * 100)
  const onFile = (i:number, files:FileList|null)=>{ if(!files || !files.length) return; const reader = new FileReader(); reader.onload = ()=> setVal(i, { media: [...(items[i].media||[]), String(reader.result)] }); reader.readAsDataURL(files[0]) }
  const submit = ()=>{ const insp: Inspection = { id: uuid(), templateId: template.id, templateName: template.name, site: template.site, status: 'submitted', startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), score, items, ownerId: currentUser.id, ownerName: currentUser.name || currentUser.email }; onSubmit(insp); onClose() }
  useEffect(()=>{ document.title = 'Audit King — Run Inspection' },[])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="p-5 border-b flex items-center justify-between"><div className="flex items-center gap-2"><ListChecks className="text-emerald-600"/><h3 className="font-semibold">{template?.name} — Run</h3></div><Button variant="ghost" onClick={onClose}>Close</Button></div>
        <div className="p-5 space-y-4">
          {items.map((q, i) => (
            <Card key={q.id}>
              <div className="font-semibold mb-2">{q.label}{template.items[i].required && <span className="ml-2 text-rose-600 text-xs">(required)</span>}</div>
              {q.type==='yesno' && (
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" name={`yn-${q.id}`} checked={q.pass===true} onChange={()=>setVal(i,{ pass:true, value:true })}/> Pass</label>
                  <label className="flex items-center gap-2"><input type="radio" name={`yn-${q.id}`} checked={q.pass===false} onChange={()=>setVal(i,{ pass:false, value:false })}/> Fail</label>
                </div>
              )}
              {q.type==='text' && <textarea value={q.value||''} onChange={e=>setVal(i,{ value:e.target.value })} placeholder="Notes" className="w-full rounded-xl border p-2 min-h-[80px]" />}
              {q.type==='number' && <input type="number" value={q.value||''} onChange={e=>setVal(i,{ value:e.target.value })} className="rounded-xl border p-2" />}
              {q.type==='date' && <input type="date" value={q.value||''} onChange={e=>setVal(i,{ value:e.target.value })} className="rounded-xl border p-2" />}
              {q.type==='photo' && (
                <div className="flex items-center gap-3">
                  <label className="rounded-xl border px-3 py-2 text-sm cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={e=>onFile(i, e.target.files)} />
                    Add Photo
                  </label>
                  <div className="flex gap-2 flex-wrap">{(q.media||[]).map((src,ix)=> <img key={ix} src={src} alt="evidence" className="h-12 w-12 object-cover rounded-lg border" />)}</div>
                </div>
              )}
            </Card>
          ))}
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-gray-600"><CheckCircle2 className={score>80 ? 'text-emerald-600' : 'text-amber-600'} /><span>Score preview: <span className="font-semibold">{score}%</span></span></div><Button onClick={submit}>Submit Inspection</Button></div>
        </div>
      </motion.div>
    </div>
  )
}

function InspectionsPage({ store, onOpenReport, currentUser }:{ store:StoreShape; onOpenReport:(insp:Inspection)=>void; currentUser: User }){
  const canSeeAll = currentUser.roles.includes('admin') || currentUser.roles.includes('manager')
  const [viewAll, setViewAll] = useState<boolean>(canSeeAll)
  const base = useMemo(()=> {
    const arr = [...store.inspections].sort((a,b)=> (b.submittedAt||'').localeCompare(a.submittedAt||''))
    return arr
  }, [store.inspections])
  const list = useMemo(()=> viewAll && canSeeAll ? base : base.filter(i => (i.ownerId ?? currentUser.id) === currentUser.id), [base, viewAll, canSeeAll, currentUser.id])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><ClipboardList className="text-blue-600"/><h1 className="text-2xl font-semibold">Inspections</h1></div>
        {canSeeAll && (
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={viewAll} onChange={e=>setViewAll(e.target.checked)} />
            View all users
          </label>
        )}
      </div>
      {list.length===0 && <Card>No inspections to show.</Card>}
      <div className="space-y-2">
        {list.map(i => (
          <Card key={i.id}>
            <div className="flex items-center gap-3 justify-between">
              <div>
                <div className="font-semibold">{i.templateName}</div>
                <div className="text-sm text-gray-600">{(i.submittedAt||i.startedAt).replace('T',' ').slice(0,16)} • {i.site ?? '—'}{i.ownerName ? ` • by ${i.ownerName}` : ''}</div>
              </div>
              <div className="flex items-center gap-3"><Badge variant={i.score && i.score>=90 ? 'green' : i.score && i.score>=70 ? 'amber':'red'}>{i.score ?? '--'}%</Badge><Button variant="outline" icon={Printer} onClick={()=>onOpenReport(i)}>Report</Button></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ActionsPage({ store, setStore, currentUser }:{ store:StoreShape; setStore:(s:StoreShape)=>void; currentUser:User }){
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Action['priority']>('medium')
  const add = ()=>{ if(!title.trim()) return; const action: Action = { id: uuid(), title, priority, status:'open', createdAt: new Date().toISOString(), ownerId: currentUser.id }; setStore({ ...store, actions: [action, ...store.actions] }); setTitle('') }
  const setAct = (id:string, patch:Partial<Action>)=> setStore({ ...store, actions: store.actions.map(a => a.id===id? { ...a, ...patch } : a) })
  const isAdmin = currentUser.roles.includes('admin')
  const del = (id:string)=>{ if(!isAdmin){ alert('Only admins can delete actions.'); return } if(confirm('Delete this action?')){ setStore({ ...store, actions: store.actions.filter(a=>a.id!==id) }) } }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><AlertTriangle className="text-amber-600"/><h1 className="text-2xl font-semibold">Actions</h1></div>
      <Card>
        <div className="grid md:grid-cols-5 gap-2 items-end">
          <div className="md:col-span-3"><label className="text-sm text-gray-600">New action</label><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="Title" /></div>
          <div><label className="text-sm text-gray-600">Priority</label><select value={priority} onChange={e=>setPriority(e.target.value as any)} className="w-full rounded-xl border px-3 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
          <div className="flex justify-end"><Button icon={Plus} onClick={add}>Add</Button></div>
        </div>
      </Card>
      <div className="space-y-2">
        {store.actions.length===0 && <Card>No actions yet.</Card>}
        {store.actions.map(a => (
          <Card key={a.id}>
            <div className="grid md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-6"><input className="w-full rounded-xl border px-3 py-2" value={a.title} onChange={e=>setAct(a.id,{ title: e.target.value })} /><div className="text-xs text-gray-500 mt-1">Created {(a.createdAt||'').replace('T',' ').slice(0,16)}</div></div>
              <div className="md:col-span-2"><select className="w-full rounded-xl border px-3 py-2" value={a.priority} onChange={e=>setAct(a.id,{ priority: e.target.value as any })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
              <div className="md:col-span-2"><select className="w-full rounded-xl border px-3 py-2" value={a.status} onChange={e=>setAct(a.id,{ status: e.target.value as any })}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="verified">Verified</option></select></div>
              <div className="md:col-span-2 text-right space-y-2">
                <Badge variant={a.status==='verified' ? 'green' : a.status==='resolved' ? 'blue' : a.status==='in_progress' ? 'amber' : 'red'}>{a.status}</Badge>
                {isAdmin && (
                  <div>
                    <button className="text-rose-600 text-sm hover:underline inline-flex items-center gap-1" onClick={()=>del(a.id)}>
                      <Trash2 size={16}/> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ReportView({ insp, onClose }:{ insp:Inspection; onClose:()=>void }){
  useEffect(()=>{ document.title = 'Audit King — Report' },[])
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3"><AuditKingLogo size={28} /><h2 className="font-semibold">Inspection Report</h2></div>
          <div className="flex items-center gap-2"><Button variant="outline" icon={Printer} onClick={()=>window.print()}>Print / Save PDF</Button><Button variant="ghost" icon={XCircle} onClick={onClose}>Close</Button></div>
        </div>
        <Card>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-600">Template:</span> <span className="font-medium">{insp.templateName}</span></div>
            <div><span className="text-gray-600">Site:</span> <span className="font-medium">{insp.site ?? '—'}</span></div>
            <div><span className="text-gray-600">Started:</span> {(insp.startedAt||'').replace('T',' ').slice(0,16)}</div>
            <div><span className="text-gray-600">Submitted:</span> {(insp.submittedAt||'').replace('T',' ').slice(0,16)}</div>
            <div><span className="text-gray-600">Score:</span> <span className="font-medium">{insp.score ?? '--'}%</span></div>
            {insp.ownerName && <div><span className="text-gray-600">Inspector:</span> <span className="font-medium">{insp.ownerName}</span></div>}
          </div>
        </Card>
        <div className="mt-4 space-y-3">
          {insp.items.map((it, idx) => (
            <Card key={it.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{idx+1}. {it.label}</div>
                  {typeof it.value === 'string' && it.value && <div className="text-sm whitespace-pre-wrap mt-1">{it.value}</div>}
                  {(it.media||[]).length>0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(it.media||[]).map((src,ix)=> <img key={ix} src={src} alt="evidence" className="h-16 w-16 object-cover rounded-lg border" />)}
                    </div>
                  )}
                </div>
                {it.type==='yesno' && (
                  <Badge variant={it.pass ? 'green' : 'red'}>{it.pass ? 'Pass' : 'Fail'}</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function AuthModal({ users, onClose }:{ users:User[]; onClose:()=>void }){
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const useSupabase = !!supabase

  const signInMagic = async () => {
    if(!useSupabase){ alert('Supabase env not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'); return }
    const em = email.trim()
    if(!em){ alert('Enter your email'); return }
    setBusy(true)
    const { error } = await supabase!.auth.signInWithOtp({ email: em })
    setBusy(false)
    if(error){ alert(error.message); return }
    alert('Check your email for the sign-in link.')
    onClose()
  }

  const signInOAuth = async (provider: 'google'|'azure') => {
    if(!useSupabase){ alert('Supabase env not set.'); return }
    const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
    if(error){ alert(error.message) }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <motion.div initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><Users className="text-blue-600"/><h3 className="font-semibold">Sign in</h3></div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="p-5 space-y-3">
          <label className="text-sm text-gray-600">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border px-3 py-2" placeholder="you@company.com"/>
          <Button onClick={signInMagic} disabled={busy}>Send magic link</Button>
          <Button variant="outline" onClick={()=>signInOAuth('google')}>Continue with Google</Button>
          <Button variant="outline" onClick={()=>signInOAuth('azure')}>Continue with Microsoft</Button>
          <p className="text-xs text-gray-500">Configure providers + URLs in Supabase → Authentication.</p>
        </div>
      </motion.div>
    </div>
  )
}

export default function App(){
  const [store, setStore] = useState<StoreShape>(loadStore())
  const [modal, setModal] = useState<null | (
    { type:'edit', template?: Template } |
    { type:'run', template: Template } |
    { type:'report', insp: Inspection } |
    { type:'import' } |
    { type:'auth' }
  )>(null)
  const [tab, setTab] = useState<NavTab>('templates')
  const [query, setQuery] = useState('')

  const currentUser = store.users.find(u=>u.id===store.currentUserId) || null

  useEffect(()=> saveStore(store), [store])
  useEffect(()=>{ document.title = 'Audit King' },[])
  useEffect(()=>{ runParserTests() },[])

  useEffect(()=>{
    if(!supabase) return
    let unsub: any
    const prime = async () => {
      const { data } = await supabase.auth.getSession()
      const sess = data.session as Session | null
      if(sess){
        const uid = sess.user.id
        const displayName = (sess.user.user_metadata as any)?.name || sess.user.email || 'User'
        setStore(s => {
          const exists = s.users.find(u=>u.id===uid)
          const u: User = { id: uid, email: sess.user.email || 'user@example.com', name: displayName, roles: ['inspector'] }
          return exists ? { ...s, users: s.users.map(x=> x.id===uid ? u : x), currentUserId: uid } : { ...s, users: [u, ...s.users], currentUserId: uid }
        })
      }
      unsub = supabase.auth.onAuthStateChange((_e, newSess)=>{
        if(newSess){
          const uid = newSess.user.id
          setStore(s => {
            const exists = s.users.find(u=>u.id===uid)
            const u: User = { id: uid, email: newSess.user.email || 'user@example.com', name: (newSess.user.user_metadata as any)?.name || newSess.user.email || 'User', roles: ['inspector'] }
            return exists ? { ...s, currentUserId: uid } : { ...s, users: [u, ...s.users], currentUserId: uid }
          })
        } else {
          setStore(s => ({ ...s, currentUserId: null }))
        }
      })
    }
    prime()
    return () => { unsub?.data?.subscription?.unsubscribe?.() }
  },[])

  const openAuth = ()=> setModal({ type:'auth' })
  const logout = async ()=> { try { await supabase?.auth.signOut() } catch {} setStore({ ...store, currentUserId: null }) }

  const saveTemplate = (tpl:Template)=>{
    const exists = store.templates.some(t=>t.id===tpl.id)
    setStore({ ...store, templates: exists? store.templates.map(t=>t.id===tpl.id? tpl : t) : [tpl, ...store.templates] })
  }
  const submitInspection = (insp: Inspection)=>{
    setStore({ ...store, inspections: [insp, ...store.inspections] })
  }

  const exportBackup = ()=>{
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit-king-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const restoreBackup = (file: File)=>{
    const reader = new FileReader()
    reader.onload = ()=>{ try{ const data = JSON.parse(String(reader.result)) as StoreShape; setStore(data) }catch{ alert('Invalid backup file') } }
    reader.readAsText(file)
  }

  const content = tab==='templates' ? (
    <TemplatesPage
      store={store}
      setStore={setStore}
      query={query}
      onRun={(tpl)=> setModal({ type:'run', template: tpl })}
      onEdit={(tpl)=> setModal({ type:'edit', template: tpl })}
      onImport={()=> setModal({ type:'import' })}
    />
  ) : tab==='inspections' ? (
    currentUser ? <InspectionsPage store={store} onOpenReport={(insp)=> setModal({ type:'report', insp })} currentUser={currentUser} /> : <Card>Please login to view inspections.</Card>
  ) : (
    currentUser ? <ActionsPage store={store} setStore={setStore} currentUser={currentUser} /> : <Card>Please login to view actions.</Card>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar onLogout={logout} onSearch={setQuery} onNav={setTab} onImport={()=> setModal({ type:'import' })} onBackup={exportBackup} onRestore={restoreBackup} user={currentUser} onOpenAuth={openAuth} />
      <main className="mx-auto max-w-6xl p-4">
        <AnimatePresence mode="wait">{content}</AnimatePresence>
      </main>

      {modal?.type==='edit' && (
        <TemplateEditor
          initial={modal.template}
          onClose={()=> setModal(null)}
          onSave={(tpl)=>{ saveTemplate(tpl); setModal(null) }}
        />
      )}
      {modal?.type==='run' && currentUser && (
        <RunInspection template={modal.template} onClose={()=> setModal(null)} onSubmit={submitInspection} currentUser={currentUser} />
      )}
      {modal?.type==='report' && (
        <ReportView insp={modal.insp} onClose={()=> setModal(null)} />
      )}
      {modal?.type==='import' && (
        <ImportModal onClose={()=> setModal(null)} onCreate={(tpl)=>{ saveTemplate(tpl); setModal(null) }} />
      )}
      {modal?.type==='auth' && (
        <AuthModal users={store.users} onClose={()=> setModal(null)} />
      )}
    </div>
  )
}
