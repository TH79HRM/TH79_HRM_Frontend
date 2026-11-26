import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft,Save,ShieldCheck,Paperclip,UploadCloud,FileText,BriefcaseBusiness,ContactRound,FolderUp,WalletCards,Banknote,UsersRound} from 'lucide-react';
import {api} from '../lib/api';
import {Loading,Toast} from '../components/ui';
import {entityId,entityKey} from '../lib/format';
import {useAuth} from '../hooks/useAuth';
import {isValidDate,isValidEmail,isValidNumber,isValidPhone} from '../lib/validation';

const initial={
  employee_code:'',full_name:'',gender:'unknown',date_of_birth:'',professional_qualification:'',identity_number:'',
  permanent_address:'',current_address:'',phone:'',email:'',social_insurance_number:'',social_insurance_status:'unknown',
  join_date:'',probation_end_date:'',recruitment_decision_no:'',employment_status:'probation',branch_id:'',department_id:'',position_id:'',contract_status_id:'',
  bank_account_number:'',bank_name:'',tax_dependents:0,note:'',
  base_salary:0,probation_salary:0,insurance_salary:0,lunch_allowance:0,fuel_allowance:0,phone_allowance:0,attendance_allowance:0,other_allowance:0,salary_effective_from:''
};

export default function EmployeeForm(){
  const {id}=useParams();
  const edit=Boolean(id);
  const nav=useNavigate();
  const {has}=useAuth();
  const [look,setLook]=useState(null);
  const [form,setForm]=useState(initial);
  const [files,setFiles]=useState({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState(null);

  useEffect(()=>{
    let active=true;
    const invalid=edit&&(!id||id==='undefined'||id==='null');
    if(invalid){setError('Liên kết hồ sơ không hợp lệ.');return()=>{active=false};}
    const jobs=[api('/employees/lookups')];
    if(edit)jobs.push(api(`/employees/${encodeURIComponent(id)}`));
    Promise.all(jobs).then(([l,r])=>{
      if(!active)return;
      setLook(l);
      if(r){
        const salary=(r.salaryProfiles||[])[0]||{};
        setForm({...initial,...normalize(r.employee),...normalizeSalary(salary)});
      }
    }).catch(e=>active&&setError(e.message));
    return()=>{active=false};
  },[id,edit]);

  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(null),3600);
    return()=>clearTimeout(timer);
  },[toast]);

  const requiredDocs=useMemo(()=>((look?.documentTypes||[]).filter(x=>x.is_required===1||x.is_required===true)).slice(0,4),[look]);
  if(!look&&!error)return <Loading/>;
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const notify=(message,tone='success')=>setToast({message,tone,key:Date.now()});
  const chooseDocument=(docId,event)=>{
    const file=event.target.files?.[0]||null;
    if(file&&file.size>10*1024*1024){setError('Mỗi tệp hồ sơ không được vượt quá 10 MB.');event.target.value='';return}
    const validType=file&&(['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)||/\.(pdf|png|jpe?g|webp)$/i.test(file.name));
    if(file&&!validType){
      setError('Chỉ hỗ trợ tệp PDF, PNG, JPG/JPEG hoặc WEBP.');event.target.value='';return
    }
    setError('');
    setFiles(current=>({...current,[docId]:file}));
  };

  const uploadDocuments=async employeeId=>{
    const selected=Object.entries(files).filter(([,file])=>file);
    if(!selected.length)return 0;
    notify(`Đang tải ${selected.length} hồ sơ lên Cloudinary...`);
    let uploaded=0;
    for(const [typeId,file] of selected){
      const fd=new FormData();
      fd.append('employee_id',employeeId);
      fd.append('document_type_id',typeId);
      fd.append('file',file);
      await api('/documents/upload',{method:'POST',body:fd});
      uploaded++;
    }
    notify(`Đã tải ${uploaded} hồ sơ lên Cloudinary thành công.`);
    return uploaded;
  };

  const submit=async e=>{
    e.preventDefault();
    const validationError=validateEmployeeForm(form,has('payroll.manage'));
    if(validationError){setError(validationError);return}
    setBusy(true);setError('');
    try{
      let employeeId=id;
      if(edit){
        await api(`/employees/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(form)});
      }else{
        const r=await api('/employees',{method:'POST',body:JSON.stringify(form)});
        employeeId=entityId(r)||r?.id;
        if(!employeeId)throw new Error('Đã tạo hồ sơ nhưng API không trả về mã định danh.');
      }
      if(has('document.upload'))await uploadDocuments(employeeId);
      notify(edit?'Đã cập nhật hồ sơ nhân viên.':'Đã tạo nhân viên mới.');
      setTimeout(()=>nav(`/employees/${encodeURIComponent(employeeId)}`),350);
    }catch(e){setError(e.message);notify(e.message||'Không thể lưu hồ sơ.','error')}finally{setBusy(false)}
  };

  const options=(rows,labelKey,prefix)=>(rows||[]).map((x,i)=>{
    const oid=entityId(x);
    return <option key={entityKey(x,`${prefix}-${i}`)} value={oid||''}>{x[labelKey]}</option>;
  });

  return <>
    {toast&&<Toast key={toast.key} message={toast.message} tone={toast.tone} onClose={()=>setToast(null)}/>}    
    <div className="employee-form-heading">
      <button className="back-link" type="button" onClick={()=>nav(-1)}><ArrowLeft/> Quay lại</button>
      <h1>{edit?'Chỉnh sửa hồ sơ nhân viên':'Thêm nhân viên mới'}</h1>
      <p>{edit?'Cập nhật thông tin nhân sự, cơ cấu và cấu hình lương.':'Nhập thông tin nhân sự, lương và số hoá hồ sơ ngay trong một lần thao tác.'}</p>
    </div>

    <form className="employee-form-layout" onSubmit={submit}>
      <div className="employee-form-main">
        {error&&<div className="form-error">{error}</div>}

        <section className="card employee-form-card">
          <div className="form-card-title"><div><h3>Thông tin cá nhân</h3><p>Thông tin định danh và liên hệ của nhân viên</p></div><span><ContactRound/></span></div>
          <div className="form-grid two-form-cols">
            <Field label="Họ và tên" required><input required minLength="2" maxLength="120" value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="Nguyễn Văn A"/></Field>
            <Field label="Giới tính"><select value={form.gender} onChange={e=>set('gender',e.target.value)}><option value="unknown">Chưa cập nhật</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></Field>
            <Field label="Ngày sinh"><input type="date" value={form.date_of_birth||''} onChange={e=>set('date_of_birth',e.target.value)}/></Field>
            <Field label="Trình độ chuyên môn"><input value={form.professional_qualification||''} onChange={e=>set('professional_qualification',e.target.value)} placeholder="Ví dụ: Đại học Kế toán"/></Field>
            <Field label="CMND/CCCD"><input inputMode="numeric" maxLength="12" value={form.identity_number||''} onChange={e=>set('identity_number',e.target.value)} placeholder="Nhập dạng chuỗi số"/></Field>
            <Field label="Số điện thoại"><input type="tel" maxLength="20" value={form.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="09xxxxxxxx"/></Field>
            <Field label="Email"><input type="email" maxLength="254" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="email@congty.vn"/></Field>
            <Field label="Số BHXH"><input inputMode="numeric" maxLength="10" value={form.social_insurance_number||''} onChange={e=>set('social_insurance_number',e.target.value)} placeholder="Số BHXH nếu đã có"/></Field>
            <Field label="Thường trú" wide><textarea maxLength="500" value={form.permanent_address||''} onChange={e=>set('permanent_address',e.target.value)} placeholder="Địa chỉ thường trú"/></Field>
            <Field label="Nơi ở hiện tại" wide><textarea maxLength="500" value={form.current_address||''} onChange={e=>set('current_address',e.target.value)} placeholder="Địa chỉ hiện tại"/></Field>
          </div>
        </section>

        {has('document.upload')&&<section className="card employee-form-card" id="employee-document-upload">
          <div className="form-card-title"><div><span className="mini-kicker"><FolderUp/> KHO HỒ SƠ SỐ</span><h3>Tải hồ sơ nhân viên</h3><p>Đính kèm PDF hoặc ảnh scan. Hệ thống tự đánh dấu hồ sơ còn thiếu.</p></div><span><FolderUp/></span></div>
          <div className="secure-upload-note"><ShieldCheck/><div><strong>Kho hồ sơ bảo mật đã sẵn sàng</strong><span>Tệp được lưu riêng tư trên Cloudinary và chỉ truy cập qua API có phân quyền.</span></div></div>
          <div className="document-upload-grid">
            {requiredDocs.map((doc,i)=>{
              const docId=entityId(doc)||doc.id||i+1;
              const file=files[docId];
              return <label className={`document-upload-card ${file?'selected':''}`} key={entityKey(doc,`doc-${i}`)}>
                <div className="document-upload-head"><span><FileText/></span><div><strong>{doc.document_name}</strong><small>{file?file.name:'Chưa có hồ sơ — nên tải lên ngay'}</small></div><em>{file?'Đã chọn':'Còn thiếu'}</em></div>
                <div className="document-drop"><UploadCloud/><span><strong>{file?'Đổi file':'Bấm để chọn PDF / ảnh scan'}</strong><small>{file?`${Math.round(file.size/1024)} KB`:'PDF, PNG, JPG, WEBP'}</small></span></div>
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={e=>chooseDocument(docId,e)}/>
              </label>;
            })}
            {!requiredDocs.length&&<div className="empty">Chưa cấu hình loại hồ sơ bắt buộc.</div>}
          </div>
        </section>}

        <section className="card employee-form-card">
          <div className="form-card-title"><div><h3>Thông tin công việc</h3><p>Đơn vị, chức vụ và tình trạng làm việc</p></div><span><BriefcaseBusiness/></span></div>
          <div className="form-grid two-form-cols">
            <Field label="Mã nhân viên"><input maxLength="30" value={form.employee_code} onChange={e=>set('employee_code',e.target.value)} placeholder="Tự sinh nếu để trống"/></Field>
            <Field label="Trạng thái"><select value={form.employment_status} onChange={e=>set('employment_status',e.target.value)}><option value="probation">Nhân viên thử việc</option><option value="active">Nhân viên chính thức</option><option value="on_leave">Nghỉ phép</option><option value="resigned">Đã nghỉ việc</option><option value="inactive">Ngưng hoạt động</option></select></Field>
            <Field label="Chi nhánh"><select value={form.branch_id||''} onChange={e=>set('branch_id',e.target.value)}><option value="">Chưa cập nhật</option>{options(look?.branches,'branch_name','branch')}</select></Field>
            <Field label="Phòng ban trực thuộc"><select value={form.department_id||''} onChange={e=>set('department_id',e.target.value)}><option value="">Chưa cập nhật</option>{options(look?.departments,'department_name','department')}</select></Field>
            <Field label="Chức vụ"><select value={form.position_id||''} onChange={e=>set('position_id',e.target.value)}><option value="">Chưa cập nhật</option>{options(look?.positions,'position_name','position')}</select></Field>
            <Field label="Ngày nhận việc"><input type="date" value={form.join_date||''} onChange={e=>set('join_date',e.target.value)}/></Field>
            <Field label="Ngày hết hạn hợp đồng thử việc"><input type="date" value={form.probation_end_date||''} onChange={e=>set('probation_end_date',e.target.value)}/></Field>
            <Field label="Số QĐ tuyển dụng"><input value={form.recruitment_decision_no||''} onChange={e=>set('recruitment_decision_no',e.target.value)} placeholder="Số quyết định"/></Field>
            <Field label="Tình trạng BHXH"><select value={form.social_insurance_status} onChange={e=>set('social_insurance_status',e.target.value)}><option value="unknown">Chưa xác định</option><option value="has_number">Đã có mã</option><option value="not_yet">Chưa có mã</option><option value="external_company">Đóng công ty khác</option></select></Field>
            <Field label="Ghi chú" wide><textarea value={form.note||''} onChange={e=>set('note',e.target.value)} placeholder="Ghi chú nội bộ"/></Field>
          </div>
        </section>

        {has('payroll.manage')&&<section className="card employee-form-card salary-config-card">
          <div className="form-card-title"><div><span className="mini-kicker"><WalletCards/> CẤU HÌNH LƯƠNG</span><h3>Lương & thông tin thanh toán</h3><p>Dữ liệu này được tự động lấy vào kỳ lương hàng tháng.</p></div><span><Banknote/></span></div>
          <div className="salary-guidance"><ShieldCheck/><span>Lương chính thức và lương thử việc được lưu vào hồ sơ lương. Kế toán vẫn có thể điều chỉnh từng kỳ lương trước khi duyệt.</span></div>
          <div className="form-grid three-form-cols salary-form-grid">
            <Field label="Lương chính thức"><MoneyInput value={form.base_salary} onChange={v=>set('base_salary',v)} placeholder="8.500.000"/></Field>
            <Field label="Lương thử việc"><MoneyInput value={form.probation_salary} onChange={v=>set('probation_salary',v)} placeholder="7.225.000"/></Field>
            <Field label="Lương đóng bảo hiểm"><MoneyInput value={form.insurance_salary} onChange={v=>set('insurance_salary',v)} placeholder="Mặc định theo lương chính thức"/></Field>
            <Field label="Phụ cấp ăn trưa"><MoneyInput value={form.lunch_allowance} onChange={v=>set('lunch_allowance',v)}/></Field>
            <Field label="Phụ cấp xăng xe"><MoneyInput value={form.fuel_allowance} onChange={v=>set('fuel_allowance',v)}/></Field>
            <Field label="Phụ cấp điện thoại"><MoneyInput value={form.phone_allowance} onChange={v=>set('phone_allowance',v)}/></Field>
            <Field label="Phụ cấp chuyên cần"><MoneyInput value={form.attendance_allowance} onChange={v=>set('attendance_allowance',v)}/></Field>
            <Field label="Phụ cấp khác"><MoneyInput value={form.other_allowance} onChange={v=>set('other_allowance',v)}/></Field>
            <Field label="Hiệu lực lương từ"><input type="date" value={form.salary_effective_from||form.join_date||''} onChange={e=>set('salary_effective_from',e.target.value)}/></Field>
            <Field label="Số tài khoản ngân hàng"><input inputMode="numeric" maxLength="30" value={form.bank_account_number||''} onChange={e=>set('bank_account_number',e.target.value)} placeholder="Số tài khoản nhận lương"/></Field>
            <Field label="Ngân hàng"><input value={form.bank_name||''} onChange={e=>set('bank_name',e.target.value)} placeholder="VD: OCB, VCB, MB..."/></Field>
            <Field label="Số người phụ thuộc"><input type="number" min="0" step="1" value={form.tax_dependents||0} onChange={e=>set('tax_dependents',e.target.value)}/></Field>
          </div>
        </section>}
      </div>

      <aside className="employee-form-side">
        <div className="card sticky-employee-create">
          <span className="side-icon"><ShieldCheck/></span>
          <h3>{edit?'Cập nhật hồ sơ':'Tạo hồ sơ mới'}</h3>
          <p>{edit?'Mọi thay đổi sẽ được ghi vào lịch sử hoạt động.':'Thông tin nhân sự, lương và hồ sơ scan được lưu cùng lúc.'}</p>
          <div className="create-checklist">
            {requiredDocs.map((doc,i)=>{const docId=entityId(doc)||doc.id||i+1;return <span key={entityKey(doc,`side-${i}`)} className={files[docId]?'done':''}><i/>{doc.document_name}</span>})}
          </div>
          {has('document.upload')&&<a className="attach-jump" href="#employee-document-upload"><Paperclip/> Đính kèm hồ sơ <span>PDF / ảnh scan</span></a>}
          {has('payroll.manage')&&<div className="salary-side-summary"><UsersRound/><span><small>{form.employment_status==='probation'?'Lương thử việc đang áp dụng':'Lương chính thức đang áp dụng'}</small><strong>{formatMoney(form.employment_status==='probation'?(form.probation_salary||form.base_salary):form.base_salary)}</strong></span></div>}
          <div className="storage-ready"><ShieldCheck/> Kho hồ sơ bảo mật sẵn sàng</div>
          <button className="btn primary create-submit" disabled={busy||Boolean(error&&!look)}><Save/>{busy?'Đang lưu...':edit?'Lưu thay đổi':'Tạo nhân viên'}</button>
          <button type="button" className="btn ghost" onClick={()=>nav(-1)}>Hủy</button>
        </div>
      </aside>
    </form>
  </>;
}

function Field({label,required,wide,children}){return <label className={wide?'wide':''}><span>{label}{required&&' *'}</span>{children}</label>}
function moneyDigits(value){
  return String(value??'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');
}
function formatGroupedMoney(value){
  const digits=moneyDigits(value);
  if(!digits||Number(digits)===0)return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function MoneyInput({value,onChange,placeholder='0'}){
  const inputRef=useRef(null);
  const caretDigits=useRef(null);
  const [focused,setFocused]=useState(false);
  const [display,setDisplay]=useState(()=>formatGroupedMoney(value));
  const lastValue=useRef(value);
  useEffect(()=>{
    if(Object.is(value,lastValue.current))return;
    lastValue.current=value;
    setDisplay(focused&&Number(value)?moneyDigits(value):focused?'':formatGroupedMoney(value));
  },[value,focused]);
  useLayoutEffect(()=>{
    if(caretDigits.current===null)return;
    const input=inputRef.current;
    if(input&&document.activeElement===input){
      const position=positionAfterDigits(input.value,caretDigits.current);
      input.setSelectionRange(position,position);
    }
    caretDigits.current=null;
  });
  const change=e=>{
    const el=e.target;
    const raw=el.value;
    if(/[−-]/.test(raw))return;
    const digits=moneyDigits(raw);
    const next=digits&&Number(digits)?Number(digits):'';
    lastValue.current=next;
    setDisplay(digits);
    onChange(next);
  };
  return <input
    ref={inputRef}
    type="text"
    inputMode="numeric"
    autoComplete="off"
    value={display}
    onChange={change}
    onFocus={e=>{
      const raw=e.currentTarget.value;
      const caret=e.currentTarget.selectionStart??raw.length;
      caretDigits.current=raw.slice(0,caret).replace(/\D/g,'').length;
      lastValue.current=value;
      setFocused(true);
      setDisplay(Number(value)?moneyDigits(value):'');
    }}
    onBlur={()=>{
      setFocused(false);
      setDisplay(formatGroupedMoney(value));
    }}
    onKeyDown={e=>{if(e.key==='-'||e.key==='Subtract')e.preventDefault()}}
    placeholder={placeholder}
  />;
}
function positionAfterDigits(value,digitCount){
  if(digitCount<=0)return 0;
  let seen=0;
  for(let index=0;index<value.length;index++){
    if(/\d/.test(value[index]))seen++;
    if(seen===digitCount)return index+1;
  }
  return value.length;
}
function normalize(e){const o={...e};for(const k of ['date_of_birth','join_date','probation_end_date'])if(o[k])o[k]=String(o[k]).slice(0,10);return o}
function normalizeSalary(s){const o={...s};if(o.effective_from)o.salary_effective_from=String(o.effective_from).slice(0,10);delete o.effective_from;return o}
function formatMoney(v){return new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v)||0)}

function validateEmployeeForm(form,includeSalary){
  if(String(form.full_name||'').trim().length<2||String(form.full_name).trim().length>120)return 'Họ và tên phải có từ 2 đến 120 ký tự.';
  if(form.employee_code&&!/^[A-Za-z0-9._-]{2,30}$/.test(String(form.employee_code).trim()))return 'Mã nhân viên chỉ được dùng chữ, số, dấu chấm, gạch ngang hoặc gạch dưới (2–30 ký tự).';
  if(form.email&&!isValidEmail(String(form.email).trim()))return 'Email không đúng định dạng.';
  if(form.phone&&!isValidPhone(String(form.phone).trim()))return 'Số điện thoại không đúng định dạng.';
  const identity=String(form.identity_number||'').replace(/\s/g,'');
  if(identity&&!/^(?:\d{9}|\d{12})$/.test(identity))return 'CMND/CCCD phải gồm 9 hoặc 12 chữ số.';
  const socialInsurance=String(form.social_insurance_number||'').replace(/\s/g,'');
  if(socialInsurance&&!/^\d{10}$/.test(socialInsurance))return 'Số BHXH phải gồm 10 chữ số.';
  if(form.bank_account_number&&!/^\d{5,30}$/.test(String(form.bank_account_number).replace(/\s/g,'')))return 'Số tài khoản ngân hàng phải gồm 5–30 chữ số.';
  for(const [key,label] of [['date_of_birth','Ngày sinh'],['join_date','Ngày nhận việc'],['probation_end_date','Ngày kết thúc thử việc']]){
    if(form[key]&&!isValidDate(String(form[key]).slice(0,10)))return `${label} không hợp lệ.`;
  }
  if(form.date_of_birth&&String(form.date_of_birth).slice(0,10)>=new Date().toISOString().slice(0,10))return 'Ngày sinh phải nằm trong quá khứ.';
  if(form.join_date&&form.probation_end_date&&form.probation_end_date<form.join_date)return 'Ngày kết thúc thử việc phải sau hoặc bằng ngày nhận việc.';
  if(includeSalary){
    for(const key of ['base_salary','probation_salary','insurance_salary','lunch_allowance','fuel_allowance','phone_allowance','attendance_allowance','other_allowance']){
      if(form[key]!==''&&form[key]!==null&&form[key]!==undefined&&!isValidNumber(form[key],{min:0,max:1_000_000_000_000}))return 'Các khoản lương và phụ cấp phải là số không âm hợp lệ.';
    }
    if(form.salary_effective_from&&!isValidDate(String(form.salary_effective_from).slice(0,10)))return 'Ngày hiệu lực lương không hợp lệ.';
    if(form.tax_dependents!==''&&!isValidNumber(form.tax_dependents,{min:0,max:100,integer:true}))return 'Số người phụ thuộc phải là số nguyên từ 0 đến 100.';
  }
  return '';
}
