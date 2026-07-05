"""
User model for authentication.
"""
from django.db import models
from django.contrib.auth.hashers import make_password


class User(models.Model):
    """Custom User model."""

    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('user', 'Regular User'),
    ]

    id = models.BigAutoField(primary_key=True)
    username = models.CharField(max_length=100, unique=True, db_index=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=100, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        managed = True

    def __str__(self):
        return f"{self.username} ({self.full_name})"

    def set_password(self, raw_password: str) -> None:
        """Hash and set password."""
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Check if raw password matches hashed password."""
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password_hash)

    @property
    def is_authenticated(self) -> bool:
        """
        Always return True for authenticated users.
        This is a way to tell if the user has been authenticated in templates.
        """
        return True

    @property
    def is_anonymous(self) -> bool:
        """
        Always return False. This is a way of differentiating User objects
        from AnonymousUser objects.
        """
        return False


class TokenBlacklist(models.Model):
    """JWT Refresh Token blacklist model."""

    id = models.BigAutoField(primary_key=True)
    token = models.TextField(unique=True, db_index=True)
    user_id = models.BigIntegerField(db_index=True)
    blacklisted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'token_blacklist'
        managed = True

    def __str__(self):
        return f"Blacklisted token for user {self.user_id}"
