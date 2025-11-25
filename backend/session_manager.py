"""Session and connection management."""

from typing import Dict
from datetime import datetime
from fastapi import WebSocket
import uuid

from models import Player, GameSession
from config import SESSION_ID_LENGTH, GameStatus


class SessionManager:
    """Manages game sessions and WebSocket connections."""
    
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
        self.connections: Dict[str, Dict[str, WebSocket]] = {}
    
    def create_session(self) -> GameSession:
        """Create a new game session."""
        session_id = str(uuid.uuid4())[:SESSION_ID_LENGTH]
        
        session = GameSession(
            session_id=session_id,
            created_at=datetime.now().isoformat(),
            players=[],
            status=GameStatus.WAITING
        )
        
        self.sessions[session_id] = session
        self.connections[session_id] = {}
        
        return session
    
    def get_session(self, session_id: str) -> GameSession | None:
        """Get session by ID."""
        return self.sessions.get(session_id)
    
    def session_exists(self, session_id: str) -> bool:
        """Check if session exists."""
        return session_id in self.sessions
    
    def get_all_sessions(self) -> list[GameSession]:
        """Get all active sessions."""
        return list(self.sessions.values())
    
    def create_player(self, name: str) -> Player:
        """Create a new player."""
        return Player(
            id=str(uuid.uuid4())[:SESSION_ID_LENGTH],
            name=name,
            joined_at=datetime.now().isoformat()
        )
    
    def add_player_to_session(
        self, 
        session_id: str, 
        player: Player, 
        websocket: WebSocket
    ) -> None:
        """Add player to session and register WebSocket."""
        session = self.sessions[session_id]
        session.players.append(player)
        self.connections[session_id][player.id] = websocket
        
        # Update status if session is full
        if session.is_full:
            session.status = GameStatus.READY
    
    def remove_player_from_session(
        self, 
        session_id: str, 
        player_id: str
    ) -> None:
        """Remove player from session."""
        if session_id not in self.sessions:
            return
            
        session = self.sessions[session_id]
        session.remove_player(player_id)
        
        # Remove WebSocket connection
        if session_id in self.connections:
            self.connections[session_id].pop(player_id, None)
        
        # Update session status
        if not session.is_full:
            session.status = GameStatus.WAITING
        
        # Clean up empty sessions
        if len(session.players) == 0:
            self.delete_session(session_id)
    
    def delete_session(self, session_id: str) -> None:
        """Delete a session."""
        self.sessions.pop(session_id, None)
        self.connections.pop(session_id, None)
    
    def get_connections(self, session_id: str) -> Dict[str, WebSocket]:
        """Get all connections for a session."""
        return self.connections.get(session_id, {})
    
    async def broadcast(self, session_id: str, message: dict) -> None:
        """Broadcast message to all players in a session."""
        connections = self.get_connections(session_id)
        if not connections:
            return
        
        disconnected = []
        for player_id, websocket in connections.items():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(player_id)
        
        # Clean up disconnected connections
        for player_id in disconnected:
            self.connections[session_id].pop(player_id, None)


# Global session manager instance
session_manager = SessionManager()
