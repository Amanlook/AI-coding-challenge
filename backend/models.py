"""Data models for the game."""

from pydantic import BaseModel
from typing import List
from datetime import datetime


class Player(BaseModel):
    """Represents a player in the game session."""
    id: str
    name: str
    joined_at: str
    secret_number: str = ""
    is_ready: bool = False
    
    @property
    def has_locked_number(self) -> bool:
        return bool(self.secret_number) and self.is_ready


class Guess(BaseModel):
    """Represents a guess made by a player."""
    player_id: str
    player_name: str
    guess: str
    correct_digits: int
    correct_positions: int
    timestamp: str
    
    @classmethod
    def create(
        cls,
        player_id: str,
        player_name: str,
        guess: str,
        correct_digits: int,
        correct_positions: int
    ) -> "Guess":
        return cls(
            player_id=player_id,
            player_name=player_name,
            guess=guess,
            correct_digits=correct_digits,
            correct_positions=correct_positions,
            timestamp=datetime.now().isoformat()
        )


class GameSession(BaseModel):
    """Represents a game session."""
    session_id: str
    created_at: str
    players: List[Player]
    max_players: int = 2
    status: str = "waiting"
    current_turn: str = ""
    guesses: List[Guess] = []
    winner: str = ""
    
    @property
    def is_full(self) -> bool:
        return len(self.players) >= self.max_players
    
    @property
    def all_players_ready(self) -> bool:
        return all(p.is_ready for p in self.players)
    
    def get_player(self, player_id: str) -> Player | None:
        """Get player by ID."""
        for player in self.players:
            if player.id == player_id:
                return player
        return None
    
    def get_opponent(self, player_id: str) -> Player | None:
        """Get opponent of the given player."""
        for player in self.players:
            if player.id != player_id:
                return player
        return None
    
    def remove_player(self, player_id: str) -> None:
        """Remove player from session."""
        self.players = [p for p in self.players if p.id != player_id]
