// Configuration
const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

// State
let currentSession = null;
let websocket = null;
let playerName = '';
let playerId = '';
let mySecretNumber = '';
let isMyTurn = false;

// Screen Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showWelcome() {
    showScreen('welcomeScreen');
    clearAllErrors();
    resetGame();
}

function showCreateSession() {
    showScreen('createScreen');
    document.getElementById('createPlayerName').value = '';
    clearError('createError');
}

function showJoinSession() {
    showScreen('joinScreen');
    document.getElementById('sessionId').value = '';
    document.getElementById('joinPlayerName').value = '';
    clearError('joinError');
}

function showNumberSelection() {
    showScreen('numberSelectionScreen');
    clearDigitInputs(['digit1', 'digit2', 'digit3', 'digit4']);
    clearError('numberError');
}

// Error Handling
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = '';
    errorElement.classList.remove('show');
}

function clearAllErrors() {
    ['createError', 'joinError', 'lobbyError', 'numberError', 'gameError'].forEach(clearError);
}

// Helper Functions
function clearDigitInputs(inputIds) {
    inputIds.forEach(id => {
        document.getElementById(id).value = '';
    });
    if (inputIds.length > 0) {
        document.getElementById(inputIds[0]).focus();
    }
}

function moveToNext(current, nextId) {
    if (current.value.length === 1) {
        const nextInput = document.getElementById(nextId);
        if (nextInput) {
            nextInput.focus();
        }
    }
}

function getDigitValue(inputIds) {
    return inputIds.map(id => document.getElementById(id).value).join('');
}

