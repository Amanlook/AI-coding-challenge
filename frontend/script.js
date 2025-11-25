/**
 * 4-Digit Number Guessing Game
 * Frontend JavaScript Controller
 */

// ===========================================
// CONFIGURATION
// ===========================================
const CONFIG = {
    API_URL: 'http://localhost:8000',
    WS_URL: 'ws://localhost:8000',
    DIGIT_COUNT: 4,
    COPY_FEEDBACK_DURATION: 2000,
};

// ===========================================
// GAME STATE
// ===========================================
const GameState = {
    currentSession: null,
    websocket: null,
    playerName: '',
    playerId: '',
    mySecretNumber: '',
    isMyTurn: false,
    
    reset() {
        this.currentSession = null;
        this.playerName = '';
        this.playerId = '';
        this.mySecretNumber = '';
        this.isMyTurn = false;
    }
};

// ===========================================
// DOM ELEMENTS (cached for performance)
// ===========================================
const DOM = {
    // Screens
    screens: {
        welcome: () => document.getElementById('welcomeScreen'),
        create: () => document.getElementById('createScreen'),
        join: () => document.getElementById('joinScreen'),
        lobby: () => document.getElementById('lobbyScreen'),
        numberSelection: () => document.getElementById('numberSelectionScreen'),
        game: () => document.getElementById('gameScreen'),
        winner: () => document.getElementById('winnerScreen'),
    },
    
    // Inputs
    inputs: {
        createPlayerName: () => document.getElementById('createPlayerName'),
        sessionId: () => document.getElementById('sessionId'),
        joinPlayerName: () => document.getElementById('joinPlayerName'),
        digits: () => ['digit1', 'digit2', 'digit3', 'digit4'].map(id => document.getElementById(id)),
        guessDigits: () => ['guess1', 'guess2', 'guess3', 'guess4'].map(id => document.getElementById(id)),
    },
    
    // Displays
    displays: {
        lobbySessionId: () => document.getElementById('lobbySessionId'),
        lobbyStatus: () => document.getElementById('lobbyStatus'),
        playerCount: () => document.getElementById('playerCount'),
        playersList: () => document.getElementById('playersList'),
        waitingMessage: () => document.getElementById('waitingMessage'),
        waitingForOpponent: () => document.getElementById('waitingForOpponent'),
        readyToPlayBtn: () => document.getElementById('readyToPlayBtn'),
        gameSessionId: () => document.getElementById('gameSessionId'),
        turnIndicator: () => document.getElementById('turnIndicator'),
        turnText: () => document.getElementById('turnText'),
        guessInputSection: () => document.getElementById('guessInputSection'),
        yourGuesses: () => document.getElementById('yourGuesses'),
        opponentGuesses: () => document.getElementById('opponentGuesses'),
        yourGuessCount: () => document.getElementById('yourGuessCount'),
        opponentGuessCount: () => document.getElementById('opponentGuessCount'),
        winnerTitle: () => document.getElementById('winnerTitle'),
        winnerMessage: () => document.getElementById('winnerMessage'),
        finalStats: () => document.getElementById('finalStats'),
    },
    
    // Error elements
    errors: {
        create: () => document.getElementById('createError'),
        join: () => document.getElementById('joinError'),
        lobby: () => document.getElementById('lobbyError'),
        number: () => document.getElementById('numberError'),
        game: () => document.getElementById('gameError'),
    }
};

// ===========================================
// SCREEN NAVIGATION
// ===========================================
const Navigation = {
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId)?.classList.add('active');
    },
    
    showWelcome() {
        this.showScreen('welcomeScreen');
        ErrorHandler.clearAll();
        resetGame();
    },
    
    showCreateSession() {
        this.showScreen('createScreen');
        DOM.inputs.createPlayerName().value = '';
        ErrorHandler.clear('create');
    },
    
    showJoinSession() {
        this.showScreen('joinScreen');
        DOM.inputs.sessionId().value = '';
        DOM.inputs.joinPlayerName().value = '';
        ErrorHandler.clear('join');
    },
    
    showNumberSelection() {
        this.showScreen('numberSelectionScreen');
        InputUtils.clearDigits(DOM.inputs.digits());
        ErrorHandler.clear('number');
    }
};

// Global navigation functions (for onclick handlers)
const showWelcome = () => Navigation.showWelcome();
const showCreateSession = () => Navigation.showCreateSession();
const showJoinSession = () => Navigation.showJoinSession();
const showNumberSelection = () => Navigation.showNumberSelection();
const showScreen = (id) => Navigation.showScreen(id);

