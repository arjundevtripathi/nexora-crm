'use client';
import {useEffect,useRef,useState} from 'react';
import {
  LayoutDashboard,Users,GitBranch,CheckSquare,Activity,ArrowUpRight,Plus,
  Search,X,MoreHorizontal,ArrowRight,Download,ChevronRight,Check,RefreshCw,
  Building2,ShieldCheck,LogOut,Lock,Bot,Send,Sparkles,MessageSquare,User,UserCheck
} from 'lucide-react';

type Kind='contacts'|'deals'|'tasks';
type RecordRow={id:string;kind:Kind;data:any;version:number;updated_at:string};
type ChatMessage={id:string;role:'bot'|'user';text:string;time:string};

const stages=['Lead','Qualified','Proposal','Negotiation','Won','Lost'];
const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v);
const today=()=>new Date().toISOString().slice(0,10);
const blank=(kind:Kind)=>kind==='contacts'?{name:'',email:'',company:'',phone:'',status:'Lead',notes:''}:kind==='deals'?{name:'',company:'',value:0,stage:'Lead',closeDate:today(),notes:''}:{name:'',company:'',dueDate:today(),priority:'Medium',completed:false,notes:''};
const icons=[LayoutDashboard,Users,GitBranch,CheckSquare,Activity];

function formatChatText(text: string) {
 return text.split('\n').map((line, idx) => {
  const isQuote = line.startsWith('> ');
  const cleanLine = isQuote ? line.slice(2) : line;
  const parts = cleanLine.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  const formattedParts = parts.map((part, pIdx) => {
   if (part.startsWith('**') && part.endsWith('**')) {
    return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
   }
   if (part.startsWith('`') && part.endsWith('`')) {
    return <code key={pIdx}>{part.slice(1, -1)}</code>;
   }
   return part;
  });
  if (isQuote) {
   return (
    <blockquote key={idx} style={{margin:'4px 0',paddingLeft:10,borderLeft:'3px solid var(--purple)',opacity:0.9}}>
     {formattedParts}
    </blockquote>
   );
  }
  return (
   <div key={idx} style={{minHeight:line.trim()?undefined:'0.6em'}}>
    {formattedParts}
   </div>
  );
 });
}

