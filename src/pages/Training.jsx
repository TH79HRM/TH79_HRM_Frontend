import {useEffect,useMemo,useState} from 'react';
import {GraduationCap,Plus,Search,SlidersHorizontal,Save} from 'lucide-react';
import {api} from '../lib/api';
import {Loading,PageHeader,Badge,Modal,Empty} from '../components/ui';
import {fmtDate,money} from '../lib/format';import {useAuth} from '../hooks/useAuth';
import {isValidDate,isValidNumber} from '../lib/validation';
export default function Training(){
  const {has}=useAuth(),[d,setD]=useState(null),[open,setOpen]=useState(false),[q,setQ]=useState(''),[status,setStatus]=useState('');
  const load=()=>api('/talent/training').then(setD);useEffect(()=>{load()},[]);
  const courses=useMemo(()=>!d?[]:(d.courses||[]).filter(c=>{const hay=`${c.course_code||''} ${c.course_name||''} ${c.provider||''}`.toLowerCase();return(!q||hay.includes(q.toLowerCase()))&&(!status||c.status===status)}),[d,q,status]);
  if(!d)return <Loading/>;
  return <><PageHeader eyebrow="ĐÀO TẠO" title="Đào tạo nhân sự" subtitle="Theo dõi khóa đào tạo, thời gian, chi phí và số nhân sự tham gia." actions={has('training.manage')&&<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={17}/> Thêm khóa học</button>}/>
  <section className="card filter-card page-filter-card"><div className="filters training-filters"><label className="search-box"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Mã khóa, tên khóa, đơn vị đào tạo..."/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option><option value="planned">Kế hoạch</option><option value="ongoing">Đang diễn ra</option><option value="completed">Hoàn tất</option><option value="cancelled">Đã hủy</option></select><button className="btn filter-auto" type="button"><SlidersHorizontal size={16}/> Lọc tự động</button></div></section>
  <section className="card data-card"><div className="card-head"><div><h3>Khóa đào tạo</h3><p>{courses.length} kết quả</p></div></div><div className="table-wrap"><table><thead><tr><th>Mã khóa</th><th>Tên khóa học</th><th>Thời gian</th><th>Nhân sự</th><th>Chi phí</th><th>Trạng thái</th></tr></thead><tbody>{courses.map(c=><tr key={c.id??c._id}><td>{c.course_code||'—'}</td><td><strong>{c.course_name}</strong><small className="block">{c.provider||c.note||''}</small></td><td>{fmtDate(c.start_date)} {c.end_date?`→ ${fmtDate(c.end_date)}`:''}</td><td>{c.members?.length||0}</td><td>{money(c.cost||0)}</td><td><Badge value={c.status}/></td></tr>)}</tbody></table>{!courses.length&&<Empty title="Chưa có khóa đào tạo"/>}</div></section>
  <Modal open={open} onClose={()=>setOpen(false)} title="Thêm khóa đào tạo"><TrainingForm done={()=>{setOpen(false);load()}}/></Modal></>;
}
function TrainingForm({done}){
  const [f,setF]=useState({course_name:'',training_code:'',provider:'',start_date:'',end_date:'',cost:0,status:'planned',description:''});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const submit=async e=>{
    e.preventDefault();setError('');
    if(String(f.course_name||'').trim().length<2||String(f.course_name).trim().length>160){setError('Tên khóa học phải có từ 2 đến 160 ký tự.');return}
    if(f.start_date&&!isValidDate(f.start_date)){setError('Ngày bắt đầu khóa học không hợp lệ.');return}
    if(f.end_date&&(!isValidDate(f.end_date)||!f.start_date||f.end_date<f.start_date)){setError('Ngày kết thúc phải hợp lệ và sau hoặc bằng ngày bắt đầu.');return}
    if(!isValidNumber(f.cost,{min:0,max:1_000_000_000_000})){setError('Chi phí phải là số không âm hợp lệ.');return}
    setBusy(true);
    try{await api('/talent/training',{method:'POST',body:JSON.stringify(f)});done()}
    catch(ex){setError(ex.message||'Không thể lưu khóa học.')}
    finally{setBusy(false)}
  };
  return <form className="form-stack modal-form" onSubmit={submit}>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <label>Tên khóa học <b>*</b><input required minLength="2" maxLength="160" value={f.course_name} onChange={e=>set('course_name',e.target.value)}/></label>
    <div className="two-col"><label>Mã khóa học<input maxLength="40" value={f.training_code} onChange={e=>set('training_code',e.target.value)}/></label><label>Đơn vị đào tạo<input maxLength="160" value={f.provider} onChange={e=>set('provider',e.target.value)}/></label></div>
    <div className="two-col"><label>Ngày bắt đầu<input type="date" value={f.start_date} onChange={e=>set('start_date',e.target.value)}/></label><label>Ngày kết thúc<input type="date" value={f.end_date} onChange={e=>set('end_date',e.target.value)}/></label></div>
    <div className="two-col"><label>Chi phí<input type="number" min="0" max="1000000000000" step="1" value={f.cost} onChange={e=>set('cost',e.target.value)}/></label><label>Trạng thái<select value={f.status} onChange={e=>set('status',e.target.value)}><option value="planned">Kế hoạch</option><option value="ongoing">Đang diễn ra</option><option value="completed">Hoàn tất</option></select></label></div>
    <label>Ghi chú<textarea rows="4" maxLength="5000" value={f.description} onChange={e=>set('description',e.target.value)}/></label>
    <div className="modal-actions"><button type="button" className="btn" onClick={done} disabled={busy}>Hủy</button><button className="btn primary" disabled={busy}><Save size={16}/>{busy?'Đang lưu...':'Lưu khóa đào tạo'}</button></div>
  </form>;
}
