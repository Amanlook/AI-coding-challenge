from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import uuid
import json
from datetime import datetime

app = FastAPI(title="Game Session Manager")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class Player(BaseModel):
    id: str
    name: str
    joined_at: str
    secret_number: str = ""  # 4-digit secret number
    is_ready: bool = False  # Has locked their number

class Guess(BaseModel):
    player_id: str
    player_name: str
    guess: str
    correct_digits: int  # Digits that exist in secret number
    correct_positions: int  # Digits in correct position
    timestamp: str

class GameSession(BaseModel):
    session_id: str
    created_at: str
    players: List[Player]
    max_players: int = 2
    status: str  # "waiting", "ready", "choosing_numbers", "in_progress", "completed"
    current_turn: str = ""  # player_id whose turn it is
    guesses: List[Guess] = []
    winner: str = ""  # player_id of winner

# In-memory storage
sessions: Dict[str, GameSession] = {}
active_connections: Dict[str, Dict[str, WebSocket]] = {}  # session_id -> {player_id -> websocket}

# REST Endpoints
@app.get("/")
async def root():
    return {"message": "Game Session Manager API"}

@app.post("/sessions/create")
async def create_session():
    """Create a new game session"""
    session_id = str(uuid.uuid4())[:8]  # Short unique ID
    
    session = GameSession(
        session_id=session_id,
        created_at=datetime.now().isoformat(),
        players=[],
        status="waiting"
    )
    
    sessions[session_id] = session
    active_connections[session_id] = {}
    
    return {
        "session_id": session_id,
        "message": "Session created successfully"
    }

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return sessions[session_id]

@app.get("/sessions")
async def list_sessions():
    """List all active sessions"""
    return {"sessions": list(sessions.values())}

# WebSocket endpoint
@app.websocket("/ws/{session_id}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, player_name: str):
    """WebSocket connection for real-time game session updates"""
    
    # Check if session exists
    if session_id not in sessions:
        await websocket.close(code=4004, reason="Session not found")
        return
    
    session = sessions[session_id]
    
    # Check if session is full
    if len(session.players) >= session.max_players:
        await websocket.close(code=4003, reason="Session is full")
        return
    
    # Accept connection
    await websocket.accept()
    
    # Create player
    player_id = str(uuid.uuid4())[:8]
    player = Player(
        id=player_id,
        name=player_name,
        joined_at=datetime.now().isoformat()
    )
    
    # Add player to session
    session.players.append(player)
    active_connections[session_id][player_id] = websocket
    
    # Update session status
    if len(session.players) == session.max_players:
        session.status = "ready"
    
    # Notify all players in the session
    await broadcast_to_session(session_id, {
        "type": "player_joined",
        "player": sanitize_player(player),
        "player_id": player_id,  # Send player_id to the joining player
        "session": sanitize_session(session)
    })
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "lock_number":
                number = message.get("number", "")
                
                # Validate number
                if not validate_number(number):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid number. Must be 4 unique digits."
                    })
                    continue
                
                # Lock the player's secret number
                for p in session.players:
                    if p.id == player_id:
                        p.secret_number = number
                        p.is_ready = True
                        break
                
                # Check if both players are ready
                if all(p.is_ready for p in session.players):
                    session.status = "in_progress"
                    # Set first player's turn (player who joined first)
                    session.current_turn = session.players[0].id
                
                await broadcast_to_session(session_id, {
                    "type": "number_locked",
                    "player_id": player_id,
                    "session": sanitize_session(session)
                })
            
            elif message.get("type") == "make_guess":
                guess_number = message.get("guess", "")
                
                # Validate it's the player's turn
                if session.current_turn != player_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "It's not your turn!"
                    })
                    continue
                
                # Validate guess
                if not validate_number(guess_number):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid guess. Must be 4 unique digits."
                    })
                    continue
                
                # Find opponent
                opponent = None
                for p in session.players:
                    if p.id != player_id:
                        opponent = p
                        break
                
                if not opponent or not opponent.secret_number:
                    continue
                
                # Evaluate guess
                correct_digits, correct_positions = evaluate_guess(
                    guess_number, 
                    opponent.secret_number
                )
                
                # Create guess record
                guess = Guess(
                    player_id=player_id,
                    player_name=player_name,
                    guess=guess_number,
                    correct_digits=correct_digits,
                    correct_positions=correct_positions,
                    timestamp=datetime.now().isoformat()
                )
                
                session.guesses.append(guess)
                
                # Check if player won
                if correct_positions == 4:
                    session.status = "completed"
                    session.winner = player_id
                else:
                    # Switch turns
                    session.current_turn = opponent.id
                
                # Broadcast guess to all players
                await broadcast_to_session(session_id, {
                    "type": "guess_made",
                    "guess": guess.dict(),
                    "session": sanitize_session(session)
                })
            
            elif message.get("type") == "chat":
                await broadcast_to_session(session_id, {
                    "type": "chat",
                    "player_id": player_id,
                    "player_name": player_name,
                    "message": message.get("message")
                })
    
    except WebSocketDisconnect:
        # Remove player from session
        session.players = [p for p in session.players if p.id != player_id]
        
        # Safely remove from active connections
        if session_id in active_connections and player_id in active_connections[session_id]:
            del active_connections[session_id][player_id]
        
        # Update session status
        if len(session.players) < session.max_players:
            session.status = "waiting"
        
        # Notify remaining players
        await broadcast_to_session(session_id, {
            "type": "player_left",
            "player_id": player_id,
            "player_name": player_name,
            "session": sanitize_session(session)
        })
        
        # Clean up empty sessions
        if len(session.players) == 0:
            if session_id in sessions:
                del sessions[session_id]
            if session_id in active_connections:
                del active_connections[session_id]

def validate_number(number: str) -> bool:
    """Validate that number is 4 digits with unique digits"""
    if not number or len(number) != 4:
        return False
    if not number.isdigit():
        return False
    # Check all digits are unique
    if len(set(number)) != 4:
        return False
    return True

def evaluate_guess(guess: str, secret: str) -> tuple:
    """
    Evaluate a guess against the secret number.
    Returns (correct_digits, correct_positions)
    """
    correct_positions = sum(1 for i in range(4) if guess[i] == secret[i])
    correct_digits = len(set(guess) & set(secret))
    
    return correct_digits, correct_positions

def sanitize_player(player: Player) -> dict:
    """Return player dict without secret number"""
    p_dict = player.dict()
    p_dict.pop('secret_number', None)
    return p_dict

def sanitize_session(session: GameSession) -> dict:
    """Return session dict with sanitized players (no secret numbers)"""
    session_dict = session.dict()
    session_dict['players'] = [sanitize_player(p) for p in session.players]
    return session_dict

async def broadcast_to_session(session_id: str, message: dict):
    """Broadcast message to all players in a session"""
    if session_id not in active_connections:
        return
    
    disconnected = []
    for player_id, websocket in active_connections[session_id].items():
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.append(player_id)
    
    # Clean up disconnected websockets
    for player_id in disconnected:
        if player_id in active_connections[session_id]:
            del active_connections[session_id][player_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
