"""
Game Session Manager API
A real-time 4-digit number guessing game backend.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json

from config import (
    CORS_ORIGINS, CORS_METHODS, CORS_HEADERS,
    WS_SESSION_FULL, WS_SESSION_NOT_FOUND,
    GameStatus, MessageType, HOST, PORT
)
from models import Guess
from game_logic import validate_number, evaluate_guess, is_winning_guess
from session_manager import session_manager
from utils import sanitize_player, sanitize_session


# Initialize FastAPI app
app = FastAPI(
    title="Game Session Manager",
    description="Real-time 4-digit number guessing game API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=CORS_METHODS,
    allow_headers=CORS_HEADERS,
)


# REST Endpoints
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Game Session Manager API", "status": "running"}


@app.post("/sessions/create")
async def create_session():
    """Create a new game session."""
    session = session_manager.create_session()
    return {
        "session_id": session.session_id,
        "message": "Session created successfully"
    }


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/sessions")
async def list_sessions():
    """List all active sessions."""
    return {"sessions": session_manager.get_all_sessions()}


# WebSocket Endpoint
@app.websocket("/ws/{session_id}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, player_name: str):
    """WebSocket connection for real-time game session updates."""
    
    # Validate session exists
    session = session_manager.get_session(session_id)
    if not session:
        await websocket.close(code=WS_SESSION_NOT_FOUND, reason="Session not found")
        return
    
    # Check if session is full
    if session.is_full:
        await websocket.close(code=WS_SESSION_FULL, reason="Session is full")
        return
    
    # Accept connection and create player
    await websocket.accept()
    player = session_manager.create_player(player_name)
    session_manager.add_player_to_session(session_id, player, websocket)
    
    # Notify all players
    await session_manager.broadcast(session_id, {
        "type": MessageType.PLAYER_JOINED,
        "player": sanitize_player(player),
        "player_id": player.id,
        "session": sanitize_session(session)
    })
    
    try:
        await handle_websocket_messages(websocket, session_id, player.id, player_name)
    except WebSocketDisconnect:
        await handle_player_disconnect(session_id, player.id, player_name)


async def handle_websocket_messages(
    websocket: WebSocket, 
    session_id: str, 
    player_id: str, 
    player_name: str
):
    """Handle incoming WebSocket messages."""
    while True:
        data = await websocket.receive_text()
        message = json.loads(data)
        message_type = message.get("type")
        
        session = session_manager.get_session(session_id)
        if not session:
            break
        
        if message_type == MessageType.LOCK_NUMBER:
            await handle_lock_number(websocket, session, player_id, message)
        
        elif message_type == MessageType.MAKE_GUESS:
            await handle_make_guess(
                websocket, session, session_id, 
                player_id, player_name, message
            )
        
        elif message_type == MessageType.CHAT:
            await session_manager.broadcast(session_id, {
                "type": MessageType.CHAT,
                "player_id": player_id,
                "player_name": player_name,
                "message": message.get("message")
            })


async def handle_lock_number(
    websocket: WebSocket, 
    session, 
    player_id: str, 
    message: dict
):
    """Handle player locking their secret number."""
    number = message.get("number", "")
    
    if not validate_number(number):
        await websocket.send_json({
            "type": MessageType.ERROR,
            "message": "Invalid number. Must be 4 unique digits."
        })
        return
    
    # Lock the player's secret number
    player = session.get_player(player_id)
    if player:
        player.secret_number = number
        player.is_ready = True
    
    # Check if both players are ready
    if session.all_players_ready:
        session.status = GameStatus.IN_PROGRESS
        session.current_turn = session.players[0].id
    
    await session_manager.broadcast(session.session_id, {
        "type": MessageType.NUMBER_LOCKED,
        "player_id": player_id,
        "session": sanitize_session(session)
    })


async def handle_make_guess(
    websocket: WebSocket,
    session,
    session_id: str,
    player_id: str,
    player_name: str,
    message: dict
):
    """Handle player making a guess."""
    guess_number = message.get("guess", "")
    
    # Validate turn
    if session.current_turn != player_id:
        await websocket.send_json({
            "type": MessageType.ERROR,
            "message": "It's not your turn!"
        })
        return
    
    # Validate guess format
    if not validate_number(guess_number):
        await websocket.send_json({
            "type": MessageType.ERROR,
            "message": "Invalid guess. Must be 4 unique digits."
        })
        return
    
    # Get opponent
    opponent = session.get_opponent(player_id)
    if not opponent or not opponent.secret_number:
        return
    
    # Evaluate guess
    correct_digits, correct_positions = evaluate_guess(
        guess_number, 
        opponent.secret_number
    )
    
    # Create guess record
    guess = Guess.create(
        player_id=player_id,
        player_name=player_name,
        guess=guess_number,
        correct_digits=correct_digits,
        correct_positions=correct_positions
    )
    
    session.guesses.append(guess)
    
    # Check for winner
    if is_winning_guess(correct_positions):
        session.status = GameStatus.COMPLETED
        session.winner = player_id
    else:
        session.current_turn = opponent.id
    
    await session_manager.broadcast(session_id, {
        "type": MessageType.GUESS_MADE,
        "guess": guess.model_dump(),
        "session": sanitize_session(session)
    })


async def handle_player_disconnect(
    session_id: str, 
    player_id: str, 
    player_name: str
):
    """Handle player disconnection."""
    session = session_manager.get_session(session_id)
    session_manager.remove_player_from_session(session_id, player_id)
    
    if session and session.players:
        await session_manager.broadcast(session_id, {
            "type": MessageType.PLAYER_LEFT,
            "player_id": player_id,
            "player_name": player_name,
            "session": sanitize_session(session)
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