// Session Management
async function createSession() {
    const playerNameInput = document.getElementById('createPlayerName').value.trim();
    
    if (!playerNameInput) {
        showError('createError', 'Please enter your name');
        return;
    }
    
    playerName = playerNameInput;
    
    try {
        const response = await fetch(`${API_URL}/sessions/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to create session');
        }
        
        const data = await response.json();
        currentSession = data.session_id;
        
        // Connect to WebSocket
        await connectWebSocket(data.session_id, playerName);
        
    } catch (error) {
        showError('createError', 'Failed to create session. Please try again.');
        console.error('Error creating session:', error);
    }
}

async function joinSession() {
    const sessionId = document.getElementById('sessionId').value.trim();
    const playerNameInput = document.getElementById('joinPlayerName').value.trim();
    
    if (!sessionId) {
        showError('joinError', 'Please enter a session ID');
        return;
    }
    
    if (!playerNameInput) {
        showError('joinError', 'Please enter your name');
        return;
    }
    
    playerName = playerNameInput;
    
    try {
        // Check if session exists
        const response = await fetch(`${API_URL}/sessions/${sessionId}`);
        
        if (!response.ok) {
            throw new Error('Session not found');
        }
        
        const sessionData = await response.json();
        
        if (sessionData.players.length >= sessionData.max_players) {
            showError('joinError', 'Session is full');
            return;
        }
        
        currentSession = sessionId;
        
        // Connect to WebSocket
        await connectWebSocket(sessionId, playerName);
        
    } catch (error) {
        showError('joinError', 'Failed to join session. Please check the session ID.');
        console.error('Error joining session:', error);
    }
}

async function connectWebSocket(sessionId, playerName) {
    const wsUrl = `${WS_URL}/ws/${sessionId}/${encodeURIComponent(playerName)}`;
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
        console.log('WebSocket connected');
        showScreen('lobbyScreen');
        updateLobbyInfo(sessionId);
    };
    
    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        showError('lobbyError', 'Connection error');
    };
    
    websocket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code === 4003) {
            showError('joinError', 'Session is full');
            showWelcome();
        } else if (event.code === 4004) {
            showError('joinError', 'Session not found');
            showWelcome();
        }
    };
}

function handleWebSocketMessage(message) {
    console.log('Received message:', message);
    
    switch (message.type) {
        case 'player_joined':
            // Set player ID when joining
            if (message.player_id && !playerId) {
                playerId = message.player_id;
            }
            updatePlayers(message.session.players);
            updateStatus(message.session.status);
            updatePlayerCount(message.session.players.length);
            break;
            
        case 'player_left':
            updatePlayers(message.session.players);
            updateStatus(message.session.status);
            updatePlayerCount(message.session.players.length);
            break;
            
        case 'number_locked':
            if (message.player_id === playerId) {
                // My number was locked successfully
                document.getElementById('waitingForOpponent').style.display = 'block';
            }
            updatePlayersReady(message.session.players);
            
            if (message.session.status === 'in_progress') {
                // Both players ready, start game
                startGamePlay(message.session);
            }
            break;
            
        case 'guess_made':
            handleGuessResult(message.guess, message.session);
            break;
            
        case 'error':
            const currentScreen = document.querySelector('.screen.active').id;
            if (currentScreen === 'numberSelectionScreen') {
                showError('numberError', message.message);
            } else if (currentScreen === 'gameScreen') {
                showError('gameError', message.message);
            }
            break;
    }
}

function updateLobbyInfo(sessionId) {
    document.getElementById('lobbySessionId').textContent = sessionId;
}

function updatePlayers(players) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    players.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.textContent = player.name.charAt(0).toUpperCase();
        
        const info = document.createElement('div');
        info.className = 'player-info';
        
        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.name + (player.id === playerId ? ' (You)' : '');
        
        const status = document.createElement('div');
        status.className = 'player-status';
        status.textContent = player.is_ready ? '✓ Ready' : `Player ${index + 1}`;
        
        info.appendChild(name);
        info.appendChild(status);
        playerItem.appendChild(avatar);
        playerItem.appendChild(info);
        playersList.appendChild(playerItem);
    });
    
    // Show/hide waiting message
    const waitingMessage = document.getElementById('waitingMessage');
    const readyBtn = document.getElementById('readyToPlayBtn');
    
    if (players.length < 2) {
        waitingMessage.classList.remove('hidden');
        readyBtn.disabled = true;
    } else {
        waitingMessage.classList.add('hidden');
        readyBtn.disabled = false;
    }
}

function updatePlayersReady(players) {
    updatePlayers(players);
}

function updateStatus(status) {
    const statusElement = document.getElementById('lobbyStatus');
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    statusElement.className = 'status-badge ' + status.toLowerCase().replace('_', '-');
}

function updatePlayerCount(count) {
    document.getElementById('playerCount').textContent = count;
}

function copySessionId() {
    const sessionId = document.getElementById('lobbySessionId').textContent;
    navigator.clipboard.writeText(sessionId).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

// Number Selection
function lockNumber() {
    const number = getDigitValue(['digit1', 'digit2', 'digit3', 'digit4']);
    
    if (number.length !== 4) {
        showError('numberError', 'Please enter all 4 digits');
        return;
    }
    
    // Check for unique digits
    if (new Set(number).size !== 4) {
        showError('numberError', 'All digits must be different!');
        return;
    }
    
    mySecretNumber = number;
    
    // Send to server
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'lock_number',
            number: number
        }));
    }
}

// Game Play
function startGamePlay(session) {
    showScreen('gameScreen');
    document.getElementById('gameSessionId').textContent = currentSession;
    
    // Reset game display
    document.getElementById('yourGuesses').innerHTML = '';
    document.getElementById('opponentGuesses').innerHTML = '';
    document.getElementById('yourGuessCount').textContent = '0';
    document.getElementById('opponentGuessCount').textContent = '0';
    
    // Update turn
    updateTurn(session.current_turn);
}

function updateTurn(currentTurnPlayerId) {
    isMyTurn = (currentTurnPlayerId === playerId);
    
    const turnIndicator = document.getElementById('turnIndicator');
    const turnText = document.getElementById('turnText');
    const guessInputSection = document.getElementById('guessInputSection');
    
    if (isMyTurn) {
        turnIndicator.className = 'turn-indicator your-turn';
        turnText.textContent = '🎯 Your Turn! Make a guess';
        guessInputSection.classList.remove('disabled');
    } else {
        turnIndicator.className = 'turn-indicator opponent-turn';
        turnText.textContent = '⏳ Opponent\'s Turn';
        guessInputSection.classList.add('disabled');
    }
}

function makeGuess() {
    if (!isMyTurn) {
        showError('gameError', 'It\'s not your turn!');
        return;
    }
    
    const guess = getDigitValue(['guess1', 'guess2', 'guess3', 'guess4']);
    
    if (guess.length !== 4) {
        showError('gameError', 'Please enter all 4 digits');
        return;
    }
    
    // Check for unique digits
    if (new Set(guess).size !== 4) {
        showError('gameError', 'All digits must be different!');
        return;
    }
    
    clearError('gameError');
    
    // Send guess to server
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'make_guess',
            guess: guess
        }));
        
        // Clear input
        clearDigitInputs(['guess1', 'guess2', 'guess3', 'guess4']);
    }
}

function handleGuessResult(guess, session) {
    // Add guess to appropriate list
    const isMyGuess = guess.player_id === playerId;
    const listId = isMyGuess ? 'yourGuesses' : 'opponentGuesses';
    const list = document.getElementById(listId);
    
    const guessItem = document.createElement('div');
    guessItem.className = 'guess-item';
    
    const guessNumber = document.createElement('div');
    guessNumber.className = 'guess-number';
    guessNumber.textContent = guess.guess;
    
    const feedback = document.createElement('div');
    feedback.className = 'guess-feedback';
    
    const correctDigits = document.createElement('div');
    correctDigits.className = 'feedback-item';
    correctDigits.innerHTML = `
        <span class="feedback-label">Correct Digits</span>
        <span class="feedback-value correct">${guess.correct_digits}</span>
    `;
    
    const correctPositions = document.createElement('div');
    correctPositions.className = 'feedback-item';
    correctPositions.innerHTML = `
        <span class="feedback-label">Correct Positions</span>
        <span class="feedback-value positions">${guess.correct_positions}</span>
    `;
    
    feedback.appendChild(correctDigits);
    feedback.appendChild(correctPositions);
    
    guessItem.appendChild(guessNumber);
    guessItem.appendChild(feedback);
    
    // Add to top of list
    list.insertBefore(guessItem, list.firstChild);
    
    // Update counts
    const yourCount = document.querySelectorAll('#yourGuesses .guess-item').length;
    const opponentCount = document.querySelectorAll('#opponentGuesses .guess-item').length;
    document.getElementById('yourGuessCount').textContent = yourCount;
    document.getElementById('opponentGuessCount').textContent = opponentCount;
    
    // Check for winner
    if (session.status === 'completed' && session.winner) {
        showWinner(session.winner, session.guesses);
    } else {
        // Update turn
        updateTurn(session.current_turn);
    }
}

function showWinner(winnerId, allGuesses) {
    showScreen('winnerScreen');
    
    const isWinner = winnerId === playerId;
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
    
    // Show stats
    const myGuesses = allGuesses.filter(g => g.player_id === playerId).length;
    const opponentGuesses = allGuesses.filter(g => g.player_id !== playerId).length;
    
    finalStats.innerHTML = `
        <p><strong>Your Secret Number:</strong> ${mySecretNumber}</p>
        <p><strong>Your Guesses:</strong> ${myGuesses}</p>
        <p><strong>Opponent's Guesses:</strong> ${opponentGuesses}</p>
    `;
}

function leaveSession() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    resetGame();
    showWelcome();
}

function resetGame() {
    currentSession = null;
    playerName = '';
    playerId = '';
    mySecretNumber = '';
    isMyTurn = false;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
});

// Auto-focus on first input when screens load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('createPlayerName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createSession();
    });

    document.getElementById('joinPlayerName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinSession();
    });
});
