import React, { useRef, useState } from 'react';

export const FileUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    try {
      // 실제 API 호출은 msw로 mock 처리됨
      await fetch('/api/upload', {
        method: 'POST',
        body: new FormData(),
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div>
      <label htmlFor="file-upload">파일 선택</label>
      <input
        id="file-upload"
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        aria-label="file-upload"
      />
      <button onClick={handleUpload} disabled={!file}>
        업로드
      </button>
      {status === 'uploading' && <span>업로드 중...</span>}
      {status === 'success' && <span>업로드 성공</span>}
      {status === 'error' && <span>업로드 실패</span>}
    </div>
  );
}