// ===========================================
// ERROR HANDLING
// ===========================================
const ErrorHandler = {
    show(type, message) {
        const element = DOM.errors[type]?.();
        if (element) {
            element.textContent = message;
            element.classList.add('show');
        }
    },
    
    clear(type) {
        const element = DOM.errors[type]?.();
        if (element) {
            element.textContent = '';
            element.classList.remove('show');
        }
    },
    
    clearAll() {
        Object.keys(DOM.errors).forEach(type => this.clear(type));
    }
};

// Legacy function mappings
const showError = (elementId, message) => {
    const type = elementId.replace('Error', '');
    ErrorHandler.show(type, message);
};
const clearError = (elementId) => {
    const type = elementId.replace('Error', '');
    ErrorHandler.clear(type);
};
const clearAllErrors = () => ErrorHandler.clearAll();

// ===========================================
// INPUT UTILITIES
// ===========================================
const InputUtils = {
    clearDigits(inputs) {
        inputs.forEach(input => {
            if (input) input.value = '';
        });
        if (inputs[0]) inputs[0].focus();
    },
    
    getDigitValue(inputs) {
        return inputs.map(input => input?.value || '').join('');
    },
    
    validateUniqueDigits(value) {
        return value.length === CONFIG.DIGIT_COUNT && 
               new Set(value).size === CONFIG.DIGIT_COUNT;
    }
};

// Legacy helper functions
const clearDigitInputs = (inputIds) => {
    const inputs = inputIds.map(id => document.getElementById(id));
    InputUtils.clearDigits(inputs);
};

const getDigitValue = (inputIds) => {
    const inputs = inputIds.map(id => document.getElementById(id));
    return InputUtils.getDigitValue(inputs);
};

function moveToNext(current, nextId) {
    if (current.value.length === 1) {
        const nextInput = document.getElementById(nextId);
        if (nextInput) nextInput.focus();
    }
}

