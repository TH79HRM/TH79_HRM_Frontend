import { useEffect, useState } from 'react';
import {
  CalendarOff, Clock3, FileText, Mail, MapPin, Phone, QrCode, ScanFace, Send,
  ShieldCheck, WalletCards
} from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Empty, Loading, Modal, PageHeader, Toast } from '../components/ui';
import { fmtDate, initials, money } from '../lib/format';
import BiometricScanner from '../components/BiometricScanner';
import EmployeeBadgeCard from '../components/EmployeeBadgeCard';
import { attendanceStatusLabel, methodLabel } from '../lib/biometrics';
import { isValidDate,isValidEmail,isValidNumber,isValidPhone,isValidTime } from '../lib/validation';

const fields = [
  ['phone', 'Số điện thoại'],
  ['email', 'Email'],
  ['current_address', 'Nơi ở hiện tại'],
  ['permanent_address', 'Địa chỉ thường trú'],
  ['professional_qualification', 'Trình độ chuyên môn']
];

export default function SelfService() {
  const [d, setD] = useState(null);
  const [att, setAtt] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveReqs, setLeaveReqs] = useState([]);
  const [openProfileReq, setOpenProfileReq] = useState(false);
  const [openScan, setOpenScan] = useState(false);
  const [openBadge, setOpenBadge] = useState(false);
  const [openLeave, setOpenLeave] = useState(false);
  const [openAdj, setOpenAdj] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => setToast({ message, tone, key: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const load = async () => {
    const me = await api('/self-service/me').catch(e => ({ error: e.message }));
    setD(me);
    if (!me.error) {
      const [a, p, lt, lr] = await Promise.all([
        api('/attendance/my').catch(() => null),
        api('/payroll/my').catch(() => ({ items: [] })),
        api('/leave/types').catch(() => ({ items: [] })),
        api('/leave/requests').catch(() => ({ items: [] }))
      ]);
      setAtt(a);
      setPayslips(p.items || []);
      setLeaveTypes(lt.items || []);
      setLeaveReqs(lr.items || []);
    }
  };

  useEffect(() => { load(); }, []);

  if (!d) return <Loading />;
  if (d.error) return <section className="card"><Empty title="Chưa liên kết hồ sơ nhân viên" detail={d.error} /></section>;

  const e = d.employee;
  const todayRec = att?.todayRecord;

  return <>
    {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

    <PageHeader
      eyebrow="EMPLOYEE SELF-SERVICE"
      title="Cổng thông tin cá nhân"
      subtitle="Chấm công, xem bảng công, bảng lương, bảng tên QR, xin nghỉ phép và gửi yêu cầu cập nhật hồ sơ."
      actions={<>
        <button className="btn ghost" onClick={() => setOpenBadge(true)}><QrCode size={17} /> Bảng tên QR</button>
        <button className="btn ghost" onClick={() => setOpenLeave(true)}><CalendarOff size={17} /> Xin nghỉ / OT</button>
        <button className="btn ghost" onClick={() => setOpenProfileReq(true)}><Send size={17} /> Cập nhật hồ sơ</button>
        <button className="btn primary" onClick={() => setOpenScan(true)}><ScanFace size={17} /> Chấm công ngay</button>
      </>}
    />

    <section className="self-hero card">
      <div className="profile-avatar">{initials(e.full_name)}</div>
      <div style={{ flex: 1 }}>
        <h2>{e.full_name}</h2>
        <p>{e.employee_code} · {e.position_name || '—'} · {e.branch_name || '—'}</p>
        <div className="self-badges-row">
          <Badge value={e.employment_status} />
          {todayRec
            ? <span className="badge success">Hôm nay: Vào {todayRec.check_in_label || '—'} · Ra {todayRec.check_out_label || 'Chưa'}</span>
            : <span className="badge warning">Hôm nay: Chưa chấm công</span>}
          {att?.leaveBalance && <span className="badge neutral">Phép năm còn: {att.leaveBalance.remaining_annual}/{att.leaveBalance.annual_quota} ngày</span>}
        </div>
      </div>
    </section>

    <div className="self-grid">
      <section className="card">
        <div className="card-head">
          <div><h3>Chấm công tháng này</h3><p>{att?.records?.length || 0} ngày công đã ghi nhận</p></div>
          <button type="button" className="link-btn" onClick={() => setOpenAdj(true)}>Giải trình công</button>
        </div>
        <div className="simple-list">
          {(att?.records || []).slice(0, 8).map(r => <div key={r.id}>
            <span>
              <strong>{fmtDate(r.work_date)} · {r.check_in_label || '—'} → {r.check_out_label || '—'}</strong>
              <small>{methodLabel(r.check_in_method)} · {r.worked_hours || 0}h làm</small>
            </span>
            <Badge value={attendanceStatusLabel(r.status)} tone={r.status === 'present' ? 'success' : 'warning'} />
          </div>)}
          {!(att?.records || []).length && <Empty title="Chưa có dữ liệu chấm công tháng này" />}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Phiếu lương của tôi</h3><p>{payslips.length} kỳ lương</p></div></div>
        <div className="simple-list">
          {payslips.map(p => <div key={p.id || p._id}>
            <span>
              <strong>Kỳ lương #{p.payroll_period_id} · {p.actual_work_days} ngày công</strong>
              <small>Gross: {money(p.gross_salary)} · Khấu trừ: {money(p.total_deduction)}</small>
            </span>
            <strong style={{ color: 'var(--green)' }}>{money(p.net_salary)}</strong>
          </div>)}
          {!payslips.length && <Empty title="Chưa có kỳ lương" />}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Đơn nghỉ phép, OT &amp; Giải trình</h3><p>{leaveReqs.length + (att?.adjustments?.length || 0)} đơn đã gửi</p></div></div>
        <div className="request-list">
          {leaveReqs.slice(0, 5).map(r => <div key={`lv-${r.id}`}>
            <span className="request-icon"><CalendarOff size={18} /></span>
            <span><strong>{r.leave_name}</strong><small>{fmtDate(r.start_date)} · {r.reason}</small></span>
            <Badge value={r.status} />
          </div>)}
          {(att?.adjustments || []).slice(0, 5).map(a => <div key={`adj-${a.id}`}>
            <span className="request-icon"><Clock3 size={18} /></span>
            <span><strong>Giải trình {fmtDate(a.work_date)}</strong><small>{a.requested_check_in}–{a.requested_check_out} · {a.reason}</small></span>
            <Badge value={a.status} />
          </div>)}
          {!leaveReqs.length && !(att?.adjustments || []).length && <Empty title="Chưa có đơn từ" />}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Thông tin liên hệ</h3><p>Dữ liệu đang được HR quản lý</p></div></div>
        <div className="detail-grid one">
          <Info icon={Phone} label="Số điện thoại" value={e.phone} />
          <Info icon={Mail} label="Email" value={e.email} />
          <Info icon={MapPin} label="Nơi ở hiện tại" value={e.current_address} />
          <Info icon={MapPin} label="Địa chỉ thường trú" value={e.permanent_address} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Hợp đồng</h3><p>{d.contracts.length} hợp đồng</p></div></div>
        <div className="simple-list">
          {d.contracts.map(c => <div key={c.id}><span><strong>{c.contract_no || `Hợp đồng #${c.id}`}</strong><small>{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</small></span><Badge value={c.status} /></div>)}
          {!d.contracts.length && <Empty title="Chưa có hợp đồng" />}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Yêu cầu cập nhật hồ sơ</h3><p>HR duyệt trước khi thay đổi dữ liệu</p></div></div>
        <div className="request-list">
          {d.requests.map(r => <div key={r.id}><span className="request-icon"><ShieldCheck size={18} /></span><span><strong>{fields.find(x => x[0] === r.field_code)?.[1] || r.field_code}</strong><small>{r.old_value || '—'} → {r.new_value}</small></span><Badge value={r.status} /></div>)}
          {!d.requests.length && <Empty title="Chưa có yêu cầu" />}
        </div>
      </section>
    </div>

    <Modal open={openScan} onClose={() => setOpenScan(false)} title="Chấm công cá nhân" wide>
      <BiometricScanner
        shifts={att?.shifts || []}
        employees={[e]}
        biometrics={att?.biometric ? [{ ...att.biometric, employee_id: e.id, employee_code: e.employee_code, full_name: e.full_name }] : []}
        restrictToEmployeeId={e.id}
        onSuccess={async res => { notify(res.message); await load(); }}
      />
    </Modal>

    <Modal open={openBadge} onClose={() => setOpenBadge(false)} title="Bảng tên / Thẻ nhân viên điện tử" wide>
      <EmployeeBadgeCard
        employee={e}
        badgeCode={att?.biometric?.badge_code}
        qrPayload={att?.biometric?.qr_payload}
        faceImage={att?.biometric?.face_image}
      />
    </Modal>

    <Modal open={openLeave} onClose={() => setOpenLeave(false)} title="Xin nghỉ phép / Đăng ký OT">
      <SelfLeaveForm types={leaveTypes} done={async msg => { setOpenLeave(false); notify(msg); await load(); }} />
    </Modal>

    <Modal open={openAdj} onClose={() => setOpenAdj(false)} title="Gửi giải trình chấm công">
      <AdjustmentForm done={async msg => { setOpenAdj(false); notify(msg); await load(); }} />
    </Modal>

    <Modal open={openProfileReq} onClose={() => setOpenProfileReq(false)} title="Yêu cầu cập nhật thông tin">
      <RequestForm employee={e} done={() => { setOpenProfileReq(false); notify('Đã gửi yêu cầu cập nhật.'); load(); }} />
    </Modal>
  </>;
}

function Info({ icon: Icon, label, value }) {
  return <div className="info-item"><span><Icon size={18} /></span><div><small>{label}</small><strong>{value || '—'}</strong></div></div>;
}

function RequestForm({ employee, done }) {
  const [f, setF] = useState({ field_name: 'phone', new_value: employee.phone || '', reason: '' });
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const change = key => setF({ ...f, field_name: key, new_value: employee[key] || '' });
  const submit = async e => {
    e.preventDefault();setError('');
    const value=String(f.new_value||'').trim();
    if(value.length<2||value.length>500){setError('Giá trị mới phải có từ 2 đến 500 ký tự.');return}
    if(f.field_name==='email'&&!isValidEmail(value)){setError('Email không đúng định dạng.');return}
    if(f.field_name==='phone'&&!isValidPhone(value)){setError('Số điện thoại không đúng định dạng.');return}
    setBusy(true);
    try{await api('/self-service/requests', { method: 'POST', body: JSON.stringify({...f,new_value:value}) });done()}
    catch(ex){setError(ex.message||'Không thể gửi yêu cầu.')}
    finally{setBusy(false)}
  };
  return <form className="form-stack" onSubmit={submit}>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <label>Thông tin muốn đổi<select value={f.field_name} onChange={e => change(e.target.value)}>{fields.map(x => <option value={x[0]} key={x[0]}>{x[1]}</option>)}</select></label>
    <label>Giá trị mới<textarea required minLength="2" maxLength="500" value={f.new_value} onChange={e => setF({ ...f, new_value: e.target.value })} /></label>
    <label>Lý do / ghi chú<textarea maxLength="1000" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></label>
    <button className="btn primary" disabled={busy}>{busy?'Đang gửi...':'Gửi yêu cầu'}</button>
  </form>;
}

function SelfLeaveForm({ types, done }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ request_kind: 'leave', leave_type_id: types[0]?.id || 1, start_date: today, end_date: today, hours: 2, reason: '' });
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit = async e => {
    e.preventDefault();
    setError('');
    if(!isValidDate(f.start_date)||!isValidDate(f.request_kind==='overtime'?f.start_date:f.end_date)){setError('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.');return}
    if(f.request_kind==='leave'&&f.end_date<f.start_date){setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');return}
    if(f.request_kind==='overtime'&&(!isValidNumber(f.hours,{min:0.5,max:12})||Number(f.hours)*2%1!==0)){setError('Số giờ OT phải từ 0,5 đến 12 giờ và theo bước 0,5 giờ.');return}
    if(String(f.reason||'').trim().length<3){setError('Lý do phải có ít nhất 3 ký tự.');return}
    setBusy(true);
    try{await api('/leave/requests', { method: 'POST', body: JSON.stringify(f) });done(f.request_kind === 'overtime' ? 'Đã gửi đăng ký OT.' : 'Đã gửi đơn xin nghỉ phép.')}
    catch(ex){setError(ex.message||'Không thể gửi đơn.')}
    finally{setBusy(false)}
  };
  return <form className="form-stack" onSubmit={submit}>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <label>Loại đơn<select value={f.request_kind} onChange={e => setF({ ...f, request_kind: e.target.value })}><option value="leave">Đơn xin nghỉ phép</option><option value="overtime">Đăng ký tăng ca (OT)</option></select></label>
    {f.request_kind === 'leave' && <label>Loại phép<select value={f.leave_type_id} onChange={e => setF({ ...f, leave_type_id: e.target.value })}>{types.map(t => <option key={t.id} value={t.id}>{t.leave_name}</option>)}</select></label>}
    <div className="two-col">
      <label>{f.request_kind === 'overtime' ? 'Ngày tăng ca' : 'Từ ngày'}<input type="date" required value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} /></label>
      {f.request_kind === 'leave'
        ? <label>Đến ngày<input type="date" required value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} /></label>
        : <label>Số giờ OT<input type="number" step="0.5" min="0.5" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></label>}
    </div>
    <label>Lý do<textarea required rows={3} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></label>
    <button className="btn primary" disabled={busy}>{busy?'Đang gửi...':'Gửi đơn'}</button>
  </form>;
}

