# backend/Dockerfile
# Python 3.11 기반 Django 백엔드 컨테이너 이미지
FROM python:3.11-slim

# 작업 디렉토리 생성 및 이동
WORKDIR /app

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.development

# 의존성 파일 복사 및 설치
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# 포트 오픈
EXPOSE 8000

# 마이그레이션 및 서버 실행 (개발용)
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
