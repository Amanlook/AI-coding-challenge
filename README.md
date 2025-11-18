# Game Session Manager

A real-time multiplayer game session manager built with FastAPI backend and native HTML/CSS/JavaScript frontend. Allows two players to create and join game sessions with unique session IDs.

## Features

- 🎮 Create new game sessions with unique session IDs
- 👥 Join existing sessions (max 2 players per session)
- 🔄 Real-time updates using WebSockets
- 📋 Copy session ID to clipboard
- 🎯 Player lobby with status indicators
- 🚀 Fast and responsive native UI

## Tech Stack

**Backend:**
- Python 3.8+
- FastAPI
- WebSockets
- Uvicorn

**Frontend:**
- Native HTML5
- CSS3 (with animations)
- Vanilla JavaScript
- WebSocket API

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the FastAPI server:
```bash
python main.py
```

The backend will start on `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Open `index.html` in your browser, or use a simple HTTP server:
```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve
```

3. Access the frontend at `http://localhost:8080` (or your chosen port)

## Usage

### Creating a Session

1. Click "Create New Session"
2. Enter your name
3. Click "Create Session"
4. Share the generated Session ID with your friend

### Joining a Session

1. Click "Join Existing Session"
2. Enter the Session ID provided by your friend
3. Enter your name
4. Click "Join Session"

### Game Lobby

- View connected players (max 2)
- See session status (Waiting/Ready/In Progress)
- Copy session ID to share
- Start game when both players are connected
- Leave session anytime

## API Endpoints

### REST API

- `GET /` - API health check
- `POST /sessions/create` - Create a new game session
- `GET /sessions/{session_id}` - Get session details
- `GET /sessions` - List all active sessions

### WebSocket

- `WS /ws/{session_id}/{player_name}` - Connect to a game session

## Project Structure

```
AI-coding-challenge/
├── backend/
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── index.html        # Main HTML page
│   ├── styles.css        # Styling
│   └── script.js         # JavaScript logic
└── README.md            # This file
```

## Features in Detail

### Session Management
- Unique 8-character session IDs
- Maximum 2 players per session
- Automatic session cleanup when empty
- Real-time player join/leave notifications

### WebSocket Events
- `player_joined` - New player joins the session
- `player_left` - Player leaves the session
- `game_started` - Game begins
- `game_move` - Player makes a move (extensible)
- `chat` - Chat messages (extensible)

## Future Enhancements

- Add actual game implementation
- Session expiration
- Player authentication
- Chat functionality
- Game history
- Spectator mode
- Mobile app version

## License

MIT License

## Contributing

Feel free to submit issues and enhancement requests!