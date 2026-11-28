import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/ui';

export default function ChangePassword() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const trimmedNew = form.new_password.trim();
  const trimmedConfirm = form.confirm_password.trim();
  const trimmedCurrent = form.current_password.trim();

  const rules = [
    { ok: trimmedNew.length >= 8 && trimmedNew.length <= 72, label: 'Độ dài từ 8 đến 72 ký tự' },
    { ok: Boolean(trimmedNew) && trimmedNew !== trimmedCurrent, label: 'Khác mật khẩu hiện tại' },
    { ok: Boolean(trimmedConfirm) && trimmedNew === trimmedConfirm, label: 'Khớp với mật khẩu xác nhận' }
  ];

  const trimField = key => setForm(prev => ({ ...prev, [key]: String(prev[key] || '').trim() }));

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setSuccess('');

    const current_password = String(form.current_password || '').trim();
    const new_password = String(form.new_password || '').trim();
    const confirm_password = String(form.confirm_password || '').trim();
    setForm({ current_password, new_password, confirm_password });

    if (!current_password) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (new_password.length < 8 || new_password.length > 72) {
      setError('Mật khẩu mới phải có từ 8 đến 72 ký tự.');
      return;
    }
    if (current_password === new_password) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }
    if (new_password !== confirm_password) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setBusy(true);
    try {
      const result = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password, new_password })
      });
      if (result.token) localStorage.setItem('th79_token', result.token);
      if (result.user) {
        localStorage.setItem('th79_user', JSON.stringify(result.user));
        setUser(result.user);
      }
      setSuccess('Đổi mật khẩu thành công! Đang chuyển hướng...');
      setTimeout(() => navigate('/', { replace: true }), 450);
    } catch (ex) {
      setError(ex.message || 'Không thể đổi mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <PageHeader
      eyebrow="BẢO MẬT TÀI KHOẢN"
      title="Đổi mật khẩu"
      subtitle="Đặt mật khẩu riêng tư, tối thiểu 8 ký tự. Khoảng trắng đầu/cuối sẽ được tự động loại bỏ."
    />

    <div className="change-password-layout">
      <form className="card change-password-card" onSubmit={submit}>
        <div className="change-password-head">
          <span className="change-password-badge"><ShieldCheck size={20} /></span>
          <div>
            <h3>Cập nhật mật khẩu đăng nhập</h3>
            <p>Các phiên đăng nhập cũ sẽ tự động được làm mới sau khi lưu.</p>
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        {success && <div className="form-success" role="status"><CheckCircle2 size={16} /><span>{success}</span></div>}

        <div className="form-stack">
          <label>
            Mật khẩu hiện tại
            <div className="password-field-wrap">
              <LockKeyhole size={16} className="field-lead-icon" />
              <input
                type={show.current ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="Nhập mật khẩu hiện tại"
                value={form.current_password}
                onChange={e => setForm({ ...form, current_password: e.target.value })}
                onBlur={() => trimField('current_password')}
              />
              <button type="button" className="password-eye-btn" onClick={() => setShow(s => ({ ...s, current: !s.current }))} aria-label="Hiện/ẩn mật khẩu hiện tại">
                {show.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label>
            Mật khẩu mới
            <div className="password-field-wrap">
              <KeyRound size={16} className="field-lead-icon" />
              <input
                type={show.next ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                value={form.new_password}
                onChange={e => setForm({ ...form, new_password: e.target.value })}
                onBlur={() => trimField('new_password')}
              />
              <button type="button" className="password-eye-btn" onClick={() => setShow(s => ({ ...s, next: !s.next }))} aria-label="Hiện/ẩn mật khẩu mới">
                {show.next ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label>
            Xác nhận mật khẩu mới
            <div className="password-field-wrap">
              <KeyRound size={16} className="field-lead-icon" />
              <input
                type={show.confirm ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                placeholder="Nhập lại mật khẩu mới"
                value={form.confirm_password}
                onChange={e => setForm({ ...form, confirm_password: e.target.value })}
                onBlur={() => trimField('confirm_password')}
              />
              <button type="button" className="password-eye-btn" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))} aria-label="Hiện/ẩn xác nhận mật khẩu">
                {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        </div>

        <ul className="password-rules">
          {rules.map(rule => (
            <li key={rule.label} className={rule.ok ? 'ok' : ''}>
              <CheckCircle2 size={14} />
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>

        <div className="change-password-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            <span>{busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</span>
          </button>
        </div>
      </form>
    </div>
  </>;
}
