"""
Django management command to create admin user in custom User table.
"""
from django.core.management.base import BaseCommand
from apps.authentication.models import User


class Command(BaseCommand):
    help = '커스텀 User 테이블에 관리자 계정을 생성합니다'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='관리자 아이디 (기본값: admin)',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='admin123',
            help='관리자 비밀번호 (기본값: admin123)',
        )
        parser.add_argument(
            '--fullname',
            type=str,
            default='관리자',
            help='관리자 이름 (기본값: 관리자)',
        )

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        full_name = options['fullname']

        # 이미 존재하는지 확인
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.ERROR(f"❌ 사용자 '{username}'는 이미 존재합니다.")
            )
            return

        # 관리자 생성
        user = User(
            username=username,
            full_name=full_name,
            role='admin',
            is_active=True,
            is_locked=False,
        )
        user.set_password(password)
        user.save()

        self.stdout.write(self.style.SUCCESS('\n✅ 관리자 계정이 생성되었습니다!'))
        self.stdout.write(f'   아이디: {username}')
        self.stdout.write(f'   이름: {full_name}')
        self.stdout.write(f'   역할: admin')
        self.stdout.write(self.style.WARNING(f'\n⚠️  보안을 위해 비밀번호를 변경하는 것을 권장합니다.'))
