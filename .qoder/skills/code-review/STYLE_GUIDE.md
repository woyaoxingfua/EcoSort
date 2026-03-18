# Code Style Guide

## General Principles

### SOLID Principles
- **S**ingle Responsibility: One class/function = one purpose
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes must be substitutable
- **I**nterface Segregation: Many specific interfaces > one general
- **D**ependency Inversion: Depend on abstractions, not concretions

### DRY Principle
Don't Repeat Yourself - extract common code into reusable functions

### KISS Principle
Keep It Simple, Stupid - prefer simple solutions over clever ones

## Naming Conventions

### Variables
```python
# Good
user_count = 0
is_authenticated = True
customer_email = "user@example.com"

# Bad
x = 0
flag = True
ce = "user@example.com"
```

### Functions
```python
# Good - verb phrase, descriptive
def calculate_total_price(items):
    pass

def send_email_notification(user, message):
    pass

# Bad - vague, not descriptive
def process(data):
    pass

def handle(items):
    pass
```

### Classes
```python
# Good - noun, PascalCase
class UserAccount:
    pass

class EmailService:
    pass

# Bad - verb, vague
class UserManager:
    pass

class Helper:
    pass
```

### Constants
```python
# Good - SCREAMING_SNAKE_CASE
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT_SECONDS = 30
API_BASE_URL = "https://api.example.com"
```

## Function Design

### Size
- **Ideal**: < 20 lines
- **Acceptable**: < 50 lines
- **Refactor**: > 50 lines

### Parameters
- **Ideal**: 1-3 parameters
- **Acceptable**: 4-5 parameters
- **Refactor**: > 5 parameters (use object/config)

```python
# Bad - too many parameters
def create_user(name, email, age, address, phone, country, timezone):
    pass

# Good - use config object
def create_user(user_config):
    pass
```

### Return Values
- Return early for edge cases
- Single return at the end for happy path
- Return meaningful values (not None for errors)

```python
# Good - early returns
def get_user(user_id):
    if user_id is None:
        return None

    user = database.find(user_id)
    if user is None:
        return None

    return user
```

## Code Organization

### Nesting Depth
- **Ideal**: 1-2 levels
- **Acceptable**: 3 levels
- **Refactor**: > 3 levels

```python
# Bad - deeply nested
def process_data(data):
    if data:
        if data.valid:
            for item in data.items:
                if item.active:
                    # do something
                    pass

# Good - early returns
def process_data(data):
    if not data or not data.valid:
        return

    for item in data.items:
        if not item.active:
            continue
        # do something
```

### File Organization
```python
# Standard order:
# 1. Module docstring
# 2. Imports
# 3. Constants
# 4. Classes
# 5. Functions
# 6. Main execution

"""
Module for user authentication.
"""

import os
import hashlib
from typing import Optional

# Constants
MAX_LOGIN_ATTEMPTS = 3
TOKEN_EXPIRY_HOURS = 24

# Classes
class AuthService:
    pass

# Functions
def authenticate(username: str, password: str) -> Optional[str]:
    pass

# Main
if __name__ == "__main__":
    main()
```

## Comments

### When to Comment
- **DO**: Explain "why" something is done
- **DO**: Document public APIs
- **DO**: Explain complex algorithms
- **DON'T**: Explain "what" code does (should be obvious)

```python
# Bad - explains what
# Loop through users
for user in users:
    pass

# Good - explains why
# Filter out inactive users to prevent sending emails to closed accounts
active_users = [u for u in users if u.is_active]
```

### TODO Comments
```python
# TODO(username): Description of what needs to be done
# FIXME(username): Description of the bug
# HACK(username): Why this is a temporary solution
```

## Error Handling

### Exceptions vs Return Values
- Use exceptions for **exceptional** cases
- Use return values for **expected** cases

```python
# Good - exception for unexpected
def read_file(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        raise FileNotFoundError(f"Config file not found: {path}")

# Good - return value for expected
def find_user(user_id):
    return database.get(user_id)  # Returns None if not found
```

### Error Messages
- Be specific
- Include relevant context
- Suggest solution if possible

```python
# Bad
raise ValueError("Invalid input")

# Good
raise ValueError(f"Email '{email}' is invalid. Expected format: user@domain.com")
```

## Testing Style

### Test Names
```python
# Good - describes scenario and expected outcome
def test_login_fails_with_incorrect_password():
    pass

def test_user_cannot_access_admin_panel_without_permission():
    pass

# Bad - vague
def test_login():
    pass

def test_permissions():
    pass
```

### AAA Pattern
```python
def test_user_creation():
    # Arrange
    user_data = {"name": "John", "email": "john@example.com"}

    # Act
    user = create_user(user_data)

    # Assert
    assert user.name == "John"
    assert user.email == "john@example.com"
```
