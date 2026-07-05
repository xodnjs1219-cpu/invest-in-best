# Railway 배포 가이드

## 📋 목차
1. [사전 준비](#사전-준비)
2. [Railway 프로젝트 생성](#railway-프로젝트-생성)
3. [PostgreSQL 데이터베이스 설정](#postgresql-데이터베이스-설정)
4. [Backend (Django) 배포](#backend-django-배포)
5. [Frontend (React + Vite) 배포](#frontend-react--vite-배포)
6. [환경 변수 설정](#환경-변수-설정)
7. [도메인 설정](#도메인-설정)
8. [배포 확인 및 테스트](#배포-확인-및-테스트)
9. [문제 해결](#문제-해결)

---

## 사전 준비

### 1. Railway 계정 생성
- [Railway.app](https://railway.app) 접속
- GitHub 계정으로 로그인

### 2. GitHub 저장소 준비
```powershell
# Git 저장소 초기화 (아직 안했다면)
git init
git add .
git commit -m "feat: 프로젝트 초기 설정"

# GitHub에 저장소 생성 후 push
git remote add origin <your-repository-url>
git branch -M main
git push -u origin main
```

### 3. 생성된 파일 확인
다음 파일들이 생성되었는지 확인하세요:

**Backend:**
- `backend/Procfile` - Railway 시작 명령어
- `backend/runtime.txt` - Python 버전 지정
- `backend/railway.json` - Railway 빌드 설정
- `backend/nixpacks.toml` - Nixpacks 설정
- `backend/config/settings/production.py` - 프로덕션 설정

**Frontend:**
- `frontend/railway.json` - Railway 빌드 설정
- `frontend/nixpacks.toml` - Nixpacks 설정

---

## Railway 프로젝트 생성

### 1. 새 프로젝트 생성
1. Railway 대시보드에서 **"New Project"** 클릭
2. 프로젝트 이름: `vmc-dashboard` (또는 원하는 이름)

---

## PostgreSQL 데이터베이스 설정

### 1. PostgreSQL 서비스 추가
1. Railway 프로젝트 대시보드에서 **"+ New"** 클릭
2. **"Database"** → **"Add PostgreSQL"** 선택
3. 자동으로 PostgreSQL 인스턴스 생성됨

### 2. 데이터베이스 연결 정보 확인
1. PostgreSQL 서비스 클릭
2. **"Variables"** 탭에서 다음 정보 확인:
   - `DATABASE_URL` (전체 연결 문자열)
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

---

## Backend (Django) 배포

### 1. Backend 서비스 추가
1. Railway 프로젝트에서 **"+ New"** 클릭
2. **"GitHub Repo"** 선택
3. 저장소 선택 후 **"Add variables"** 체크
4. **Root Directory**: `backend` 입력

### 2. 환경 변수 설정
Backend 서비스의 **"Variables"** 탭에서 다음 변수 추가:

```bash
# Django 설정
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False
DJANGO_SECRET_KEY=<강력한-랜덤-키-생성>

# 데이터베이스 (PostgreSQL 서비스에서 자동 제공)
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_ENGINE=django.db.backends.postgresql
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}

# 보안 설정
ALLOWED_HOSTS=<backend-domain>.up.railway.app,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://<frontend-domain>.up.railway.app,http://localhost:5173

# 정적 파일
STATIC_ROOT=/app/staticfiles
```

#### Django Secret Key 생성 방법:
```powershell
# Python으로 생성
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 3. 배포 트리거
- **"Settings"** → **"Triggers"** → **"Deploy Now"** 클릭
- 또는 GitHub에 push하면 자동 배포

### 4. 배포 확인
1. **"Deployments"** 탭에서 빌드 로그 확인
2. 성공하면 **"View Logs"** 에서 애플리케이션 로그 확인
3. **"Settings"** → **"Networking"** 에서 Public URL 확인

### 5. 초기 데이터 설정
Railway 서비스에서 직접 명령어 실행:

1. **"Settings"** → **"Service Variables"** 옆 터미널 아이콘 클릭
2. 다음 명령어 실행:
```bash
# 마이그레이션 (자동 실행되지만 확인용)
python manage.py migrate

# 관리자 계정 생성
python manage.py createsuperuser

# 정적 파일 수집 (자동 실행되지만 확인용)
python manage.py collectstatic --noinput
```

---

## Frontend (React + Vite) 배포

### 1. Frontend 서비스 추가
1. Railway 프로젝트에서 **"+ New"** 클릭
2. **"GitHub Repo"** 선택 (같은 저장소)
3. **Root Directory**: `frontend` 입력

### 2. 환경 변수 설정
Frontend 서비스의 **"Variables"** 탭에서:

```bash
# API 백엔드 URL
VITE_API_BASE_URL=https://<backend-domain>.up.railway.app

# 포트 (Railway가 자동 할당)
PORT=3000
```

### 3. Build 명령어 확인
Railway는 `package.json`의 스크립트를 자동 감지합니다:
- Build: `npm run build`
- Start: `npm run preview` (이미 수정됨)

### 4. 배포 확인
1. **"Deployments"** 탭에서 빌드 로그 확인
2. **"Settings"** → **"Networking"** 에서 Public URL 확인

---

## 환경 변수 설정

### Backend 전체 환경 변수 리스트

```bash
# Django Core
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False
DJANGO_SECRET_KEY=<your-secret-key>
ALLOWED_HOSTS=<backend-url>.up.railway.app,localhost

# Database
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_ENGINE=django.db.backends.postgresql
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}

# CORS
CORS_ALLOWED_ORIGINS=https://<frontend-url>.up.railway.app

# Static Files
STATIC_ROOT=/app/staticfiles
STATIC_URL=/static/

# JWT (선택사항 - settings에서 SECRET_KEY 사용)
JWT_SECRET_KEY=<jwt-secret-key>
JWT_ACCESS_TOKEN_LIFETIME=3600
JWT_REFRESH_TOKEN_LIFETIME=604800
```

### Frontend 전체 환경 변수 리스트

```bash
# API Backend
VITE_API_BASE_URL=https://<backend-url>.up.railway.app

# Port
PORT=3000
```

---

## 도메인 설정

### 1. 커스텀 도메인 추가 (선택사항)

#### Backend:
1. Backend 서비스 → **"Settings"** → **"Networking"**
2. **"Custom Domain"** 섹션에서 도메인 추가
3. DNS 레코드 설정 (Railway에서 제공하는 CNAME)
4. `ALLOWED_HOSTS` 환경 변수에 도메인 추가

#### Frontend:
1. Frontend 서비스 → **"Settings"** → **"Networking"**
2. **"Custom Domain"** 추가
3. `VITE_API_BASE_URL` 환경 변수 업데이트

### 2. Railway 기본 도메인 사용
- Backend: `https://<service-name>-production.up.railway.app`
- Frontend: `https://<service-name>-production.up.railway.app`

---

## 배포 확인 및 테스트

### 1. Backend API 테스트

```powershell
# Health Check
curl https://<backend-url>.up.railway.app/api/health/

# 로그인 테스트
curl -X POST https://<backend-url>.up.railway.app/api/auth/login/ `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"password"}'
```

### 2. Frontend 접속 테스트
1. 브라우저에서 Frontend URL 접속
2. 로그인 페이지 확인
3. 개발자 도구 (F12) → Network 탭에서 API 호출 확인

### 3. 데이터베이스 연결 확인
Railway CLI를 사용한 직접 연결:

```powershell
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# PostgreSQL 접속
railway run psql $DATABASE_URL
```

---

## 문제 해결

### 1. 500 Internal Server Error

**원인**: Django 설정 오류, 데이터베이스 연결 실패

**해결**:
```powershell
# Railway 서비스 로그 확인
railway logs

# 환경 변수 확인
railway variables

# 마이그레이션 재실행
railway run python manage.py migrate
```

### 2. CORS 오류

**증상**: Frontend에서 API 호출 시 CORS 에러

**해결**:
1. Backend 환경 변수 확인:
```bash
CORS_ALLOWED_ORIGINS=https://<frontend-url>.up.railway.app
```

2. `base.py` 설정 확인:
```python
CORS_ALLOW_CREDENTIALS = True
```

### 3. 정적 파일 404 오류

**해결**:
```bash
# Railway 터미널에서 실행
python manage.py collectstatic --noinput
```

### 4. 빌드 실패

**Nixpacks 오류**:
- `nixpacks.toml` 파일 확인
- Python 버전 확인 (`runtime.txt`)
- `requirements.txt` 의존성 확인

**Frontend 빌드 오류**:
```powershell
# 로컬에서 빌드 테스트
cd frontend
npm run build
```

### 5. 데이터베이스 마이그레이션 오류

```bash
# Railway 터미널에서
python manage.py showmigrations
python manage.py migrate --fake-initial
```

### 6. 메모리 부족 오류

Railway Free Tier 제한:
- 512MB RAM
- 1GB Disk

**해결**:
1. **"Settings"** → **"Resources"** 에서 플랜 업그레이드
2. 또는 불필요한 서비스 제거

---

## 배포 후 체크리스트

- [ ] Backend API 정상 작동 확인
- [ ] Frontend 로딩 확인
- [ ] 로그인/로그아웃 기능 테스트
- [ ] 파일 업로드 기능 테스트
- [ ] 대시보드 데이터 표시 확인
- [ ] HTTPS 적용 확인
- [ ] CORS 설정 확인
- [ ] 환경 변수 보안 확인 (SECRET_KEY 등)
- [ ] 데이터베이스 백업 설정 (Railway 자동 백업)
- [ ] 모니터링 설정 (Railway Metrics)

---

## 유용한 Railway CLI 명령어

```powershell
# 프로젝트 상태 확인
railway status

# 로그 실시간 확인
railway logs -f

# 환경 변수 보기
railway variables

# 서비스 재시작
railway restart

# 로컬에서 Railway 환경 변수로 실행
railway run python manage.py shell
```

---

## 추가 리소스

- [Railway 공식 문서](https://docs.railway.app/)
- [Django 배포 가이드](https://docs.djangoproject.com/en/4.2/howto/deployment/)
- [Vite 프로덕션 빌드](https://vitejs.dev/guide/build.html)

---

## 비용 안내

**Railway Free Tier:**
- $5 무료 크레딧/월
- 월별 실행 시간 제한
- 512MB RAM
- 1GB Disk

**예상 비용:**
- PostgreSQL: ~$5/월
- Backend: ~$5/월
- Frontend: ~$5/월
- **총 예상**: ~$15/월 (Free Tier 초과 시)

**절약 팁:**
- 개발 환경은 로컬에서 실행
- 사용하지 않을 때 서비스 일시 중지
- 로그 보관 기간 최소화

---

## 연락처 및 지원

문제가 발생하면:
1. Railway Discord 커뮤니티
2. GitHub Issues
3. Railway 지원 팀

배포 성공을 기원합니다! 🚀
