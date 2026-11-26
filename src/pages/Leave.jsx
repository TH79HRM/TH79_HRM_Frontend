import { useEffect, useState } from 'react';
import { CalendarOff, Check, Clock, Plus, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Empty, Loading, Modal, PageHeader, StatCard, Toast } from '../components/ui';
import { fmtDate } from '../lib/format';
import { useAuth } from '../hooks/useAuth';
import { isValidDate,isValidNumber } from '../lib/validation';

export default function Leave() {
  const { has, user } = useAuth();
  const canApprove = has('attendance.manage') || has('employee.update');
  const [requests, setRequests] = useState(null);
  const [types, setTypes] = useState([]);
  const [balance, setBalance] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filterKind, setFilterKind] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => setToast({ message, tone, key: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const load = async () => {
    const [reqRes, typeRes, balRes] = await Promise.all([
      api('/leave/requests'),
      api('/leave/types'),
      api('/leave/balance')
    ]);
    setRequests(reqRes.items || []);
    setTypes(typeRes.items || []);
    setBalance(balRes);
    if (canApprove) {
      api('/employees?limit=100').then(r => setEmployees(r.items || [])).catch(() => {});
    }
  };

  useEffect(() => {
    load().catch(e => notify(e.message, 'error'));
  }, []);

  if (!requests) return <Loading />;

  const review = async (id, status) => {
    try {
      await api(`/leave/requests/${id}/review`, { method: 'POST', body: JSON.stringify({ status }) });
      notify(status === 'approved' ? 'Đã duyệt đơn.' : 'Đã từ chối đơn.');
      await load();
    } catch (e) { notify(e.message, 'error'); }
  };

  const shown = requests.filter(r =>
    (!filterKind || r.request_kind === filterKind) &&
    (!filterStatus || r.status === filterStatus)
  );
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedOt = requests.filter(r => r.request_kind === 'overtime' && r.status === 'approved').reduce((s, r) => s + Number(r.hours || 0), 0);

  return <>
    {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

    <PageHeader
      eyebrow="NGHỈ PHÉP & TĂNG CA"
      title="Quản lý nghỉ phép & làm thêm giờ (OT)"
      subtitle="Theo dõi quỹ phép năm, gửi đơn nghỉ phép / đăng ký tăng ca và phê duyệt tự động đồng bộ vào bảng lương."
      actions={<button className="btn primary" onClick={() => setOpenModal(true)}><Plus size={16} /> Tạo đơn mới</button>}
    />

    <div className="stats-grid four">
      <StatCard icon={CalendarOff} label="Quỹ phép năm" value={`${balance?.remaining_annual ?? 12}/${balance?.annual_quota ?? 12} ngày`} detail={`Đã dùng ${balance?.used_annual ?? 0} ngày`} tone="green" />
      <StatCard icon={Clock} label="Đơn chờ duyệt" value={pendingCount} detail="Nghỉ phép & OT" tone="amber" />
      <StatCard icon={Sparkles} label="Giờ OT đã duyệt" value={`${approvedOt} giờ`} detail="Tự động cộng khi tính lương" tone="violet" />
      <StatCard icon={CalendarOff} label="Tổng số đơn" value={requests.length} detail="Trong hệ thống" tone="blue" />
    </div>

    <section className="card">
      <div className="filters">
        <select value={filterKind} onChange={e => setFilterKind(e.target.value)}>
          <option value="">Tất cả loại đơn</option>
          <option value="leave">Đơn xin nghỉ phép</option>
          <option value="overtime">Đăng ký tăng ca (OT)</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </select>
        <div />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Loại đơn</th>
              <th>Thời gian</th>
              <th>Số ngày / Giờ</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => <tr key={r.id}>
              <td><strong>{r.employee_name || `NV #${r.employee_id}`}</strong><small className="block">{r.employee_code} · {r.branch_name || '—'}</small></td>
              <td>
                <strong>{r.leave_name}</strong>
                <small className="block">{r.request_kind === 'overtime' ? 'Tăng ca OT' : (Number(r.is_paid) === 1 ? 'Có hưởng lương' : 'Không hưởng lương')}</small>
              </td>
              <td>{fmtDate(r.start_date)}{r.end_date && r.end_date !== r.start_date ? ` → ${fmtDate(r.end_date)}` : ''}</td>
              <td><strong>{r.request_kind === 'overtime' ? `${r.hours} giờ` : `${r.total_days} ngày`}</strong></td>
              <td>{r.reason}</td>
              <td><Badge value={r.status} /></td>
              <td>
                {r.status === 'pending' && canApprove && <div className="inline-actions">
                  <button type="button" className="icon-btn success" title="Duyệt" onClick={() => review(r.id, 'approved')}><Check size={16} /></button>
                  <button type="button" className="icon-btn danger" title="Từ chối" onClick={() => review(r.id, 'rejected')}><X size={16} /></button>
                </div>}
              </td>
            </tr>)}
          </tbody>
        </table>
        {!shown.length && <Empty title="Chưa có đơn nghỉ phép hoặc tăng ca" />}
      </div>
    </section>

    <Modal open={openModal} onClose={() => setOpenModal(false)} title="Tạo đơn nghỉ phép / tăng ca">
      <LeaveOrOtForm
        types={types}
        employees={employees}
        canChooseEmployee={canApprove}
        defaultEmployeeId={user?.employee_id}
        done={async msg => { setOpenModal(false); notify(msg); await load(); }}
      />
    </Modal>
  </>;
}

