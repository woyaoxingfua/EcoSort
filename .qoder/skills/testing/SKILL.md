---
name: testing
description: Assist with writing tests, running test suites, analyzing coverage, and debugging test failures. Use when the user needs help with unit tests, integration tests, test coverage, or fixing failing tests.
---

# Testing

## Quick Start

### Write Tests
```
1. Identify test type (unit/integration/e2e)
2. Follow AAA pattern (Arrange-Act-Assert)
3. Use descriptive test names
4. Test edge cases and error conditions
```

### Run Tests
```bash
# Python
pytest tests/ -v
pytest tests/ --cov=src --cov-report=html

# JavaScript
npm test
npm run test:coverage

# Java
mvn test
gradle test
```

## Test Types

### Unit Tests
Test individual functions/methods in isolation.

```python
# Good unit test
def test_calculate_discount_returns_zero_for_negative_price():
    # Arrange
    price = -100
    discount_percent = 10

    # Act
    result = calculate_discount(price, discount_percent)

    # Assert
    assert result == 0
```

### Integration Tests
Test how components work together.

```python
def test_user_registration_creates_account_and_sends_email():
    # Arrange
    user_data = {"email": "test@example.com", "password": "secure123"}

    # Act
    response = client.post("/api/register", json=user_data)

    # Assert
    assert response.status_code == 201
    assert User.query.filter_by(email=user_data["email"]).first() is not None
    assert len(mail.outbox) == 1
```

### End-to-End (E2E) Tests
Test complete user workflows.

```python
def test_user_can_complete_purchase(browser):
    # Arrange
    browser.visit("/login")

    # Act
    browser.fill("email", "user@example.com")
    browser.fill("password", "password123")
    browser.find_by_id("login-button").click()
    browser.visit("/products/1")
    browser.find_by_id("add-to-cart").click()
    browser.visit("/checkout")
    browser.find_by_id("complete-purchase").click()

    # Assert
    assert browser.is_text_present("Order confirmed")
```

## Test Naming Convention

### Pattern
```
test_<method>_<scenario>_<expected_result>
```

### Examples
```python
# Good - clear and descriptive
def test_login_succeeds_with_valid_credentials():
    pass

def test_login_fails_with_invalid_password():
    pass

def test_login_fails_with_nonexistent_user():
    pass

def test_login_fails_when_account_locked():
    pass

# Bad - vague
def test_login():
    pass

def test_login_1():
    pass
```

## AAA Pattern

Always structure tests with three sections:

```python
def test_withdraw_insufficient_funds():
    # Arrange - Set up test data
    account = Account(balance=100)
    withdrawal_amount = 150

    # Act - Execute the code under test
    result = account.withdraw(withdrawal_amount)

    # Assert - Verify the outcome
    assert result.success is False
    assert account.balance == 100
    assert "Insufficient funds" in result.message
```

## What to Test

### Test These
- Happy path (normal execution)
- Edge cases (boundaries, empty inputs)
- Error conditions (invalid inputs, failures)
- Security scenarios (unauthorized access)
- Performance requirements (if applicable)

### Example Test Cases
```python
class TestUserRegistration:
    def test_register_with_valid_data_succeeds(self):
        pass

    def test_register_with_existing_email_fails(self):
        pass

    def test_register_with_invalid_email_format_fails(self):
        pass

    def test_register_with_weak_password_fails(self):
        pass

    def test_register_with_missing_required_fields_fails(self):
        pass
```

## Test Coverage

### Run Coverage Analysis
```bash
# Python (pytest-cov)
pytest --cov=src --cov-report=html --cov-report=term

# JavaScript (Jest)
npm test -- --coverage

# Java (JaCoCo)
mvn jacoco:report
```

### Coverage Guidelines
- **Target**: 80%+ coverage
- **Focus**: Business logic and critical paths
- **Not needed**: Getters/setters, simple POJOs

### Coverage Report Analysis
```
---------- coverage: platform ----------
Name                      Stmts   Miss  Cover
---------------------------------------------
src/auth.py                  45      2    96%
src/user.py                  78     15    81%
src/payment.py              120     45    62%  <-- Needs more tests
---------------------------------------------
TOTAL                       243     62    74%
```

## Mocking

### When to Mock
- External APIs/services
- Database operations
- File system operations
- Time-dependent code

### Python Example (unittest.mock)
```python
from unittest.mock import Mock, patch

def test_send_notification_calls_email_service():
    # Arrange
    mock_email_service = Mock()
    mock_email_service.send.return_value = True
    notifier = Notifier(email_service=mock_email_service)

    # Act
    result = notifier.notify("user@example.com", "Hello")

    # Assert
    assert result is True
    mock_email_service.send.assert_called_once_with(
        to="user@example.com",
        subject="Notification",
        body="Hello"
    )
```

### JavaScript Example (Jest)
```javascript
jest.mock('../emailService');

test('sends notification via email service', async () => {
    const mockSend = jest.fn().mockResolvedValue(true);
    EmailService.send = mockSend;

    const notifier = new Notifier(EmailService);
    const result = await notifier.notify('user@test.com', 'Hello');

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledWith({
        to: 'user@test.com',
        body: 'Hello'
    });
});
```

## Fixtures

### Python (pytest)
```python
# conftest.py
import pytest

@pytest.fixture
def sample_user():
    return User(id=1, email="test@example.com", name="Test User")

@pytest.fixture
def authenticated_client(client, sample_user):
    client.force_login(sample_user)
    return client

# test_user.py
def test_get_user_profile(authenticated_client, sample_user):
    response = authenticated_client.get(f"/api/users/{sample_user.id}")
    assert response.status_code == 200
```

### JavaScript (Jest)
```javascript
// fixtures.js
export const sampleUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User'
};

// test.js
import { sampleUser } from './fixtures';

beforeEach(() => {
    // Reset state before each test
});

test('user has correct email', () => {
    expect(sampleUser.email).toBe('test@example.com');
});
```

## Debugging Failing Tests

### Step 1: Read the Error
```
FAILED tests/test_user.py::test_create_user - AssertionError: Expected 201, got 400
```

### Step 2: Run with Verbose Output
```bash
pytest tests/test_user.py::test_create_user -v -s
```

### Step 3: Add Debug Output
```python
def test_create_user():
    response = client.post("/api/users", json=user_data)
    print(f"Response: {response.json}")  # Debug output
    assert response.status_code == 201
```

### Step 4: Run Single Test
```bash
# Python
pytest tests/test_user.py::test_create_user -v

# JavaScript
npm test -- test/user.test.js -t "create user"
```

## Test Best Practices

### Do's
- Write tests before fixing bugs (TDD)
- Keep tests independent (no order dependency)
- Use factories instead of fixtures for complex data
- Test behavior, not implementation
- Clean up resources after tests

### Don'ts
- Don't test private methods directly
- Don't use production data in tests
- Don't create interdependent tests
- Don't skip tests without good reason
- Don't test third-party libraries

## Performance Testing

### Simple Timing Test
```python
import time

def test_api_response_time():
    start = time.time()
    response = client.get("/api/large-dataset")
    elapsed = time.time() - start

    assert response.status_code == 200
    assert elapsed < 2.0, f"API took {elapsed:.2f}s, expected < 2.0s"
```

### Load Testing (locust)
```python
from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 5)

    @task
    def load_homepage(self):
        self.client.get("/")

    @task(3)  # 3x more frequent
    def search_products(self):
        self.client.get("/search?q=laptop")
```
