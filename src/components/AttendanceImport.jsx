import { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert, UploadCloud } from 'lucide-react';
import { api } from '../lib/api';

export default function AttendanceImport({ onComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const downloadTemplate = async () => {
    setError('');
    try {
      const blob = await api('/attendance/import/template');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'TH79_Mau_Import_ChamCong.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || 'Không tải được file mẫu.');
    }
  };

  const inspectFile = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      setPreview(await api('/attendance/import/preview', { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message || 'Không đọc được file chấm công.');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const importRows = async () => {
    const rows = (preview?.preview || []).filter(row => !row.errors.length);
    if (!rows.length) return;
    setBusy(true);
    setError('');
    try {
      const imported = await api('/attendance/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      setResult(imported);
      setPreview(null);
      setFile(null);
      try {
        await onComplete?.();
      } catch (err) {
        setError(`Đã ghi dữ liệu nhưng không tải lại được bảng công: ${err.message}`);
      }
    } catch (err) {
      const rowErrors = err.payload?.errors?.map(item => `Dòng ${item.row}: ${item.errors.join(', ')}`).join('; ');
      setError(rowErrors || err.message || 'Không thể ghi dữ liệu chấm công.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="card attendance-import-card">
    <div className="card-head">
      <div>
        <h3>Nhập kết quả từ máy chấm công</h3>
        <p>Chọn báo cáo CSV/Excel đã xuất từ máy, kiểm tra trước rồi mới ghi vào bảng công.</p>
      </div>
      <button type="button" className="btn ghost small" onClick={downloadTemplate} disabled={busy}>
        <Download size={15} /> Tải file mẫu
      </button>
    </div>

    <div className="attendance-import-guide">
      File cần có mã nhân viên, ngày công, giờ vào và có thể có giờ ra. Dòng trùng mã nhân viên/ngày sẽ được báo lỗi;
      dữ liệu hợp lệ trùng ngày công hiện có sẽ cập nhật bản ghi đó.
    </div>

    <div className="attendance-import-actions">
      <label className="attendance-import-file">
        <FileSpreadsheet size={18} />
        <span>{file?.name || 'Chọn file .csv, .xls hoặc .xlsx'}</span>
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={event => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
            setResult(null);
            setError('');
          }}
        />
      </label>
      <button type="button" className="btn primary" disabled={!file || busy} onClick={inspectFile}>
        <UploadCloud size={16} /> {busy ? 'Đang đọc...' : 'Kiểm tra dữ liệu'}
      </button>
    </div>

    {error && <div className="scanner-feedback error" role="alert">
      <TriangleAlert size={18} /><span>{error}</span>
    </div>}

    {result && <div className="scanner-feedback success" role="status">
      <CheckCircle2 size={18} />
      <span>Đã ghi {result.created} dòng mới, cập nhật {result.updated} dòng.{result.errors?.length ? ` Có ${result.errors.length} dòng lỗi.` : ''}</span>
    </div>}
    {result?.errors?.length > 0 && <ul className="attendance-import-result-errors">
      {result.errors.map(item => <li key={`${item.row}-${item.message}`}>Dòng {item.row}: {item.message}</li>)}
    </ul>}

    {preview && <div className="attendance-import-preview">
      <div className="attendance-import-summary">
        <span><strong>{preview.summary.total}</strong> tổng dòng</span>
        <span className="success-text"><strong>{preview.summary.valid}</strong> hợp lệ</span>
        <span className="error-text"><strong>{preview.summary.errors}</strong> lỗi</span>
        <span><strong>{preview.summary.update}</strong> bản ghi sẽ cập nhật</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Dòng</th><th>Mã NV</th><th>Nhân viên</th><th>Ngày</th><th>Vào</th><th>Ra</th><th>Kiểm tra</th></tr></thead>
          <tbody>
            {preview.preview.slice(0, 100).map(row => <tr key={row.row}>
              <td>{row.row}</td>
              <td>{row.employee_code || '—'}</td>
              <td>{row.full_name || '—'}</td>
              <td>{row.work_date || '—'}</td>
              <td>{row.check_in_time || '—'}</td>
              <td>{row.check_out_time || '—'}</td>
              <td>{row.errors.length
                ? <span className="error-text">{row.errors.join(', ')}</span>
                : <span className="success-text">{row.action === 'update' ? 'Sẽ cập nhật' : 'Sẽ thêm mới'}</span>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {preview.preview.length > 100 && <p className="attendance-import-limit">Chỉ hiển thị 100 dòng đầu; sẽ nhập toàn bộ dòng hợp lệ.</p>}
      <div className="attendance-import-confirm">
        <span>Các dòng lỗi được bỏ qua; dòng cập nhật sẽ thay thế giờ vào/ra đang lưu.</span>
        <button type="button" className="btn primary" disabled={!preview.summary.valid || busy} onClick={importRows}>
          {busy ? 'Đang ghi...' : `Ghi ${preview.summary.valid} dòng hợp lệ`}
        </button>
      </div>
    </div>}
  </section>;
}
