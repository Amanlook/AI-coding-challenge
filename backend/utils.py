"""Utility functions for data sanitization."""

from models import Player, GameSession


def sanitize_player(player: Player) -> dict:
    """Return player dict without secret number."""
    data = player.model_dump()
    data.pop('secret_number', None)
    return data


def sanitize_session(session: GameSession) -> dict:
    """Return session dict with sanitized players (no secret numbers)."""
    data = session.model_dump()
    data['players'] = [sanitize_player(p) for p in session.players]
    return data
