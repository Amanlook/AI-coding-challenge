"""Application configuration and constants."""

# Server Configuration
HOST = "0.0.0.0"
PORT = 8000
DEBUG = True

# CORS Settings
CORS_ORIGINS = ["*"]
CORS_METHODS = ["*"]
CORS_HEADERS = ["*"]

# Game Settings
MAX_PLAYERS_PER_SESSION = 2
SECRET_NUMBER_LENGTH = 4
SESSION_ID_LENGTH = 8

# WebSocket Close Codes
WS_SESSION_FULL = 4003
WS_SESSION_NOT_FOUND = 4004

# Game Status
class GameStatus:
    WAITING = "waiting"
    READY = "ready"
    CHOOSING_NUMBERS = "choosing_numbers"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

# Message Types
class MessageType:
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    NUMBER_LOCKED = "number_locked"
    GUESS_MADE = "guess_made"
    CHAT = "chat"
    ERROR = "error"
    LOCK_NUMBER = "lock_number"
    MAKE_GUESS = "make_guess"
