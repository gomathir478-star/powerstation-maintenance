const API = '../api/index.php';
const state = {view:'dashboard', equipment:[], users:[], alarms:[], schedules:[], repairs:[], inventory:[], history:[], reports:null};
const titles = {dashboard:'Operations Overview',equipment:'Equipment Registry',alarms:'Alarm Monitoring',schedules:'Maintenance Planning',repairs:'Repair Work Orders',inventory:'Spare Parts Inventory',history:'Maintenance History',reports:'Reports & Analytics',users:'User Management'};
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(resource, method='GET', payload=null){
  const options={method,headers:{'Content-Type':'application/json'}};
  if(payload) options.body=JSON.stringify(payload);
  const res=await fetch(`${API}?resource=${encodeURIComponent(resource)}`,options);
  const data=await res.json().catch(()=>({error:'Invalid server response'}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function notify(message,error=false){const n=$('#notice');n.textContent=message;n.classList.remove('hidden','error');if(error)n.classList.add('error');window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>n.classList.add('hidden'),5000)}
function badge(status){
  const s=String(status||'').toLowerCase();
  let cls=['operational','completed','resolved','active'].includes(s)?(s==='active'?'bad':'good'):['critical','faulty','offline','blocked'].includes(s)?'critical':['warning','scheduled','pending','under maintenance','in progress'].includes(s)?'warn':'info';
  return `<span class="badge ${cls}">${esc(status||'Unknown')}</span>`;
}
function date(v){return v?esc(String(v).replace('T',' ').slice(0,16)):'—'}
function emptyRow(n,msg='No records found'){return `<tr><td colspan="${n}" class="empty">${msg}</td></tr>`}
function section(title,sub,action=''){return `<div class="section-head"><div><h2>${title}</h2><p>${sub}</p></div>${action}</div>`}
function panel(title,body,extra=''){return `<div class="panel"><div class="panel-head"><div><h3>${title}</h3></div>${extra}</div>${body}</div>`}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||emptyRow(headers.length)}</tbody></table></div>`}
async function load(resource){state[resource]=await api(resource);return state[resource]}
async function navigate(view){
  state.view=view;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#pageTitle').textContent=titles[view]||'GridGuardian Pro';
  try{
    if(view==='dashboard'){const d=await api('dashboard');state.dashboard=d;renderDashboard(d)}
    else {const map={equipment:'equipment',alarms:'alarms',schedules:'schedules',repairs:'repairs',inventory:'inventory',history:'history',users:'users',reports:'reports'};await load(map[view]);if(view==='schedules'||view==='repairs')await load('users');renderView(view)}
  }catch(e){$('#view').innerHTML=`<div class="panel"><div class="panel-body"><h3>Cannot load data</h3><p class="muted">${esc(e.message)}</p><p class="muted">Check that XAMPP Apache and MySQL are running and that database/psms.sql was imported.</p><button class="btn primary" onclick="navigate('${view}')">Retry</button></div></div>`}
}
function renderDashboard(d){
  $('#alarmBadge').textContent=d.active_alarms;
  const stats=[['REGISTERED EQUIPMENT',d.equipment,'Asset registry','▦'],['ACTIVE ALARMS',d.active_alarms,'Needs attention','⚠'],['OPEN WORK ORDERS',d.open_repairs,'Repairs in progress','⌁'],['MAINTENANCE WORKERS',d.technicians,'Active team members','♙']];
  const cards=stats.map((s,i)=>`<div class="stat"><span class="stat-icon">${s[3]}</span><div class="stat-label">${s[0]}</div><div class="stat-value">${s[1]}</div><div class="stat-note">${i===1&&s[1]>0?'● Attention required':'↗ '+s[2]}</div></div>`).join('');
  const alarms=d.recent_alarms.map(a=>`<div class="alarm-row"><div class="alarm-symbol">⚠</div><div style="flex:1"><b>${esc(a.title)}</b><p>${esc(a.equipment_name)} · ${esc(a.severity)}</p><time>${date(a.triggered_at)}</time></div>${badge(a.alarm_status)}</div>`).join('')||'<div class="empty">No alarms recorded</div>';
  $('#view').innerHTML=`${section('Plant health at a glance','Live operational snapshot and maintenance activity.','<button class="btn primary" onclick="openModal(\'equipment\')">＋ Add equipment</button>')}<div class="stats">${cards}<div class="stat"><span class="stat-icon">▤</span><div class="stat-label">LOW-STOCK ITEMS</div><div class="stat-value">${d.low_stock}</div><div class="stat-note">${d.low_stock?'● Reorder recommended':'✓ Stock levels healthy'}</div></div></div><div class="two-col">${panel('Recent alarms',`<div class="panel-body">${alarms}</div>`,'<button class="btn small" onclick="navigate(\'alarms\')">View all →</button>')}${panel('Quick actions',`<div class="panel-body"><p class="muted" style="margin-top:0">Common operations</p><div class="quick-actions"><button class="btn primary" onclick="openModal(\'repair\')">＋ Create repair</button><button class="btn" onclick="openModal(\'schedule\')">＋ Schedule maintenance</button><button class="btn" onclick="navigate(\'inventory\')">Check inventory</button><button class="btn" onclick="navigate(\'reports\')">View reports</button></div><div style="margin-top:23px;padding:15px;background:#0c1724;border:1px solid var(--line);border-radius:9px"><div class="stat-label">SYSTEM STATUS</div><h3 style="color:var(--green);margin-top:7px">● API connected when data loads</h3><p class="muted" style="font-size:11px;margin-bottom:0">Data shown here is read from your local MySQL database.</p></div></div>`)}</div>`;
}
function renderView(view){
  $('#alarmBadge').textContent=(state.alarms||[]).filter(a=>a.alarm_status!=='Resolved').length;
  const add=(kind,label)=>`<button class="btn primary" onclick="openModal('${kind}')">＋ ${label}</button>`;
  if(view==='equipment'){
    const rows=state.equipment.map(e=>`<tr><td><b>${esc(e.equipment_code)}</b></td><td>${esc(e.name)}<div class="muted">${esc(e.equipment_type)}</div></td><td>${esc(e.location||'—')}</td><td>${badge(e.status)}</td><td>${date(e.last_maintenance_date)}</td><td><select class="search" style="padding:6px;width:150px" onchange="updateEquipment(${e.equipment_id},this.value)">${['Operational','Warning','Faulty','Under Maintenance','Offline'].map(s=>`<option ${s===e.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('');
    $('#view').innerHTML=section('Equipment registry','Track assets, current condition, and maintenance dates.',add('equipment','Add equipment'))+panel('All equipment',table(['ASSET CODE','EQUIPMENT','LOCATION','STATUS','LAST MAINTENANCE','UPDATE STATUS'],rows));
  } else if(view==='alarms'){
    const rows=state.alarms.map(a=>`<tr><td>#${a.alarm_id}</td><td><b>${esc(a.title)}</b><div class="muted">${esc(a.message||'')}</div></td><td>${esc(a.equipment_name)}</td><td>${badge(a.severity)}</td><td>${date(a.triggered_at)}</td><td>${badge(a.alarm_status)}</td><td>${a.alarm_status==='Resolved'?'—':`<button class="btn small" onclick="updateAlarm(${a.alarm_id},'${a.alarm_status==='Active'?'Acknowledged':'Resolved'}')">${a.alarm_status==='Active'?'Acknowledge':'Resolve'}</button>`}</td></tr>`).join('');
    $('#view').innerHTML=section('Alarm monitor','Review active warnings and acknowledge or resolve incidents.',add('alarm','Log alarm'))+panel('Alarm events',table(['ID','ALARM','EQUIPMENT','SEVERITY','TRIGGERED','STATUS','ACTION'],rows));
  } else if(view==='schedules'){
    const rows=state.schedules.map(s=>`<tr><td>#${s.schedule_id}</td><td><b>${esc(s.task_title)}</b><div class="muted">${esc(s.details||'')}</div></td><td>${esc(s.equipment_name)}</td><td>${esc(s.engineer_name||'Unassigned')}</td><td>${date(s.scheduled_date)}</td><td>${badge(s.schedule_status)}</td><td><select class="search" style="width:140px;padding:6px" onchange="updateSchedule(${s.schedule_id},this.value)">${['Scheduled','In Progress','Completed','Cancelled'].map(x=>`<option ${x===s.schedule_status?'selected':''}>${x}</option>`).join('')}</select></td></tr>`).join('');
    $('#view').innerHTML=section('Maintenance planning','Plan preventive maintenance and assign an engineer.',add('schedule','Create schedule'))+panel('Scheduled work',table(['ID','TASK','EQUIPMENT','ENGINEER','DATE','STATUS','UPDATE'],rows));
  } else if(view==='repairs'){
    const rows=state.repairs.map(r=>`<tr><td>#${r.repair_id}</td><td>${esc(r.equipment_name)}</td><td>${esc(r.issue_description)}</td><td>${esc(r.worker_name||'Unassigned')}</td><td>${badge(r.priority)}</td><td>${badge(r.repair_status)}</td><td><select class="search" style="width:145px;padding:6px" onchange="updateRepair(${r.repair_id},this.value)">${['Pending','In Progress','Completed','Blocked'].map(x=>`<option ${x===r.repair_status?'selected':''}>${x}</option>`).join('')}</select></td></tr>`).join('');
    $('#view').innerHTML=section('Repair work orders','Assign technicians, track repairs, and record completed work.',add('repair','Create work order'))+panel('Repair queue',table(['ID','EQUIPMENT','ISSUE','ASSIGNED WORKER','PRIORITY','STATUS','UPDATE STATUS'],rows));
  } else if(view==='inventory'){
    const rows=state.inventory.map(i=>`<tr><td>${esc(i.item_code)}</td><td><b>${esc(i.item_name)}</b><div class="muted">${esc(i.category||'')}</div></td><td>${i.quantity} ${esc(i.unit)}</td><td>${i.reorder_level} ${esc(i.unit)}</td><td>${i.quantity<=i.reorder_level?'<span class="badge bad">Reorder</span>':'<span class="badge good">In stock</span>'}</td><td><button class="btn small" onclick="changeStock(${i.item_id},${i.quantity})">Update quantity</button></td></tr>`).join('');
    $('#view').innerHTML=section('Spare parts inventory','Monitor parts availability and low-stock thresholds.',add('inventory','Add part'))+panel('Stock list',table(['ITEM CODE','PART','QUANTITY','REORDER LEVEL','STOCK STATUS','ACTION'],rows));
  } else if(view==='history'){
    const rows=state.history.map(h=>`<tr><td>${date(h.maintenance_date)}</td><td>${esc(h.equipment_name)}</td><td>${esc(h.maintenance_type)}</td><td>${esc(h.technician_name||'Unassigned')}</td><td>${esc(h.notes||'—')}</td></tr>`).join('');
    $('#view').innerHTML=section('Maintenance history','Completed work automatically appears here.', '<button class="btn" onclick="navigate(\'reports\')">Open reports →</button>')+panel('Historical maintenance records',table(['DATE','EQUIPMENT','TYPE','TECHNICIAN','NOTES'],rows));
  } else if(view==='users'){
    const rows=state.users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${badge(u.role)}</td><td>${esc(u.phone||'—')}</td><td>${u.active?'Active':'Inactive'}</td></tr>`).join('');
    $('#view').innerHTML=section('User management','View system roles: Admin, Engineer, and Maintenance Worker.',add('user','Add user'))+panel('Registered users',table(['NAME','EMAIL','ROLE','PHONE','STATUS'],rows))+'<p class="muted">Note: this starter UI does not enforce role-based permissions. Add server-side authentication before deployment.</p>';
  } else if(view==='reports'){
    const d=state.reports||{}, eq=d.equipment_by_status||[], repairs=d.repairs_by_status||[], low=d.inventory_low_stock||[];
    const bars=(arr)=>arr.length?arr.map(x=>`<div class="bar-row"><span>${esc(x.status)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Number(x.total)*20)}%"></div></div><b>${x.total}</b></div>`).join(''):'<div class="empty">No data yet</div>';
    const lowRows=low.map(x=>`<tr><td>${esc(x.item_name)}</td><td class="low-stock">${x.quantity}</td><td>${x.reorder_level}</td></tr>`).join('');
    $('#view').innerHTML=section('Reports & analytics','Operational summaries calculated from database records.','<button class="btn" onclick="window.print()">Print report</button>')+`<div class="report-grid">${panel('Equipment by status',`<div class="panel-body">${bars(eq)}</div>`)}${panel('Repair work orders',`<div class="panel-body">${bars(repairs)}</div>`)}</div>`+panel('Low-stock alerts',table(['PART','AVAILABLE','REORDER LEVEL'],lowRows));
  }
}
function field(name,label,type='text',opts=null,required=true,full=false){
  let input='';
  if(type==='select')input=`<select name="${name}" ${required?'required':''}>${(opts||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`;
  else if(type==='textarea')input=`<textarea name="${name}" ${required?'required':''}></textarea>`;
  else input=`<input name="${name}" type="${type}" ${required?'required':''} ${type==='number'?'min="0"':''}>`;
  return `<div class="field ${full?'full':''}"><label>${label}</label>${input}</div>`;
}
function optsFrom(arr,id,label){return arr.map(x=>({value:x[id],label:x[label]}))}
const modalDefs={
 equipment:{title:'Add equipment',resource:'equipment',fields:()=>field('equipment_code','Asset code')+field('name','Equipment name')+field('equipment_type','Equipment type','select',['Generator','Turbine','Transformer','Pump','Control Panel','Other'].map(x=>({value:x,label:x})))+field('location','Location', 'text',null,false)+field('installation_date','Installation date','date',null,false)+field('status','Initial status','select',['Operational','Warning','Faulty','Under Maintenance','Offline'].map(x=>({value:x,label:x})),true,true),payload:f=>Object.fromEntries(new FormData(f))},
 alarm:{title:'Log alarm',resource:'alarms',fields:()=>field('equipment_id','Equipment','select',optsFrom(state.equipment,'equipment_id','name'))+field('severity','Severity','select',['Info','Warning','Critical'].map(x=>({value:x,label:x})))+field('title','Alarm title')+field('message','Details','textarea',null,false,true),payload:f=>Object.fromEntries(new FormData(f))},
 schedule:{title:'Schedule maintenance',resource:'schedules',fields:()=>field('equipment_id','Equipment','select',optsFrom(state.equipment,'equipment_id','name'))+field('assigned_engineer_id','Assigned engineer','select',[{value:'',label:'Unassigned'},...optsFrom(state.users.filter(u=>u.role==='Engineer'||u.role==='Admin'),'user_id','full_name')],false)+field('task_title','Task title')+field('scheduled_date','Scheduled date','date')+field('details','Details','textarea',null,false,true),payload:f=>Object.fromEntries(new FormData(f))},
 repair:{title:'Create repair work order',resource:'repairs',fields:()=>field('equipment_id','Equipment','select',optsFrom(state.equipment,'equipment_id','name'))+field('worker_id','Assign worker','select',[{value:'',label:'Unassigned'},...optsFrom(state.users.filter(u=>u.role==='Maintenance Worker'||u.role==='Admin'),'user_id','full_name')],false)+field('priority','Priority','select',['Low','Medium','High','Critical'].map(x=>({value:x,label:x})))+field('issue_description','Issue description','textarea',null,true,true),payload:f=>Object.fromEntries(new FormData(f))},
 inventory:{title:'Add spare part',resource:'inventory',fields:()=>field('item_code','Item code')+field('item_name','Item name')+field('category','Category', 'text',null,false)+field('quantity','Quantity','number')+field('reorder_level','Reorder level','number',null,false)+field('unit','Unit', 'text',null,false)+field('supplier','Supplier','text',null,false,true),payload:f=>Object.fromEntries(new FormData(f))},
 user:{title:'Add user',resource:'users',fields:()=>field('full_name','Full name')+field('email','Email','email')+field('password','Temporary password','password')+field('role','Role','select',['Admin','Engineer','Maintenance Worker'].map(x=>({value:x,label:x})))+field('phone','Phone','text',null,false,true),payload:f=>Object.fromEntries(new FormData(f))}
};
function openModal(kind){
 const def=modalDefs[kind];if(!def)return;
 if(['alarm','schedule','repair'].includes(kind)&&!state.equipment.length){notify('Add equipment first before creating this record.',true);return}
 $('#modalTitle').textContent=def.title;$('#modalFields').innerHTML=def.fields();$('#modal').classList.remove('hidden');
 $('#modalForm').onsubmit=async e=>{e.preventDefault();const payload=def.payload(e.target);try{await api(def.resource,'POST',payload);$('#modal').classList.add('hidden');notify(def.title.replace(/^(Add|Create|Log|Schedule) /,'')+' saved successfully.');await navigate(state.view)}catch(err){notify(err.message,true)}};
}
$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modal').classList.add('hidden');
async function updateEquipment(id,status){try{await api('equipment','PATCH',{equipment_id:id,status});notify('Equipment status updated.');await navigate(state.view)}catch(e){notify(e.message,true)}}
async function updateAlarm(id,status){try{await api('alarms','PATCH',{alarm_id:id,alarm_status:status});notify('Alarm status updated.');await navigate(state.view)}catch(e){notify(e.message,true)}}
async function updateSchedule(id,status){try{await api('schedules','PATCH',{schedule_id:id,schedule_status:status});notify('Maintenance schedule updated.');await navigate(state.view)}catch(e){notify(e.message,true)}}
async function updateRepair(id,status){try{await api('repairs','PATCH',{repair_id:id,repair_status:status});notify(status==='Completed'?'Repair completed; equipment status and history updated.':'Repair status updated.');await navigate(state.view)}catch(e){notify(e.message,true)}}
async function changeStock(id,current){const raw=prompt('Enter new quantity:',current);if(raw===null)return;const q=Number(raw);if(!Number.isInteger(q)||q<0){notify('Enter a valid non-negative whole number.',true);return}try{await api('inventory','PATCH',{item_id:id,quantity:q});notify('Stock updated.');await navigate(state.view)}catch(e){notify(e.message,true)}}
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)navigate(b.dataset.view)});
navigate('dashboard');