function LeaveOrOtForm({ types, employees, canChooseEmployee, defaultEmployeeId, done }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    employee_id: defaultEmployeeId || employees[0]?.id || '',
    request_kind: 'leave',
    leave_type_id: types[0]?.id || 1,
    start_date: today,
    end_date: today,
    hours: 2,
    reason: ''
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setErr('');
    if (!isValidDate(f.start_date) || !isValidDate(f.request_kind === 'overtime' ? f.start_date : f.end_date)) {
      setErr('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.');
      return;
    }
    if (f.request_kind === 'leave' && f.end_date < f.start_date) {
      setErr('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
      return;
    }
    if (f.request_kind === 'overtime' && (!isValidNumber(f.hours,{min:0.5,max:12}) || Number(f.hours)*2%1!==0)) {
      setErr('Số giờ OT phải từ 0,5 đến 12 giờ và theo bước 0,5 giờ.');
      return;
    }
    if (String(f.reason||'').trim().length < 3) {
      setErr('Lý do phải có ít nhất 3 ký tự.');
      return;
    }
    setBusy(true);
    try {
      await api('/leave/requests', { method: 'POST', body: JSON.stringify(f) });
      done(f.request_kind === 'overtime' ? 'Đã gửi đăng ký tăng ca (OT).' : 'Đã gửi đơn xin nghỉ phép.');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return <form className="form-stack" onSubmit={submit}>
    {err && <div className="form-error">{err}</div>}
    {canChooseEmployee && <label>
      <span>Nhân viên</span>
      <select required value={f.employee_id} onChange={e => setF({ ...f, employee_id: e.target.value })}>
        <option value="">-- Chọn nhân viên --</option>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.employee_code} · {emp.full_name}</option>)}
      </select>
    </label>}
    <label>
      <span>Loại yêu cầu</span>
      <select value={f.request_kind} onChange={e => setF({ ...f, request_kind: e.target.value })}>
        <option value="leave">Đơn xin nghỉ phép</option>
        <option value="overtime">Đăng ký làm thêm giờ (OT)</option>
      </select>
    </label>
    {f.request_kind === 'leave' && <label>
      <span>Loại nghỉ phép</span>
      <select value={f.leave_type_id} onChange={e => setF({ ...f, leave_type_id: e.target.value })}>
        {types.map(t => <option key={t.id} value={t.id}>{t.leave_name} ({Number(t.is_paid) === 1 ? 'Có lương' : 'Không lương'})</option>)}
      </select>
    </label>}
    <div className="two-col">
      <label>{f.request_kind === 'overtime' ? 'Ngày tăng ca' : 'Từ ngày'}<input type="date" required value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value, end_date: f.request_kind === 'overtime' ? e.target.value : (f.end_date < e.target.value ? e.target.value : f.end_date) })} /></label>
      {f.request_kind === 'leave'
        ? <label>Đến ngày<input type="date" required value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} /></label>
        : <label>Số giờ tăng ca<input type="number" min="0.5" max="12" step="0.5" required value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></label>}
    </div>
    <label>Lý do / Nội dung công việc<textarea required rows={3} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="Nhập lý do nghỉ hoặc đầu việc OT..." /></label>
    <button className="btn primary" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi đơn'}</button>
  </form>;
}
