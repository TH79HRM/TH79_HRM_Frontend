import { useEffect, useRef, useState } from 'react';
import {
  Camera, CameraOff, CheckCircle2, Fingerprint, QrCode, ScanFace,
  ShieldCheck, TriangleAlert, Upload, Keyboard
} from 'lucide-react';
import { api } from '../lib/api';
import {
  decodeQrFromSource, detectFace, extractFaceDescriptor, isWebAuthnAvailable,
  methodLabel, verifyWebAuthnFingerprint
} from '../lib/biometrics';
import { initials } from '../lib/format';

export default function BiometricScanner({
  shifts = [],
  employees = [],
  biometrics = [],
  defaultMethod = 'face',
  kioskMode = false,
  onSuccess,
  restrictToEmployeeId = null
}) {
  const [method, setMethod] = useState(defaultMethod);
  const [shiftId, setShiftId] = useState('');
  const [action, setAction] = useState('auto');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [autoQrScan, setAutoQrScan] = useState(true);
  const [badgeInput, setBadgeInput] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState(restrictToEmployeeId ? String(restrictToEmployeeId) : '');
  const [fingerHold, setFingerHold] = useState(false);
  const [webAuthnReady, setWebAuthnReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [faceScanStatus, setFaceScanStatus] = useState('Bật camera để bắt đầu quét.');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const qrLockRef = useRef(false);
  const faceScanLockRef = useRef(false);
  const faceScanInFlightRef = useRef(false);
  const previousFaceRef = useRef(null);
  const stableFaceFramesRef = useRef(0);

  useEffect(() => {
    isWebAuthnAvailable().then(setWebAuthnReady);
  }, []);

  useEffect(() => {
    if (shifts.length && !shiftId) {
      const def = shifts.find(s => Number(s.is_default) === 1) || shifts[0];
      if (def) setShiftId(String(def.id));
    }
  }, [shifts, shiftId]);

  useEffect(() => {
    if (restrictToEmployeeId) setSelectedEmpId(String(restrictToEmployeeId));
  }, [restrictToEmployeeId]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setError('');
    faceScanLockRef.current = false;
    previousFaceRef.current = null;
    stableFaceFramesRef.current = 0;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Camera trực tiếp.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      if (method === 'face') setFaceScanStatus('Đang tải mô hình nhận diện...');
    } catch (err) {
      setCameraError(err.message || 'Không mở được Camera.');
      setCameraOn(false);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Switching scanner modes replaces its video element.
  useEffect(() => {
    stopCamera();
    setError('');
  }, [method]);

  // Continuous QR scanner loop when camera is active on Badge tab
  useEffect(() => {
    if (!cameraOn || method !== 'badge' || !autoQrScan) return;
    const timer = setInterval(async () => {
      if (qrLockRef.current || busy || !videoRef.current) return;
      const decoded = await decodeQrFromSource(videoRef.current);
      if (decoded) {
        qrLockRef.current = true;
        setBadgeInput(decoded);
        await submitScan({ method: 'badge', badge_code: decoded });
        setTimeout(() => { qrLockRef.current = false; }, 3000);
      }
    }, 550);
    return () => clearInterval(timer);
  }, [cameraOn, method, autoQrScan, busy, shiftId, action]);

  const submitScan = async payload => {
    setBusy(true);
    setError('');
    try {
      const res = await api('/attendance/scan', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          shift_id: shiftId || undefined,
          action,
          device: kioskMode ? 'Kiosk Reception Terminal' : 'HRM Web Scanner'
        })
      });
      setResult(res);
      onSuccess?.(res);
      return res;
    } catch (err) {
      setError(err.message || 'Chấm công thất bại.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!cameraOn || method !== 'face') return undefined;
    let active = true;

    const scanFaceFrame = async () => {
      if (!videoRef.current || busy || faceScanInFlightRef.current || faceScanLockRef.current) return;
      faceScanInFlightRef.current = true;
      try {
        const detection = await detectFace(videoRef.current);
        if (!active) return;
        if (detection.status !== 'ready') {
          stableFaceFramesRef.current = 0;
          previousFaceRef.current = null;
          const prompts = {
            'no-face': 'Đưa khuôn mặt vào chính giữa khung hình.',
            'multiple-faces': 'Chỉ để một khuôn mặt trong khung hình.',
            'low-quality': 'Tăng ánh sáng và nhìn thẳng vào camera.'
          };
          setFaceScanStatus(prompts[detection.status] || 'Đang tìm khuôn mặt...');
          return;
        }

        const [x, y, width, height] = detection.faceBox;
        const [frameWidth, frameHeight] = detection.frameSize;
        const centerX = (x + width / 2) / frameWidth;
        const centerY = (y + height / 2) / frameHeight;
        const widthRatio = width / frameWidth;
        const inGuide = Math.abs(centerX - 0.5) <= 0.18
          && Math.abs(centerY - 0.46) <= 0.24
          && widthRatio >= 0.14
          && widthRatio <= 0.62;

        if (!inGuide) {
          stableFaceFramesRef.current = 0;
          previousFaceRef.current = null;
          setFaceScanStatus('Căn khuôn mặt vào giữa khung và giữ khoảng cách vừa phải.');
          return;
        }

        const previous = previousFaceRef.current;
        const stable = previous
          && Math.abs(centerX - previous.centerX) < 0.04
          && Math.abs(centerY - previous.centerY) < 0.05
          && Math.abs(widthRatio - previous.widthRatio) < 0.06;
        stableFaceFramesRef.current = stable ? stableFaceFramesRef.current + 1 : 1;
        previousFaceRef.current = { centerX, centerY, widthRatio };
        setFaceScanStatus(`Đã căn đúng — giữ nguyên (${stableFaceFramesRef.current}/3).`);

        if (stableFaceFramesRef.current >= 3) {
          faceScanLockRef.current = true;
          setFaceScanStatus('Đang xác minh khuôn mặt và ghi nhận chấm công...');
          const response = await submitScan({
            method: 'face',
            descriptor: detection.descriptor,
            employee_id: restrictToEmployeeId ? Number(restrictToEmployeeId) : undefined
          });
          if (response) stopCamera();
          else setFaceScanStatus('Chưa xác minh được. Tắt rồi bật camera để quét lại.');
        }
      } catch (err) {
        if (!active) return;
        faceScanLockRef.current = true;
        setError(err.message || 'Không thể nhận diện khuôn mặt.');
        setFaceScanStatus('Không thể tải hoặc chạy mô hình nhận diện.');
      } finally {
        faceScanInFlightRef.current = false;
      }
    };

    const timer = setInterval(scanFaceFrame, 500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [cameraOn, method, busy, restrictToEmployeeId, shiftId, action, kioskMode, onSuccess]);

  const handleBadgeImageUpload = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const decoded = await decodeQrFromSource(img);
        if (!decoded) {
          setError('Không tìm thấy mã QR hợp lệ trên ảnh bảng tên vừa tải lên.');
        } else {
          setBadgeInput(decoded);
          await submitScan({ method: 'badge', badge_code: decoded });
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Không đọc được file ảnh.');
    };
    img.src = url;
  };

  const handleBadgeSubmit = async e => {
    e.preventDefault();
    const val = badgeInput.trim();
    if (!val && !selectedEmpId) {
      setError('Vui lòng nhập hoặc quét mã bảng tên / mã nhân viên.');
      return;
    }
    await submitScan({
      method: 'badge',
      badge_code: val || undefined,
      employee_id: !val && selectedEmpId ? Number(selectedEmpId) : undefined
    });
  };

  const handleFingerprintTouch = async () => {
    setFingerHold(true);
    setError('');
    setTimeout(async () => {
      setFingerHold(false);
      if (selectedEmpId) {
        const bio = biometrics.find(b => Number(b.employee_id) === Number(selectedEmpId));
        await submitScan({
          method: 'fingerprint',
          employee_id: Number(selectedEmpId),
          fingerprint_token: bio?.fingerprint_template || undefined
        });
        return;
      }
      if (webAuthnReady) {
        try {
          const allowIds = biometrics.map(b => b.webauthn_credential_id).filter(Boolean);
          const { credential_id } = await verifyWebAuthnFingerprint(allowIds);
          await submitScan({ method: 'fingerprint', credential_id });
          return;
        } catch (err) {
          setError(err.message);
          return;
        }
      }
      setError('Vui lòng chọn nhân viên đã đăng ký vân tay bên dưới để chạm cảm biến chấm công.');
    }, 650);
  };

  const fpEnrolledList = biometrics.filter(b => b.fingerprint_enrolled);
  const activeList = employees.length ? employees : biometrics;

  return <div className={`scanner-shell ${kioskMode ? 'is-kiosk' : ''}`}>
    <div className="scanner-mode-tabs" role="tablist" aria-label="Phương thức chấm công">
      <button type="button" className={method === 'face' ? 'active' : ''} onClick={() => setMethod('face')}>
        <ScanFace size={18} />
        <div><strong>Quét khuôn mặt</strong><small>Tự căn chỉnh & chụp</small></div>
      </button>
      <button type="button" className={method === 'badge' ? 'active' : ''} onClick={() => setMethod('badge')}>
        <QrCode size={18} />
        <div><strong>Quét bảng tên</strong><small>QR / Barcode / Mã NV</small></div>
      </button>
      <button type="button" className={method === 'fingerprint' ? 'active' : ''} onClick={() => setMethod('fingerprint')}>
        <Fingerprint size={18} />
        <div><strong>Dấu vân tay</strong><small>Cảm biến / Windows Hello</small></div>
      </button>
    </div>

    <div className="scanner-toolbar">
      <label>
        <span>Ca làm việc</span>
        <select value={shiftId} onChange={e => setShiftId(e.target.value)}>
          {shifts.map(s => (
            <option key={s.id} value={s.id}>{s.shift_name} ({s.start_time} - {s.end_time})</option>
          ))}
        </select>
      </label>
      <label>
        <span>Chế độ lượt chấm</span>
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="auto">Tự động (Vào / Ra)</option>
          <option value="check_in">Check-in (Vào ca)</option>
          <option value="check_out">Check-out (Tan ca)</option>
        </select>
      </label>
    </div>

    {method === 'face' && <div className="scanner-stage">
      <div className={`camera-viewport ${cameraOn ? 'live' : ''}`}>
        <video ref={videoRef} muted playsInline style={{ display: cameraOn ? 'block' : 'none' }} />
        {!cameraOn && <div className="camera-standby">
          <ScanFace size={48} />
          <strong>Camera nhận diện khuôn mặt</strong>
          <p>{cameraError || 'Bật camera; hệ thống sẽ tự phát hiện và chụp khi khuôn mặt rõ, ở giữa khung hình và ổn định.'}</p>
        </div>}
        {cameraOn && <div className="face-guide-overlay">
          <div className="face-ring"><span className="scan-beam" /></div>
          <small role="status" aria-live="polite">{faceScanStatus}</small>
        </div>}
      </div>

      <div className="scanner-controls">
        {!cameraOn
          ? <button type="button" className="btn primary" onClick={startCamera}><Camera size={16} /> Bật Camera</button>
          : <button type="button" className="btn ghost" onClick={stopCamera}><CameraOff size={16} /> Dừng quét</button>}
        <span className="face-scan-note">Ảnh xử lý tại trình duyệt; vector khuôn mặt được gửi lên máy chủ để đối chiếu. Không thể đảm bảo chính xác tuyệt đối 100%.</span>
      </div>
    </div>}

    {method === 'badge' && <div className="scanner-stage">
      <div className={`camera-viewport compact ${cameraOn ? 'live' : ''}`}>
        <video ref={videoRef} muted playsInline style={{ display: cameraOn ? 'block' : 'none' }} />
        {!cameraOn && <div className="camera-standby">
          <QrCode size={44} />
          <strong>Máy quét Bảng tên & Thẻ QR / Barcode</strong>
          <p>{cameraError || 'Đưa thẻ nhân viên có mã QR trước Camera hoặc quét bằng máy đọc mã vạch / nhập mã nhân viên.'}</p>
        </div>}
        {cameraOn && <div className="qr-guide-overlay" aria-hidden="true">
          <div className="qr-box"><span className="scan-beam" /></div>
          <small>{autoQrScan ? 'Đang tự động dò mã QR trên bảng tên...' : 'Camera sẵn sàng'}</small>
        </div>}
      </div>

      <div className="scanner-controls">
        {!cameraOn
          ? <button type="button" className="btn primary" onClick={startCamera}><Camera size={16} /> Mở Camera quét QR</button>
          : <button type="button" className="btn ghost" onClick={stopCamera}><CameraOff size={16} /> Tắt Camera</button>}
        <label className="btn ghost upload-btn">
          <Upload size={16} /> Tải ảnh thẻ QR
          <input type="file" accept="image/*" hidden onChange={handleBadgeImageUpload} />
        </label>
        {cameraOn && <label className="inline-toggle">
          <input type="checkbox" checked={autoQrScan} onChange={e => setAutoQrScan(e.target.checked)} />
          <span>Tự động quét liên tục</span>
        </label>}
      </div>

      <form className="badge-input-form" onSubmit={handleBadgeSubmit}>
        <div className="search-box">
          <Keyboard size={16} />
          <input
            value={badgeInput}
            onChange={e => setBadgeInput(e.target.value)}
            placeholder="Quét đầu đọc mã vạch hoặc nhập mã bảng tên (VD: TH79-NV0001)..."
            autoFocus={method === 'badge'}
          />
        </div>
        <button className="btn primary" disabled={busy}><QrCode size={16} /> {busy ? 'Đang xử lý...' : 'Xác nhận thẻ'}</button>
      </form>

      {!restrictToEmployeeId && <div className="scanner-assist-box">
        <div className="assist-head">
          <QrCode size={15} />
          <span>Hoặc chọn nhanh bảng tên nhân viên để quét thử</span>
        </div>
        <div className="assist-row">
          <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
            <option value="">-- Chọn nhân viên để quét bảng tên --</option>
            {activeList.map(emp => {
              const id = emp.employee_id || emp.id;
              return <option key={id} value={id}>{emp.employee_code} · {emp.full_name}</option>;
            })}
          </select>
          <button
            type="button"
            className="btn ghost small"
            disabled={busy || !selectedEmpId}
            onClick={() => submitScan({ method: 'badge', employee_id: Number(selectedEmpId) })}
          >
            Quét thẻ NV này
          </button>
        </div>
      </div>}
    </div>}

    {method === 'fingerprint' && <div className="scanner-stage">
      <div className="fingerprint-stage">
        <button
          type="button"
          className={`fingerprint-pad ${fingerHold ? 'scanning' : ''} ${busy ? 'busy' : ''}`}
          onClick={handleFingerprintTouch}
          disabled={busy}
        >
          <span className="fp-ripple" />
          <Fingerprint size={64} />
          <strong>{fingerHold ? 'Đang đọc vân tay...' : busy ? 'Đang đối chiếu...' : 'Chạm vào cảm biến vân tay'}</strong>
          <small>{webAuthnReady ? 'Hỗ trợ Windows Hello / Touch ID & Cảm biến quang học' : 'Cảm biến sinh trắc học quang học'}</small>
        </button>
      </div>

      {!restrictToEmployeeId && <div className="scanner-assist-box">
        <div className="assist-head">
          <Fingerprint size={15} />
          <span>Nhân viên đặt ngón tay lên cảm biến ({fpEnrolledList.length} NV đã đăng ký vân tay)</span>
        </div>
        <div className="assist-row">
          <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
            <option value="">-- Chọn nhân viên (hoặc dùng Windows Hello) --</option>
            {activeList.map(emp => {
              const id = emp.employee_id || emp.id;
              const bio = biometrics.find(b => Number(b.employee_id) === Number(id));
              return <option key={id} value={id}>
                {emp.employee_code} · {emp.full_name} {bio?.fingerprint_enrolled ? `✓ ${bio.fingerprint_label || 'Đã đăng ký'}` : '(Chưa đăng ký)'}
              </option>;
            })}
          </select>
          <button
            type="button"
            className="btn primary small"
            disabled={busy || (!selectedEmpId && !webAuthnReady)}
            onClick={handleFingerprintTouch}
          >
            <Fingerprint size={15} /> Quét vân tay
          </button>
        </div>
      </div>}
    </div>}

    {error && <div className="scanner-feedback error" role="alert">
      <TriangleAlert size={18} />
      <span>{error}</span>
    </div>}

    {result && <div className="scanner-feedback success" role="status">
      <div className="scan-emp-avatar">
        {initials(result.employee?.full_name)}
      </div>
      <div className="scan-emp-copy">
        <div className="scan-emp-top">
          <strong>{result.employee?.full_name}</strong>
          <span className="scan-action-pill">{result.action === 'check_in' ? 'CHECK-IN' : 'CHECK-OUT'}</span>
        </div>
        <small>
          {result.employee?.employee_code} · {result.employee?.position_name || 'Nhân viên'} · Phương thức: {methodLabel(result.method)} ({result.confidence}%)
        </small>
        <p><CheckCircle2 size={15} /> {result.message}</p>
      </div>
      <div className="scan-confidence">
        <ShieldCheck size={16} />
        <strong>{result.action === 'check_in' ? result.record?.check_in_label : result.record?.check_out_label}</strong>
      </div>
    </div>}
  </div>;
}
