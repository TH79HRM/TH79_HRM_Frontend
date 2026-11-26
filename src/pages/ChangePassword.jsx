import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/ui';

export default function ChangePassword() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (form.new_password.length < 8 || form.new_password.length > 72) {
      setError('Mật khẩu mới phải có từ 8 đến 72 ký tự.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setBusy(true);
    try {
      const result = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: form.current_password,
          new_password: form.new_password
        })
      });
      if (result.token) localStorage.setItem('th79_token', result.token);
      if (result.user) {
        localStorage.setItem('th79_user', JSON.stringify(result.user));
        setUser(result.user);
      }
      navigate('/', { replace: true });
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
      subtitle="Hãy đặt mật khẩu riêng tư, tối thiểu 8 ký tự. Không dùng chung mật khẩu với tài khoản khác."
    />
    <form className="card form-stack" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" required value={form.current_password} onChange={event => setForm({ ...form, current_password: event.target.value })}/></label>
      <label>Mật khẩu mới<div className="input-with-icon"><KeyRound/><input type="password" autoComplete="new-password" minLength="8" maxLength="72" required value={form.new_password} onChange={event => setForm({ ...form, new_password: event.target.value })}/></div></label>
      <label>Xác nhận mật khẩu mới<input type="password" autoComplete="new-password" minLength="8" maxLength="72" required value={form.confirm_password} onChange={event => setForm({ ...form, confirm_password: event.target.value })}/></label>
      <div className="modal-form-actions"><button className="btn primary" disabled={busy}><Save/>{busy ? 'Đang lưu...' : 'Đổi mật khẩu'}</button></div>
    </form>
  </>;
}