// ===========================================
// SESSION MANAGEMENT
// ===========================================
const SessionManager = {
    async create() {
        const nameInput = DOM.inputs.createPlayerName();
        const name = nameInput.value.trim();
        
        if (!name) {
            ErrorHandler.show('create', 'Please enter your name');
            return;
        }
        
        GameState.playerName = name;
        
        try {
            const response = await fetch(`${CONFIG.API_URL}/sessions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) throw new Error('Failed to create session');
            
            const data = await response.json();
            GameState.currentSession = data.session_id;
            
            await WebSocketManager.connect(data.session_id, name);
        } catch (error) {
            ErrorHandler.show('create', 'Failed to create session. Please try again.');
            console.error('Error creating session:', error);
        }
    },
    
    async join() {
        const sessionId = DOM.inputs.sessionId().value.trim();
        const name = DOM.inputs.joinPlayerName().value.trim();
        
        if (!sessionId) {
            ErrorHandler.show('join', 'Please enter a session ID');
            return;
        }
        
        if (!name) {
            ErrorHandler.show('join', 'Please enter your name');
            return;
        }
        
        GameState.playerName = name;
        
        try {
            const response = await fetch(`${CONFIG.API_URL}/sessions/${sessionId}`);
            
            if (!response.ok) throw new Error('Session not found');
            
            const sessionData = await response.json();
            
            if (sessionData.players.length >= sessionData.max_players) {
                ErrorHandler.show('join', 'Session is full');
                return;
            }
            
            GameState.currentSession = sessionId;
            await WebSocketManager.connect(sessionId, name);
        } catch (error) {
            ErrorHandler.show('join', 'Failed to join session. Please check the session ID.');
            console.error('Error joining session:', error);
        }
    },
    
    leave() {
        WebSocketManager.disconnect();
        resetGame();
        Navigation.showWelcome();
    }
};

// Global functions for onclick handlers
const createSession = () => SessionManager.create();
const joinSession = () => SessionManager.join();
const leaveSession = () => SessionManager.leave();

// ===========================================
// WEBSOCKET MANAGEMENT
// ===========================================
const WebSocketManager = {
    async connect(sessionId, playerName) {
        const wsUrl = `${CONFIG.WS_URL}/ws/${sessionId}/${encodeURIComponent(playerName)}`;
        
        GameState.websocket = new WebSocket(wsUrl);
        
        GameState.websocket.onopen = () => {
            console.log('WebSocket connected');
            Navigation.showScreen('lobbyScreen');
            LobbyManager.updateInfo(sessionId);
        };
        
        GameState.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            MessageHandler.handle(message);
        };
        
        GameState.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            ErrorHandler.show('lobby', 'Connection error');
        };
        
        GameState.websocket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            if (event.code === 4003) {
                ErrorHandler.show('join', 'Session is full');
                Navigation.showWelcome();
            } else if (event.code === 4004) {
                ErrorHandler.show('join', 'Session not found');
                Navigation.showWelcome();
            }
        };
    },
    
    disconnect() {
        if (GameState.websocket) {
            GameState.websocket.close();
            GameState.websocket = null;
        }
    },
    
    send(data) {
        if (GameState.websocket?.readyState === WebSocket.OPEN) {
            GameState.websocket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }
};

async function connectWebSocket(sessionId, playerName) {
    return WebSocketManager.connect(sessionId, playerName);
}

// ===========================================
// MESSAGE HANDLER
// ===========================================
const MessageHandler = {
    handle(message) {
        console.log('Received message:', message);
        
        const handlers = {
            'player_joined': () => this.handlePlayerJoined(message),
            'player_left': () => this.handlePlayerLeft(message),
            'number_locked': () => this.handleNumberLocked(message),
            'guess_made': () => this.handleGuessMade(message),
            'error': () => this.handleError(message),
        };
        
        const handler = handlers[message.type];
        if (handler) handler();
    },
    
    handlePlayerJoined(message) {
        if (message.player_id && !GameState.playerId) {
            GameState.playerId = message.player_id;
        }
        LobbyManager.updatePlayers(message.session.players);
        LobbyManager.updateStatus(message.session.status);
        LobbyManager.updatePlayerCount(message.session.players.length);
    },
    
    handlePlayerLeft(message) {
        LobbyManager.updatePlayers(message.session.players);
        LobbyManager.updateStatus(message.session.status);
        LobbyManager.updatePlayerCount(message.session.players.length);
    },
    
    handleNumberLocked(message) {
        if (message.player_id === GameState.playerId) {
            DOM.displays.waitingForOpponent().style.display = 'block';
        }
        LobbyManager.updatePlayers(message.session.players);
        
        if (message.session.status === 'in_progress') {
            GameManager.start(message.session);
        }
    },
    
    handleGuessMade(message) {
        GameManager.handleGuessResult(message.guess, message.session);
    },
    
    handleError(message) {
        const currentScreen = document.querySelector('.screen.active')?.id;
        if (currentScreen === 'numberSelectionScreen') {
            ErrorHandler.show('number', message.message);
        } else if (currentScreen === 'gameScreen') {
            ErrorHandler.show('game', message.message);
        }
    }
};

// ===========================================
// LOBBY MANAGER
// ===========================================
const LobbyManager = {
    updateInfo(sessionId) {
        document.getElementById('lobbySessionId').textContent = sessionId;
    },
    
    updatePlayers(players) {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerItem = this.createPlayerItem(player, index);
            playersList.appendChild(playerItem);
        });
        
        this.updateWaitingState(players.length);
    },
    
    createPlayerItem(player, index) {
        const isCurrentPlayer = player.id === GameState.playerId;
        
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        playerItem.innerHTML = `
            <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
            <div class="player-info">
                <div class="player-name">${player.name}${isCurrentPlayer ? ' (You)' : ''}</div>
                <div class="player-status">${player.is_ready ? '✓ Ready' : `Player ${index + 1}`}</div>
            </div>
        `;
        
        return playerItem;
    },
    
    updateWaitingState(playerCount) {
        const waitingMessage = document.getElementById('waitingMessage');
        const readyBtn = document.getElementById('readyToPlayBtn');
        
        if (playerCount < 2) {
            waitingMessage.classList.remove('hidden');
            readyBtn.disabled = true;
        } else {
            waitingMessage.classList.add('hidden');
            readyBtn.disabled = false;
        }
    },
    
    updateStatus(status) {
        const statusElement = document.getElementById('lobbyStatus');
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
        statusElement.className = 'status-badge ' + status.toLowerCase().replace('_', '-');
    },
    
    updatePlayerCount(count) {
        document.getElementById('playerCount').textContent = count;
    }
};

function copySessionId() {
    const sessionId = document.getElementById('lobbySessionId').textContent;
    navigator.clipboard.writeText(sessionId).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, CONFIG.COPY_FEEDBACK_DURATION);
    });
}

// ===========================================
// NUMBER SELECTION
// ===========================================
function lockNumber() {
    const number = getDigitValue(['digit1', 'digit2', 'digit3', 'digit4']);
    
    if (number.length !== CONFIG.DIGIT_COUNT) {
        ErrorHandler.show('number', 'Please enter all 4 digits');
        return;
    }
    
    if (!InputUtils.validateUniqueDigits(number)) {
        ErrorHandler.show('number', 'All digits must be different!');
        return;
    }
    
    GameState.mySecretNumber = number;
    WebSocketManager.send({ type: 'lock_number', number });
}

// ===========================================
// GAME MANAGER
// ===========================================
const GameManager = {
    start(session) {
        Navigation.showScreen('gameScreen');
        document.getElementById('gameSessionId').textContent = GameState.currentSession;
        
        // Reset game display
        document.getElementById('yourGuesses').innerHTML = '';
        document.getElementById('opponentGuesses').innerHTML = '';
        document.getElementById('yourGuessCount').textContent = '0';
        document.getElementById('opponentGuessCount').textContent = '0';
        
        this.updateTurn(session.current_turn);
    },
    
    updateTurn(currentTurnPlayerId) {
        GameState.isMyTurn = (currentTurnPlayerId === GameState.playerId);
        
        const turnIndicator = document.getElementById('turnIndicator');
        const turnText = document.getElementById('turnText');
        const guessInputSection = document.getElementById('guessInputSection');
        
        if (GameState.isMyTurn) {
            turnIndicator.className = 'turn-indicator your-turn';
            turnText.textContent = '🎯 Your Turn! Make a guess';
            guessInputSection.classList.remove('disabled');
        } else {
            turnIndicator.className = 'turn-indicator opponent-turn';
            turnText.textContent = "⏳ Opponent's Turn";
            guessInputSection.classList.add('disabled');
        }
    },
    
    handleGuessResult(guess, session) {
        const isMyGuess = guess.player_id === GameState.playerId;
        const list = document.getElementById(isMyGuess ? 'yourGuesses' : 'opponentGuesses');
        
        const guessItem = this.createGuessItem(guess);
        list.insertBefore(guessItem, list.firstChild);
        
        this.updateGuessCounts();
        
        if (session.status === 'completed' && session.winner) {
            this.showWinner(session.winner, session.guesses);
        } else {
            this.updateTurn(session.current_turn);
        }
    },
    
    createGuessItem(guess) {
        const guessItem = document.createElement('div');
        guessItem.className = 'guess-item';
        
        guessItem.innerHTML = `
            <div class="guess-number">${guess.guess}</div>
            <div class="guess-feedback">
                <div class="feedback-item">
                    <span class="feedback-label">Correct Digits</span>
                    <span class="feedback-value correct">${guess.correct_digits}</span>
                </div>
                <div class="feedback-item">
                    <span class="feedback-label">Correct Positions</span>
                    <span class="feedback-value positions">${guess.correct_positions}</span>
                </div>
            </div>
        `;
        
        return guessItem;
    },
    
    updateGuessCounts() {
        const yourCount = document.querySelectorAll('#yourGuesses .guess-item').length;
        const opponentCount = document.querySelectorAll('#opponentGuesses .guess-item').length;
        document.getElementById('yourGuessCount').textContent = yourCount;
        document.getElementById('opponentGuessCount').textContent = opponentCount;
    },
    
    showWinner(winnerId, allGuesses) {
        Navigation.showScreen('winnerScreen');
        
        const isWinner = winnerId === GameState.playerId;
        const winnerTitle = document.getElementById('winnerTitle');
        const winnerMessage = document.getElementById('winnerMessage');
        const finalStats = document.getElementById('finalStats');
        
        if (isWinner) {
            winnerTitle.textContent = '🏆 YOU WIN! 🏆';
            winnerMessage.textContent = 'Congratulations! You guessed the number!';
        } else {
            winnerTitle.textContent = '😔 You Lost';
            winnerMessage.textContent = 'Better luck next time!';
        }
        
        const myGuesses = allGuesses.filter(g => g.player_id === GameState.playerId).length;
        const opponentGuesses = allGuesses.filter(g => g.player_id !== GameState.playerId).length;
        
        finalStats.innerHTML = `
            <p><strong>Your Secret Number:</strong> ${GameState.mySecretNumber}</p>
            <p><strong>Your Guesses:</strong> ${myGuesses}</p>
            <p><strong>Opponent's Guesses:</strong> ${opponentGuesses}</p>
        `;
    }
};

function makeGuess() {
    if (!GameState.isMyTurn) {
        ErrorHandler.show('game', "It's not your turn!");
        return;
    }
    
    const guess = getDigitValue(['guess1', 'guess2', 'guess3', 'guess4']);
    
    if (guess.length !== CONFIG.DIGIT_COUNT) {
        ErrorHandler.show('game', 'Please enter all 4 digits');
        return;
    }
    
    if (!InputUtils.validateUniqueDigits(guess)) {
        ErrorHandler.show('game', 'All digits must be different!');
        return;
    }
    
    ErrorHandler.clear('game');
    
    if (WebSocketManager.send({ type: 'make_guess', guess })) {
        clearDigitInputs(['guess1', 'guess2', 'guess3', 'guess4']);
    }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================
function resetGame() {
    GameState.reset();
}

// ===========================================
// EVENT LISTENERS
// ===========================================
window.addEventListener('beforeunload', () => {
    WebSocketManager.disconnect();
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('createPlayerName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createSession();
    });

    document.getElementById('joinPlayerName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinSession();
    });
});
