import { useEffect, useRef, useState } from 'react';
import { Printer, Download, ShieldCheck, Building2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateQrDataUrl } from '../lib/biometrics';
import { initials } from '../lib/format';

export default function EmployeeBadgeCard({ employee, badgeCode, qrPayload, faceImage, showActions = true }) {
  const cardRef = useRef(null);
  const [qrUrl, setQrUrl] = useState('');
  const codeText = badgeCode || employee?.employee_code || `TH79-NV${String(employee?.id || 0).padStart(4, '0')}`;
  const payload = qrPayload || `TH79|EMP|${employee?.id || ''}|${codeText}`;

  useEffect(() => {
    let alive = true;
    generateQrDataUrl(payload).then(url => {
      if (alive) setQrUrl(url);
    }).catch(() => {});
    return () => { alive = false; };
  }, [payload]);

  const downloadPng = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `BangTen_${codeText}.png`;
    a.click();
  };

  const printCard = () => {
    window.print();
  };

  // Deterministic visual barcode bars from employee code
  const bars = codeText.split('').flatMap((ch, idx) => {
    const n = ch.charCodeAt(0);
    return [((n + idx) % 3) + 1, ((n >> 1) % 2) + 1, ((n >> 2) % 3) + 1];
  });

  return <div className="badge-card-wrapper">
    <div className="employee-id-badge" ref={cardRef}>
      <div className="badge-top-stripe">
        <div className="badge-company">
          <img src="/assets/images/logo-th79.png" alt="T&H 79" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <strong>CÔNG TY TNHH ĐẦU TƯ T&H 79</strong>
            <small>THẺ NHÂN VIÊN / BẢNG TÊN ĐIỆN TỬ</small>
          </div>
        </div>
        <span className="badge-verified"><ShieldCheck size={14} /> SMART ID</span>
      </div>

      <div className="badge-body">
        <div className="badge-photo">
          {faceImage
            ? <img src={faceImage} alt={employee?.full_name} />
            : <span>{initials(employee?.full_name)}</span>}
        </div>
        <div className="badge-identity">
          <h3>{employee?.full_name || 'Nhân viên T&H 79'}</h3>
          <p className="badge-role">{employee?.position_name || 'Nhân sự nội bộ'}</p>
          <div className="badge-meta">
            <span><Building2 size={13} /> {employee?.branch_name || 'Trụ sở chính'}</span>
            {employee?.department_name && <span>· {employee.department_name}</span>}
          </div>
          <div className="badge-code-pill">MÃ THẺ: <strong>{codeText}</strong></div>
        </div>
        <div className="badge-qr-box">
          {qrUrl ? <img src={qrUrl} alt={`QR ${codeText}`} /> : <div className="qr-placeholder" />}
          <small>Quét chấm công</small>
        </div>
      </div>

      <div className="badge-barcode-footer">
        <div className="visual-barcode" aria-hidden="true">
          {bars.map((w, i) => <span key={i} style={{ width: `${w * 2}px`, opacity: i % 2 === 0 ? 1 : 0.25 }} />)}
        </div>
        <span>{payload}</span>
      </div>
    </div>

    {showActions && <div className="badge-card-actions">
      <button type="button" className="btn ghost small" onClick={printCard}><Printer size={15} /> In bảng tên</button>
      <button type="button" className="btn primary small" onClick={downloadPng}><Download size={15} /> Tải ảnh thẻ PNG</button>
    </div>}
  </div>;
}
