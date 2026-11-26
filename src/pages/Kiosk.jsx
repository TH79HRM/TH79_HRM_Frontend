import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Badge } from '../components/ui';
import { initials } from '../lib/format';
import BiometricScanner from '../components/BiometricScanner';
import { attendanceStatusLabel, methodLabel } from '../lib/biometrics';

export default function Kiosk() {
  const [now, setNow] = useState(new Date());
  const [overview, setOverview] = useState({ shifts: [], recentRecords: [], stats: {} });
  const [biometrics, setBiometrics] = useState([]);

  const load = async () => {
    const [ov, bio] = await Promise.all([
      api('/attendance/overview'),
      api('/attendance/biometrics')
    ]);
    setOverview(ov);
    setBiometrics(bio.items || []);
  };

  useEffect(() => {
    load().catch(() => {});
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return <div className="kiosk-shell">
    <header className="kiosk-header">
      <div className="kiosk-brand">
        <img src="/assets/images/logo-th79.png" alt="T&H 79" />
        <div>
          <span className="eyebrow">TH79 BIOMETRIC ATTENDANCE KIOSK</span>
          <h1>Máy chấm công thông minh T&amp;H 79</h1>
        </div>
      </div>

      <div className="kiosk-clock">
        <strong>{timeStr}</strong>
        <span>{dateStr}</span>
      </div>

      <Link className="btn ghost" to="/attendance"><ArrowLeft size={16} /> Quay lại quản trị</Link>
    </header>

    <main className="kiosk-body">
      <section className="kiosk-scanner-panel card">
        <BiometricScanner
          kioskMode
          shifts={overview.shifts || []}
          biometrics={biometrics}
          onSuccess={() => load()}
        />
      </section>

      <aside className="kiosk-sidebar">
        <section className="card kiosk-stats-card">
          <h3><ShieldCheck size={17} /> Thống kê hôm nay</h3>
          <div className="kiosk-mini-stats">
            <div><small>Đã vào ca</small><strong>{overview.stats?.checked_in || 0}</strong></div>
            <div><small>Đúng giờ</small><strong>{overview.stats?.on_time || 0}</strong></div>
            <div><small>Đi muộn</small><strong>{overview.stats?.late || 0}</strong></div>
            <div><small>Đã ra về</small><strong>{overview.stats?.checked_out || 0}</strong></div>
          </div>
        </section>

        <section className="card kiosk-feed-card">
          <h3><Clock3 size={17} /> Vừa chấm công gần đây</h3>
          <div className="kiosk-feed-list">
            {(overview.recentRecords || []).slice(0, 10).map(r => <div key={r.id} className="kiosk-feed-item">
              <span className="mini-avatar">{initials(r.employee?.full_name)}</span>
              <div>
                <strong>{r.employee?.full_name}</strong>
                <small>{r.employee?.employee_code} · {methodLabel(r.check_in_method)}</small>
              </div>
              <div className="kiosk-feed-right">
                <b>{r.check_out_label || r.check_in_label}</b>
                <Badge value={attendanceStatusLabel(r.status)} tone={r.status === 'present' ? 'success' : 'warning'} />
              </div>
            </div>)}
          </div>
        </section>
      </aside>
    </main>
  </div>;
}
