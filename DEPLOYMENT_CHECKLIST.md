# Railway 배포 전 체크리스트

## 📋 배포 전 확인사항

### 1. 코드 준비
- [ ] 모든 변경사항 커밋 완료
- [ ] `.gitignore` 에 환경 변수 파일 추가 확인
- [ ] GitHub 저장소에 푸시 완료
- [ ] `main` 브랜치에 최신 코드 반영

### 2. Backend 파일 확인
- [ ] `backend/Procfile` 존재
- [ ] `backend/runtime.txt` 존재
- [ ] `backend/railway.json` 존재
- [ ] `backend/nixpacks.toml` 존재
- [ ] `backend/requirements.txt` 에 `gunicorn`, `whitenoise` 추가 확인
- [ ] `backend/config/settings/production.py` 존재
- [ ] `backend/.env.example` 참조용 파일 확인

### 3. Frontend 파일 확인
- [ ] `frontend/railway.json` 존재
- [ ] `frontend/nixpacks.toml` 존재
- [ ] `frontend/vite.config.ts` 에 preview 설정 추가 확인
- [ ] `frontend/package.json` preview 스크립트 확인
- [ ] `frontend/.env.example` 참조용 파일 확인

### 4. 로컬 테스트
- [ ] Backend 로컬 빌드 테스트
  ```powershell
  cd backend
  pip install -r requirements.txt
  python manage.py collectstatic --noinput
  python manage.py migrate
  python manage.py runserver
  ```
- [ ] Frontend 로컬 빌드 테스트
  ```powershell
  cd frontend
  npm install
  npm run build
  npm run preview
  ```
- [ ] 로컬 환경에서 전체 기능 테스트

## 🚀 Railway 배포 단계

### Phase 1: 인프라 설정
- [ ] Railway 계정 생성/로그인
- [ ] Railway CLI 설치
- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 데이터베이스 추가

### Phase 2: Backend 배포
- [ ] Backend 서비스 추가 (Root: `backend`)
- [ ] Secret Key 생성
  ```powershell
  python backend/generate_secret_key.py
  ```
- [ ] Backend 환경 변수 설정
  - `DJANGO_SETTINGS_MODULE`
  - `DEBUG`
  - `DJANGO_SECRET_KEY`
  - `DATABASE_URL` (PostgreSQL 참조)
  - `DB_*` 변수들
  - `ALLOWED_HOSTS`
  - `CORS_ALLOWED_ORIGINS`
  - `STATIC_ROOT`
- [ ] Backend 첫 배포 완료
- [ ] Backend Public URL 확인
- [ ] `ALLOWED_HOSTS` 환경 변수 업데이트
- [ ] Backend 재배포
- [ ] 관리자 계정 생성
  ```bash
  python manage.py createsuperuser
  ```
- [ ] Admin 페이지 접속 테스트

### Phase 3: Frontend 배포
- [ ] Frontend 서비스 추가 (Root: `frontend`)
- [ ] Frontend 환경 변수 설정
  - `VITE_API_BASE_URL` (Backend URL)
  - `PORT`
- [ ] Frontend 배포 완료
- [ ] Frontend Public URL 확인
- [ ] Backend `CORS_ALLOWED_ORIGINS` 업데이트
- [ ] Backend 재배포

### Phase 4: 통합 테스트
- [ ] Frontend에서 Backend API 호출 확인
- [ ] 로그인 기능 테스트
- [ ] 로그아웃 기능 테스트
- [ ] JWT 토큰 인증 확인
- [ ] 파일 업로드 기능 테스트
- [ ] 대시보드 데이터 표시 확인
- [ ] HTTPS 연결 확인
- [ ] CORS 정책 작동 확인

## 🔒 보안 체크리스트

- [ ] `DEBUG=False` 설정 확인
- [ ] `DJANGO_SECRET_KEY` 강력한 키 사용
- [ ] 환경 변수에 민감한 정보 저장 (코드에 하드코딩 X)
- [ ] `ALLOWED_HOSTS` 적절히 설정
- [ ] `CORS_ALLOWED_ORIGINS` 필요한 도메인만 허용
- [ ] HTTPS 강제 설정 (production.py)
- [ ] HSTS 헤더 설정 확인
- [ ] XSS, CSRF 보호 활성화 확인

## 📊 모니터링 설정

- [ ] Railway Metrics 확인
- [ ] 로그 수집 설정
- [ ] 에러 알림 설정 (선택사항)
- [ ] 성능 모니터링 도구 연동 (선택사항)

## 💾 데이터베이스 관리

- [ ] 마이그레이션 자동 실행 확인 (Procfile의 release 명령어)
- [ ] 데이터베이스 백업 전략 수립
- [ ] Railway PostgreSQL 자동 백업 확인

## 📈 성능 최적화

- [ ] 정적 파일 압축 (Whitenoise)
- [ ] 데이터베이스 연결 풀링 설정
- [ ] Frontend 빌드 최적화
- [ ] 이미지 최적화

## 🔄 CI/CD 설정 (선택사항)

- [ ] GitHub Actions 워크플로우 설정
- [ ] 자동 테스트 실행
- [ ] 자동 배포 트리거
- [ ] 배포 전 테스트 통과 확인

## 📝 문서화

- [ ] README.md 업데이트
- [ ] API 문서 작성 (선택사항)
- [ ] 배포 과정 기록
- [ ] 환경 변수 목록 문서화

## 💰 비용 관리

- [ ] Railway Free Tier 크레딧 확인
- [ ] 리소스 사용량 모니터링
- [ ] 불필요한 서비스 종료
- [ ] 예산 알림 설정

## 🆘 비상 대응

- [ ] 롤백 계획 수립
- [ ] 데이터베이스 백업 확인
- [ ] 장애 대응 매뉴얼 작성
- [ ] 지원 채널 확인 (Railway Discord)

---

## ✅ 최종 확인

배포 완료 후:

1. **기능 테스트**
   - [ ] 모든 페이지 로딩 확인
   - [ ] 사용자 인증 플로우
   - [ ] 데이터 CRUD 작업
   - [ ] 파일 업로드/다운로드
   - [ ] 차트 렌더링

2. **성능 테스트**
   - [ ] 페이지 로드 시간 < 3초
   - [ ] API 응답 시간 < 1초
   - [ ] 동시 접속 테스트

3. **브라우저 호환성**
   - [ ] Chrome
   - [ ] Firefox
   - [ ] Safari
   - [ ] Edge

4. **모바일 반응형**
   - [ ] iOS Safari
   - [ ] Android Chrome

---

## 📞 문제 발생 시

1. Railway 서비스 로그 확인
2. Browser DevTools Console 확인
3. Network 탭에서 API 호출 상태 확인
4. `RAILWAY_QUICKSTART.md` 문제 해결 섹션 참조
5. `RAILWAY_DEPLOYMENT_GUIDE.md` 상세 가이드 참조
6. Railway Discord 커뮤니티 질문

---

**배포 시작 날짜**: _______________  
**배포 완료 날짜**: _______________  
**배포 담당자**: _______________  

**Backend URL**: _______________  
**Frontend URL**: _______________  
**Database**: Railway PostgreSQL  