function AdjustmentForm({ done }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ work_date: today, requested_check_in: '08:00', requested_check_out: '17:30', reason: '' });
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit = async e => {
    e.preventDefault();
    setError('');
    if(!isValidDate(f.work_date)){setError('Ngày cần giải trình không hợp lệ.');return}
    if(!isValidTime(f.requested_check_in)||!isValidTime(f.requested_check_out)){setError('Giờ vào hoặc giờ ra không hợp lệ.');return}
    if(f.requested_check_out<=f.requested_check_in){setError('Giờ ra phải sau giờ vào.');return}
    if(String(f.reason||'').trim().length<3){setError('Lý do phải có ít nhất 3 ký tự.');return}
    setBusy(true);
    try{await api('/attendance/adjustments', { method: 'POST', body: JSON.stringify(f) });done('Đã gửi đơn giải trình chấm công.')}
    catch(ex){setError(ex.message||'Không thể gửi giải trình.')}
    finally{setBusy(false)}
  };
  return <form className="form-stack" onSubmit={submit}>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <label>Ngày cần giải trình<input type="date" required value={f.work_date} onChange={e => setF({ ...f, work_date: e.target.value })} /></label>
    <div className="two-col">
      <label>Giờ vào thực tế<input type="time" required value={f.requested_check_in} onChange={e => setF({ ...f, requested_check_in: e.target.value })} /></label>
      <label>Giờ ra thực tế<input type="time" required value={f.requested_check_out} onChange={e => setF({ ...f, requested_check_out: e.target.value })} /></label>
    </div>
    <label>Lý do<textarea required rows={3} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="VD: Quên chấm công sáng / đi gặp khách hàng..." /></label>
    <button className="btn primary" disabled={busy}>{busy?'Đang gửi...':'Gửi giải trình'}</button>
  </form>;
}
