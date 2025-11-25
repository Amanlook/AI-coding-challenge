"""Core game logic for number validation and guess evaluation."""

from config import SECRET_NUMBER_LENGTH


def validate_number(number: str) -> bool:
    """
    Validate that a number is valid for the game.
    
    Args:
        number: The number string to validate
        
    Returns:
        True if valid (4 unique digits), False otherwise
    """
    if not number or len(number) != SECRET_NUMBER_LENGTH:
        return False
    if not number.isdigit():
        return False
    if len(set(number)) != SECRET_NUMBER_LENGTH:
        return False
    return True


def evaluate_guess(guess: str, secret: str) -> tuple[int, int]:
    """
    Evaluate a guess against the secret number.
    
    Args:
        guess: The guessed number
        secret: The secret number to compare against
        
    Returns:
        Tuple of (correct_digits, correct_positions)
        - correct_digits: Count of digits that exist in secret
        - correct_positions: Count of digits in correct position
    """
    correct_positions = sum(
        1 for i in range(SECRET_NUMBER_LENGTH) 
        if guess[i] == secret[i]
    )
    correct_digits = len(set(guess) & set(secret))
    
    return correct_digits, correct_positions


def is_winning_guess(correct_positions: int) -> bool:
    """Check if the guess is a winning guess."""
    return correct_positions == SECRET_NUMBER_LENGTH
