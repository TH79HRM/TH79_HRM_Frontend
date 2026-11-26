import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, UploadCloud, CheckCircle2, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge } from '../components/ui';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function EmployeeImport() {
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const template = async () => {
    setError('');
    try {
      const blob = await api('/employees/import/template');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'TH79_Mau_Import_NhanSu.xlsx';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (ex) {
      setError(ex.message || 'Không thể tải file mẫu.');
    }
  };

  const chooseFile = event => {
    const selected = event.target.files?.[0] || null;
    setError('');
    setPreview(null);
    if (selected && selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('File không được vượt quá 10 MB.');
      return;
    }
    if (selected && !/\.xlsx?$/i.test(selected.name)) {
      setFile(null);
      setError('Chỉ hỗ trợ file XLS hoặc XLSX.');
      return;
    }
    setFile(selected);
  };

  const inspect = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      setPreview(await api('/employees/import/preview', { method: 'POST', body: formData }));
    } catch (ex) {
      setError(ex.message || 'Không thể kiểm tra file.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview?.summary?.valid) return;
    setBusy(true);
    setError('');
    try {
      setDone(await api('/employees/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows: preview.preview })
      }));
    } catch (ex) {
      setError(ex.message || 'Không thể import dữ liệu.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <PageHeader
      eyebrow="SMART EXCEL IMPORT"
      title="Cập nhật nhân sự bằng Excel"
      subtitle="Upload → kiểm tra trước → xác nhận ghi MongoDB. Không ghi dữ liệu ngay khi vừa chọn file."
      actions={<>
        <button type="button" className="btn ghost" onClick={() => nav('/employees')}><ArrowLeft size={18} /> Quay lại</button>
        <button type="button" className="btn ghost" onClick={template}><Download size={18} /> File mẫu</button>
      </>}
    />
    {error && <div className="form-error" role="alert">{error}</div>}
    {done ? <section className="card success-panel">
      <CheckCircle2 size={44} />
      <h2>Import hoàn tất</h2>
      <p>{done.created} nhân viên mới · {done.updated} hồ sơ được cập nhật.</p>
      <button className="btn primary" onClick={() => nav('/employees')}>Về danh sách nhân sự</button>
    </section> : <section className="card import-card">
      <div className="upload-zone">
        <UploadCloud size={40} />
        <h3>Chọn file Excel</h3>
        <p>Hỗ trợ XLS/XLSX tối đa 10 MB, 2.000 dòng. Hệ thống sẽ preview trước khi ghi dữ liệu.</p>
        <input type="file" accept=".xlsx,.xls" onChange={chooseFile} />
        {file && <strong>{file.name}</strong>}
        <button type="button" className="btn primary" disabled={!file || busy} onClick={inspect}>
          {busy ? 'Đang đọc file...' : 'Kiểm tra dữ liệu'}
        </button>
      </div>
      {preview && <div className="preview-area">
        <div className="preview-summary">
          <span><b>{preview.summary.total}</b> Tổng dòng</span>
          <span className="ok"><b>{preview.summary.valid}</b> Hợp lệ</span>
          <span className="bad"><b>{preview.summary.errors}</b> Có lỗi</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Dòng</th><th>Thao tác</th><th>Mã NV</th><th>Họ tên</th><th>Điện thoại</th><th>Trạng thái kiểm tra</th></tr></thead>
            <tbody>{preview.preview.map(row => <tr key={row.row}>
              <td>{row.row}</td>
              <td><Badge value={row.action === 'create' ? 'Mới' : 'Cập nhật'} tone={row.action === 'create' ? 'success' : 'neutral'} /></td>
              <td>{row.data.employee_code || 'Tự sinh'}</td>
              <td><strong>{row.data.full_name || '—'}</strong></td>
              <td>{row.data.phone || '—'}</td>
              <td>{row.errors.length
                ? <span className="error-text"><TriangleAlert size={15} />{row.errors.join(', ')}</span>
                : <span className="success-text"><CheckCircle2 size={15} />Hợp lệ</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="confirm-bar">
          <div><strong>Sẵn sàng ghi {preview.summary.valid} dòng hợp lệ</strong><small>Các dòng có lỗi sẽ bị bỏ qua.</small></div>
          <button type="button" className="btn primary" disabled={!preview.summary.valid || busy} onClick={confirm}>
            {busy ? 'Đang import...' : 'Xác nhận import'}
          </button>
        </div>
      </div>}
    </section>}
  </>;
}
