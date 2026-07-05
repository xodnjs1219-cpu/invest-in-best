# Railway 배포 빠른 시작 가이드 🚀

## 1단계: Railway CLI 설치

### Windows (PowerShell)
```powershell
# NPM을 통한 설치
npm install -g @railway/cli

# 또는 Scoop 사용
scoop install railway

# 설치 확인
railway --version
```

## 2단계: Railway 로그인

```powershell
# Railway 계정 로그인 (브라우저 열림)
railway login
```

## 3단계: GitHub 저장소 준비

```powershell
# 변경사항 커밋
git add .
git commit -m "feat: Railway 배포 설정 추가"

# GitHub에 푸시
git push origin main
```

## 4단계: Railway 프로젝트 생성 (웹 인터페이스 사용)

1. [Railway.app](https://railway.app/dashboard) 접속
2. **"New Project"** 클릭
3. 프로젝트 이름: `vmc-dashboard`

## 5단계: PostgreSQL 추가

1. 프로젝트 대시보드에서 **"+ New"** 클릭
2. **"Database"** → **"Add PostgreSQL"** 선택
3. 자동으로 데이터베이스 생성됨

## 6단계: Backend 배포

### 6-1. Backend 서비스 추가
1. 프로젝트에서 **"+ New"** 클릭
2. **"GitHub Repo"** 선택
3. 저장소 선택
4. **Root Directory**: `backend` 입력
5. **"Add service"** 클릭

### 6-2. Backend 환경 변수 설정

Backend 서비스 클릭 → **"Variables"** 탭에서 다음 추가:

```bash
# Django 기본 설정
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False

# Secret Key 생성 (PowerShell)
# python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
DJANGO_SECRET_KEY=<생성된-secret-key>

# 데이터베이스 (PostgreSQL 서비스 참조)
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_ENGINE=django.db.backends.postgresql
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}

# ALLOWED_HOSTS (배포 후 업데이트 필요)
ALLOWED_HOSTS=localhost,127.0.0.1

# CORS (배포 후 업데이트 필요)
CORS_ALLOWED_ORIGINS=http://localhost:5173

# 정적 파일
STATIC_ROOT=/app/staticfiles
STATIC_URL=/static/
```

### 6-3. Backend 배포 확인
1. **"Deployments"** 탭에서 빌드 로그 확인
2. 빌드 성공 후 **"Settings"** → **"Networking"** 에서 Public URL 확인
3. URL 복사 (예: `https://backend-production-xxxx.up.railway.app`)

### 6-4. ALLOWED_HOSTS 업데이트
Backend 서비스 **"Variables"** 에서:
```bash
ALLOWED_HOSTS=backend-production-xxxx.up.railway.app,localhost,127.0.0.1
```

### 6-5. 관리자 계정 생성
1. Backend 서비스 → **"Settings"** 탭
2. 우측 상단 터미널 아이콘 (⚡) 클릭
3. 다음 명령어 실행:
```bash
python manage.py createsuperuser
```

## 7단계: Frontend 배포

### 7-1. Frontend 서비스 추가
1. 프로젝트에서 **"+ New"** 클릭
2. **"GitHub Repo"** 선택 (같은 저장소)
3. **Root Directory**: `frontend` 입력
4. **"Add service"** 클릭

### 7-2. Frontend 환경 변수 설정

Frontend 서비스 → **"Variables"** 탭:

```bash
# Backend API URL (6-3에서 복사한 URL)
VITE_API_BASE_URL=https://backend-production-xxxx.up.railway.app

# 포트 (Railway 자동 설정)
PORT=3000
```

### 7-3. Frontend 배포 확인
1. **"Deployments"** 탭에서 빌드 로그 확인
2. **"Settings"** → **"Networking"** 에서 Public URL 확인
3. URL 복사 (예: `https://frontend-production-yyyy.up.railway.app`)

### 7-4. Backend CORS 업데이트
Backend 서비스 **"Variables"** 에서:
```bash
CORS_ALLOWED_ORIGINS=https://frontend-production-yyyy.up.railway.app,http://localhost:5173
```

## 8단계: 배포 테스트

### 8-1. Backend API 테스트
```powershell
# Health check
curl https://backend-production-xxxx.up.railway.app/api/health/

# 관리자 페이지 접속
# https://backend-production-xxxx.up.railway.app/admin/
```

### 8-2. Frontend 접속
1. 브라우저에서 Frontend URL 접속
2. 로그인 페이지 확인
3. 6-5에서 생성한 계정으로 로그인 테스트

## 9단계: 로컬 환경에서 Railway 환경 변수 사용 (선택사항)

```powershell
# 프로젝트 연결
railway link

# Railway 환경 변수로 로컬 실행
railway run python manage.py shell
```

## 문제 해결

### 빌드 실패 시
```powershell
# 로컬에서 빌드 테스트
cd backend
pip install -r requirements.txt
python manage.py collectstatic --noinput

cd ../frontend
npm install
npm run build
```

### 로그 확인
```powershell
# Railway CLI로 로그 확인
railway logs

# 또는 웹 인터페이스에서
# 서비스 → "View Logs" 클릭
```

### 데이터베이스 마이그레이션 수동 실행
Backend 서비스 터미널에서:
```bash
python manage.py migrate
python manage.py showmigrations
```

## 체크리스트

- [ ] Railway CLI 설치 및 로그인
- [ ] GitHub 저장소 생성 및 푸시
- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 데이터베이스 추가
- [ ] Backend 서비스 배포
- [ ] Backend 환경 변수 설정
- [ ] Backend Public URL 확인
- [ ] 관리자 계정 생성
- [ ] Frontend 서비스 배포
- [ ] Frontend 환경 변수 설정
- [ ] Frontend Public URL 확인
- [ ] Backend CORS 업데이트
- [ ] 로그인 테스트
- [ ] 파일 업로드 테스트
- [ ] 대시보드 데이터 확인

## 유용한 명령어

```powershell
# 프로젝트 상태 확인
railway status

# 로그 실시간 확인
railway logs -f

# 환경 변수 확인
railway variables

# 서비스 재시작
railway restart

# 데이터베이스 접속
railway run psql $DATABASE_URL
```

## 다음 단계

배포가 완료되었다면:
1. 커스텀 도메인 설정 (선택사항)
2. CI/CD 자동화 설정
3. 모니터링 및 알림 설정
4. 백업 전략 수립

자세한 내용은 `RAILWAY_DEPLOYMENT_GUIDE.md` 참조

---

문제가 발생하면:
- Railway Discord: https://discord.gg/railway
- 공식 문서: https://docs.railway.app/
