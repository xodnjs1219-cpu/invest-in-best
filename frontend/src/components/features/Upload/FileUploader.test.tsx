import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUploader } from './FileUploader';
import { server } from '@/mocks/server'; // MSW 서버 임포트
import { http, HttpResponse } from 'msw';
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';

describe('FileUploader', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());
  afterEach(() => server.resetHandlers());

  test('파일 업로드 성공 시 성공 메시지를 보여준다', async () => {
    // Given: MSW로 특정 API 엔드포인트에 대한 응답을 설정
    server.use(
      http.post('/api/upload', () => {
        return HttpResponse.json({ success: true, total_records: 1 });
      })
    );

    render(<FileUploader />); // Provider 래핑 필요
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file-upload/i);
    const button = screen.getByRole('button', { name: /업로드/i });

    // When: 실제 사용자와 유사하게 상호작용
    await userEvent.upload(input, file);
    await userEvent.click(button);

    // Then: API 호출 후 UI에 나타나는 최종 결과를 검증
    expect(await screen.findByText(/업로드 성공/i)).toBeInTheDocument();
  });
});
