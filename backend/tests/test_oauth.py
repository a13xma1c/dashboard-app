"""OpenID userinfo lookup, with httpx faked out."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx

from app.oauth import USERINFO_ENDPOINT, fetch_user_email


def _response(status: int, payload: object) -> httpx.Response:
    return httpx.Response(status, json=payload, request=httpx.Request("GET", USERINFO_ENDPOINT))


def test_returns_email_from_userinfo() -> None:
    with patch("app.oauth.httpx.get", return_value=_response(200, {"email": "me@example.com"})) as get:
        assert fetch_user_email("tok") == "me@example.com"
    get.assert_called_once()
    assert get.call_args.kwargs["headers"] == {"Authorization": "Bearer tok"}


def test_returns_none_when_email_missing_or_blank() -> None:
    with patch("app.oauth.httpx.get", return_value=_response(200, {"sub": "123"})):
        assert fetch_user_email("tok") is None
    with patch("app.oauth.httpx.get", return_value=_response(200, {"email": ""})):
        assert fetch_user_email("tok") is None


def test_returns_none_on_http_error() -> None:
    with patch("app.oauth.httpx.get", return_value=_response(401, {"error": "invalid_token"})):
        assert fetch_user_email("tok") is None


def test_returns_none_on_network_error() -> None:
    with patch("app.oauth.httpx.get", side_effect=httpx.ConnectError("boom")):
        assert fetch_user_email("tok") is None


def test_returns_none_on_malformed_json() -> None:
    bad = MagicMock()
    bad.raise_for_status.return_value = None
    bad.json.side_effect = ValueError("not json")
    with patch("app.oauth.httpx.get", return_value=bad):
        assert fetch_user_email("tok") is None
