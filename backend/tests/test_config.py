import pytest

from app.config import INSECURE_DEV_SECRET, Settings


def test_from_env_reads_all_values() -> None:
    s = Settings.from_env(
        {
            "SESSION_SECRET": "abc",
            "FRONTEND_ORIGIN": "http://example.com",
            "GA_MOCK_MODE": "true",
            "GOOGLE_CLIENT_ID": "id",
            "GOOGLE_CLIENT_SECRET": "secret",
            "GOOGLE_REDIRECT_URI": "http://example.com/cb",
            "CORS_ORIGINS": "http://a.com, http://b.com,",
        }
    )
    assert s.session_secret == "abc"
    assert s.frontend_origin == "http://example.com"
    assert s.mock_mode is True
    assert s.google_client_id == "id"
    assert s.google_client_secret == "secret"
    assert s.google_redirect_uri == "http://example.com/cb"
    assert s.cors_origins == ["http://a.com", "http://b.com"]


def test_defaults() -> None:
    s = Settings.from_env({"SESSION_SECRET": "abc"})
    assert s.mock_mode is False
    assert s.frontend_origin == "http://localhost:5173"
    assert s.google_redirect_uri == "http://localhost:8000/auth/callback"
    assert s.google_client_id is None
    assert s.cors_origins == []


@pytest.mark.parametrize("raw", ["1", "true", "TRUE", "Yes", " on "])
def test_mock_mode_truthy_values(raw: str) -> None:
    assert Settings.from_env({"SESSION_SECRET": "x", "GA_MOCK_MODE": raw}).mock_mode


@pytest.mark.parametrize("raw", ["0", "false", "no", "", "off", "random"])
def test_mock_mode_falsy_values(raw: str) -> None:
    assert not Settings.from_env({"SESSION_SECRET": "x", "GA_MOCK_MODE": raw}).mock_mode


def test_missing_secret_raises_outside_mock_mode() -> None:
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        Settings.from_env({})


def test_blank_secret_is_treated_as_missing() -> None:
    with pytest.raises(RuntimeError):
        Settings.from_env({"SESSION_SECRET": "   "})


def test_missing_secret_falls_back_in_mock_mode(caplog: pytest.LogCaptureFixture) -> None:
    s = Settings.from_env({"GA_MOCK_MODE": "true"})
    assert s.session_secret == INSECURE_DEV_SECRET
    assert "insecure" in caplog.text.lower()


def test_allowed_origins_deduplicates_and_keeps_order() -> None:
    s = Settings(
        session_secret="x",
        frontend_origin="http://a.com",
        cors_origins=["http://b.com", "http://a.com", ""],
    )
    assert s.allowed_origins == ["http://a.com", "http://b.com"]


def test_new_settings_parse_from_env() -> None:
    s = Settings.from_env(
        {
            "SESSION_SECRET": "x",
            "SESSION_HTTPS_ONLY": "true",
            "MOCK_TODAY": "2025-03-15",
            "REPORT_CACHE_TTL": "42",
            "REDIS_URL": " redis://cache:6379/0 ",
        }
    )
    assert s.redis_url == "redis://cache:6379/0"
    assert s.session_https_only is True
    assert s.mock_today is not None and s.mock_today.isoformat() == "2025-03-15"
    assert s.report_cache_ttl == 42


def test_new_settings_defaults() -> None:
    s = Settings.from_env({"SESSION_SECRET": "x"})
    assert s.session_https_only is False
    assert s.mock_today is None
    assert s.report_cache_ttl == 300
    assert s.redis_url is None


def test_invalid_mock_today_is_rejected() -> None:
    with pytest.raises(RuntimeError, match="MOCK_TODAY"):
        Settings.from_env({"SESSION_SECRET": "x", "MOCK_TODAY": "15/03/2025"})


def test_invalid_cache_ttl_is_rejected_and_negative_clamped() -> None:
    with pytest.raises(RuntimeError, match="REPORT_CACHE_TTL"):
        Settings.from_env({"SESSION_SECRET": "x", "REPORT_CACHE_TTL": "soon"})
    assert Settings.from_env({"SESSION_SECRET": "x", "REPORT_CACHE_TTL": "-5"}).report_cache_ttl == 0