export default function CRM(){
 const [page,setPage]=useState('Overview');
 const [records,setRecords]=useState<RecordRow[]>([]);
 const [activity,setActivity]=useState<any[]>([]);
 const [user,setUser]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('All');
 const [modal,setModal]=useState<{kind:Kind;row?:RecordRow}|null>(null);
 const [form,setForm]=useState<any>({});
 const [busy,setBusy]=useState(false);
 const [auth,setAuth]=useState(false);
 const [truncated,setTruncated]=useState(false);

 // Login state (tabs: 'user' | 'admin')
 const [authMode,setAuthMode]=useState<'user'|'admin'>('user');
 const [loginEmail,setLoginEmail]=useState('user@nexora.com');
 const [loginPassword,setLoginPassword]=useState('user123');
 const [loginBusy,setLoginBusy]=useState(false);
 const [loginError,setLoginError]=useState('');

 // Chatbot states
 const [chatOpen,setChatOpen]=useState(false);
 const [chatInput,setChatInput]=useState('');
 const [chatBusy,setChatBusy]=useState(false);
 const [chatMessages,setChatMessages]=useState<ChatMessage[]>([
  {
   id:'welcome',
   role:'bot',
   text:'Hi there! 👋 I am your Nexora CRM AI Assistant.\n\nAsk me about your pipeline, deal metrics, contacts, or follow-up tasks.',
   time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
  }
 ]);
 const [chatSuggestions,setChatSuggestions]=useState<string[]>([
  '📊 Pipeline summary',
  '🎯 Top opportunities',
  '⏳ Pending tasks',
  '✉️ Draft follow-up email'
 ]);

 const dialog=useRef<HTMLDialogElement>(null);
 const chatBottomRef=useRef<HTMLDivElement>(null);

 async function load(){
  setLoading(true);
  setError('');
  try{
   const r=await fetch('/api/crm');
   const data:any=await r.json();
   if(!r.ok){
    if(r.status===401){
     setAuth(true);
     setUser(null);
    }
    throw Error(data.error);
   }
   setRecords(data.records);
   setActivity(data.activity);
   setUser(data.user);
   setAuth(false);
   setTruncated(data.truncated);
  }catch(e){
   setError((e as Error).message);
  }finally{
   setLoading(false);
  }
 }

 useEffect(()=>{load()},[]);
 useEffect(()=>{if(modal)dialog.current?.showModal();else dialog.current?.close()},[modal]);
 useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(t)}},[notice]);
 useEffect(()=>{
  if(chatOpen){
   setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}),100);
  }
 },[chatOpen,chatMessages,chatBusy]);

 function switchAuthMode(mode:'user'|'admin'){
  setAuthMode(mode);
  setLoginError('');
  if(mode==='admin'){
   setLoginEmail('admin@nexora.com');
   setLoginPassword('admin123');
  }else{
   setLoginEmail('user@nexora.com');
   setLoginPassword('user123');
  }
 }

 async function handleLogin(e?:React.FormEvent,customCreds?:{email:string;password:string;mode:'user'|'admin'}){
  if(e)e.preventDefault();
  setLoginBusy(true);
  setLoginError('');

  const emailToUse=customCreds?.email??loginEmail;
  const passwordToUse=customCreds?.password??loginPassword;
  const modeToUse=customCreds?.mode??authMode;

  try{
   const res=await fetch('/api/auth/login',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:emailToUse,password:passwordToUse,mode:modeToUse})
   });
   const data:any=await res.json();
   if(!res.ok)throw new Error(data.error||'Authentication failed');
   setAuth(false);
   setNotice(`Welcome back, ${data.user?.displayName||'User'}`);
   await load();
  }catch(err:any){
   setLoginError(err.message||'Authentication failed');
  }finally{
   setLoginBusy(false);
  }
 }

 async function handleLogout(){
  if(busy)return;
  setBusy(true);
  try{
   await fetch('/api/auth/logout',{method:'POST'});
   setUser(null);
   setRecords([]);
   setActivity([]);
   setAuth(true);
   setNotice('Logged out successfully');
  }catch(e){
   setError('Logout failed');
  }finally{
   setBusy(false);
  }
 }

 async function sendChatMessage(textToSend?:string){
  const msg=textToSend||chatInput;
  if(!msg.trim()||chatBusy)return;

  const userMsg:ChatMessage={
   id:crypto.randomUUID(),
   role:'user',
   text:msg.trim(),
   time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
  };

  setChatMessages(prev=>[...prev,userMsg]);
  if(!textToSend)setChatInput('');
  setChatBusy(true);

  try{
   const res=await fetch('/api/chatbot',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     message:userMsg.text,
     history:chatMessages.slice(-6).map(m=>({role:m.role==='bot'?'assistant':'user',content:m.text}))
    })
   });
   const data:any=await res.json();
   if(!res.ok)throw new Error(data.error||'Chatbot unavailable');

   const botMsg:ChatMessage={
    id:crypto.randomUUID(),
    role:'bot',
    text:data.reply,
    time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
   };
   setChatMessages(prev=>[...prev,botMsg]);
   if(data.suggestions?.length){
    setChatSuggestions(data.suggestions);
   }
  }catch(err:any){
   setChatMessages(prev=>[
    ...prev,
    {
     id:crypto.randomUUID(),
     role:'bot',
     text:`⚠️ ${err.message||'Sorry, I encountered an error. Please try again.'}`,
     time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    }
   ]);
  }finally{
   setChatBusy(false);
  }
 }

 function open(kind:Kind,row?:RecordRow){setForm(row?{...row.data}:blank(kind));setModal({kind,row});setError('')}

 async function mutate(method:string,kind:Kind,data?:any,row?:RecordRow){
  const r=await fetch('/api/crm',{
   method,
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({kind,...(row?{id:row.id,version:row.version}:{}),...(data?{data}:{})})
  });
  const j:any=await r.json();
  if(!r.ok)throw Error(j.error+(j.details?' — '+Object.values(j.details.fieldErrors??{}).flat().join(', '):''));
  return j;
 }

 async function save(e:React.FormEvent){
  e.preventDefault();
  if(!modal)return;
  setBusy(true);
  try{
   await mutate(modal.row?'PATCH':'POST',modal.kind,form,modal.row);
   setModal(null);
   setNotice('Record saved');
   await load();
  }catch(e){
   setError((e as Error).message);
  }finally{
   setBusy(false);
  }
 }

 async function remove(){
  if(!modal?.row||!confirm('Permanently delete this record? This cannot be undone.'))return;
  setBusy(true);
  try{
   await mutate('DELETE',modal.kind,undefined,modal.row);
   setModal(null);
   setNotice('Record deleted');
   await load();
  }catch(e){
   setError((e as Error).message);
  }finally{
   setBusy(false);
  }
 }

 async function update(row:RecordRow,changes:any){
  setBusy(true);
  try{
   await mutate('PATCH',row.kind,{...row.data,...changes},row);
   await load();
   setNotice('Updated successfully');
  }catch(e){
   setError((e as Error).message);
  }finally{
   setBusy(false);
  }
 }

 async function samples(){
  if(!confirm('Add 3 fictional contacts, 4 sample deals, and 3 sample tasks?'))return;
  setBusy(true);
  try{
   for(const data of [{name:'Aarav Mehta',email:'aarav@example.com',company:'Acme Studios',status:'Lead'},{name:'Maya Rao',email:'maya@example.com',company:'Orbit Labs',status:'Customer'},{name:'Rohan Shah',email:'rohan@example.com',company:'Vertex Systems',status:'Partner'}])await mutate('POST','contacts',{...blank('contacts'),...data});
   for(const [name,company,value,stage] of [['Enterprise AI platform','Acme Studios',850000,'Proposal'],['Analytics modernization','Orbit Labs',420000,'Negotiation'],['Customer support copilot','Vertex Systems',650000,'Qualified'],['Discovery workshop','Orbit Labs',125000,'Won']])await mutate('POST','deals',{...blank('deals'),name,company,value,stage,notes:'Fictional sample record'});
   for(const [name,company,priority]of [['Send revised proposal','Acme Studios','High'],['Schedule technical discovery','Vertex Systems','Medium'],['Check in with Maya','Orbit Labs','Low']])await mutate('POST','tasks',{...blank('tasks'),name,company,priority});
   setNotice('Fictional sample records added');
   await load();
  }catch(e){
   setError((e as Error).message+' Some sample records may have been saved.');
  }finally{
   setBusy(false);
  }
 }

 // Render Login Screen when unauthenticated
 if(auth || (!loading && !user)){
  return (
   <div className="login-screen">
    <div className="login-card">
     <div className="login-header">
      <div className="brand" style={{justifyContent:'center',marginBottom:16}}>
       <span className="brand-icon">n</span>nexora<span className="brand-crm">CRM</span>
      </div>

      <div className="login-tabs">
       <button
        type="button"
        className={'login-tab '+(authMode==='user'?'active':'')}
        onClick={()=>switchAuthMode('user')}
       >
        <User size={14}/> Sales User
       </button>
       <button
        type="button"
        className={'login-tab '+(authMode==='admin'?'active':'')}
        onClick={()=>switchAuthMode('admin')}
       >
        <ShieldCheck size={14}/> Administrator
       </button>
      </div>

      <div className="admin-badge">
       {authMode==='admin'?<><ShieldCheck size={13}/> Admin Portal</>:<><UserCheck size={13}/> Sales Portal</>}
      </div>
      <h2>{authMode==='admin'?'Administrator Sign In':'Sign In to Nexora CRM'}</h2>
      <p>
       {authMode==='admin'
        ?'Access your administrative dashboard, user management, and workspace settings.'
        :'Manage your contacts, deals, sales pipeline, and interact with your AI assistant.'}
      </p>
     </div>

     {loginError&&<div role="alert" className="error" style={{marginBottom:18}}>{loginError}</div>}

     <form onSubmit={handleLogin} className="login-form">
      <label>
       <span>{authMode==='admin'?'Admin Email or Username':'User Email'}</span>
       <input
        type="text"
        required
        value={loginEmail}
        onChange={e=>setLoginEmail(e.target.value)}
        placeholder={authMode==='admin'?'admin@nexora.com':'user@nexora.com'}
        autoFocus
       />
      </label>

      <label>
       <span>Password</span>
       <input
        type="password"
        required
        value={loginPassword}
        onChange={e=>setLoginPassword(e.target.value)}
        placeholder="••••••••"
       />
      </label>

      <div style={{marginTop:8}}>
       <button
        type="submit"
        className="button primary"
        style={{width:'100%',padding:'12px',fontSize:13}}
        disabled={loginBusy}
       >
        {loginBusy?<RefreshCw className="spin" size={16}/>:authMode==='admin'?<Lock size={16}/>:<User size={16}/>}
        {loginBusy?'Authenticating…':authMode==='admin'?'Sign In as Administrator':'Sign In as Sales User'}
       </button>
      </div>
     </form>

     <div className="login-demo-box">
      <div className="demo-credentials">
       <strong>{authMode==='admin'?'Default Admin Credentials':'Default User Credentials'}</strong>
       <span>Email: <code>{authMode==='admin'?'admin@nexora.com':'user@nexora.com'}</code></span>
       <span>Password: <code>{authMode==='admin'?'admin123':'user123'}</code></span>
      </div>
      <button
       type="button"
       className="button secondary"
       style={{width:'100%',fontSize:11,fontWeight:600}}
       disabled={loginBusy}
       onClick={()=>handleLogin(undefined,authMode==='admin'?{email:'admin@nexora.com',password:'admin123',mode:'admin'}:{email:'user@nexora.com',password:'user123',mode:'user'})}
      >
       One-Click {authMode==='admin'?'Admin':'User'} Login
      </button>
     </div>

     <div className="login-footer">
      <a href="/signin-with-chatgpt?return_to=/" target="_top">
       Or sign in with ChatGPT →
      </a>
     </div>
    </div>
    {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
   </div>
  );
 }

 const contacts=records.filter(r=>r.kind==='contacts'),deals=records.filter(r=>r.kind==='deals'),tasks=records.filter(r=>r.kind==='tasks');
 const active=deals.filter(r=>!['Won','Lost'].includes(r.data.stage)),won=deals.filter(r=>r.data.stage==='Won'),closed=deals.filter(r=>['Won','Lost'].includes(r.data.stage));
 const pending=tasks.filter(r=>!r.data.completed).sort((a,b)=>a.data.dueDate.localeCompare(b.data.dueDate));
 const total=active.reduce((a,r)=>a+r.data.value,0),revenue=won.reduce((a,r)=>a+r.data.value,0);
 const kind:Kind=page==='Contacts'?'contacts':page==='Tasks'?'tasks':'deals';
 const visible=records.filter(r=>r.kind===kind&&JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase())&&(filter==='All'||(kind==='contacts'?r.data.status===filter:kind==='tasks'?filter==='Completed'?r.data.completed:!r.data.completed:r.data.stage===filter)));

 function navigate(p:string){setPage(p);setSearch('');setFilter('All')}

 function exportCsv(){
  const rows=page==='Overview'?records:visible;
  if(!rows.length){setNotice('No records to export');return}
  const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r.data))));
  const cell=(v:any)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const csv=[['type',...keys].map(cell).join(','),...rows.map(r=>[r.kind,...keys.map(k=>r.data[k])].map(cell).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='nexora-crm-'+today()+'.csv';
  a.click();
  URL.revokeObjectURL(url);
 }

 const taskList=(items:RecordRow[])=>items.length?<div className="task-list">{items.map(r=><div className="task" key={r.id}><button className={'checkbox '+(r.data.completed?'checked':'')} aria-label={'Mark '+r.data.name+(r.data.completed?' incomplete':' complete')} disabled={busy} onClick={()=>update(r,{completed:!r.data.completed})}>{r.data.completed&&<Check size={13}/>}</button><button className="task-name" onClick={()=>open('tasks',r)}><strong>{r.data.name}</strong><span>{r.data.company||'No company'} · {r.data.dueDate}</span></button><span className={'tag '+r.data.priority.toLowerCase()}>{r.data.priority}</span></div>)}</div>:<div className="empty-small">All clear. Add a follow-up to stay ahead.</div>;

 return (
  <div className="app">
   <aside>
    <a href="/" className="brand">
     <span className="brand-icon">n</span>nexora<span className="brand-crm">CRM</span>
    </a>
    <div className="workspace">
     <span className="workspace-icon">N</span>
     <div>
      <strong>{user?.role==='admin'?'Admin workspace':'My workspace'}</strong>
      <small>Sales & relationships</small>
     </div>
     <ChevronRight size={15}/>
    </div>
    <span className="nav-label">WORKSPACE</span>
    <nav>
     {['Overview','Contacts','Pipeline','Tasks','Activity'].map((p,i)=>{
      const Icon=icons[i];
      return <button className={page===p?'active':''} key={p} onClick={()=>navigate(p)}><Icon size={18}/>{p}{p==='Tasks'&&pending.length>0&&<em>{pending.length}</em>}</button>
     })}
    </nav>
    <div className="sidebar-bottom">
     <div className="private">
      <ShieldCheck size={18}/>
      <div>
       <strong>Private by design</strong>
       <small>Role: {user?.role==='admin'?'Administrator':'Sales User'}</small>
      </div>
     </div>
     <div className="profile">
      <div className="avatar">{(user?.name||'U').slice(0,1).toUpperCase()}</div>
      <div>
       <strong>{user?.name||'Sales User'}</strong>
       <small>{user?.role==='admin'?'Administrator':'Sales Representative'}</small>
      </div>
      <button title="Sign out" onClick={handleLogout} className="icon-button" style={{color:'#9299a5'}} aria-label="Sign out">
       <LogOut size={16}/>
      </button>
     </div>
    </div>
   </aside>

   <div className="main">
    <header>
     <div className="breadcrumb">Workspace <ChevronRight size={13}/><strong>{page}</strong></div>
     <div className="header-right">
      <span className="live-dot"/>
      <span>{user?.role==='admin'?'Admin workspace · Active':'User workspace · Active'}</span>
      <span className="header-avatar">{(user?.name||'U').slice(0,1).toUpperCase()}</span>
      <button
       onClick={handleLogout}
       className="button secondary"
       style={{padding:'4px 8px',fontSize:10,marginLeft:10}}
       title="Sign out of workspace"
      >
       <LogOut size={12}/> Sign out
      </button>
     </div>
    </header>

    <main>
     <div className="page-heading">
      <div>
       <div className="eyebrow">YOUR RELATIONSHIPS. MOVING FORWARD.</div>
       <h1>{page==='Overview'?'A clearer view. A stronger pipeline.':page==='Contacts'?'Relationships start here.':page==='Pipeline'?'Turn opportunities into outcomes.':page==='Tasks'?'Make your next move.':'Every move, in one place.'}</h1>
       <p>{page==='Overview'?'Everything you need to keep your sales moving, all in one place.':page==='Contacts'?'Keep the people behind your business close.':page==='Pipeline'?'Track every deal from first conversation to closed won.':page==='Tasks'?'A little follow-through makes a big difference.':'A record of changes across your private workspace.'}</p>
      </div>
      <div className="heading-actions">
       <button className="button secondary" onClick={()=>setChatOpen(!chatOpen)} style={{background:'#f3f0fb',color:'var(--purple)',borderColor:'#e0daf5'}}>
        <Sparkles size={15}/> Ask AI Assistant
       </button>
       <button className="button secondary" onClick={exportCsv}><Download size={16}/>Export</button>
       <button className="button primary" disabled={busy} onClick={()=>open(kind)}><Plus size={17}/>New {kind==='contacts'?'contact':kind==='tasks'?'task':'deal'}</button>
      </div>
     </div>

     {error&&<div role="alert" className="error">{error} <button onClick={load}>Retry</button></div>}
     {truncated&&<div className="error">Showing the latest 5,000 records. Dashboard totals and export cover this subset.</div>}

     {loading&&records.length===0?<div className="loading"><RefreshCw className="spin" size={22}/>Loading your workspace…</div>:<>
      {page==='Overview'&&<>
       <div className="stats">
        {[["Open pipeline",money(total),`${active.length} active opportunities`],["Won revenue",money(revenue),`${won.length} deals closed won`],["Total contacts",contacts.length,'People in your network'],["Win rate",closed.length?Math.round(won.length/closed.length*100)+'%':'—',closed.length?`${closed.length} closed deals`:'No closed deals yet']].map(([label,value,sub],i)=><div className="stat" key={label}><div><span>{label}</span><span className="stat-icon">{i<2?<GitBranch size={16}/>:i===2?<Users size={16}/>:<ArrowUpRight size={16}/>}</span></div><strong>{value}</strong><small>{sub}</small></div>)}
       </div>

       <div className="overview-grid">
        <section className="panel pipeline-summary">
         <div className="panel-head">
          <div><h2>Pipeline at a glance</h2><p>Deal value across your sales stages</p></div>
          <button className="text-button" onClick={()=>navigate('Pipeline')}>View pipeline <ArrowUpRight size={15}/></button>
         </div>
         <div className="chart">
          {stages.slice(0,5).map((s,i)=>{
           const list=deals.filter(r=>r.data.stage===s),v=list.reduce((a,r)=>a+r.data.value,0),max=Math.max(1,...stages.map(st=>deals.filter(r=>r.data.stage===st).reduce((a,r)=>a+r.data.value,0)));
           return <button key={s} className="bar-column" onClick={()=>{navigate('Pipeline');setFilter(s)}}><span>{money(v)}</span><div className="bar-track"><div className={'bar bar-'+i} style={{height:Math.max(3,v/max*100)+'%'}}/></div><strong>{s}</strong><small>{list.length} deals</small></button>
          })}
         </div>
         <div className="chart-foot"><span className="legend-dot"/>All-time pipeline · INR <span>Click a stage to explore</span></div>
        </section>

        <section className="panel">
         <div className="panel-head">
          <div><h2>Next up</h2><p>Follow-ups that keep things moving</p></div>
          <button className="icon-button" title="Add task" onClick={()=>open('tasks')}><Plus size={19}/></button>
         </div>
         {taskList(pending.slice(0,4))}
         <button className="panel-footer" onClick={()=>navigate('Tasks')}>View all tasks <ArrowRight size={15}/></button>
        </section>

        <section className="panel">
         <div className="panel-head">
          <div><h2>Recent opportunities</h2><p>Your latest conversations with potential</p></div>
          <button className="text-button" onClick={()=>navigate('Pipeline')}>View all <ArrowUpRight size={15}/></button>
         </div>
         {deals.length?<div className="recent-deals">{deals.slice(0,4).map(r=><button key={r.id} onClick={()=>open('deals',r)}><span className="company-avatar">{r.data.company.slice(0,1)}</span><span><strong>{r.data.name}</strong><small>{r.data.company}</small></span><b>{money(r.data.value)}</b><span className="tag">{r.data.stage}</span></button>)}</div>:<div className="empty-small">Your next opportunity starts with a conversation.<button className="text-button" onClick={()=>open('deals')}>Add your first deal →</button></div>}
        </section>

        <section className="panel">
         <div className="panel-head">
          <div><h2>Workspace activity</h2><p>The latest updates at a glance</p></div>
          <Activity size={18}/>
         </div>
         {activity.length?<div className="activity-list">{activity.slice(0,4).map(a=><div key={a.id}><span className="activity-dot"/><div><strong>{a.label}</strong><span>Record {a.action} · {new Date(a.created_at).toLocaleDateString()}</span></div></div>)}</div>:<div className="empty-small">Your changes will appear here.</div>}
        </section>
       </div>

       {!records.length&&<div className="onboarding">
        <div><strong>A fresh start for your sales.</strong><p>Add your first contact or explore with clearly fictional sample records.</p></div>
        <button className="button secondary" disabled={busy} onClick={samples}>{busy?'Adding…':'Explore with sample data'} <ArrowRight size={15}/></button>
       </div>}
      </>}

      {['Contacts','Pipeline','Tasks'].includes(page)&&<>
       <div className="toolbar">
        <div className="search"><Search size={17}/><input aria-label="Search records" placeholder={'Search '+kind+'…'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select aria-label="Filter records" value={filter} onChange={e=>setFilter(e.target.value)}>{['All',...(kind==='contacts'?['Lead','Customer','Partner']:kind==='tasks'?['Open','Completed']:stages)].map(s=><option key={s}>{s}</option>)}</select>
        <span>{visible.length} {kind}</span>
        <button className="icon-button" title="Refresh" onClick={load}><RefreshCw size={17}/></button>
       </div>

       {page==='Pipeline'?<div className="board">{stages.filter(s=>filter==='All'||filter===s).map(s=><section className="lane" key={s}><div className="lane-head"><span className={'stage-dot '+s.toLowerCase()}/><strong>{s}</strong><em>{visible.filter(r=>r.data.stage===s).length}</em><button title={'Add '+s+' deal'} onClick={()=>{open('deals');setForm({...blank('deals'),stage:s})}}><Plus size={15}/></button></div><div className="lane-value">{money(visible.filter(r=>r.data.stage===s).reduce((a,r)=>a+r.data.value,0))}</div>{visible.filter(r=>r.data.stage===s).map(r=><article className="deal-card" key={r.id}><button onClick={()=>open('deals',r)} className="deal-title">{r.data.name}<MoreHorizontal size={16}/></button><span className="deal-company"><Building2 size={13}/>{r.data.company}</span><strong>{money(r.data.value)}</strong><div className="deal-bottom"><span>{r.data.closeDate}</span><select disabled={busy} aria-label={'Stage for '+r.data.name} value={s} onChange={e=>update(r,{stage:e.target.value})}>{stages.map(st=><option key={st}>{st}</option>)}</select></div></article>)}<button className="add-card" onClick={()=>{open('deals');setForm({...blank('deals'),stage:s})}}><Plus size={14}/>Add deal</button></section>)}</div>:page==='Contacts'?<section className="panel table-wrap"><table><thead><tr><th>Contact</th><th>Company</th><th>Email</th><th>Status</th><th>Phone</th><th/></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td><button className="contact-name" onClick={()=>open('contacts',r)}><span className="company-avatar">{r.data.name.slice(0,1)}</span><strong>{r.data.name}</strong></button></td><td>{r.data.company}</td><td>{r.data.email}</td><td><span className="tag">{r.data.status}</span></td><td>{r.data.phone||'—'}</td><td><button className="icon-button" aria-label={'Edit '+r.data.name} onClick={()=>open('contacts',r)}><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table>{!visible.length&&<div className="empty-small">No contacts found. Add a contact to grow your network.</div>}</section>:<section className="panel">{taskList(visible)}</section>}
      </>}

      {page==='Activity'&&<section className="panel">
       <div className="panel-head"><div><h2>Activity log</h2><p>Latest 50 record changes · timestamps shown in your local time</p></div></div>
       {activity.length?<div className="activity-list full">{activity.map(a=><div key={a.id}><span className="activity-dot"/><div><strong>{a.label}</strong><span>Record {a.action}</span></div><time>{new Date(a.created_at).toLocaleString()}</time></div>)}</div>:<div className="empty-small">No activity yet.</div>}
      </section>}
     </>}

     <footer>
      <span>NEXORA CRM</span>
      <span>Built for meaningful connections.</span>
      <span><ShieldCheck size={13}/> Secure workspace</span>
     </footer>
    </main>
   </div>

   {/* Chatbot Floating Trigger */}
   <button
    className="chat-fab"
    onClick={()=>setChatOpen(!chatOpen)}
    aria-label="Open AI Assistant"
    title="Open AI CRM Assistant"
   >
    <Bot size={18}/>
    <span>AI Assistant</span>
    <span className="fab-badge"/>
   </button>

   {/* Chatbot Interactive Window */}
   {chatOpen&&(
    <div className="chat-window">
     <div className="chat-header">
      <div className="chat-header-title">
       <div className="bot-avatar"><Bot size={18}/></div>
       <div>
        <h3>Nexora AI Assistant</h3>
        <small><span className="online-indicator"/> Context Aware · Live</small>
       </div>
      </div>
      <button className="chat-close-btn" onClick={()=>setChatOpen(false)} title="Close Chat">
       <X size={17}/>
      </button>
     </div>

     <div className="chat-body">
      {chatMessages.map(m=>(
       <div key={m.id} className={'chat-msg '+m.role}>
        <div className="chat-bubble">
         {formatChatText(m.text)}
         <div className="chat-msg-time">{m.time}</div>
        </div>
       </div>
      ))}
      {chatBusy&&(
       <div className="chat-msg bot">
        <div className="chat-typing">
         <span/><span/><span/>
        </div>
       </div>
      )}
      <div ref={chatBottomRef}/>
     </div>

     {chatSuggestions.length>0&&(
      <div className="chat-suggestions">
       {chatSuggestions.map(s=>(
        <button
         key={s}
         className="suggestion-chip"
         disabled={chatBusy}
         onClick={()=>sendChatMessage(s)}
        >
         {s}
        </button>
       ))}
      </div>
     )}

     <form
      className="chat-input-bar"
      onSubmit={(e)=>{e.preventDefault();sendChatMessage()}}
     >
      <input
       type="text"
       placeholder="Ask about pipeline, deals, tasks…"
       value={chatInput}
       onChange={(e)=>setChatInput(e.target.value)}
       disabled={chatBusy}
      />
      <button
       type="submit"
       className="chat-send-btn"
       disabled={!chatInput.trim()||chatBusy}
       title="Send message"
      >
       <Send size={15}/>
      </button>
     </form>
    </div>
   )}

   <dialog ref={dialog} onCancel={()=>{if(!busy)setModal(null)}} onClose={()=>{if(!busy)setModal(null)}}>
    <form onSubmit={save}>
     <div className="modal-head">
      <div>
       <span className="eyebrow">KEEP THINGS MOVING</span>
       <h2>{modal?.row?'Edit':'New'} {modal?.kind==='contacts'?'contact':modal?.kind==='tasks'?'task':'deal'}</h2>
      </div>
      <button type="button" disabled={busy} className="icon-button" aria-label="Close" onClick={()=>setModal(null)}><X size={21}/></button>
     </div>
     <div className="form-grid">
      {Object.entries(form).filter(([k])=>k!=='completed').map(([k,v])=><label key={k} className={['name','notes'].includes(k)?'wide':''}>{({name:'Name',email:'Email address',company:'Company',phone:'Phone number',status:'Relationship',notes:'Notes',value:'Deal value (INR)',stage:'Stage',closeDate:'Expected close date',dueDate:'Due date',priority:'Priority'}as any)[k]}{['stage','status','priority'].includes(k)?<select value={String(v)} onChange={e=>setForm({...form,[k]:e.target.value})}>{(k==='stage'?stages:k==='status'?['Lead','Customer','Partner']:['High','Medium','Low']).map(s=><option key={s}>{s}</option>)}</select>:k==='notes'?<textarea maxLength={4000} rows={3} value={String(v)} onChange={e=>setForm({...form,[k]:e.target.value})}/>:<input autoFocus={k==='name'} required={!['phone','notes'].includes(k)&&!(k==='company'&&modal?.kind==='tasks')} maxLength={k==='email'?254:k==='phone'?40:160} type={k==='value'?'number':k==='email'?'email':k.endsWith('Date')?'date':'text'} min={k==='value'?0:undefined} max={k==='value'?100000000000:undefined} step={k==='value'?'0.01':undefined} value={String(v)} onChange={e=>setForm({...form,[k]:k==='value'?Number(e.target.value):e.target.value})}/>}</label>)}
     </div>
     {error&&<p role="alert" className="error">{error}</p>}
     <div className="modal-actions">
      {modal?.row&&<button type="button" className="delete-button" disabled={busy} onClick={remove}>Delete record</button>}
      <button type="button" className="button secondary" disabled={busy} onClick={()=>setModal(null)}>Cancel</button>
      <button className="button primary" disabled={busy}>{busy?'Saving…':'Save '+(modal?.kind==='contacts'?'contact':modal?.kind==='tasks'?'task':'deal')}</button>
     </div>
    </form>
   </dialog>

   {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>
 );
}
